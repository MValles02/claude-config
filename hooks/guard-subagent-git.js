"use strict";
const fs = require("fs");

// Git and GitHub writes belong to the main session (orchestrator). Subagent prompts already say so;
// this PreToolUse hook enforces it. `agent_id` is present only for tool calls made inside a subagent.
// Approach: tokenize the Bash/PowerShell command (quotes, separators, substitutions, wrappers, -c payloads),
// then allow only an explicit read-only allow-list of git/gh. Unknown subcommands (incl. aliases) are writes.
// Fail closed: any parse error or exception inside a subagent call denies.
// ponytail: static analysis cannot see through variables, scripts, or aliases defined elsewhere; denies when a
// program cannot be resolved and the raw command mentions git/gh. Upgrade path: none short of sandboxing.

// Cannot stop: scripts run from files (`bash script.sh`, npm scripts, git hooks, make), variables built at
// runtime in PowerShell, decoded payloads that are not piped into a shell, anything a program does internally,
// `.git/config` edited through file tools (`diff.external`, aliases), and wrappers not listed in W.
const GIT_WORD =/\b(git|gh)(\.exe)?\b/i;
const norm = (t) => t.replace(/^.*[\\/]/, "").toLowerCase().replace(/\.(exe|cmd|bat)$/, "");
const variants = (t) => [norm(t), norm(t.replace(/\\/g, ""))];

// ---------- tokenizer ----------
function matchParen(s, open) {
  let depth = 0;
  for (let i = open; i < s.length; i++) {
    const c = s[i];
    if (c === "\\") i++;
    else if (c === "'") { i = s.indexOf("'", i + 1); if (i < 0) break; }
    else if (c === '"') {
      for (i++; i < s.length && s[i] !== '"'; i++) if (s[i] === "\\") i++;
    } else if (c === "(") depth++;
    else if (c === ")" && --depth === 0) return i;
  }
  throw new Error("unbalanced $(");
}

function matchTick(s, open) {
  for (let i = open + 1; i < s.length; i++) {
    if (s[i] === "\\") i++;
    else if (s[i] === "`") return i;
  }
  throw new Error("unbalanced `");
}

function parse(s, ps) {
  const cmds = [], subs = [];
  let words = [], cur = null, dropNext = false;
  const endWord = () => {
    if (cur === null) return;
    if (dropNext) dropNext = false;
    else words.push(cur);
    cur = null;
  };
  const endCmd = () => { endWord(); dropNext = false; if (words.length) cmds.push(words); words = []; };
  const add = (c) => { cur = (cur || "") + c; };
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "'") {
      const j = s.indexOf("'", i + 1);
      if (j < 0) throw new Error("unbalanced '");
      add(s.slice(i + 1, j)); i = j;
    } else if (c === '"') {
      add("");
      let j = i + 1;
      for (;; j++) {
        if (j >= s.length) throw new Error('unbalanced "');
        const d = s[j];
        if (d === '"') break;
        if (!ps && d === "\\") {
          const n = s[j + 1];
          if (n === undefined) throw new Error('unbalanced "');
          if ('$`"\\'.includes(n)) add(n); else if (n !== "\n") add("\\" + n);
          j++;
        } else if (ps && d === "`") {
          if (s[j + 1] === undefined) throw new Error('unbalanced "');
          add(s[++j]);
        } else if (d === "$" && s[j + 1] === "(") {
          const e = matchParen(s, j + 1);
          subs.push(s.slice(j + 2, e)); add("$S"); j = e;
        } else if (!ps && d === "`") {
          const e = matchTick(s, j);
          subs.push(s.slice(j + 1, e)); add("$S"); j = e;
        } else add(d);
      }
      i = j;
    } else if (c === "\\" && !ps) {
      const n = s[i + 1];
      if (n !== undefined && /[\s'"\\$`;&|<>(){}*?#]/.test(n)) { if (n !== "\n") add(n); i++; } else add("\\");
    } else if (c === "`") {
      if (ps) { if (s[i + 1] !== undefined) add(s[++i]); }
      else { const e = matchTick(s, i); subs.push(s.slice(i + 1, e)); add("$S"); i = e; }
    } else if (c === "$" && s[i + 1] === "(") {
      const e = matchParen(s, i + 1);
      subs.push(s.slice(i + 2, e)); add("$S"); i = e;
    } else if (!ps && c === "{" && /^\{[^\s{};|&()<>]*,[^\s{};|&()<>]*\}/.test(s.slice(i))) {
      const m = /^\{[^\s{};|&()<>]*,[^\s{};|&()<>]*\}/.exec(s.slice(i))[0];
      add(m); i += m.length - 1;
    } else if (c === "$" && s[i + 1] === "{") {
      const j = s.indexOf("}", i);
      if (j < 0) throw new Error("unbalanced ${");
      add(s.slice(i, j + 1)); i = j;
    } else if (c === " " || c === "\t" || c === "\r") endWord();
    else if (c === "\n" || c === ";" || c === "|" || c === "(" || c === ")" || c === "{" || c === "}") endCmd();
    else if (c === "&" && s[i + 1] !== ">") {
      const afterAssign = cur !== null ? /^\$[\w:.]+\+?=$/.test(cur) && words.length === 0 : words.length > 0 && /^\+?=$/.test(words[words.length - 1]);
      if (ps && s[i + 1] !== "&" && s[i - 1] !== "&" && ((cur === null && words.length === 0) || afterAssign)) { endWord(); words.push("&"); }
      else endCmd();
    } else if ((c === ">" || c === "<" || c === "&") && s[i + 1] !== "(") {
      if (cur !== null && /^\d+$/.test(cur)) cur = null; else endWord();
      while (i + 1 < s.length && ">|&<".includes(s[i + 1])) i++;
      dropNext = true;
    } else if (c === "#" && cur === null) {
      while (i + 1 < s.length && s[i + 1] !== "\n") i++;
    } else add(c);
  }
  endCmd();
  return { cmds, subs };
}

