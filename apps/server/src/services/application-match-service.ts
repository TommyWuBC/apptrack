/**
 * application.match orchestration. AGENTS.md §15 / M8
 * Pure scoring in @apptrack/core; this layer resolves entities + persists.
 */
import {
  domainOfAddress,
  inferRoleLevel,
  isAtsSenderDomain,
  matchApplication,
  MATCHER_VERSION,
  normalizeCompanyName,
  normalizeRoleTitle,
  resolveCompany,
  type MatchCandidateContext,
} from "@apptrack/core";
import {
  EventType,
  ExtractionV1Schema,
  MatchDecision,
  ReviewKind,
  type ExtractionV1,
  type MatchResultV1,
} from "@apptrack/shared";
import { repos, type Database } from "@apptrack/db";
import { recomputeApplication } from "./application-recompute-service.js";

const {
  emailsRepo,
  accountsRepo,
  classificationRepo,
  applicationsRepo,
  matchingRepo,
} = repos;

export type MatchStoredResult = {
  messageId: string;
  skipped: boolean;
  skipReason?: string;
  match: MatchResultV1 | null;
  applicationId: string | null;
  reviewItemId: string | null;
  companyId: string | null;
};

async function ensureCompany(
  db: Database,
  extraction: ExtractionV1,
  fromAddress: string | null | undefined,
): Promise<{
  companyId: string | null;
  canonicalName: string | null;
  fuzzySuggest: boolean;
}> {
  const domainRaw = domainOfAddress(fromAddress ?? undefined);
  const domain =
    domainRaw && !isAtsSenderDomain(domainRaw) ? domainRaw : null;

  const aliases = await matchingRepo.listCompanyAliases(db);
  const resolved = resolveCompany({
    companyName: extraction.company,
    domain,
    aliases,
    includeSeed: true,
  });

  if (resolved.kind === "unresolved") {
    return { companyId: null, canonicalName: null, fuzzySuggest: false };
  }

  if (resolved.kind === "fuzzy_suggest") {
    // Do not silent-merge; create new company and open merge suggestion.
    const company = await applicationsRepo.createCompany(
      db,
      resolved.candidateName.trim(),
      { primaryDomain: domain ?? undefined },
    );
    await matchingRepo.addCompanyAlias(db, {
      companyId: company.id,
      alias: normalizeCompanyName(resolved.candidateName),
      aliasType: "name",
      source: "auto",
    });
    await matchingRepo.createReviewItem(db, {
      kind: ReviewKind.entity_merge_suggestion,
      refId: company.id,
      resolution: {
        suggestedCompanyId: resolved.companyId,
        suggestedCanonicalName: resolved.canonicalName,
        similarity: resolved.similarity,
        candidateName: resolved.candidateName,
      },
    });
    return {
      companyId: company.id,
      canonicalName: resolved.candidateName.trim(),
      fuzzySuggest: true,
    };
  }

  if (resolved.kind === "exact") {
    if (resolved.companyId) {
      return {
        companyId: resolved.companyId,
        canonicalName: resolved.canonicalName,
        fuzzySuggest: false,
      };
    }
    // Seed hit without DB row — create company + aliases
    const existing = await matchingRepo.findCompanyByCanonicalName(
      db,
      resolved.canonicalName,
    );
    if (existing) {
      return {
        companyId: existing.id,
        canonicalName: existing.canonicalName,
        fuzzySuggest: false,
      };
    }
    const company = await applicationsRepo.createCompany(
      db,
      resolved.canonicalName,
      { primaryDomain: domain ?? undefined },
    );
    await matchingRepo.addCompanyAlias(db, {
      companyId: company.id,
      alias: normalizeCompanyName(resolved.canonicalName),
      aliasType: "name",
      source: "seed",
    });
    if (domain) {
      await matchingRepo.addCompanyAlias(db, {
        companyId: company.id,
        alias: domain,
        aliasType: "email_domain",
        source: "auto",
      });
    }
    return {
      companyId: company.id,
      canonicalName: resolved.canonicalName,
      fuzzySuggest: false,
    };
  }

  // create_new
  const existing = await matchingRepo.findCompanyByCanonicalName(
    db,
    resolved.canonicalName,
  );
  if (existing) {
    return {
      companyId: existing.id,
      canonicalName: existing.canonicalName,
      fuzzySuggest: false,
    };
  }
  const company = await applicationsRepo.createCompany(
    db,
    resolved.canonicalName,
    { primaryDomain: resolved.primaryDomain ?? undefined },
  );
  await matchingRepo.addCompanyAlias(db, {
    companyId: company.id,
    alias: normalizeCompanyName(resolved.canonicalName),
    aliasType: "name",
    source: "auto",
  });
  if (resolved.primaryDomain) {
    await matchingRepo.addCompanyAlias(db, {
      companyId: company.id,
      alias: resolved.primaryDomain,
      aliasType: "email_domain",
      source: "auto",
    });
  }
  return {
    companyId: company.id,
    canonicalName: resolved.canonicalName,
    fuzzySuggest: false,
  };
}

