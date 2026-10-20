const fs = require("fs");

// Git and GitHub writes belong to the main session (orchestrator). Subagent prompts already say so;
// this PreToolUse hook enforces it. `agent_id` is present only for tool calls made inside a subagent.
// Read-only forms stay allowed: `git merge-tree`, `git worktree list`, `git stash list|show`,
// `git tag -l|--list`, and `gh api` GETs (no -X/--method other than GET, no field or input flags).
const GIT_WRITE =
  /(^|[\s;&|(`])git\s+(?:-C\s+\S+\s+)?(?:(?:commit|push|pull|merge|rebase|reset|checkout|switch|restore|add|rm|mv|clean|cherry-pick|revert|am|apply|update-ref)(?![\w-])|stash(?!\s+(?:list|show)\b)|tag(?!\s+(?:-l|--list)\b)(?![\w-])|worktree(?!\s+list\b)|branch\s+(?!--show-current|--list|-a\b|-r\b|-vv?\b|--contains|--merged|--no-merged)\S)/;
const GH_WRITE = /(^|[\s;&|(`])gh\s+(?!(?:pr|issue|run|repo|release)\s+(?:view|list|checks|diff|status)\b|api\s)\S/;
const GH_API = /(^|[\s;&|(`])gh\s+api\s/;
const GH_API_WRITE = /\s(?:-X\s*|--method[\s=]+)(?!GET\b)\w|\s(?:-f|-F|--field|--raw-field|--input)[\s=]/i;

try {
  const { agent_id, agent_type, tool_name, tool_input } = JSON.parse(fs.readFileSync(0, "utf8"));
  const command = String((tool_input && tool_input.command) || "");
  if (agent_id && tool_name === "Bash" && (GIT_WRITE.test(command) || GH_WRITE.test(command) || (GH_API.test(command) && GH_API_WRITE.test(command)))) {
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "deny",
          permissionDecisionReason: `Subagent ${agent_type || ""} may only run read-only git/gh (status, diff, log, show, merge-tree, worktree list, stash list; gh view/list/checks/diff, gh api GET). Leave the change in the working tree and report it; the orchestrator owns commits, branches, pushes and GitHub.`,
        },
      }),
    );
  }
} catch {}
process.exit(0);