// Join tokens back into a command line for re-parsing (payloads of sh -c / pwsh -c / cmd /c / eval).
const join = (t) =>
  t.length === 1 ? t[0] : t.map((x) => (x === "" || /[\s"'`$;&|()<>{}\\*?]/.test(x) ? "'" + x.replace(/'/g, "'\\''") + "'" : x)).join(" ");

// ---------- git ----------
const GIT_SKIP = new Set(["--no-pager", "-p", "--paginate", "-P", "--bare", "--no-replace-objects", "--literal-pathspecs", "--no-optional-locks"]);
const GIT_RO = new Set(
  ("status log diff show rev-parse ls-files ls-tree ls-remote blame annotate cat-file grep shortlog describe merge-base merge-tree rev-list " +
    "name-rev show-ref for-each-ref whatchanged diff-tree diff-files diff-index check-ignore check-attr check-ref-format count-objects " +
    "verify-commit verify-tag var version help range-diff cherry fetch").split(" "),
);
const cfgBad = (kv) => {
  if (kv === undefined) return "git -c without value";
  const key = kv.split("=")[0];
  return /^(color\..+|core\.quotepath|safe\.directory)$/i.test(key) ? null : `git -c ${key} (config injection)`;
};

function branchOk(r) {
  const listF = new Set(["--show-current", "--list", "-l", "-a", "--all", "-r", "--remotes", "-v", "-vv", "--verbose", "--color", "--no-color", "--column", "--no-column", "--ignore-case"]);
  const valF = new Set(["--contains", "--no-contains", "--merged", "--no-merged", "--points-at", "--sort", "--format"]);
  const list = r.some((t) => t === "--list" || /^-[larv]*l[larv]*$/.test(t));
  for (let k = 0; k < r.length; k++) {
    const t = r[k], name = t.split("=")[0];
    if (valF.has(name)) { if (!t.includes("=") && r[k + 1] !== undefined && !r[k + 1].startsWith("-")) k++; }
    else if (t.startsWith("-")) { if (!(listF.has(name) || /^-[larv]+$/.test(t))) return false; }
    else if (!list) return false;
  }
  return true;
}

function tagOk(r) {
  if (!r.length) return true;
  const valF = new Set(["--sort", "--contains", "--no-contains", "--points-at", "--format", "--merged", "--no-merged"]);
  const list = r.some((t) => t === "--list" || /^-[ln]+\d*$/.test(t) && t.includes("l"));
  if (!list) return r.some((t) => t === "-v" || t === "--verify") && r.every((t) => !t.startsWith("-") || t === "-v" || t === "--verify");
  for (let k = 0; k < r.length; k++) {
    const t = r[k], name = t.split("=")[0];
    if (valF.has(name)) { if (!t.includes("=") && r[k + 1] !== undefined && !r[k + 1].startsWith("-")) k++; }
    else if (t.startsWith("-") && !(t === "--list" || /^-[ln]+\d*$/.test(t) || t === "-i" || t === "--ignore-case" || /^--(no-)?(column|color)/.test(t))) return false;
  }
  return true;
}

