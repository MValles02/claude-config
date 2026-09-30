# Global conventions

Applies to every project under `~/projects`. Each repo's `AGENTS.md`/`CLAUDE.md` overrides this file.

- Code, identifiers, comments, commits and developer docs in English.
- User-facing UI in Spanish (es-AR) unless a repo says otherwise.
- JS/TS projects use pnpm; never switch package managers.
- Deploys: Docker images deployed via Dokploy on this VPS. Host/infra documentation lives in `~/projects/infra` (`README.md`, `RUNBOOK.md`).
- Never print or commit secrets. `.env*` files other than examples are never read or committed.
