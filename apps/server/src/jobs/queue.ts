import { PgBoss } from "pg-boss";
import { JobName, type JobName as JobNameT } from "@apptrack/shared/jobs";

export type EnqueueOptions = {
  singletonKey?: string;
  priority?: number;
};

export type AppJobQueue = {
  boss: PgBoss;
  send: (
    name: JobNameT,
    data: Record<string, unknown>,
    options?: EnqueueOptions,
  ) => Promise<string | null>;
  stop: () => Promise<void>;
};

export const APP_JOB_NAMES = Object.values(JobName);
export const DEAD_LETTER_QUEUE = "apptrack.dead-letter";

export async function createJobQueue(
  connectionString: string,
  onError: (error: Error) => void,
): Promise<AppJobQueue> {
  const boss = new PgBoss({
    connectionString,
    schema: process.env.PG_BOSS_SCHEMA ?? "pgboss",
    application_name: "apptrack-server",
  });
  boss.on("error", onError);
  await boss.start();
  await boss.createQueue(DEAD_LETTER_QUEUE, {
    deleteAfterSeconds: 30 * 86_400,
  });
  for (const name of APP_JOB_NAMES) {
    await boss.createQueue(name, {
      retryLimit: 3,
      retryDelay: 30,
      retryBackoff: true,
      deadLetter: DEAD_LETTER_QUEUE,
      deleteAfterSeconds: 7 * 86_400,
    });
  }
  return {
    boss,
    send: (name, data, options = {}) =>
      boss.send(name, data, {
        singletonKey: options.singletonKey,
        priority: options.priority,
      }),
    stop: () => boss.stop({ graceful: true, timeout: 10_000 }),
  };
}
