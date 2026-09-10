/* ------------------------------------------------------------------
   Fetch current NFL records and write records.json.

   This runs in GitHub Actions, not in the browser. That matters: a
   server-side fetch has no CORS to satisfy, which is what makes this
   dependable where a fetch from the page was not.

   No dependencies — Node's built-in fetch only.
------------------------------------------------------------------ */

import { readFile, writeFile } from 'node:fs/promises';

const OUT = new URL('../records.json', import.meta.url);
const TEAMS_FILE = new URL('../teams.js', import.meta.url);

// Candidate sources, tried in order until one yields real records.
const SOURCES = [
  'https://site.api.espn.com/apis/site/v2/sports/football/nfl/standings',
  'https://site.web.api.espn.com/apis/v2/sports/football/nfl/standings?region=us&lang=en&contentorigin=espn&type=0&level=1',
  'https://cdn.espn.com/core/nfl/standings?xhr=1',
  'https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams',
  'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard',
];

/* ---- the 32 valid abbreviations, read from teams.js -------------- */
async function loadAbbrs() {
  const src = await readFile(TEAMS_FILE, 'utf8');
  const fn = new Function(src + '; return TEAMS;');
  return new Set(fn().map((t) => t.abbr));
}

/* ---- pull W-L-T out of whatever shape ESPN hands back ------------ */

const isRecordString = (s) => typeof s === 'string' && /^\d{1,2}-\d{1,2}(-\d{1,2})?$/.test(s);

function parseRecordString(s) {
  const [w, l, t = 0] = s.split('-').map(Number);
  return { w, l, t };
}

// A standings entry carries stats like {name:"wins", value:1}. Prefer those.
function fromStats(stats) {
  if (!Array.isArray(stats)) return null;
  const pick = (name) => {
    const s = stats.find((x) => x && (x.name === name || x.type === name));
    return s && Number.isFinite(Number(s.value)) ? Number(s.value) : null;
  };
  const w = pick('wins');
  const l = pick('losses');
  if (w === null || l === null) return null;
  return { w, l, t: pick('ties') ?? 0 };
}

// Otherwise look for a record summary ("1-0") near the team object.
function fromSummary(node, depth = 0) {
  if (!node || typeof node !== 'object' || depth > 4) return null;
  if (isRecordString(node.summary)) return parseRecordString(node.summary);
  if (isRecordString(node.displayValue) && node.type === 'total') {
    return parseRecordString(node.displayValue);
  }
  for (const key of Object.keys(node)) {
    const found = fromSummary(node[key], depth + 1);
    if (found) return found;
  }
  return null;
}

function harvest(node, valid, out = {}, seen = new WeakSet()) {
  if (!node || typeof node !== 'object' || seen.has(node)) return out;
  seen.add(node);

  // Standings entries nest the team one level down; team lists don't.
  const team = node.team && typeof node.team === 'object' ? node.team : node;
  const abbr = typeof team.abbreviation === 'string' ? team.abbreviation.toUpperCase() : null;

  if (abbr && valid.has(abbr) && !out[abbr]) {
    const rec = fromStats(node.stats) ?? fromSummary(node);
    if (rec && rec.w + rec.l + rec.t <= 17) out[abbr] = rec;
  }

  for (const key of Object.keys(node)) harvest(node[key], valid, out, seen);
  return out;
}

/* ---- main -------------------------------------------------------- */

async function main() {
  const valid = await loadAbbrs();
  let best = null;

  for (const url of SOURCES) {
    try {
      const res = await fetch(url, {
        headers: { 'user-agent': 'lojo-wins-draft (github actions)' },
      });
      if (!res.ok) {
        console.log(`  ${res.status}  ${url}`);
        continue;
      }
      const json = await res.json();
      const records = harvest(json, valid);
      const teams = Object.keys(records).length;
      const played = Object.values(records).filter((r) => r.w + r.l + r.t > 0).length;
      console.log(`  ok    ${url}\n        ${teams} teams, ${played} with games played`);

      // Keep the response that knows about the most games.
      if (!best || played > best.played || (played === best.played && teams > best.teams)) {
        best = { url, records, teams, played };
      }
      // A full slate of 32 teams with games played is as good as it gets.
      if (teams === 32 && played > 0) break;
    } catch (err) {
      console.log(`  fail  ${url}\n        ${err.message}`);
    }
  }

  if (!best || best.teams === 0) {
    console.error('No source returned usable records.');
    process.exit(1);
  }

  const payload = {
    updated: new Date().toISOString(),
    source: best.url,
    teams: best.teams,
    played: best.played,
    records: Object.fromEntries(Object.keys(best.records).sort().map((k) => [k, best.records[k]])),
  };

  let previous = null;
  try {
    previous = JSON.parse(await readFile(OUT, 'utf8'));
  } catch {
    /* first run */
  }

  const same =
    previous && JSON.stringify(previous.records) === JSON.stringify(payload.records);
  if (same) {
    console.log('\nRecords unchanged since last run.');
    return;
  }

  await writeFile(OUT, JSON.stringify(payload, null, 2) + '\n');
  console.log(`\nWrote records.json from ${best.url}`);
  console.log(
    Object.entries(payload.records)
      .map(([k, r]) => `${k} ${r.w}-${r.l}${r.t ? '-' + r.t : ''}`)
      .join('  ')
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
