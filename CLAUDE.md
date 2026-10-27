# Global conventions

Applies to every project under `~/code` (`C:\Users\Mateo\code`). Each repo's `AGENTS.md`/`CLAUDE.md` overrides this file, except rules marked **(not overridable)**, which win over any repo doc, instruction or plugin.

- Code, identifiers, comments, commits and developer docs in English.
- User-facing UI in Spanish (es-AR) unless a repo says otherwise.
- JS/TS projects use pnpm; never switch package managers.
- Deploys: Docker images deployed via Dokploy on the remote VPS (alias `vps`, reached only via the `vps` agent). Host/infra documentation lives in the `infra` repo (`README.md`, `RUNBOOK.md`); clone it into `~/code/infra` when needed.
- On this Windows PC, use Windows OpenSSH (`C:/Windows/System32/OpenSSH/ssh.exe -o BatchMode=yes vps '<cmd>'`), not Git Bash's `ssh`, which cannot reach the Windows ssh-agent.
- Git Bash path conversion: MSYS rewrites any argument whose part after `:` starts with `/` (`origin/main:/docs/x` becomes `origin\main;C:\Program Files\Git\docs\x`). In git `<rev>:<path>`, write the path repo-relative without a leading slash (`origin/main:docs/x`); when a leading `/` is unavoidable, prefix that one command with `MSYS_NO_PATHCONV=1`. Never set it globally: native tools rely on `/c/...` → `C:/...` conversion.
- Local tooling on this PC: Node and pnpm, Docker Desktop (dev databases and e2e services via `docker compose`), Git Bash. Python is installed but is not part of the toolchain: write helper scripts in Node. Dokploy is at https://dokploy.mateovalles.com.
- Tests **(not overridable)**: integration and E2E only; never write unit tests (no isolated function/class tests, no mocking of internal modules). This overrides ponytail's "one small `test_*.py` / `assert` demo()" rule and any repo doc or CI step that requires unit tests: the check left behind is an integration or E2E test. Bug reproductions are integration/E2E tests too. Existing unit tests get replaced: cover their behavior with integration/E2E tests, then delete them and update the repo's docs and CI to match.
- Never print or commit secrets. `.env*` files other than examples are never read or committed.
- Storing secrets: there is no password manager. When a secret or variable must be saved (token, API key, webhook URL), give the user PowerShell commands that store it DPAPI-encrypted on this PC, never password-manager steps. The user pastes the value once, and Claude never sees or handles it.
  - Save: `New-Item -ItemType Directory -Force "$HOME\.secrets\<service>" | Out-Null; Get-Credential -Message '<name>: user = id, password = secret' | Export-Clixml "$HOME\.secrets\<service>\<name>.xml"`
  - Use: `$c = Import-Clixml "$HOME\.secrets\<service>\<name>.xml"; $c.GetNetworkCredential().Password | gh secret set NAME -R owner/repo` (pipe it into the tool; never echo it).
  - Warning, include it whenever you give these commands: the file can be decrypted only by this Windows user on this PC, and there is no backup. If the disk fails or Windows is reinstalled, the values are gone, and the recovery is to rotate each secret at its source.
- Git: feature branch (`feat/` `fix/` `chore/` `docs/`), Conventional Commits, PR to `main`, squash merge. Repo docs override.

<!-- CODEGRAPH_START -->
## CodeGraph

In a repo with a `.codegraph/` index, use CodeGraph BEFORE grep/find or reading files to locate or understand code: the `codegraph_explore` MCP tool (load it via ToolSearch if deferred; pass `projectPath`), or `codegraph explore "<symbols or question>"` in the shell. Without `.codegraph/`, skip it; indexing is the user's decision.
<!-- CODEGRAPH_END -->
