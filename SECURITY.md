# Security Policy

## Supported versions

| Version                          | Supported                          |
| -------------------------------- | ---------------------------------- |
| `main` / pre-1.0                 | Yes (best-effort while dogfooding) |
| Tagged releases (once published) | Latest minor of the current major  |

## Reporting a vulnerability

Please **do not** open a public GitHub issue for security bugs.

Email the maintainer via the address listed on the GitHub profile for this repository, or open a private [GitHub Security Advisory](https://docs.github.com/en/code-security/security-advisories) if available.

Include:

- Affected commit / version
- Reproduction steps
- Impact (confidentiality / integrity / availability)
- Whether you plan to disclose publicly and preferred timeline

We aim to acknowledge within 7 days and ship a fix or mitigation for confirmed issues as soon as practical.

## Hardening baseline

See [`THREAT_MODEL.md`](./THREAT_MODEL.md) for T1–T14 mitigations and test coverage. Self-hosters should:

1. Use strong unique `APP_ENCRYPTION_KEY`, `SESSION_SECRET`, `INTERNAL_JOB_SECRET`
2. Terminate TLS at a reverse proxy; leave `ENABLE_HSTS=true` / production `NODE_ENV` so HSTS is sent
3. Encrypt backups with `scripts/backup.sh` (age)
4. Keep `CLASSIFIER_MODE=deterministic` unless you accept LLM egress (settings UI discloses)
