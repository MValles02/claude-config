# Workflow

This file is identical in every documentation/configuration repo (infra, claude-config). It is copied from `standards/docs/` in the [infra](https://github.com/mvalles02/infra) repo; edit it there, never here.

## Branching

- `main` is the only long-lived branch and the default branch.
- Work on a feature branch (`feat/`, `fix/`, `chore/`, `docs/`) and open a PR into `main`. It is merged with **squash**; commits and PR titles follow Conventional Commits.
- Nothing is deployed from these repos.

## Auto-merge

`.github/workflows/auto-merge.yml` enables auto-merge (squash) on every non-draft PR opened from a branch of this repo, Dependabot's included, so it merges itself once `checks` is green. The job uses the `AUTO_MERGE_TOKEN` secret (a fine-grained PAT, stored as both an Actions and a Dependabot secret) so the merge triggers push workflows; without the secret it skips with a notice.

## CI gate

`.github/workflows/ci.yml` runs on every pull request. The `checks` job runs gitleaks over the PR commits, installs with `pnpm install --frozen-lockfile` and runs `pnpm run check`. `checks` is the required status check on `main`. It is not strict ("require branches to be up to date"): a deliberate solo-developer tradeoff, since `strict=true` forces every open PR to update and re-run CI after each merge.

`secrets-scan.yml` also scans the commits of every push, on any branch.

## Local hooks

`pnpm install` runs `prepare`, which sets `core.hooksPath` to `.githooks`. The `pre-commit` hook scans the staged diff with gitleaks (digest-pinned Docker image; skipped with a warning when Docker is missing).

## Package contract

`package.json` is `private`, has no dependencies, `packageManager: pnpm@12.6.0`, `engines.node: ">=24"`, a `check` script (the whole local and CI verification) and `prepare` = `git config core.hooksPath .githooks`.

## Standards

The files listed in `standards/docs/` of the infra repo are the same in every docs repo. From the infra checkout, `node scripts/check-standards.mjs` reports drift; see `standards/README.md` there.
