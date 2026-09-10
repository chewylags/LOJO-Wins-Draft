/* TEMPORARY: verify 2025 final regular-season records. Delete after use. */
function walk(node, out = {}, seen = new WeakSet()) {
  if (!node || typeof node !== 'object' || seen.has(node)) return out;
  seen.add(node);
  const team = node.team && typeof node.team === 'object' ? node.team : null;
  if (team && typeof team.abbreviation === 'string' && Array.isArray(node.stats)) {
    const pick = (n) => {
      const s = node.stats.find((x) => x && (x.name === n || x.type === n));
      return s && Number.isFinite(Number(s.value)) ? Number(s.value) : null;
    };
    const w = pick('wins'), l = pick('losses');
    if (w !== null && l !== null) out[team.abbreviation.toUpperCase()] = { w, l, t: pick('ties') ?? 0 };
  }
  for (const k of Object.keys(node)) walk(node[k], out, seen);
  return out;
}
const url = 'https://site.web.api.espn.com/apis/v2/sports/football/nfl/standings?region=us&lang=en&contentorigin=espn&type=0&level=1&season=2025';
const res = await fetch(url, { headers: { 'user-agent': 'lojo (actions)' } });
const found = walk(await res.json());
const keys = Object.keys(found).sort();
console.log(`2025 FINAL — ${keys.length} teams`);
console.log(keys.map((k) => `${k} ${found[k].w}-${found[k].l}${found[k].t ? '-' + found[k].t : ''}`).join('   '));
