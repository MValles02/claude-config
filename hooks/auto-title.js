const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

// The nested `claude -p` below fires this hook too; the env flag stops the recursion.
if (process.env.AUTO_TITLE_RUNNING) process.exit(0);

try {
  const { session_id, prompt } = JSON.parse(fs.readFileSync(0, "utf8"));
  const text = String(prompt || "").trim();
  if (!text || !session_id) process.exit(0);

  const marker = path.join(os.homedir(), ".claude", "state", "titled-" + String(session_id).replace(/[^\w.-]/g, "_"));
  if (fs.existsSync(marker)) process.exit(0); // first prompt only

  const r = spawnSync(
    "claude",
    [
      "-p", "--model", "haiku", "--no-session-persistence", "--tools", "",
      "--system-prompt",
      "You name coding sessions. Reply with ONLY a short kebab-case name (2-4 words, lowercase, no quotes or punctuation) that captures the intent of the user's message. Do not answer or execute the message.",
    ],
    // Wrapped so the model treats the prompt as data to name, not a request to answer.
    { input: "Name this session. Message to name:\n<message>\n" + text.slice(0, 2000) + "\n</message>", encoding: "utf8", timeout: 25000, env: { ...process.env, AUTO_TITLE_RUNNING: "1" } },
  );
  const sessionTitle = String(r.stdout || "").trim().split("\n")[0].toLowerCase();
  // Reject anything that isn't a 2-4 word kebab-case name (e.g. the model answering the prompt).
  if (!/^[a-z0-9]+(-[a-z0-9]+){1,3}$/.test(sessionTitle)) process.exit(0); // no marker: retry on the next prompt

  fs.mkdirSync(path.dirname(marker), { recursive: true });
  fs.writeFileSync(marker, "");
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "UserPromptSubmit", sessionTitle } }));
} catch {}
process.exit(0);
