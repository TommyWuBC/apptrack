/**
 * Classification eval harness (M3 skeleton).
 * AGENTS.md §24.5 — reports zeros until deterministic classifier lands (M7).
 *
 * Usage: pnpm eval
 */
import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  FixtureExpectedV1Schema,
  GoldenBaselineV1Schema,
  EventType,
  type GoldenBaselineV1,
} from "@apptrack/shared";

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

/** Placeholder classifier — always returns null (unknown). Real logic in M7. */
function classifyStub(_emlPath: string): string | null {
  return null;
}

function metrics(rows: Row[]): GoldenBaselineV1 {
  const perEventType: GoldenBaselineV1["perEventType"] = {};
  for (const et of Object.values(EventType)) {
    const subset = rows.filter((r) => r.eventType === et);
    const support = subset.length;
    const tp = subset.filter((r) => r.correct).length;
    // Stub predicts nothing → precision/recall/f1 are 0
    perEventType[et] = {
      precision: 0,
      recall: support === 0 ? 0 : tp / support,
      f1: 0,
      support,
    };
  }
  const support = rows.length;
  return GoldenBaselineV1Schema.parse({
    version: "1",
    generatedAt: new Date().toISOString(),
    classifierVersion: null,
    overall: {
      precision: 0,
      recall: 0,
      f1: 0,
      support,
    },
    perEventType,
    notes:
      "M3 skeleton: classifier not implemented. All predictions null → F1=0. Replace classifyStub in M7.",
  });
}

function main(): void {
  mkdirSync(GOLDEN, { recursive: true });
  const expectedPaths = walkExpected(EMAILS);
  if (expectedPaths.length === 0) {
    console.error(
      "[eval] No fixtures found. Run: pnpm fixtures:generate",
    );
    process.exit(1);
  }

  const rows: Row[] = [];
  for (const expPath of expectedPaths) {
    const raw = JSON.parse(readFileSync(expPath, "utf8"));
    const expected = FixtureExpectedV1Schema.parse(raw);
    const emlPath = expPath.replace(/\.expected\.json$/, ".eml");
    const predicted = existsSync(emlPath) ? classifyStub(emlPath) : null;
    rows.push({
      path: expPath,
      eventType: expected.eventType,
      predicted,
      correct: predicted === expected.eventType,
    });
  }

  const baseline = metrics(rows);
  const outPath = join(GOLDEN, "baseline.json");
  writeFileSync(outPath, `${JSON.stringify(baseline, null, 2)}\n`, "utf8");

  // Manifest of golden paths (relative) for future scrub imports
  const index = {
    version: 1,
    sources: expectedPaths.map((p) =>
      p.replace(ROOT + "\\", "").replace(ROOT + "/", "").replace(/\\/g, "/"),
    ),
    count: expectedPaths.length,
  };
  writeFileSync(
    join(GOLDEN, "index.json"),
    `${JSON.stringify(index, null, 2)}\n`,
    "utf8",
  );

  console.info(`[eval] fixtures=${rows.length}`);
  console.info(
    `[eval] overall F1=${baseline.overall.f1.toFixed(3)} precision=${baseline.overall.precision.toFixed(3)} recall=${baseline.overall.recall.toFixed(3)} (stub classifier)`,
  );
  console.info(`[eval] wrote ${outPath.replace(/\\/g, "/")}`);
}

main();