function configOk(r) {
  if (r.some((t) => /^(--add|--replace-all|--unset|--unset-all|--rename-section|--remove-section|--edit|-e|--set)$/.test(t))) return false;
  if (r.some((t) => /^(--get|--get-all|--get-regexp|--get-urlmatch|--list|-l)$/.test(t))) return true;
  for (let k = 0; k < r.length; k++) {
    if (r[k] === "--file" || r[k] === "-f") k++;
    else if (!r[k].startsWith("-")) return r[k] === "get" || r[k] === "list";
  }
  return false;
}

// Flags that make a read-only subcommand run programs or write files. Long options may be abbreviated by git.
const DANGER_LONG = ["--upload-pack", "--receive-pack", "--exec", "--open-files-in-pager", "--output", "--output-directory", "--set-upstream", "--refmap", "--ext-diff"];
const OUT_SUBS = new Set(["diff", "log", "show", "whatchanged", "diff-tree", "diff-files", "diff-index", "range-diff", "format-patch"]);
function dangerousFlag(sub, r) {
  for (const t of r) {
    if (t === "--") break;
    if (t.startsWith("--")) {
      const n = t.split("=")[0];
      if (n.length >= 3 && DANGER_LONG.some((d) => d.startsWith(n))) return t;
    } else if (/^-u/.test(t) &&(sub === "fetch" || sub === "ls-remote")) return t;
    else if (/^-O/.test(t) && sub === "grep") return t;
    else if (/^-o/.test(t) && OUT_SUBS.has(sub)) return t;
  }
  return null;
}

function checkGit(a, xargs) {
  if (xargs) return "git via xargs (arguments unknown)";
  let i = 0;
  for (; i < a.length; i++) {
    const t = a[i];
    let bad = null;
    if (t === "-c" || t === "--config-env") bad = cfgBad(a[++i]);
    else if (t.startsWith("--config-env=")) bad = cfgBad(t.slice(13));
    else if (/^-c./.test(t)) bad = cfgBad(t.slice(2));
    else if (t === "-C" || t === "--git-dir" || t === "--work-tree" || t === "--namespace") i++;
    else if (/^--(git-dir|work-tree|namespace)=/.test(t) || GIT_SKIP.has(t)) continue;
    else if (t === "--version" || t === "--help" || t === "-h") return null;
    else if (t.startsWith("-")) bad = `git ${t} (unknown global option)`;
    else break;
    if (bad) return bad;
  }
  const sub = a[i], r = a.slice(i + 1);
  if (sub === undefined) return null;
  const deny = `git ${sub}`;
  const danger = dangerousFlag(sub, r);
  if (danger) return `git ${sub} ${danger} (can run commands or write)`;
  switch (sub) {
    case "fetch": return r.some((t) => !t.startsWith("-") && t.includes(":")) ? "git fetch with refspec" : null;
    case "branch": return branchOk(r) ? null : deny;
    case "tag": return tagOk(r) ? null : deny;
    case "stash": return r[0] === "list" || r[0] === "show" ? null : deny;
    case "worktree": return r[0] === "list" ? null : deny;
    case "notes": return r[0] === undefined || r[0] === "list" || r[0] === "show" ? null : deny;
    case "reflog": return r[0] === undefined || r[0] === "show" || r[0] === "exists" ? null : deny;
    case "submodule": return r[0] === "status" ? null : deny;
    case "remote": {
      const x = r.filter((t) => t !== "-v" && t !== "--verbose");
      return x[0] === undefined || x[0] === "show" || x[0] === "get-url" ? null : deny;
    }
    case "config": return configOk(r) ? null : deny;
    case "symbolic-ref": {
      const x = r.filter((t) => !["-q", "--quiet", "--short"].includes(t));
      return x.length === 1 && !x[0].startsWith("-") ? null : deny;
    }
    default: return GIT_RO.has(sub) ? null : deny;
  }
}

// ---------- gh ----------
const GH_OK = {
  pr: ["list", "view", "diff", "checks", "status"], issue: ["list", "view", "status"], run: ["list", "view", "watch"],
  repo: ["view", "list"], release: ["list", "view"], workflow: ["list", "view"], label: ["list"], auth: ["status"],
};

