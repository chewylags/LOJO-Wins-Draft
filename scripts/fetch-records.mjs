/* ------------------------------------------------------------------
   Fetch current NFL records and write records.json.

   Runs in GitHub Actions on a schedule so the site has fresh records
   without anyone pressing anything. The page can also refresh itself
   live — ESPN sends access-control-allow-origin: * — but this keeps the
   published file current for whoever opens the site cold.

   Parsing is shared with the page via records-parse.js so the two can
   never drift. No dependencies beyond Node's built-in fetch.
------------------------------------------------------------------ */

import { readFile, writeFile } from 'node:fs/promises';

const OUT = new URL('../records.json', import.meta.url);
const TEAMS_FILE = new URL('../teams.js', import.meta.url);
const PARSE_FILE = new URL('../records-parse.js', import.meta.url);

/* ---- load the browser files as plain scripts --------------------- */

async function loadShared() {
  const teamsSrc = await readFile(TEAMS_FILE, 'utf8');
  const parseSrc = await readFile(PARSE_FILE, 'utf8');
  const teams = new Function(teamsSrc + '; return TEAMS;')();
  const parse = new Function(
    parseSrc.replace(/^if \(typeof module[\s\S]*$/m, '') + '; return RecordsParse;'
  )();
  return { valid: new Set(teams.map((t) => t.abbr)), parse };
}

async function main() {
  const { valid, parse } = await loadShared();
  let best = null;

  for (const url of parse.SOURCES) {
    try {
      const res = await fetch(url, {
        headers: { 'user-agent': 'lojo-wins-draft (github actions)' },
      });
      if (!res.ok) {
        console.log(`  ${res.status}  ${url}`);
        continue;
      }
      const records = parse.harvest(await res.json(), valid);
      const teams = Object.keys(records).length;
      const played = parse.played(records);
      console.log(`  ok    ${url}\n        ${teams} teams, ${played} with games played`);

      if (!best || played > best.played || (played === best.played && teams > best.teams)) {
        best = { url, records, teams, played };
      }
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
    records: Object.fromEntries(
      Object.keys(best.records).sort().map((k) => [k, best.records[k]])
    ),
  };

  let previous = null;
  try {
    previous = JSON.parse(await readFile(OUT, 'utf8'));
  } catch {
    /* first run */
  }

  if (previous && JSON.stringify(previous.records) === JSON.stringify(payload.records)) {
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