async function buildCandidateContexts(
  db: Database,
  userId: string,
  companyId: string,
  threadMessageIds: string[],
): Promise<MatchCandidateContext[]> {
  const apps = await matchingRepo.listApplicationsAtCompany(
    db,
    userId,
    companyId,
  );
  const threadAppIds = await matchingRepo.listApplicationIdsForThread(
    db,
    threadMessageIds,
  );

  const contexts: MatchCandidateContext[] = [];
  for (const app of apps) {
    const [recruiterEmails, assessmentProviders] = await Promise.all([
      matchingRepo.listRecruiterEmailsForApplication(db, app.applicationId),
      matchingRepo.listAssessmentProvidersForApplication(
        db,
        app.applicationId,
      ),
    ]);
    const loc = app.location as { city?: string; raw?: string } | null;
    contexts.push({
      applicationId: app.applicationId,
      currentState: app.currentState,
      lastEventAt: app.lastEventAt,
      appliedAt: app.appliedAt,
      roleTitle: app.roleTitle,
      requisitionId: app.requisitionId,
      postingUrl: app.postingUrl,
      portalUrl: null,
      locationText: loc?.city ?? loc?.raw ?? null,
      recruiterEmails,
      assessmentProviders,
      sameThread: threadAppIds.has(app.applicationId),
    });
  }
  return contexts;
}

async function createApplicationFromEmail(
  db: Database,
  input: {
    userId: string;
    companyId: string;
    extraction: ExtractionV1;
    eventType: string;
    occurredAt: Date;
    messageId: string;
    classificationResultId: string;
    fromAddress?: string | null;
  },
): Promise<string> {
  let roleId: string | undefined;
  if (input.extraction.roleTitle) {
    const titleNorm = normalizeRoleTitle(input.extraction.roleTitle);
    const role = await matchingRepo.createRole(db, {
      companyId: input.companyId,
      titleRaw: input.extraction.roleTitle,
      titleNorm,
      level: inferRoleLevel(titleNorm),
      requisitionId: undefined,
      postingUrl: input.extraction.jobPostingUrl ?? undefined,
      location: input.extraction.location
        ? { raw: input.extraction.location }
        : undefined,
      workArrangement: input.extraction.workArrangement ?? undefined,
    });
    roleId = role.id;
  }

  const app = await applicationsRepo.createApplication(db, {
    userId: input.userId,
    companyId: input.companyId,
    roleId,
    currentState: "applied",
    appliedAt: input.occurredAt,
    source: input.extraction.source ?? "email",
  });

  await applicationsRepo.appendApplicationEvent(db, {
    applicationId: app.id,
    eventType: input.eventType,
    occurredAt: input.occurredAt,
    source: "email",
    messageId: input.messageId,
    classificationResultId: input.classificationResultId,
    payload: {
      extraction: input.extraction,
      fromAddress: input.fromAddress,
      recruiterEmail: input.extraction.recruiterEmail,
      assessmentProvider: input.extraction.assessmentProvider,
      matcherVersion: MATCHER_VERSION,
    },
  });

  // Projection from reducer (INV-9), not a one-shot state poke
  await recomputeApplication(db, app.id);
  return app.id;
}