function checkGhApi(a) {
  let method = null, fields = false, endpoint = null;
  for (let k = 0; k < a.length; k++) {
    const t = a[k];
    if (t === "-X" || t === "--method") method = a[++k] ?? "";
    else if (/^-X./.test(t)) method = t.slice(2);
    else if (t.startsWith("--method=")) method = t.slice(9);
    else if (t === "--input" || t.startsWith("--input=")) return "gh api --input";
    else if (/^(-[fF]|--field|--raw-field)/.test(t)) { fields = true; if (/^(-[fF]|--field|--raw-field)$/.test(t)) k++; }
    else if (/^(-H|--header|-q|--jq|-t|--template|--cache|--hostname|-p|--preview)$/.test(t)) k++;
    else if (!t.startsWith("-") && endpoint === null) endpoint = t;
  }
  const get = method !== null && method.toUpperCase() === "GET";
  if (method !== null && !get) return `gh api -X ${method}`;
  if (endpoint !== null && /^\/?graphql\b/.test(endpoint)) return "gh api graphql";
  if (fields && !get) return "gh api with fields (implicit POST)";
  return null;
}

function checkGh(a) {
  const c = a[0];
  if (c === undefined || ["--version", "version", "help", "--help", "search", "status"].includes(c)) return null;
  if (c === "api") return checkGhApi(a.slice(1));
  if (GH_OK[c] && GH_OK[c].includes(a[1])) return null;
  return `gh ${a.slice(0, 2).join(" ")}`;
}

// ---------- wrappers / shells ----------
const W = {
  env: ["-u", "--unset", "-C", "--chdir", "-S", "--split-string"], command: [], exec: ["-a"], builtin: [], time: ["-f", "-o"],
  nice: ["-n", "--adjustment"], nohup: [], sudo: ["-u", "-g", "-h", "-p", "-C", "-D", "-R", "-T", "-U"],
  timeout: ["-s", "--signal", "-k", "--kill-after"], stdbuf: ["-i", "-o", "-e"],
  xargs: ["-I", "-n", "-P", "-d", "-L", "-s", "-E", "-a", "-l"], wsl: ["-d", "--distribution", "-u", "--user", "--cd"], ".": [],
  "&": [], pnpm: [], yarn: [], npx: ["-p", "--package"], pnpx: [], bunx: [], watch: ["-n", "--interval", "-d"], ionice: ["-c", "-n", "-p", "-P", "-u"],
  doas: ["-u", "-C"], runas: [], parallel: ["-j", "-n", "-N", "-L", "-S", "-a", "-d", "--jobs", "--max-args", "--arg-file", "--colsep"],
};
const KW = new Set(["if", "then", "elif", "else", "fi", "while", "until", "do", "done", "esac", "!", "coproc"]);
const HEADS = new Set(["for", "select", "case", "function"]);
const SHELLS = new Set(["sh", "bash", "zsh", "dash", "ksh", "ash"]);
const PS = new Set(["pwsh", "powershell"]);
const INTERP = {
  node: /^(-[a-z]*[ep][a-z]*|--eval|--print)$/, nodejs: /^(-[a-z]*[ep][a-z]*|--eval|--print)$/, bun: /^(-e|--eval|-p|--print)$/,
  deno: /^eval$/, perl: /^-\w*[eE]\w*$/, ruby: /^-\w*e\w*$/, php: /^-r$/, py: /^-\w*c\w*$/,
};
const PS_VALUE = ["executionpolicy", "workingdirectory", "windowstyle", "inputformat", "outputformat", "configurationname", "settingsfile", "custompipename"];

