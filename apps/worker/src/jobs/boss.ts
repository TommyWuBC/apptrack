import { PgBoss, type Job } from "pg-boss";
import {
  ApplicationJobV1Schema,
  CompanyJobV1Schema,
  EmailBackfillJobV1Schema,
  EmailReprocessJobV1Schema,
  EmailSyncJobV1Schema,
  JobName,
  MessageJobV1Schema,
  ScheduledJobV1Schema,
} from "@apptrack/shared/jobs";
import { callInternalApi } from "../internal-api.js";
import { triggerAnalyticsAggregate } from "./analytics-aggregate.js";
import { triggerGhostEvaluate } from "./ghost-evaluate.js";
import { triggerSyncRun } from "./email-sync.js";

const DEAD_LETTER_QUEUE = "apptrack.dead-letter";

function first<T>(jobs: Job<T>[]): T {
  const job = jobs[0];
  if (!job) throw new Error("pg-boss handler received empty batch");
  return job.data;
}

async function createQueues(boss: PgBoss): Promise<void> {
  await boss.createQueue(DEAD_LETTER_QUEUE, {
    deleteAfterSeconds: 30 * 86_400,
  });
  for (const name of Object.values(JobName)) {
    await boss.createQueue(name, {
      retryLimit: 3,
      retryDelay: 30,
      retryBackoff: true,
      deadLetter: DEAD_LETTER_QUEUE,
      deleteAfterSeconds: 7 * 86_400,
    });
  }
}

async function registerHandlers(boss: PgBoss): Promise<void> {
  await boss.work(JobName.EMAIL_SYNC, async (jobs) => {
    const data = EmailSyncJobV1Schema.parse(first(jobs));
    return triggerSyncRun(data.accountId);
  });
  await boss.work(JobName.EMAIL_BACKFILL, async (jobs) => {
    const data = EmailBackfillJobV1Schema.parse(first(jobs));
    return callInternalApi("POST", "/api/v1/backfill", data);
  });
  await boss.work(JobName.EMAIL_NORMALIZE, async (jobs) => {
    const data = MessageJobV1Schema.parse(first(jobs));
    return callInternalApi(
      "POST",
      `/api/v1/normalize/${encodeURIComponent(data.messageId)}`,
      {},
    );
  });
  await boss.work(JobName.EMAIL_CLASSIFY, async (jobs) => {
    const data = MessageJobV1Schema.parse(first(jobs));
    return callInternalApi(
      "POST",
      `/api/v1/classify/${encodeURIComponent(data.messageId)}`,
      {},
    );
  });
  await boss.work(JobName.APPLICATION_MATCH, async (jobs) => {
    const data = MessageJobV1Schema.parse(first(jobs));
    return callInternalApi(
      "POST",
      `/api/v1/match/${encodeURIComponent(data.messageId)}`,
      {},
    );
  });
  await boss.work(JobName.APPLICATION_RECOMPUTE, async (jobs) => {
    const data = ApplicationJobV1Schema.parse(first(jobs));
    return callInternalApi(
      "POST",
      `/api/v1/applications/${encodeURIComponent(data.applicationId)}/recompute`,
      {},
    );
  });
  await boss.work(JobName.MATCH_REEVALUATE, async (jobs) => {
    const data = CompanyJobV1Schema.parse(first(jobs));
    return callInternalApi(
      "POST",
      `/api/v1/match/reevaluate/${encodeURIComponent(data.companyId)}`,
      {},
    );
  });
  await boss.work(JobName.GHOST_EVALUATE, async (jobs) => {
    ScheduledJobV1Schema.parse(first(jobs));
    return triggerGhostEvaluate();
  });
  await boss.work(JobName.ANALYTICS_AGGREGATE, async (jobs) => {
    ScheduledJobV1Schema.parse(first(jobs));
    return triggerAnalyticsAggregate();
  });
  await boss.work(JobName.RETENTION_CLEANUP, async (jobs) => {
    ScheduledJobV1Schema.parse(first(jobs));
    return callInternalApi("POST", "/api/v1/analytics/retention", {});
  });
  await boss.work(JobName.OAUTH_REFRESH_SWEEP, async (jobs) => {
    ScheduledJobV1Schema.parse(first(jobs));
    return callInternalApi("POST", "/api/v1/gmail/refresh-sweep", {});
  });
  await boss.work(JobName.EMAIL_REPROCESS, async (jobs) => {
    const data = EmailReprocessJobV1Schema.parse(first(jobs));
    return callInternalApi("POST", "/api/v1/reprocess/execute", data);
  });
}

async function registerSchedules(boss: PgBoss): Promise<void> {
  await boss.schedule(JobName.EMAIL_SYNC, "*/10 * * * *", {});
  await boss.schedule(JobName.GHOST_EVALUATE, "0 6 * * *", {}, { tz: "UTC" });
  await boss.schedule(JobName.ANALYTICS_AGGREGATE, "*/5 * * * *", {});
  await boss.schedule(JobName.RETENTION_CLEANUP, "0 4 * * *", {}, { tz: "UTC" });
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    await boss.schedule(JobName.OAUTH_REFRESH_SWEEP, "*/30 * * * *", {});
  }
}

export async function startBossWorker(connectionString: string): Promise<PgBoss> {
  const boss = new PgBoss({
    connectionString,
    schema: process.env.PG_BOSS_SCHEMA ?? "pgboss",
    application_name: "apptrack-worker",
  });
  boss.on("error", (error) => {
    console.error("[worker] pg-boss error", error.message);
  });
  await boss.start();
  await createQueues(boss);
  await registerHandlers(boss);
  await registerSchedules(boss);
  return boss;
}
