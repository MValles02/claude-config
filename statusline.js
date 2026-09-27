#!/usr/bin/env node
"use strict";

const { execSync } = require("child_process");
const path = require("path");

const RESET = "\x1b[0m";
const DIM = "\x1b[2m";
const CYAN = "\x1b[36m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";
const MAGENTA = "\x1b[35m";
const BLUE = "\x1b[34m";

function pctColor(pct) {
  if (pct > 80) return RED;
  if (pct > 50) return YELLOW;
  return GREEN;
}

function run(cmd, cwd) {
  try {
    return execSync(cmd, { cwd, stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return "";
  }
}

const fs = require("fs");
const LOG_PATH = path.join(__dirname, "statusline.log");

function logError(err, rawInput) {
  try {
    fs.appendFileSync(
      LOG_PATH,
      `[${new Date().toISOString()}] ${err && err.stack ? err.stack : err}\nraw input: ${rawInput}\n\n`
    );
  } catch {
    // ignore logging failures
  }
}

let input = "";
process.stdin.on("data", (d) => (input += d));
process.stdin.on("end", () => {
  try {
    main(input);
  } catch (err) {
    logError(err, input);
    console.log(`statusline error - see ${LOG_PATH}`);
  }
});

function main(input) {
  let data;
  try {
    data = JSON.parse(input);
  } catch {
    data = {};
  }

  const parts = [];

  // thread-title
  if (data.session_name) {
    parts.push(`${DIM}${data.session_name}${RESET}`);
  }

  // model-with-reasoning
  const modelName = data.model?.display_name || data.model?.id || "";
  const effort = data.effort?.level;
  if (modelName) {
    parts.push(`${MAGENTA}${modelName}${effort ? ` (${effort})` : ""}${RESET}`);
  }

  // current-dir
  const cwd = data.workspace?.current_dir || data.cwd || process.cwd();
  parts.push(`${CYAN}${path.basename(cwd)}${RESET}`);

  // git-branch + branch-changes
  const branch = run("git branch --show-current", cwd);
  if (branch) {
    parts.push(`${GREEN}${branch}${RESET}`);
    const stat = run("git diff --shortstat HEAD", cwd);
    const added = /(\d+) insertion/.exec(stat);
    const removed = /(\d+) deletion/.exec(stat);
    if (added || removed) {
      parts.push(`${GREEN}+${added ? added[1] : 0}${RESET}/${RED}-${removed ? removed[1] : 0}${RESET}`);
    }
  }

  // context-used
  const ctxPct = data.context_window?.used_percentage;
  if (typeof ctxPct === "number") {
    parts.push(`${pctColor(ctxPct)}ctx ${ctxPct.toFixed(0)}%${RESET}`);
  }

  // five-hour-limit
  const fiveHour = data.rate_limits?.five_hour?.used_percentage;
  if (typeof fiveHour === "number") {
    parts.push(`${pctColor(fiveHour)}5h ${fiveHour.toFixed(0)}%${RESET}`);
  }

  // weekly-limit (7-day window)
  const weekly = data.rate_limits?.seven_day?.used_percentage;
  if (typeof weekly === "number") {
    parts.push(`${pctColor(weekly)}7d ${weekly.toFixed(0)}%${RESET}`);
  }

  console.log(parts.join(` ${DIM}|${RESET} `));
}
