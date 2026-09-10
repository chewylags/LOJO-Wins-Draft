/* ------------------------------------------------------------------
   TEMPORARY: look up past-season records so history.js can be filled in
   from real data rather than memory. Runs in Actions (which has network);
   read the results from the job log. Delete once the seasons are entered.
------------------------------------------------------------------ */

const SEASONS = [2023, 2024];

// Teams whose game-by-game record is needed to split a swapped slot.
const SPLIT = {
  2024: ['mia', 'tb', 'jax', 'min'],
  2023: ['nyj', 'gb'],
};

const get = async (url) => {
  const res = await fetch(url, { headers: { 'user-agent': 'lojo-wins-draft (actions)' } });
  if (!res.ok) throw new Error(res.status + ' ' + url);
  return res.json();
};

/* ---- final regular-season standings ------------------------------ */

function walkStandings(node, out = {}, seen = new WeakSet()) {
  if (!node || typeof node !== 'object' || seen.has(node)) return out;
  seen.add(node);
  const team = node.team && typeof node.team === 'object' ? node.team : null;
  if (team && typeof team.abbreviation === 'string' && Array.isArray(node.stats)) {
    const pick = (n) => {
      const s = node.stats.find((x) => x && (x.name === n || x.type === n));
      return s && Number.isFinite(Number(s.value)) ? Number(s.value) : null;
    };
    const w = pick('wins'), l = pick('losses');
    if (w !== null && l !== null) {
      out[team.abbreviation.toUpperCase()] = { w, l, t: pick('ties') ?? 0 };
    }
  }
  for (const k of Object.keys(node)) walkStandings(node[k], out, seen);
  return out;
}

async function standings(season) {
  const urls = [
    `https://site.web.api.espn.com/apis/v2/sports/football/nfl/standings?region=us&lang=en&contentorigin=espn&type=0&level=1&season=${season}`,
    `https://site.api.espn.com/apis/site/v2/sports/football/nfl/standings?season=${season}&seasontype=2`,
  ];
  for (const url of urls) {
    try {
      const found = walkStandings(await get(url));
      if (Object.keys(found).length >= 30) return { url, found };
      console.log(`  (only ${Object.keys(found).length} teams from ${url})`);
    } catch (err) {
      console.log(`  (failed ${url}: ${err.message})`);
    }
  }
  return null;
}

/* ---- game by game, to find where a swap cuts --------------------- */

async function gameLog(team, season) {
  const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/${team}/schedule?season=${season}&seasontype=2`;
  const data = await get(url);
  const rows = [];
  for (const ev of data.events || []) {
    const comp = (ev.competitions || [])[0];
    if (!comp) continue;
    const mine = (comp.competitors || []).find(
      (c) => (c.team?.abbreviation || '').toLowerCase() === team.toLowerCase()
    );
    const opp = (comp.competitors || []).find((c) => c !== mine);
    if (!mine) continue;
    let result = mine.winner === true ? 'W' : mine.winner === false ? 'L' : 'T';
    if (comp.status?.type?.completed === false) continue;
    rows.push({
      week: ev.week?.number ?? comp.week ?? null,
      opp: opp?.team?.abbreviation || '?',
      home: mine.homeAway === 'home',
      result,
      score: `${mine.score?.value ?? mine.score?.displayValue ?? '?'}-${opp?.score?.value ?? opp?.score?.displayValue ?? '?'}`,
    });
  }
  rows.sort((a, b) => (a.week || 0) - (b.week || 0));
  return rows;
}

function cumulative(rows) {
  let w = 0, l = 0, t = 0;
  return rows.map((r) => {
    if (r.result === 'W') w++; else if (r.result === 'L') l++; else t++;
    return { ...r, after: `${w}-${l}${t ? '-' + t : ''}`, played: w + l + t };
  });
}

/* ---- main -------------------------------------------------------- */

for (const season of SEASONS) {
  console.log(`\n================ ${season} FINAL REGULAR SEASON ================`);
  const res = await standings(season);
  if (!res) {
    console.log('  could not retrieve standings');
  } else {
    console.log(`  source: ${res.url}`);
    const keys = Object.keys(res.found).sort();
    console.log(`  ${keys.length} teams`);
    console.log(
      keys.map((k) => `${k} ${res.found[k].w}-${res.found[k].l}${res.found[k].t ? '-' + res.found[k].t : ''}`).join('   ')
    );
  }

  for (const team of SPLIT[season] || []) {
    console.log(`\n---- ${team.toUpperCase()} ${season} week by week ----`);
    try {
      const rows = cumulative(await gameLog(team, season));
      for (const r of rows) {
        console.log(
          `   wk ${String(r.week).padStart(2)}  ${r.result}  ${r.home ? 'vs' : '@ '} ${String(r.opp).padEnd(4)} ${String(r.score).padEnd(8)} -> ${r.after} (${r.played} played)`
        );
      }
    } catch (err) {
      console.log('   failed: ' + err.message);
    }
  }
}
