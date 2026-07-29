# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Nothing yet.

## [1.0.0] - 2026-07-29

First open-source release. Milestones M1–M20.

### Added

#### Foundation (M1–M2)

- TypeScript monorepo with pnpm workspaces, Turborepo, strict TypeScript, ESLint/Prettier, and dependency-cruiser boundary enforcement.
- Docker Compose for production (Postgres, server, worker) and dev (Postgres, Mailpit).
- Full Drizzle schema and migrations for users, Gmail accounts, emails, classification, applications, analytics, and correlation.
- AES-256-GCM encryption for OAuth tokens; dedicated credential repository (INV-1, INV-4).
- Cookie sessions with argon2id passwords, CSRF double-submit, and setup wizard.

#### Email pipeline (M3–M7)

- Synthetic fixture corpus (60+ `.eml` pairs) and golden eval harness with CI regression gate.
- Gmail OAuth (PKCE, encrypted token storage, refresh sweep, reauth handling).
- Incremental Gmail sync and historical backfill via `EmailProvider` abstraction; mock provider for contributors (`EMAIL_PROVIDER=mock`).
- Email normalization: MIME parse, HTML sanitization, quote stripping, link extraction, calendar invite parsing.
- Layered deterministic classification (L0–L2): ATS template detectors, keyword rules, confidence + review routing; optional LLM layer (M13) behind `CLASSIFIER_MODE`.

#### Applications (M8–M12)

- Application matching with weighted signals, auto-attach thresholds, and ambiguous-match review queue.
- Event-sourced application timeline with pure reducer projection (INV-9).
- Dashboard SPA: pipeline board, application detail with evidence viewer, stats with small-sample guards.
- Manual corrections, field locks, merge/split, reattach, and review queue resolution (INV-7).
- Ghosting inference with configurable thresholds, pause/reset semantics, and dismiss.

#### Analytics & correlation (M14–M16)

- Analytics ingestion API with site keys, rate limits, CORS allowlists, and cookie-free visitor hashing (INV-8).
- Browser analytics SDK (`<2 KB` gzip) served at `/sdk.js`; example Astro portfolio site.
- Rules-based correlation scoring with medium confidence cap; opt-in unique `?src=` links and tracked resume downloads.

#### Security & release (M17–M20)

- Threat model, security test suite (CSRF, auth, log redaction, prompt-injection canaries).
- Security headers (CSP, HSTS, frame-ancestors), API rate limiting, Dependabot, encrypted backup/restore scripts.
- Open-source packaging: MIT license, CONTRIBUTING, CODE_OF_CONDUCT, PRIVACY, ADRs, issue/PR templates, release workflow publishing to GHCR.

### Security

- OAuth tokens and session secrets never logged or returned in API responses.
- Raw IP addresses never persisted; geolocation is in-memory only (INV-8).
- Email HTML sanitized on ingest; evidence rendered in sandboxed iframe.
- `CLASSIFIER_MODE=deterministic` by default — no LLM egress without explicit opt-in.

### Documentation

- Setup, Gmail OAuth, classification, application matching, analytics integration, correlation model, data retention, interview preparation, and demo storyboard guides.

[Unreleased]: https://github.com/TommyWuBC/apptrack/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/TommyWuBC/apptrack/releases/tag/v1.0.0
