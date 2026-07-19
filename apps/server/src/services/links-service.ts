/**
 * Unique application links + tracked résumé. AGENTS.md §20.5 / §22 / M16
 */
import { randomBytes, randomUUID } from "node:crypto";
import { repos, type Database } from "@apptrack/db";
import { AnalyticsEventType } from "@apptrack/shared";

/** Crockford base32 without I/L/O/U — readable 8-char tokens. */
const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

export function mintUniqueLinkToken(length = 8): string {
  const buf = randomBytes(length);
  let out = "";
  for (const byte of buf) {
    out += ALPHABET[byte % ALPHABET.length]!;
  }
  return out;
}

export async function mintApplicationLink(
  db: Database,
  input: {
    userId: string;
    applicationId: string;
    appBaseUrl: string;
    portfolioBaseUrl?: string | null;
  },
) {
  const application = await repos.applicationsRepo.getApplicationById(
    db,
    input.applicationId,
  );
  if (!application || application.userId !== input.userId) {
    throw Object.assign(new Error("application_not_found"), {
      code: "NOT_FOUND",
    });
  }

  let token = application.uniqueLinkToken;
  if (!token) {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const candidate = mintUniqueLinkToken();
      const clash = await repos.applicationsRepo.getApplicationByUniqueLinkToken(
        db,
        candidate,
      );
      if (clash) continue;
      const updated = await repos.applicationsRepo.setApplicationUniqueLinkToken(
        db,
        application.id,
        candidate,
      );
      token = updated?.uniqueLinkToken ?? candidate;
      break;
    }
  }
  if (!token) throw new Error("token_mint_failed");

  const portfolioBase = (input.portfolioBaseUrl ?? input.appBaseUrl).replace(/\/$/, "");
  const trackerBase = input.appBaseUrl.replace(/\/$/, "");
  await repos.correctionsRepo.writeAuditLog(db, {
    userId: input.userId,
    actor: "user",
    action: "links.mint",
    targetType: "application",
    targetId: application.id,
    metadata: { token },
  });

  return {
    applicationId: application.id,
    token,
    portfolioUrl: `${portfolioBase}/?src=${encodeURIComponent(token)}`,
    resumeUrl: `${trackerBase}/r/${encodeURIComponent(token)}/resume.pdf`,
  };
}

export async function revokeApplicationLink(
  db: Database,
  userId: string,
  applicationId: string,
) {
  const application = await repos.applicationsRepo.getApplicationById(db, applicationId);
  if (!application || application.userId !== userId) {
    throw Object.assign(new Error("application_not_found"), {
      code: "NOT_FOUND",
    });
  }
  await repos.applicationsRepo.setApplicationUniqueLinkToken(db, applicationId, null);
  await repos.correctionsRepo.writeAuditLog(db, {
    userId,
    actor: "user",
    action: "links.revoke",
    targetType: "application",
    targetId: applicationId,
    metadata: {},
  });
  return { applicationId, revoked: true };
}

/**
 * Serve resume bytes and log a deterministic analytics resume_download.
 * Returns null when token revoked or no résumé uploaded.
 */
export async function serveTrackedResume(
  db: Database,
  token: string,
  opts: { siteKey?: string | null } = {},
) {
  const application = await repos.applicationsRepo.getApplicationByUniqueLinkToken(
    db,
    token,
  );
  if (!application) return null;
  const resume = await repos.resumesRepo.getResumeForUser(db, application.userId);
  if (!resume) return null;

  // Best-effort deterministic attribution event when a site exists.
  const sites = await repos.analyticsRepo.listSitesForUser(db, application.userId);
  const site =
    (opts.siteKey
      ? sites.find((candidate) => candidate.siteKey === opts.siteKey)
      : null) ?? sites[0];
  if (site && site.mode !== "off") {
    await repos.analyticsRepo.insertEventIdempotent(db, {
      eventId: randomUUID(),
      siteId: site.id,
      visitorHash: `token:${token}`,
      eventType: AnalyticsEventType.resume_download,
      path: `/r/${token}/resume.pdf`,
      occurredAt: new Date(),
      props: { src: token },
      srcToken: token,
    });
  }

  return {
    applicationId: application.id,
    filename: resume.filename,
    contentType: resume.contentType,
    bytes: resume.bytes,
  };
}