function checkCmd(words, ctx, ps) {
  const uninspectable = (what) => (GIT_WORD.test(ctx.raw) ? `${what} (payload cannot be inspected)` : null);
  for (const w of words) {
    const m = /^((?:GIT|GH)_\w*)\+?=(.*)$/i.exec(w);
    if (m && /^git_pager$/i.test(m[1]) && (m[2] === "" || m[2] === "cat")) continue;
    if (m || /^\$?env:(GIT|GH)_/i.test(w)) return `assignment of ${w.split("=")[0]} (env injection)`;
  }
  let i = 0, xargs = false, callOp = false;
  for (;;) {
    while (i < words.length && /^[A-Za-z_][A-Za-z0-9_]*\+?=/.test(words[i])) i++;
    if (ps && i < words.length) {
      if (/^\$[\w:.]+$/.test(words[i]) && /^\+?=$/.test(words[i + 1] || "")) { i += 2; continue; }
      const m = /^\$[\w:.]+\+?=(.+)$/.exec(words[i]);
      if (m) { words = words.slice(); words[i] = m[1]; }
    }
    if (i >= words.length) return callOp ? "call operator without a literal target" : null;
    if (!ps && KW.has(words[i])) { i++; continue; }
    if (!ps && HEADS.has(words[i])) return null;
    const vs = variants(words[i]);
    let wname = vs.find((v) => Object.prototype.hasOwnProperty.call(W, v));
    if ((wname === "pnpm" || wname === "yarn") && words[i + 1] !== "exec" && words[i + 1] !== "dlx") wname = undefined;
    if (wname === undefined) break;
    if (wname === "xargs" || wname === "parallel") xargs = true;
    if (wname === "&" || (ps && wname === ".")) callOp = true;
    i++;
    if (wname === "pnpm" || wname === "yarn") i++;
    if (wname === "runas") {
      while (i < words.length && words[i].startsWith("/")) i++;
      return i < words.length ? analyze(join(words.slice(i)), ctx, ps) : null;
    }
    while (i < words.length && words[i].startsWith("-") && words[i].length > 1) {
      const t = words[i];
      if (wname === "env") {
        const m = /^(?:-[A-Za-z]*S|--split-string=)(.+)$/.exec(t);
        if (m) return analyze(m[1], ctx, ps);
        if (/^-[A-Za-z]*S$/.test(t) || t === "--split-string") return words[i + 1] === undefined ? null : analyze(words[i + 1], ctx, ps);
      }
      if (wname === "npx" && (t === "-c" || t === "--call")) return words[i + 1] === undefined ? null : analyze(words[i + 1], ctx, ps);
      i += W[wname].includes(t) ? 2 : 1;
    }
    if (wname === "timeout") i++;
  }
  let prog = words[i];
  const rest = words.slice(i + 1);
  const NONLIT = /[$*?[]|\{[^}]*,/;
  if ((!ps || callOp) && !/^\[\[?$/.test(prog) && NONLIT.test(prog)) {
    const seg = prog.split(/[\\/]/).pop();
    if (seg === prog || NONLIT.test(seg) || variants(seg).some((v) => v === "git" || v === "gh")) return `non-literal program ${prog}`;
    prog = seg;
  }
  const vs = variants(prog);
  const is = (...names) => vs.some((v) => names.includes(v));
  if (is("export", "read", "declare", "typeset", "local", "readonly", "mapfile", "readarray") && rest.some((t) => /^(GIT|GH)_[A-Z0-9_]*$/i.test(t))) return `${prog} of GIT_*/GH_* variable`;
  if (is("printf") && rest[0] === "-v" && /^(GIT|GH)_[A-Z0-9_]*$/i.test(rest[1] || "")) return "printf -v GIT_*/GH_* variable";
  if (is("git")) return checkGit(rest, xargs);
  if (is("gh")) return xargs ? "gh via xargs (arguments unknown)" : checkGh(rest);
  if (is("find")) {
    for (let k = 0; k < rest.length; k++) {
      if (!/^-(exec|execdir|ok|okdir)$/.test(rest[k])) continue;
      const sub = [];
      for (k++; k < rest.length && rest[k] !== ";" && rest[k] !== "+"; k++) sub.push(rest[k]);
      const r = sub.length ? checkCmd(sub, ctx, ps) : null;
      if (r) return r;
    }
    return null;
  }
  if (vs.some((v) => SHELLS.has(v))) {
    let script = false;
    for (let k = 0; k < rest.length; k++) {
      const t = rest[k];
      if (/^-[a-zA-Z]+$/.test(t) && t.includes("c")) return rest[k + 1] === undefined ? uninspectable(prog) : analyze(rest[k + 1], ctx, false);
      if (t === "-o" || t === "-O") k++;
      else if (!t.startsWith("-")) { script = true; break; }
    }
    return script ? uninspectable(prog) : `${prog} reading commands from stdin`;
  }
  if (vs.some((v) => PS.has(v))) {
    for (let k = 0; k < rest.length; k++) {
      const t = rest[k];
      if (t.startsWith("-") && t.length > 1) {
        const n = t.slice(1).toLowerCase().split(":")[0];
        if ("encodedcommand".startsWith(n)) return `${prog} -EncodedCommand`;
        if ("command".startsWith(n)) return k + 1 < rest.length ? analyze(join(rest.slice(k + 1)), ctx, true) : uninspectable(prog);
        if ("file".startsWith(n)) return uninspectable(prog);
        if (n === "ep" || n === "wd" || n === "w" || (n.length > 1 && PS_VALUE.some((x) => x.startsWith(n)))) k++;
      } else return t === "-" ? `${prog} reading commands from stdin` : analyze(join(rest.slice(k)), ctx, true);
    }
    return `${prog} reading commands from stdin`;
  }
  if (is("cmd")) {
    let script = false;
    for (let k = 0; k < rest.length; k++) {
      const t = rest[k].toLowerCase();
      if (t === "/c" || t === "/k") return k + 1 < rest.length ? analyze(join(rest.slice(k + 1)), ctx, false) : null;
      if (/^\/[ck]./.test(t)) return analyze(join([rest[k].slice(2), ...rest.slice(k + 1)]), ctx, false);
      if (!t.startsWith("/")) { script = true; break; }
    }
    return script ? uninspectable(prog) : `${prog} reading commands from stdin`;
  }
  if (is("eval")) return rest.length ? analyze(join(rest), ctx, false) : null;
  if (is("invoke-expression", "iex")) return rest.length ? analyze(join(rest), ctx, true) : null;
  if (is("start-process", "saps", "start")) {
    return rest.some((t) => variants(t).some((v) => v === "git" || v === "gh") || GIT_WORD.test(t)) ? "Start-Process of git/gh" : null;
  }
  for (const v of vs) {
    const key = /^python[\d.]*$/.test(v) ? "py" : v;
    if (INTERP[key] && rest.some((t) => INTERP[key].test(t))) return uninspectable(`${v} inline code`);
  }
  return null;
}

// Replace PowerShell <# ... #> comments with a space, leaving quoted text alone.
function stripBlockComments(s) {
  let out = "", q = null;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) { out += c; if (q === '"' && c === "`" && i + 1 < s.length) out += s[++i]; else if (c === q) q = null; }
    else if (c === "'" || c === '"') { q = c; out += c; }
    else if (c === "<" && s[i + 1] === "#" && s.indexOf("#>", i + 2) >= 0) { i = s.indexOf("#>", i + 2) + 1; out += " "; }
    else out += c;
  }
  return out;
}

function analyze(s, ctx, ps) {
  if (ps) s = stripBlockComments(s.replace(/[“”„‟]/g, '"').replace(/[‘’‚‛]/g, "'"));
  const { cmds, subs } = parse(s, ps);
  for (const sub of subs) { const r = analyze(sub, ctx, ps); if (r) return r; }
  for (const c of cmds) { const r = checkCmd(c, ctx, ps); if (r) return r; }
  return null;
}

// ---------- main ----------
function deny(agentType, what) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: `Subagent ${agentType || ""} may only run read-only git/gh; blocked: ${what}. Leave the change in the working tree and report it; the orchestrator owns commits, branches, pushes and GitHub.`,
      },
    }),
  );
  process.exit(0);
}

