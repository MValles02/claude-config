// Integration test for hooks/guard-subagent-git.js: spawns the real hook with a PreToolUse payload on stdin.
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const hook = fileURLToPath(new URL("../hooks/guard-subagent-git.js", import.meta.url));

const denyBash = [
  "git push", "git -c x=y push", "git --no-pager push", "git.exe push", "/usr/bin/git push",
  '"C:\\Program Files\\Git\\cmd\\git.exe" push', 'git -C "a b" push', 'bash -c "git push"', 'sh -c "git push"',
  'pwsh -c "git push"', 'powershell -Command "git push"', "cmd /c git push", '"gh" pr create', "gh.exe pr create",
  "git p", "git -c alias.p=push p", `git -c core.pager="sh -c 'git push'" log`, "git config user.name x",
  "git remote add o url", "git symbolic-ref HEAD refs/heads/x", "git notes add -m x", "git init", "git gc",
  "env git push", "command git push", "FOO=1 git push", "git status && git push", "git status; git push",
  "echo x | git push", "echo push | xargs git", "xargs git push", "echo $(git push)", "echo `git push`",
  "(git push)", "pwsh -EncodedCommand abc", 'echo "git push" | bash',
  `node -e "require('child_process').execSync('git push')"`,
  "gh api -X POST repos/o/r/issues", "gh api --method=PATCH repos/o/r", "gh api -XPOST x",
  "gh api graphql -f query=q", "gh api repos/o/r/issues -f title=t", "gh api x --input f.json",
  "gh pr merge 1", "gh release create v1", "gh issue close 1", "gh secret set X", "gh workflow run ci",
  "gh run rerun 1", "git update-ref refs/heads/x HEAD", "git tag v1", "git tag -d v1", "git branch -D x",
  "git branch newbranch", "git stash", "git stash pop", "git worktree add ../x", "git reset --hard",
  "git commit -m x", "git checkout main", "git fetch origin main:main", "git reflog expire --all",
  'git log "oops',
  "git fetch --upload-pack='git push #' .", "git ls-remote --upload-pack=x origin", "git grep -Ovim foo",
  "git grep --open-files-in-pager=x foo", "git fetch origin main --refmap=refs/heads/*:refs/heads/*",
  "git fetch --set-upstream origin main", "git diff --output=f", "git diff --ext-diff", "git fetch -u origin",
  "GIT_EXTERNAL_DIFF='git push #' git diff", "GIT_SSH_COMMAND=x git fetch", "GIT_PAGER=x git log",
  "GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=alias.x GIT_CONFIG_VALUE_0=push git x", "export GIT_EXTERNAL_DIFF=x; git diff",
  "env GIT_PAGER=x git log",
  "if true; then git push; fi", "for i in 1; do git push; done", "while true; do git push; done", "! git push",
  "/usr/bin/gi? push", "/mingw64/bin/g*t push", "a=gi; ${a}t push", "$(echo gi)t push", "{git,push}",
  "find . -exec git push \\;", "env -S 'git push'", "pnpm exec git push", "npx git push", "watch git push",
  "echo Z2l0IHB1c2g= | base64 -d | bash", "echo x | sh", "bash -s", "echo x | pwsh -",
  "env -iS 'git push'", "env -vS'git push'", "git ls-remote -u'git push #' .", "git fetch -ux .",
  "read GIT_EXTERNAL_DIFF <<< 'git push #'; export GIT_EXTERNAL_DIFF; git diff", "printf -v GIT_PAGER x; git log",
  "parallel git push ::: a", '"$HOME/bin/git" push', "$X/git.exe push", "GIT_PAGER=less git log",
];
const denyPs = [
  "& git push", 'iex "git push"', "Start-Process git -ArgumentList push", "\u201cgit\u201d push", "\u2018git\u2019 push",
  "git <#x#> push", "$c='gi'+'t'; & $c push", "& $c push", "& (gcm git) push", "$env:GIT_EXTERNAL_DIFF='x'; git diff",
  "Set-Item env:GIT_X x", "$x = git push", "echo Z2l0 | pwsh",
  "[Environment]::SetEnvironmentVariable('GIT_EXTERNAL_DIFF','x'); git diff", "\u201bgit\u201b push",
  "echo '<#'; git push; '#>'", "$x = & $c push", "$null = & $c push", "[ScriptBlock]::Create('git push').Invoke()",
  'Invoke-Command -ScriptBlock ([ScriptBlock]::Create("git push"))', "$ExecutionContext.InvokeCommand.InvokeScript('git push')",
];
const allowBash = [
  "git status", "git log --oneline -5", "git diff main...HEAD", "git show HEAD:README.md", "git rev-parse HEAD",
  "git ls-files", "git blame README.md", "git branch", "git branch -a", "git branch --show-current",
  "git branch --list 'feat/*'", "git branch --contains HEAD", "git remote -v", "git remote get-url origin",
  "git config --get user.name", "git config --list", 'git -C "a b" status', "git --no-pager log",
  "git -c color.ui=never diff", "/usr/bin/git status", "git.exe status", "git stash list", "git worktree list",
  "git tag -l", "git symbolic-ref --short HEAD", "git merge-tree a b", "git fetch origin", "git status && git log",
  "git log | head -5", "git diff 2>&1 | head", 'bash -c "git status"', "gh pr list", "gh pr view 1", "gh pr diff 1",
  "gh pr checks 1", "gh issue list", "gh issue view 1", "gh run list", "gh run view 1", "gh auth status",
  "gh search issues foo", "gh api repos/o/r/pulls", "gh api -X GET search/issues -f q=foo",
  "gh api --method GET x --paginate", "grep -rn git hooks/", "ls", "node tests/guard-cases.mjs",
  "git ls-files | xargs grep -l git", "timeout 10 grep -rn git .", "FOO=1 git status", "git log --format='%H %s'",
  'grep -rn "git push" .', "gh pr view 1 --json title", "gh api repos/o/r/pulls/1/comments --paginate",
  "[ -f x ] && git status", "git diff -U5 --stat",
  '"$HOME/bin/tool" --version', "$PNPM_HOME/pnpm test", '"$(pwd)/node_modules/.bin/tsc" --noEmit',
  "GIT_PAGER=cat git log -1", "GIT_PAGER= git log",
];
const allowPs = ["& git status", "Get-ChildItem", "Get-ChildItem | Where-Object { $_ -match 'git' }"];

