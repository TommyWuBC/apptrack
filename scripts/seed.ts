#!/usr/bin/env tsx
import argon2 from "argon2";
import { closeDb, createDb, repos } from "@apptrack/db";
import { ApplicationEventType } from "@apptrack/shared";

const DEMO_APPS = [
  ["Initech", "confirmation_received", true],
  ["Hooli", "assessment_received", true],
  ["Pied Piper", "interviewing", false],
  ["Acme Labs", "final_round", true],
  ["Globex", "offer", true],
  ["Umbrella Systems", "rejected", false],
  ["Vandelay Industries", "on_hold", false],
  ["Stark Data", "applied", false],
] as const;

async function main() {
  if (!process.argv.includes("--demo")) {
    throw new Error("Only synthetic demo seeding is supported; pass --demo");
  }
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  const db = createDb(databaseUrl);
  try {
    let user = await repos.usersRepo.getFirstUser(db);
    if (!user) {
      const password = process.env.DEMO_OWNER_PASSWORD ?? "apptrack-demo-password";
      user = await repos.usersRepo.createUser(db, {
        email: process.env.DEMO_OWNER_EMAIL ?? "demo@apptrack.local",
        passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
        role: "owner",
      });
      console.info(`[seed] created synthetic owner ${user.email}`);
    }

    const existingCompanies = await repos.applicationsRepo.listCompanies(db);
    const existingApps = await repos.applicationsRepo.listApplicationsWithCompany(
      db,
      user.id,
    );
    let created = 0;
    for (const [companyName, state, actionRequired] of DEMO_APPS) {
      let company = existingCompanies.find(
        (candidate) => candidate.canonicalName === companyName,
      );
      if (!company) {
        company = await repos.applicationsRepo.createCompany(db, companyName, {
          primaryDomain: `${companyName.toLowerCase().replace(/\s+/g, "-")}.example`,
        });
        existingCompanies.push(company);
      }
      if (existingApps.some((application) => application.companyId === company.id)) {
        continue;
      }
      const occurredAt = new Date(Date.UTC(2026, 0, 15 + created * 12, 12, 0, 0));
      const application = await repos.applicationsRepo.createApplication(db, {
        userId: user.id,
        companyId: company.id,
        currentState: state,
        appliedAt: occurredAt,
        source: "synthetic_demo",
      });
      await repos.applicationsRepo.appendApplicationEvent(db, {
        applicationId: application.id,
        eventType: ApplicationEventType.created_manually,
        occurredAt,
        source: "user",
        payload: {
          state,
          actionRequired,
          synthetic: true,
        },
      });
      await repos.applicationsRepo.updateApplicationProjection(db, application.id, {
        currentState: state,
        actionRequired,
      });
      created += 1;
    }
    console.info(`[seed] demo ready; created ${created} applications`);
  } finally {
    await closeDb(db);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
