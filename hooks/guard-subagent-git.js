const fs = require("fs");

// Git and GitHub writes belong to the main session (orchestrator). Subagent prompts already say so;
// this PreToolUse hook enforces it. `agent_id` is present only for tool calls made inside a subagent.
const GIT_WRITE =
  /(^|[\s;&|(`])git\s+(?:-C\s+\S+\s+)?(?:commit|push|pull|merge|rebase|reset|checkout|switch|restore|stash|tag|add|rm|mv|clean|cherry-pick|revert|am|apply|update-ref|worktree|branch\s+(?!--show-current|--list|-a\b|-r\b|-vv?\b|--contains|--merged|--no-merged)\S)/;
const GH_WRITE = /(^|[\s;&|(`])gh\s+(?!(?:pr|issue|run|repo|release)\s+(?:view|list|checks|diff|status)\b)\S/;

try {
  const { agent_id, agent_type, tool_name, tool_input } = JSON.parse(fs.readFileSync(0, "utf8"));
  const command = String((tool_input && tool_input.command) || "");
  if (agent_id && tool_name === "Bash" && (GIT_WRITE.test(command) || GH_WRITE.test(command))) {
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "deny",
          permissionDecisionReason: `Subagent ${agent_type || ""} may only run read-only git/gh (status, diff, log, show; gh view/list/checks/diff). Leave the change in the working tree and report it; the orchestrator owns commits, branches, pushes and GitHub.`,
        },
      }),
    );
  }
} catch {}
process.exit(0);