const cases = [
  ...denyBash.map((command) => ({ tool: "Bash", command, agent: true, expect: "deny" })),
  ...denyPs.map((command) => ({ tool: "PowerShell", command, agent: true, expect: "deny" })),
  ...allowBash.map((command) => ({ tool: "Bash", command, agent: true, expect: "allow" })),
  ...allowPs.map((command) => ({ tool: "PowerShell", command, agent: true, expect: "allow" })),
  { name: "main thread git push", tool: "Bash", command: "git push", agent: false, expect: "allow" },
  { name: "non-Bash tool with agent_id", tool: "Read", command: "git push", agent: true, expect: "allow" },
  { name: "malformed JSON with agent_id", raw: '{"agent_id": "a1", "tool_name": "Bash", "tool_input": {', expect: "deny" },
  { name: "non-string command", raw: JSON.stringify({ agent_id: "a1", tool_name: "Bash", tool_input: { command: 5 } }), expect: "deny" },
];

let passed = 0, failed = 0;
for (const c of cases) {
  const name = c.name || `${c.tool} ${c.command}`;
  const stdin =
    c.raw ??
    JSON.stringify({
      ...(c.agent ? { agent_id: "a1", agent_type: "implementer" } : {}),
      tool_name: c.tool,
      tool_input: { command: c.command },
    });
  const r = spawnSync(process.execPath, [hook], { input: stdin, encoding: "utf8" });
  let got = "error";
  if (r.status === 0) {
    if (r.stdout === "") got = "allow";
    else {
      try { got = JSON.parse(r.stdout).hookSpecificOutput.permissionDecision === "deny" ? "deny" : "error"; } catch {}
    }
  }
  if (got === c.expect) passed++;
  else { failed++; console.log(`FAIL [expected ${c.expect}, got ${got}] ${name}`); }
}
console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
