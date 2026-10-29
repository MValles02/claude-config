// TEMPORARY while GitHub Actions is unavailable: delete with the orchestrator's "Temporary" section.
// Usage: node merge-develop-without-ci.mjs <owner/repo> <pr-number> [--dry-run]
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [repo, pr, flag] = process.argv.slice(2);
const dry = flag === '--dry-run';
const die = (m, c = 1) => { console.error(m); process.exit(c); };
if (!repo || !pr) die('Usage: <owner/repo> <pr-number> [--dry-run]');
const gh = (args, input) => execFileSync('gh', args, { encoding: 'utf8', input });

const v = JSON.parse(gh(['pr', 'view', pr, '-R', repo, '--json', 'baseRefName,state,headRefOid,mergeable,isDraft']));
if (v.baseRefName !== 'develop') die(`Refusing: base is not develop (is ${v.baseRefName})`);
if (v.state !== 'OPEN') die(`Refusing: PR state is ${v.state}`);
if (v.isDraft) die('Refusing: PR is a draft');
if (v.mergeable === 'CONFLICTING') die('Refusing: PR has conflicts');

const found = JSON.parse(gh(['api', `repos/${repo}/rulesets`])).find((r) => r.name === 'develop');
if (!found) die('Refusing: no ruleset named develop');
const id = found.id;
const url = `repos/${repo}/rulesets/${id}`;
const full = JSON.parse(gh(['api', url]));
const backup = join(tmpdir(), `ruleset-${repo.replace('/', '-')}-${id}-${Date.now()}.json`);
writeFileSync(backup, JSON.stringify(full, null, 2));
console.log(`Backup: ${backup}`);

const body = (rules) => JSON.stringify({ name: full.name, target: full.target, enforcement: full.enforcement, conditions: full.conditions, bypass_actors: full.bypass_actors, rules });
const kept = full.rules.filter((r) => r.type !== 'required_status_checks');
if (dry) {
  console.log(`DRY RUN: repo=${repo} pr=${pr} head=${v.headRefOid} ruleset=${id} kept rules=${kept.map((r) => r.type).join(',')}`);
  process.exit(0);
}
const snap = (r) => JSON.stringify({ enforcement: r.enforcement, conditions: r.conditions, rules: r.rules, bypass_actors: r.bypass_actors });

gh(['api', '-X', 'PUT', url, '--input', '-'], body(kept));
try {
  gh(['pr', 'merge', pr, '-R', repo, '--squash', '--match-head-commit', v.headRefOid]);
} finally {
  gh(['api', '-X', 'PUT', url, '--input', '-'], body(full.rules));
  if (snap(JSON.parse(gh(['api', url]))) !== snap(full)) die(`RESTORE MISMATCH — ruleset ${id} differs from backup ${backup}`, 2);
}
console.log(gh(['pr', 'view', pr, '-R', repo, '--json', 'mergeCommit', '--jq', '.mergeCommit.oid']).trim());
