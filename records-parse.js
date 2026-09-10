/* ------------------------------------------------------------------
   Shared record harvester.

   Loaded as a plain <script> by the page, and read + evaluated by
   scripts/fetch-records.mjs in CI. One implementation, so a fix to the
   parsing benefits both and they can never disagree.

   ESPN hands back several shapes depending on the endpoint:
     - standings entries with a stats array   [{name:'wins', value:1}, …]
     - team objects with record.items[].summary  "1-0"
     - records[] entries of type 'total' with displayValue "4-2-1"
   Rather than bind to one, walk the response and accept any of them.
------------------------------------------------------------------ */
var RecordsParse = (function () {
  'use strict';

  var MAX_GAMES = 17;

  function isRecordString(s) {
    return typeof s === 'string' && /^\d{1,2}-\d{1,2}(-\d{1,2})?$/.test(s);
  }

  function parseRecordString(s) {
    var b = s.split('-').map(Number);
    return { w: b[0], l: b[1], t: b[2] || 0 };
  }

  // Standings entries carry stats like {name:'wins', value:1}. Prefer them:
  // they are unambiguous, where a summary string can be a home/away split.
  function fromStats(stats) {
    if (!Array.isArray(stats)) return null;
    function pick(name) {
      var i, s;
      for (i = 0; i < stats.length; i++) {
        s = stats[i];
        if (s && (s.name === name || s.type === name) && isFinite(Number(s.value))) {
          return Number(s.value);
        }
      }
      return null;
    }
    var w = pick('wins'), l = pick('losses'), t = pick('ties');
    if (w === null || l === null) return null;
    return { w: w, l: l, t: t === null ? 0 : t };
  }

  function fromSummary(node, depth) {
    depth = depth || 0;
    if (!node || typeof node !== 'object' || depth > 4) return null;
    if (isRecordString(node.summary)) return parseRecordString(node.summary);
    if (node.type === 'total' && isRecordString(node.displayValue)) {
      return parseRecordString(node.displayValue);
    }
    var keys = Object.keys(node), i, found;
    for (i = 0; i < keys.length; i++) {
      found = fromSummary(node[keys[i]], depth + 1);
      if (found) return found;
    }
    return null;
  }

  // `valid` is a Set (or any object with .has) of the 32 abbreviations.
  function harvest(node, valid, out, seen) {
    out = out || {};
    seen = seen || new WeakSet();
    if (!node || typeof node !== 'object' || seen.has(node)) return out;
    seen.add(node);

    // Standings nest the team one level down; team lists do not.
    var team = node.team && typeof node.team === 'object' ? node.team : node;
    var abbr = typeof team.abbreviation === 'string' ? team.abbreviation.toUpperCase() : null;

    if (abbr && valid.has(abbr) && !out[abbr]) {
      var rec = fromStats(node.stats) || fromSummary(node);
      if (rec && rec.w >= 0 && rec.l >= 0 && rec.w + rec.l + rec.t <= MAX_GAMES) out[abbr] = rec;
    }

    Object.keys(node).forEach(function (k) { harvest(node[k], valid, out, seen); });
    return out;
  }

  function played(records) {
    return Object.keys(records).filter(function (k) {
      var r = records[k];
      return r.w + r.l + r.t > 0;
    }).length;
  }

  // Ordered best-first. site.web.api is the one verified to return all 32.
  var SOURCES = [
    'https://site.web.api.espn.com/apis/v2/sports/football/nfl/standings?region=us&lang=en&contentorigin=espn&type=0&level=1',
    'https://cdn.espn.com/core/nfl/standings?xhr=1',
    'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard',
    'https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams',
    'https://site.api.espn.com/apis/site/v2/sports/football/nfl/standings',
  ];

  return { harvest: harvest, played: played, SOURCES: SOURCES };
})();

if (typeof module === 'object' && module.exports) module.exports = RecordsParse;
