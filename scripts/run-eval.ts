/**
 * Classification eval harness. AGENTS.md §24.5 / M7
 * Usage: pnpm eval
 *
 * CI regression: F1 drop >2 points vs committed baseline fails (see compare below).
 */
import {
  readdirSync,
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  FixtureExpectedV1Schema,
  GoldenBaselineV1Schema,
  EventType,
  type GoldenBaselineV1,
} from "@apptrack/shared";
import {
  normalizeEmail,
  classifyEmail,
  CLASSIFIER_VERSION,
} from "@apptrack/core";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const EMAILS = join(ROOT, "fixtures", "emails");
const GOLDEN = join(ROOT, "fixtures", "golden");

type Row = {
  path: string;
  eventType: string;
  predicted: string | null;
  correct: boolean;
};

function walkExpected(dir: string, acc: string[] = []): string[] {
  if (!existsSync(dir)) return acc;
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, name.name);
    if (name.isDirectory()) walkExpected(p, acc);
    else if (name.name.endsWith(".expected.json")) acc.push(p);
  }
  return acc;
}

async function classifyEml(emlPath: string): Promise<string> {
  const raw = readFileSync(emlPath);
  const n = await normalizeEmail({ rawMime: raw });
  const text = raw.toString("utf8");
  const from = text.match(/^From:\s*(.+)$/im)?.[1] ?? "";
  const fromEmail = from.match(/<([^>]+)>/)?.[1] ?? from;
  const headers: Record<string, string> = {};
  const listId = text.match(/^List-Id:\s*(.+)$/im)?.[1];
  const listUnsub = text.match(/^List-Unsubscribe:\s*(.+)$/im)?.[1];
  if (listId) headers["List-Id"] = listId;
  if (listUnsub) headers["List-Unsubscribe"] = listUnsub;

  const result = classifyEmail({
    subject: n.subject,
    textPlain: n.textPlain,
    textFull: n.textFull,
    fromAddress: fromEmail,
    headers,
    links: n.links,
    calendarEvent: n.calendarEvent,
  });
  return result.eventType;
}

function prf(tp: number, fp: number, fn: number) {
  const precision = tp + fp === 0 ? 0 : tp / (tp + fp);
  const recall = tp + fn === 0 ? 0 : tp / (tp + fn);
  const f1 =
    precision + recall === 0
      ? 0
      : (2 * precision * recall) / (precision + recall);
  return { precision, recall, f1 };
}

function metrics(rows: Row[]): GoldenBaselineV1 {
  const perEventType: GoldenBaselineV1["perEventType"] = {};
  for (const et of Object.values(EventType)) {
    const gold = rows.filter((r) => r.eventType === et);
    const support = gold.length;
    const tp = gold.filter((r) => r.correct).length;
    const fp = rows.filter(
      (r) => r.predicted === et && r.eventType !== et,
    ).length;
    const fn = support - tp;
    const { precision, recall, f1 } = prf(tp, fp, fn);
    perEventType[et] = { precision, recall, f1, support };
  }

  const tp = rows.filter((r) => r.correct).length;
  const support = rows.length;
  // Micro-ish overall: accuracy as recall when every row has one label
  const overallRecall = support === 0 ? 0 : tp / support;
  // Macro F1 over types with support > 0
  const withSupport = Object.values(perEventType).filter((x) => x.support > 0);
  const macroF1 =
    withSupport.length === 0
      ? 0
      : withSupport.reduce((s, x) => s + x.f1, 0) / withSupport.length;
  const macroP =
    withSupport.length === 0
      ? 0
      : withSupport.reduce((s, x) => s + x.precision, 0) / withSupport.length;

  return GoldenBaselineV1Schema.parse({
    version: "1",
    generatedAt: new Date().toISOString(),
    classifierVersion: CLASSIFIER_VERSION,
    overall: {
      precision: macroP,
      recall: overallRecall,
      f1: macroF1,
      support,
    },
    perEventType,
    notes: `Deterministic classifier ${CLASSIFIER_VERSION}. Macro-F1 over event types with support.`,
  });
}

/** Core types M7 acceptance cares about (≥0.85 F1). */
const CORE_TYPES = [
  EventType.application_confirmation,
  EventType.rejection,
  EventType.oa_invitation,
  EventType.oa_reminder,
  EventType.interview_invitation,
  EventType.interview_scheduled,
] as const;

function assertAcceptance(baseline: GoldenBaselineV1): void {
  for (const et of CORE_TYPES) {
    const row = baseline.perEventType[et];
    if (!row || row.support === 0) continue;
    if (row.f1 < 0.85) {
      console.error(
        `[eval] FAIL acceptance: ${et} F1=${row.f1.toFixed(3)} < 0.85 (support=${row.support})`,
      );
      process.exit(1);
    }
  }
  console.info("[eval] acceptance: core event-type F1 ≥ 0.85 OK");
}

function assertNoRegression(baseline: GoldenBaselineV1): void {
  const prevPath = join(GOLDEN, "baseline.json");
  if (!existsSync(prevPath)) return;
  const prev = GoldenBaselineV1Schema.parse(
    JSON.parse(readFileSync(prevPath, "utf8")),
  );
  // Only gate once we have a real classifier baseline (not stub null version)
  if (!prev.classifierVersion) return;
  for (const et of Object.values(EventType)) {
    const a = prev.perEventType[et];
    const b = baseline.perEventType[et];
    if (!a || !b || a.support === 0) continue;
    if (b.f1 + 0.02 < a.f1) {
      console.error(
        `[eval] REGRESSION: ${et} F1 ${a.f1.toFixed(3)} → ${b.f1.toFixed(3)} (>2pt drop)`,
      );
      process.exit(1);
    }
  }
}

async function main(): Promise<void> {
  mkdirSync(GOLDEN, { recursive: true });
  const expectedPaths = walkExpected(EMAILS);
  if (expectedPaths.length === 0) {
    console.error("[eval] No fixtures found. Run: pnpm fixtures:generate");
    process.exit(1);
  }

  const rows: Row[] = [];
  for (const expPath of expectedPaths) {
    const raw = JSON.parse(readFileSync(expPath, "utf8"));
    const expected = FixtureExpectedV1Schema.parse(raw);
    const emlPath = expPath.replace(/\.expected\.json$/, ".eml");
    const predicted = existsSync(emlPath) ? await classifyEml(emlPath) : null;
    rows.push({
      path: expPath,
      eventType: expected.eventType,
      predicted,
      correct: predicted === expected.eventType,
    });
  }

  const baseline = metrics(rows);
  assertAcceptance(baseline);
  assertNoRegression(baseline);

  const outPath = join(GOLDEN, "baseline.json");
  writeFileSync(outPath, `${JSON.stringify(baseline, null, 2)}\n`, "utf8");

  const index = {
    generatedAt: baseline.generatedAt,
    classifierVersion: CLASSIFIER_VERSION,
    overallF1: baseline.overall.f1,
    support: baseline.overall.support,
    correct: rows.filter((r) => r.correct).length,
  };
  writeFileSync(
    join(GOLDEN, "index.json"),
    `${JSON.stringify(index, null, 2)}\n`,
    "utf8",
  );

  console.info(`[eval] fixtures=${rows.length}`);
  console.info(
    `[eval] overall F1=${baseline.overall.f1.toFixed(3)} precision=${baseline.overall.precision.toFixed(3)} recall=${baseline.overall.recall.toFixed(3)}`,
  );
  console.info(`[eval] wrote ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
