# Global conventions

Applies to every project under `~/code` (`C:\Users\Mateo\code`). Each repo's `AGENTS.md`/`CLAUDE.md` overrides this file, except rules marked **(not overridable)**, which win over any repo doc, instruction or plugin.

- Code, identifiers, comments, commits and developer docs in English.
- User-facing UI in Spanish (es-AR) unless a repo says otherwise.
- JS/TS projects use pnpm; never switch package managers.
- Deploys: Docker images deployed via Dokploy on the remote VPS (alias `vps`, reached only via the `vps` agent). Host/infra documentation lives in the `infra` repo (`README.md`, `RUNBOOK.md`); clone it into `~/code/infra` when needed.
- On this Windows PC, use Windows OpenSSH (`C:/Windows/System32/OpenSSH/ssh.exe -o BatchMode=yes vps '<cmd>'`), not Git Bash's `ssh`, which cannot reach the Windows ssh-agent.
- Local tooling on this PC: Node and pnpm, Docker Desktop (dev databases and e2e services via `docker compose`), Git Bash. There is no Python: write helper scripts in Node. Dokploy is at https://dokploy.mateovalles.cloud.
- Tests **(not overridable)**: integration and E2E only; never write unit tests (no isolated function/class tests, no mocking of internal modules). This overrides ponytail's "one small `test_*.py` / `assert` demo()" rule and any repo doc or CI step that requires unit tests: the check left behind is an integration or E2E test. Bug reproductions are integration/E2E tests too. Existing unit tests get replaced: cover their behavior with integration/E2E tests, then delete them and update the repo's docs and CI to match.
- Never print or commit secrets. `.env*` files other than examples are never read or committed.
- Git: feature branch (`feat/` `fix/` `chore/` `docs/`), Conventional Commits, PR to `main`, squash merge. Repo docs override.

<!-- CODEGRAPH_START -->
## CodeGraph

In repositories indexed by CodeGraph (a `.codegraph/` directory exists at the repo root), reach for it BEFORE grep/find or reading files when you need to understand or locate code:

- **MCP tool** (when available): `codegraph_explore` answers most code questions in one call — the relevant symbols' verbatim source plus the call paths between them, including dynamic-dispatch hops grep can't follow. Name a file or symbol in the query to read its current line-numbered source. If it's listed but deferred, load it by name via tool search.
- **Shell** (always works): `codegraph explore "<symbol names or question>"` prints the same output.

If there is no `.codegraph/` directory, skip CodeGraph entirely — indexing is the user's decision.
<!-- CODEGRAPH_END -->
