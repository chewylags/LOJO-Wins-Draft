/* ------------------------------------------------------------------
   Publish a draft so the plain site URL shows it to everyone.

   Takes a share link (or the bare code out of one) and writes draft.json.
   The page loads that file and adopts it when it is newer than whatever
   the visitor's own browser has — which is how a draft made on one phone
   reaches the other one on a refresh.

   Input arrives as DRAFT_INPUT. No secrets involved: the workflow commits
   with GITHUB_TOKEN, exactly like the records job.
------------------------------------------------------------------ */

import { readFile, writeFile } from 'node:fs/promises';

const raw = (process.env.DRAFT_INPUT || '').trim();
if (!raw) {
  console.error('::error::no draft link or code given');
  process.exit(1);
}

// Accept a whole share URL or just the code after "#d=".
const match = /[#&?]d=([A-Za-z0-9_-]+)/.exec(raw);
const code = match ? match[1] : raw;

if (!/^[A-Za-z0-9_-]+$/.test(code)) {
  console.error('::error::that does not look like a draft code — paste the Share link');
  process.exit(1);
}

function b64urlDecode(str) {
  let b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) b64 += '=';
  return Buffer.from(b64, 'base64').toString('utf8');
}

let payload;
try {
  payload = JSON.parse(b64urlDecode(code));
} catch {
  console.error('::error::could not decode that draft code');
  process.exit(1);
}

// Sanity-check against the real team list before publishing it to both of you.
const teamsSrc = await readFile(new URL('../teams.js', import.meta.url), 'utf8');
const teams = new Function(teamsSrc + '; return TEAMS;')();
const valid = new Set(teams.map((t) => t.abbr));

const picks = Array.isArray(payload.p) ? payload.p : [];
const unknown = picks.filter((p) => !valid.has(p));
if (unknown.length) {
  console.error(`::error::unknown teams in the draft: ${unknown.join(', ')}`);
  process.exit(1);
}
if (new Set(picks).size !== picks.length) {
  console.error('::error::the same team is drafted twice');
  process.exit(1);
}

const names = Array.isArray(payload.n) ? payload.n : ['Player 1', 'Player 2'];
const size = Number(payload.z) || 6;

await writeFile(
  'draft.json',
  JSON.stringify(
    {
      publishedAt: new Date().toISOString(),
      season: payload.s || '',
      players: names,
      picks,
      code,
    },
    null,
    2
  ) + '\n'
);

console.log(`published ${picks.length} of ${size * 2} picks for ${names.join(' vs ')}`);
console.log(`  ${picks.join(', ') || '(none yet)'}`);