let raw = "";
try { raw = fs.readFileSync(0, "utf8"); } catch {}
let input;
try { input = JSON.parse(raw); } catch {
  if (/"agent_id"\s*:/.test(raw)) deny("", "unparseable hook input");
  process.exit(0);
}
if (!input || typeof input !== "object" || !input.agent_id) process.exit(0);
if (input.tool_name !== "Bash" && input.tool_name !== "PowerShell") process.exit(0);
try {
  const command = input.tool_input && input.tool_input.command;
  if (typeof command !== "string") deny(input.agent_type, "non-string command");
  if (/SetEnvironmentVariable/i.test(command) && /\b(GIT|GH)_[A-Z0-9_]/i.test(command)) deny(input.agent_type, "SetEnvironmentVariable of GIT_*/GH_*");
  if (GIT_WORD.test(command) && /\[ScriptBlock\]::Create|\.InvokeScript\s*\(|\.Invoke\s*\(|\b(Invoke-Command|icm)\b.*-ScriptBlock/i.test(command)) deny(input.agent_type, "dynamic PowerShell script block mentioning git/gh");
  const r = analyze(command, { raw: command }, input.tool_name === "PowerShell");
  if (r) deny(input.agent_type, r);
} catch (e) {
  deny(input.agent_type, `command could not be analyzed (${e && e.message})`);
}
process.exit(0);
