# Global conventions

Applies to every project under `~/code` (`C:\Users\Mateo\code`). Each repo's `AGENTS.md`/`CLAUDE.md` overrides this file.

- Code, identifiers, comments, commits and developer docs in English.
- User-facing UI in Spanish (es-AR) unless a repo says otherwise.
- JS/TS projects use pnpm; never switch package managers.
- Deploys: Docker images deployed via Dokploy on the remote VPS (alias `vps`, reached only via the `vps` agent). Host/infra documentation lives in the `infra` repo (`README.md`, `RUNBOOK.md`); clone it into `~/code/infra` when needed.
- On this Windows PC, use Windows OpenSSH (`C:/Windows/System32/OpenSSH/ssh.exe -o BatchMode=yes vps '<cmd>'`), not Git Bash's `ssh`, which cannot reach the Windows ssh-agent.
- Tests: integration and E2E only; never write unit tests (no isolated function/class tests, no mocking of internal modules). This overrides ponytail's "one small `test_*.py` / `assert` demo()" rule: the check left behind is an integration or E2E test. Bug reproductions are integration/E2E tests too. Existing unit tests are not deleted unless asked.
- Never print or commit secrets. `.env*` files other than examples are never read or committed.
- Git: feature branch (`feat/` `fix/` `chore/` `docs/`), Conventional Commits, PR to `main`, squash merge. Repo docs override.