async function attachToApplication(
  db: Database,
  input: {
    applicationId: string;
    eventType: string;
    occurredAt: Date;
    messageId: string;
    classificationResultId: string;
    extraction: ExtractionV1;
    fromAddress?: string | null;
  },
): Promise<void> {
  await applicationsRepo.appendApplicationEvent(db, {
    applicationId: input.applicationId,
    eventType: input.eventType,
    occurredAt: input.occurredAt,
    source: "email",
    messageId: input.messageId,
    classificationResultId: input.classificationResultId,
    payload: {
      extraction: input.extraction,
      fromAddress: input.fromAddress,
      recruiterEmail: input.extraction.recruiterEmail,
      assessmentProvider: input.extraction.assessmentProvider,
      matcherVersion: MATCHER_VERSION,
    },
  });
  await recomputeApplication(db, input.applicationId);
}

/**
 * Match a classified message to an application (or create / review).
 * Idempotent: if message already has an application_event, returns existing link.
 * Always appends match_candidates audit when a new decision is applied.
 */
export async function matchAndStoreMessage(
  db: Database,
  messageId: string,
  opts: { reevaluate?: boolean } = {},
): Promise<MatchStoredResult> {
  const shouldReevaluate = opts.reevaluate !== false;
  const msg = await emailsRepo.getEmailMessageById(db, messageId);
  if (!msg) throw new Error("message_not_found");

  const existingEvent = await applicationsRepo.findEventByMessageId(
    db,
    messageId,
  );
  if (existingEvent) {
    return {
      messageId,
      skipped: true,
      skipReason: "already_matched",
      match: null,
      applicationId: existingEvent.applicationId,
      reviewItemId: null,
      companyId: null,
    };
  }

  const openExisting = await matchingRepo.listOpenReviewItems(db, {
    refId: messageId,
  });
  const openMatchReview = openExisting.find(
    (r) =>
      r.kind === ReviewKind.ambiguous_match ||
      r.kind === ReviewKind.unmatched_email,
  );

  const classification =
    await classificationRepo.getLatestClassification(db, messageId);
  if (!classification) {
    return {
      messageId,
      skipped: true,
      skipReason: "not_classified",
      match: null,
      applicationId: null,
      reviewItemId: null,
      companyId: null,
    };
  }

  if (
    !classification.isJobRelated ||
    classification.eventType === EventType.newsletter_ignore ||
    classification.eventType === EventType.unknown
  ) {
    const prior = await matchingRepo.listMatchCandidatesForMessage(
      db,
      messageId,
    );
    if (prior.length === 0) {
      await matchingRepo.insertMatchCandidate(db, {
        messageId,
        applicationId: null,
        score: 0,
        signals: { skip: classification.eventType },
        decision: MatchDecision.rejected,
        matcherVersion: MATCHER_VERSION,
      });
    }
    return {
      messageId,
      skipped: true,
      skipReason: `event_type_${classification.eventType}`,
      match: null,
      applicationId: null,
      reviewItemId: null,
      companyId: null,
    };
  }

  const account = await accountsRepo.getAccountById(db, msg.accountId);
  if (!account) throw new Error("account_not_found");

  const extraction = ExtractionV1Schema.parse(classification.extraction ?? {});
  const { companyId } = await ensureCompany(db, extraction, msg.fromAddress);
  if (!companyId) {
    let reviewItemId = openMatchReview?.id ?? null;
    if (!reviewItemId) {
      const review = await matchingRepo.createReviewItem(db, {
        kind: ReviewKind.unmatched_email,
        refId: messageId,
        resolution: { reason: "company_unresolved" },
      });
      reviewItemId = review.id;
    }
    await matchingRepo.insertMatchCandidate(db, {
      messageId,
      score: 0,
      signals: { reason: "company_unresolved" },
      decision: MatchDecision.review,
      matcherVersion: MATCHER_VERSION,
    });
    return {
      messageId,
      skipped: false,
      match: null,
      applicationId: null,
      reviewItemId,
      companyId: null,
    };
  }

  const threadIds = await emailsRepo.listMessageIdsInThread(db, msg.threadId);
  const candidates = await buildCandidateContexts(
    db,
    account.userId,
    companyId,
    threadIds,
  );

  const occurredAt = msg.internalDate;
  const match = matchApplication({
    email: {
      eventType: classification.eventType,
      occurredAt,
      fromAddress: msg.fromAddress,
      roleTitle: extraction.roleTitle,
      requisitionId: undefined,
      jobPostingUrl: extraction.jobPostingUrl,
      portalUrl: extraction.portalUrl,
      locationText: extraction.location,
      recruiterEmail: extraction.recruiterEmail,
      assessmentProvider: extraction.assessmentProvider,
    },
    candidates,
  });

  // Persist audit rows for every candidate (+ a null row for new/review empty)
  if (match.candidates.length === 0) {
    await matchingRepo.insertMatchCandidate(db, {
      messageId,
      applicationId: null,
      score: match.score,
      signals: { reason: match.reason },
      decision: match.decision,
      matcherVersion: MATCHER_VERSION,
    });
  } else {
    for (const c of match.candidates) {
      const decisionForRow =
        match.decision === MatchDecision.auto_attached &&
        c.applicationId === match.selectedApplicationId
          ? MatchDecision.auto_attached
          : match.decision === MatchDecision.review
            ? MatchDecision.review
            : match.decision === MatchDecision.new_application
              ? MatchDecision.new_application
              : MatchDecision.rejected;
      await matchingRepo.insertMatchCandidate(db, {
        messageId,
        applicationId: c.applicationId,
        score: c.score,
        signals: c.signals,
        decision: decisionForRow,
        matcherVersion: MATCHER_VERSION,
      });
    }
  }

  let applicationId: string | null = null;
  let reviewItemId: string | null = openMatchReview?.id ?? null;

  if (match.decision === MatchDecision.auto_attached && match.selectedApplicationId) {
    applicationId = match.selectedApplicationId;
    await attachToApplication(db, {
      applicationId,
      eventType: classification.eventType,
      occurredAt,
      messageId,
      classificationResultId: classification.id,
      extraction,
      fromAddress: msg.fromAddress,
    });
    if (openMatchReview) {
      await matchingRepo.resolveReviewItem(db, openMatchReview.id, {
        resolvedBy: "application.match",
        decision: match.decision,
        applicationId,
      });
      reviewItemId = null;
    }
  } else if (match.decision === MatchDecision.new_application) {
    applicationId = await createApplicationFromEmail(db, {
      userId: account.userId,
      companyId,
      extraction,
      eventType: classification.eventType,
      occurredAt,
      messageId,
      classificationResultId: classification.id,
      fromAddress: msg.fromAddress,
    });
    if (openMatchReview) {
      await matchingRepo.resolveReviewItem(db, openMatchReview.id, {
        resolvedBy: "application.match",
        decision: match.decision,
        applicationId,
      });
      reviewItemId = null;
    }
  } else if (!openMatchReview) {
    const kind =
      match.score < 0.45 && match.candidates.length === 0
        ? ReviewKind.unmatched_email
        : ReviewKind.ambiguous_match;
    const review = await matchingRepo.createReviewItem(db, {
      kind,
      refId: messageId,
      resolution: {
        companyId,
        match,
        status: "pending",
      },
    });
    reviewItemId = review.id;
  }

  // New evidence may resolve open ambiguities at this company (§15.3)
  if (shouldReevaluate && companyId && applicationId) {
    await reevaluateMatchesForCompany(db, companyId);
  }

  return {
    messageId,
    skipped: false,
    match,
    applicationId,
    reviewItemId,
    companyId,
  };
}

/**
 * Re-score open ambiguous matches at a company when new evidence arrives.
 * // AGENTS.md §15.3
 */
export async function reevaluateMatchesForCompany(
  db: Database,
  companyId: string,
): Promise<{ resolved: number; stillOpen: number }> {
  const open = await matchingRepo.findOpenAmbiguousForCompany(db, companyId);
  let resolved = 0;
  let stillOpen = 0;

  for (const item of open) {
    // open review items have no event yet, so matchAndStoreMessage will re-decide.
    // Disable nested reevaluate to avoid recursive fan-out.
    const out = await matchAndStoreMessage(db, item.refId, {
      reevaluate: false,
    });
    if (
      out.match?.decision === MatchDecision.auto_attached ||
      out.match?.decision === MatchDecision.new_application ||
      out.skipReason === "already_matched"
    ) {
      if (out.applicationId) {
        await matchingRepo.resolveReviewItem(db, item.id, {
          resolvedBy: "match.reevaluate",
          match: out.match,
          applicationId: out.applicationId,
        });
        resolved += 1;
        continue;
      }
    }
    stillOpen += 1;
  }

  return { resolved, stillOpen };
}
