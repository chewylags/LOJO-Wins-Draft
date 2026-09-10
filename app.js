/* ==================================================================
   LOJO WINS DRAFT — app logic
   No backend. State lives in localStorage and in the URL hash, so a
   copied link carries the entire draft to anyone who opens it.
   ================================================================== */
(function () {
  'use strict';

  var STORE_KEY = 'lojo-wins-draft-v1';
  var LOCKED_DIVISION = 'NFC West';
  var LOGO_BASE = 'https://a.espncdn.com/i/teamlogos/nfl/500/';

  /* ---------------- state ---------------------------------------- */

  function defaultState() {
    return {
      v: 1,
      season: '2026',
      names: ['Josh', 'Logan'],
      first: 0,          // index of the player with pick 1
      size: 6,           // teams per player
      lockNFCW: true,
      picks: [],         // ordered array of team abbreviations
      lines: {},         // abbr -> overridden win total
      records: {},       // abbr -> { w, l, t }
      editLines: false,
    };
  }

  var state = defaultState();
  var ui = { tab: 'board', filter: 'all', query: '', flash: null };

  /* ---------------- draft order ----------------------------------- */

  // Pick 1 to the first picker, picks 2 and 3 to the other player,
  // then straight alternating starting again with the first picker.
  function draftOrder(size, first) {
    var total = size * 2,
      other = first === 0 ? 1 : 0,
      order = [],
      i;
    for (i = 0; i < total; i++) {
      if (i === 0) order.push(first);
      else if (i === 1 || i === 2) order.push(other);
      else order.push(i % 2 === 1 ? first : other);
    }
    return order;
  }

  function order() { return draftOrder(state.size, state.first); }
  function totalPicks() { return state.size * 2; }
  function onClock() {
    var o = order();
    return state.picks.length < o.length ? o[state.picks.length] : -1;
  }
  function isComplete() { return state.picks.length >= totalPicks(); }

  function ownerOf(abbr) {
    var i = state.picks.indexOf(abbr);
    return i === -1 ? -1 : order()[i];
  }
  function teamsOf(playerIdx) {
    var o = order();
    return state.picks.filter(function (a, i) { return o[i] === playerIdx; })
      .map(function (a) { return TEAM_BY_ABBR[a]; })
      .filter(Boolean);
  }

  function lineOf(team) {
    var v = state.lines[team.abbr];
    return typeof v === 'number' && isFinite(v) ? v : team.line;
  }
  function recordOf(abbr) {
    var r = state.records[abbr];
    return r ? { w: r.w | 0, l: r.l | 0, t: r.t | 0 } : { w: 0, l: 0, t: 0 };
  }
  function isLocked(team) {
    return state.lockNFCW && team.div === LOCKED_DIVISION;
  }

  /* ---------------- persistence ----------------------------------- */

  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* private mode */ }
    syncHash();
  }

  function loadLocal() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (raw) return sanitize(JSON.parse(raw));
    } catch (e) { /* ignore */ }
    return null;
  }

  function sanitize(o) {
    var d = defaultState();
    if (!o || typeof o !== 'object') return d;
    var s = defaultState();
    if (typeof o.season === 'string') s.season = o.season.slice(0, 9);
    if (Array.isArray(o.names)) {
      s.names = [String(o.names[0] || d.names[0]).slice(0, 14),
                 String(o.names[1] || d.names[1]).slice(0, 14)];
    }
    s.first = o.first === 1 ? 1 : 0;
    var size = parseInt(o.size, 10);
    s.size = size >= 1 && size <= 14 ? size : d.size;
    s.lockNFCW = o.lockNFCW !== false;
    s.editLines = !!o.editLines;

    if (Array.isArray(o.picks)) {
      var seen = {};
      s.picks = o.picks
        .map(function (a) { return String(a).toUpperCase(); })
        .filter(function (a) {
          if (!TEAM_BY_ABBR[a] || seen[a]) return false;
          seen[a] = 1; return true;
        })
        .slice(0, s.size * 2);
    }
    if (o.lines && typeof o.lines === 'object') {
      Object.keys(o.lines).forEach(function (k) {
        var n = parseFloat(o.lines[k]);
        if (TEAM_BY_ABBR[k] && isFinite(n) && n >= 0 && n <= GAMES_IN_SEASON) s.lines[k] = n;
      });
    }
    if (o.records && typeof o.records === 'object') {
      Object.keys(o.records).forEach(function (k) {
        if (!TEAM_BY_ABBR[k]) return;
        var r = o.records[k] || {};
        var w = clampGame(r.w), l = clampGame(r.l), t = clampGame(r.t);
        if (w || l || t) s.records[k] = { w: w, l: l, t: t };
      });
    }
    return s;
  }

  function clampGame(n) {
    n = parseInt(n, 10);
    if (!isFinite(n) || n < 0) return 0;
    return Math.min(n, GAMES_IN_SEASON);
  }

  /* ---- URL hash: the whole draft, compressed into short keys ------ */

  function encodeState() {
    var payload = {
      v: 1,
      s: state.season,
      n: state.names,
      f: state.first,
      z: state.size,
      w: state.lockNFCW ? 1 : 0,
      p: state.picks,
      l: state.lines,
      r: {},
    };
    Object.keys(state.records).forEach(function (k) {
      var r = state.records[k];
      payload.r[k] = r.t ? r.w + '-' + r.l + '-' + r.t : r.w + '-' + r.l;
    });
    return b64urlEncode(JSON.stringify(payload));
  }

  function decodeState(str) {
    var p = JSON.parse(b64urlDecode(str));
    var records = {};
    if (p.r) {
      Object.keys(p.r).forEach(function (k) {
        var bits = String(p.r[k]).split('-');
        records[k] = { w: bits[0], l: bits[1], t: bits[2] || 0 };
      });
    }
    return sanitize({
      season: p.s, names: p.n, first: p.f, size: p.z,
      lockNFCW: p.w !== 0, picks: p.p, lines: p.l, records: records,
    });
  }

  function b64urlEncode(str) {
    var bytes = new TextEncoder().encode(str), bin = '', i;
    for (i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function b64urlDecode(str) {
    var b64 = str.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    var bin = atob(b64), bytes = new Uint8Array(bin.length), i;
    for (i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  function syncHash() {
    var hash = '#d=' + encodeState();
    if (location.hash !== hash) {
      try { history.replaceState(null, '', location.pathname + location.search + hash); }
      catch (e) { location.hash = hash; }
    }
  }

  function shareURL() {
    return location.origin + location.pathname + location.search + '#d=' + encodeState();
  }

  /* ---------------- tiny DOM helpers ------------------------------ */

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function fmt(n) {
    return (Math.round(n * 10) / 10).toFixed(1).replace(/\.0$/, '');
  }
  function signed(n) {
    var v = Math.round(n * 10) / 10;
    return (v > 0 ? '+' : '') + v.toFixed(1).replace(/\.0$/, '');
  }

  var toastTimer;
  function toast(msg) {
    var t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2200);
  }

  function logoNode(team, size) {
    var box = el('span', size === 'sm' ? 'rrow-logo' : 'row-logo');
    box.style.setProperty('--tc', team.color);
    box.style.background = team.color;
    box.appendChild(el('span', 'mono', team.abbr));
    var img = new Image();
    img.alt = '';
    img.loading = 'lazy';
    img.src = LOGO_BASE + team.id + '.png';
    img.onload = function () { box.textContent = ''; box.appendChild(img); };
    img.onerror = function () { /* keep the monogram */ };
    return box;
  }

  /* ---------------- render: clock + order ------------------------- */

  function accentVar(i) { return i === 0 ? 'var(--p0)' : 'var(--p1)'; }

  function renderClock() {
    var card = $('#clockCard'), who = onClock(), done = isComplete();
    card.classList.toggle('is-done', done);
    if (done) {
      card.style.removeProperty('--accent');
      $('#clockKicker').textContent = 'Draft complete';
      $('#clockName').textContent = 'All picks in';
    } else {
      card.style.setProperty('--accent', accentVar(who));
      $('#clockKicker').textContent = 'On the clock';
      $('#clockName').textContent = state.names[who];
    }
    $('#pickNum').textContent = Math.min(state.picks.length + 1, totalPicks());
    $('#pickTotal').textContent = totalPicks();
    $('#brandYear').textContent = state.season;

    var strip = $('#orderStrip');
    strip.textContent = '';
    order().forEach(function (p, i) {
      var pick = el('div', 'opick is-p' + p);
      pick.setAttribute('role', 'listitem');
      if (i === state.picks.length && !done) pick.classList.add('is-now');
      pick.appendChild(el('span', null, String(i + 1)));
      pick.appendChild(el('b', null, state.names[p].slice(0, 6)));
      var abbr = state.picks[i];
      pick.appendChild(el('span', 'oteam', abbr || '—'));
      pick.title = 'Pick ' + (i + 1) + ' — ' + state.names[p] + (abbr ? ': ' + TEAM_BY_ABBR[abbr].name : '');
      strip.appendChild(pick);
    });
  }

  /* ---------------- render: scoreboard ---------------------------- */

  function totalsFor(idx) {
    var teams = teamsOf(idx), proj = 0, w = 0, l = 0, t = 0;
    teams.forEach(function (team) {
      proj += lineOf(team);
      var r = recordOf(team.abbr);
      w += r.w; l += r.l; t += r.t;
    });
    return { teams: teams, proj: proj, w: w, l: l, t: t, gp: w + l + t };
  }

  function renderScoreboard() {
    var a = totalsFor(0), b = totalsFor(1), sb = $('#scoreboard');
    var live = a.gp + b.gp > 0;
    sb.textContent = '';

    [0, 1].forEach(function (idx) {
      var d = idx === 0 ? a : b;
      var side = el('div', 'sb-side p' + idx + (idx === 1 ? ' right' : ''));
      side.appendChild(el('div', 'sb-name', state.names[idx]));
      side.appendChild(el('div', 'sb-big', live ? String(d.w) : fmt(d.proj)));
      side.appendChild(el('div', 'sb-sub', live
        ? 'wins · ' + fmt(d.proj) + ' projected'
        : (d.teams.length + ' of ' + state.size + ' drafted')));
      if (idx === 0) {
        sb.appendChild(side);
        var mid = el('div', 'sb-mid');
        mid.appendChild(el('div', 'sb-vs', 'VS'));
        var tag = leadTag(a, b, live);
        if (tag) mid.appendChild(el('div', 'sb-tag', tag));
        sb.appendChild(mid);
      } else {
        sb.appendChild(side);
      }
    });
  }

  function leadTag(a, b, live) {
    if (live) {
      if (a.w === b.w) return 'All square';
      var lead = a.w > b.w ? 0 : 1;
      return state.names[lead] + ' +' + Math.abs(a.w - b.w);
    }
    if (!a.teams.length && !b.teams.length) return null;
    if (a.proj === b.proj) return 'Dead even';
    var p = a.proj > b.proj ? 0 : 1;
    return state.names[p] + ' +' + fmt(Math.abs(a.proj - b.proj));
  }

  /* ---------------- render: board --------------------------------- */

  function renderBoard() {
    var board = $('#board'), q = ui.query.trim().toLowerCase();
    board.textContent = '';

    // Highest line first; ties keep the reference order from teams.js.
    var teams = TEAMS.map(function (t, i) { return { t: t, i: i }; })
      .sort(function (x, y) { return lineOf(y.t) - lineOf(x.t) || x.i - y.i; })
      .map(function (o) { return o.t; });

    var shown = 0, available = 0;
    teams.forEach(function (team, rank) {
      var owner = ownerOf(team.abbr), locked = isLocked(team);
      if (owner === -1 && !locked) available++;

      if (ui.filter === 'available' && (owner !== -1 || locked)) return;
      if (ui.filter === 'drafted' && owner === -1) return;
      if (q && (team.name + ' ' + team.abbr + ' ' + team.short + ' ' + team.div).toLowerCase().indexOf(q) === -1) return;

      shown++;
      board.appendChild(boardRow(team, rank, owner, locked));
    });

    $('#boardEmpty').hidden = shown > 0;
    $('#boardCount').textContent = available + ' available · ' + state.picks.length + '/' + totalPicks() + ' drafted';
  }

  function boardRow(team, rank, owner, locked) {
    var li = el('li', 'row');
    li.style.setProperty('--tc', team.color);
    li.dataset.abbr = team.abbr;

    var open = owner === -1 && !locked && !isComplete() && !state.editLines;
    if (owner !== -1) li.classList.add('is-taken');
    else if (locked) li.classList.add('is-locked');
    if (open) {
      li.classList.add('is-open');
      li.tabIndex = 0;
      li.setAttribute('role', 'button');
      li.title = 'Draft ' + team.name + ' for ' + state.names[onClock()];
    }
    if (ui.flash === team.abbr) li.classList.add('just-picked');

    li.appendChild(el('span', 'row-rank', String(rank + 1)));
    li.appendChild(logoNode(team));

    var main = el('div', 'row-main');
    main.appendChild(el('div', 'row-name', team.name));
    var meta = el('div', 'row-meta');
    meta.appendChild(el('span', 'row-div', team.div));
    main.appendChild(meta);
    li.appendChild(main);

    var right = el('div', 'row-right');
    if (state.editLines) {
      var input = el('input', 'line-input');
      input.type = 'number'; input.step = '0.5'; input.min = '0'; input.max = String(GAMES_IN_SEASON);
      input.value = fmt(lineOf(team));
      input.setAttribute('aria-label', team.name + ' win total');
      input.addEventListener('change', function () {
        var n = parseFloat(input.value);
        if (isFinite(n) && n >= 0 && n <= GAMES_IN_SEASON) {
          if (n === team.line) delete state.lines[team.abbr];
          else state.lines[team.abbr] = n;
        } else {
          input.value = fmt(lineOf(team));
        }
        save(); renderAll();
      });
      right.appendChild(input);
    } else {
      right.appendChild(el('span', 'line-pill', fmt(lineOf(team))));
      if (owner !== -1) right.appendChild(el('span', 'tag tag-p' + owner, state.names[owner]));
      else if (locked) right.appendChild(el('span', 'tag tag-out', 'Locked'));
      else right.appendChild(el('span', 'tag tag-open', 'Open'));
    }
    li.appendChild(right);

    if (open) {
      li.addEventListener('click', function () { draft(team.abbr); });
      li.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); draft(team.abbr); }
      });
    }
    return li;
  }

  /* ---------------- render: rosters ------------------------------- */

  function renderRosters() {
    var host = $('#rosters');
    host.textContent = '';
    [0, 1].forEach(function (idx) { host.appendChild(rosterPanel(idx)); });
  }

  function rosterPanel(idx) {
    var d = totalsFor(idx);
    var panel = el('section', 'panel roster');
    panel.style.setProperty('--acc', accentVar(idx));

    var head = el('div', 'panel-head');
    head.appendChild(el('h2', 'panel-title', state.names[idx]));

    var totals = el('div', 'rt-totals');
    totals.appendChild(numBlock(fmt(d.proj), 'projected'));
    totals.appendChild(numBlock(d.gp ? String(d.w) : '—', 'wins'));
    head.appendChild(totals);
    panel.appendChild(head);

    if (!d.teams.length) {
      panel.appendChild(el('p', 'rempty', 'No teams yet — ' + state.names[idx] + ' is still on the board.'));
      return panel;
    }

    var list = el('ul', 'rlist');
    d.teams.slice().sort(function (a, b) { return lineOf(b) - lineOf(a); })
      .forEach(function (team) { list.appendChild(rosterRow(team)); });
    panel.appendChild(list);

    var foot = el('div', 'rfoot');
    foot.appendChild(el('span', null, d.teams.length + '/' + state.size + ' teams'));
    foot.appendChild(el('span', null, d.gp
      ? d.w + '-' + d.l + (d.t ? '-' + d.t : '') + '  ·  ' + signed(d.w - pace(d)) + ' vs pace'
      : 'season not started'));
    panel.appendChild(foot);
    return panel;
  }

  function numBlock(value, label) {
    var b = el('div', 'rt-block');
    b.appendChild(el('div', 'rt-num', value));
    b.appendChild(el('span', 'rt-lbl', label));
    return b;
  }

  // Wins a roster "should" have by now, given each line and games played.
  function pace(d) {
    var expected = 0;
    d.teams.forEach(function (team) {
      var r = recordOf(team.abbr), gp = r.w + r.l + r.t;
      expected += lineOf(team) * (gp / GAMES_IN_SEASON);
    });
    return expected;
  }

  function rosterRow(team) {
    var li = el('li', 'rrow');
    li.style.setProperty('--tc', team.color);
    li.appendChild(logoNode(team, 'sm'));

    var main = el('div', null);
    main.appendChild(el('div', 'rrow-name', team.short));
    main.appendChild(el('div', 'rrow-line', 'line ' + fmt(lineOf(team))));
    li.appendChild(main);

    var r = recordOf(team.abbr);
    var rec = el('div', 'rec');
    rec.appendChild(recInput(team.abbr, 'w', r.w, 'wins'));
    rec.appendChild(el('span', 'sep', '-'));
    rec.appendChild(recInput(team.abbr, 'l', r.l, 'losses'));
    if (r.t) {
      rec.appendChild(el('span', 'sep', '-'));
      rec.appendChild(recInput(team.abbr, 't', r.t, 'ties'));
    }
    li.appendChild(rec);

    var gp = r.w + r.l + r.t;
    var diff = gp ? r.w - lineOf(team) * (gp / GAMES_IN_SEASON) : 0;
    var cls = !gp ? 'even' : diff > 0.05 ? 'up' : diff < -0.05 ? 'down' : 'even';
    li.appendChild(el('span', 'pace ' + cls, gp ? signed(diff) : '—'));
    return li;
  }

  function recInput(abbr, key, value, label) {
    var input = el('input');
    input.type = 'number'; input.min = '0'; input.max = String(GAMES_IN_SEASON);
    input.inputMode = 'numeric';
    input.value = String(value);
    input.setAttribute('aria-label', TEAM_BY_ABBR[abbr].name + ' ' + label);
    input.addEventListener('change', function () {
      var r = recordOf(abbr);
      r[key] = clampGame(input.value);
      if (r.w + r.l + r.t > GAMES_IN_SEASON) {
        r[key] = Math.max(0, GAMES_IN_SEASON - (r.w + r.l + r.t - r[key]));
      }
      if (r.w || r.l || r.t) state.records[abbr] = r;
      else delete state.records[abbr];
      save(); renderAll();
    });
    return input;
  }

  /* ---------------- render: setup --------------------------------- */

  function renderSetup() {
    $('#p0name').value = state.names[0];
    $('#p1name').value = state.names[1];
    $('#seasonInput').value = state.season;
    $('#sizeInput').value = state.size;
    $('#nfcwToggle').checked = state.lockNFCW;
    $('#linesToggle').checked = state.editLines;
    $$('#firstPick [data-first]').forEach(function (b) {
      var i = Number(b.dataset.first);
      b.textContent = state.names[i];
      b.classList.toggle('is-active', state.first === i);
    });
  }

  function renderAll() {
    renderClock();
    renderScoreboard();
    renderBoard();
    renderRosters();
    renderSetup();
  }

  /* ---------------- actions --------------------------------------- */

  function draft(abbr) {
    var team = TEAM_BY_ABBR[abbr];
    if (!team || isComplete() || ownerOf(abbr) !== -1 || isLocked(team)) return;
    var who = onClock();
    state.picks.push(abbr);
    ui.flash = abbr;
    save();
    renderAll();
    setTimeout(function () { ui.flash = null; }, 600);
    toast(state.names[who] + ' takes the ' + team.short);
  }

  function undo() {
    if (!state.picks.length) { toast('Nothing to undo'); return; }
    var abbr = state.picks.pop();
    save(); renderAll();
    toast(TEAM_BY_ABBR[abbr].short + ' back on the board');
  }

  function copy(text, okMsg) {
    function fallback() {
      var ta = el('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;top:-1000px;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      document.body.removeChild(ta);
      toast(ok ? okMsg : 'Copy failed — the link is in your address bar');
    }
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(function () { toast(okMsg); }, fallback);
    } else fallback();
  }

  function setLock(on) {
    if (on) {
      var drafted = state.picks.filter(function (a) { return TEAM_BY_ABBR[a].div === LOCKED_DIVISION; });
      if (drafted.length && !confirm(
        'Locking the ' + LOCKED_DIVISION + ' will release ' +
        drafted.map(function (a) { return TEAM_BY_ABBR[a].short; }).join(', ') +
        ' and every pick made after them. Continue?')) {
        $('#nfcwToggle').checked = false;
        return;
      }
      if (drafted.length) {
        var cut = Math.min.apply(null, drafted.map(function (a) { return state.picks.indexOf(a); }));
        state.picks = state.picks.slice(0, cut);
      }
    }
    state.lockNFCW = on;
    save(); renderAll();
  }

  function setSize(n) {
    n = parseInt(n, 10);
    if (!isFinite(n) || n < 1 || n > 14) { renderSetup(); return; }
    state.size = n;
    if (state.picks.length > n * 2) state.picks = state.picks.slice(0, n * 2);
    save(); renderAll();
  }

  function setFirst(i) {
    if (state.first === i) return;
    if (state.picks.length && !confirm('Changing who picks first reshuffles every pick already made. Continue?')) return;
    state.first = i;
    save(); renderAll();
  }

  function exportFile() {
    var blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    var a = el('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'lojo-wins-draft-' + state.season + '.json';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }

  function importFile(file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        state = sanitize(JSON.parse(String(reader.result)));
        save(); renderAll(); toast('Draft imported');
      } catch (e) { toast('That file could not be read'); }
    };
    reader.readAsText(file);
  }

  /* ---------------- live records (optional) ------------------------ */

  // ESPN's public endpoints are not a backend we own — this is a
  // convenience. If it is unreachable, records stay hand-entered.
  var ESPN_URLS = [
    'https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams',
    'https://site.api.espn.com/apis/site/v2/sports/football/nfl/standings',
  ];

  // Walk arbitrary JSON for {abbreviation, ...record summary "W-L" or "W-L-T"}.
  function harvestRecords(node, out, seen) {
    if (!node || typeof node !== 'object') return out;
    if (seen.has(node)) return out;
    seen.add(node);

    if (typeof node.abbreviation === 'string') {
      var abbr = node.abbreviation.toUpperCase();
      if (TEAM_BY_ABBR[abbr] && !out[abbr]) {
        var summary = findSummary(node, 0);
        if (summary) {
          var b = summary.split('-').map(Number);
          out[abbr] = { w: b[0] | 0, l: b[1] | 0, t: b[2] | 0 };
        }
      }
    }
    Object.keys(node).forEach(function (k) { harvestRecords(node[k], out, seen); });
    return out;
  }

  function findSummary(node, depth) {
    if (!node || typeof node !== 'object' || depth > 4) return null;
    if (typeof node.summary === 'string' && /^\d+-\d+(-\d+)?$/.test(node.summary)) return node.summary;
    var keys = Object.keys(node), i, found;
    for (i = 0; i < keys.length; i++) {
      found = findSummary(node[keys[i]], depth + 1);
      if (found) return found;
    }
    return null;
  }

  function syncRecords() {
    var note = $('#syncNote'), btn = $('#btnSync');
    note.className = 'syncnote';
    note.textContent = 'Contacting ESPN…';
    btn.disabled = true;

    var attempt = 0;
    function next() {
      if (attempt >= ESPN_URLS.length) return Promise.reject(new Error('no source'));
      var url = ESPN_URLS[attempt++];
      return fetch(url, { cache: 'no-store' })
        .then(function (res) { if (!res.ok) throw new Error(res.status); return res.json(); })
        .then(function (json) {
          var found = harvestRecords(json, {}, new WeakSet());
          if (!Object.keys(found).length) throw new Error('empty');
          return found;
        })
        .catch(next);
    }

    next().then(function (found) {
      var n = 0;
      Object.keys(found).forEach(function (abbr) {
        var r = found[abbr];
        if (r.w + r.l + r.t === 0) { delete state.records[abbr]; return; }
        state.records[abbr] = r; n++;
      });
      save(); renderAll();
      note.className = 'syncnote ok';
      note.textContent = 'Updated ' + n + ' team records · ' + new Date().toLocaleString();
    }).catch(function () {
      note.className = 'syncnote bad';
      note.textContent = 'Could not reach ESPN. Enter records by hand on the Rosters tab.';
    }).then(function () { btn.disabled = false; });
  }

  /* ---------------- wiring ---------------------------------------- */

  function bind() {
    $('#btnUndo').addEventListener('click', undo);
    $('#btnShare').addEventListener('click', function () { copy(shareURL(), 'Share link copied'); });
    $('#btnShare2').addEventListener('click', function () { copy(shareURL(), 'Share link copied'); });

    $('#search').addEventListener('input', function (e) { ui.query = e.target.value; renderBoard(); });

    $('#filterChips').addEventListener('click', function (e) {
      var chip = e.target.closest('.chip');
      if (!chip) return;
      ui.filter = chip.dataset.filter;
      $$('#filterChips .chip').forEach(function (c) { c.classList.toggle('is-active', c === chip); });
      renderBoard();
    });

    $('#tabs').addEventListener('click', function (e) {
      var tab = e.target.closest('.tab');
      if (!tab) return;
      ui.tab = tab.dataset.tab;
      $$('#tabs .tab').forEach(function (t) {
        var on = t === tab;
        t.classList.toggle('is-active', on);
        t.setAttribute('aria-selected', String(on));
      });
      $$('.pane').forEach(function (p) { p.classList.toggle('is-active', p.dataset.pane === ui.tab); });
    });

    $('#p0name').addEventListener('input', function (e) { state.names[0] = e.target.value.slice(0, 14) || 'Player 1'; save(); renderClock(); renderScoreboard(); renderBoard(); renderRosters(); });
    $('#p1name').addEventListener('input', function (e) { state.names[1] = e.target.value.slice(0, 14) || 'Player 2'; save(); renderClock(); renderScoreboard(); renderBoard(); renderRosters(); });
    $('#seasonInput').addEventListener('input', function (e) { state.season = e.target.value.slice(0, 9); save(); renderClock(); });
    $('#sizeInput').addEventListener('change', function (e) { setSize(e.target.value); });

    $('#firstPick').addEventListener('click', function (e) {
      var b = e.target.closest('[data-first]');
      if (b) setFirst(Number(b.dataset.first));
    });
    $('#btnFlip').addEventListener('click', function () {
      if (state.picks.length && !confirm('Flipping resets the picks already made. Continue?')) return;
      state.picks = [];
      state.first = Math.random() < 0.5 ? 0 : 1;
      save(); renderAll();
      toast('🪙 ' + state.names[state.first] + ' wins the flip — first pick');
    });

    $('#nfcwToggle').addEventListener('change', function (e) { setLock(e.target.checked); });
    $('#linesToggle').addEventListener('change', function (e) {
      state.editLines = e.target.checked; save(); renderBoard();
      if (state.editLines) { ui.tab = 'board'; $$('#tabs .tab')[0].click(); }
    });

    $('#btnSync').addEventListener('click', syncRecords);
    $('#btnClearRecords').addEventListener('click', function () {
      if (!confirm('Clear every team record?')) return;
      state.records = {}; save(); renderAll(); toast('Records cleared');
    });

    $('#btnExport').addEventListener('click', exportFile);
    $('#btnImport').addEventListener('click', function () { $('#fileInput').click(); });
    $('#fileInput').addEventListener('change', function (e) {
      if (e.target.files && e.target.files[0]) importFile(e.target.files[0]);
      e.target.value = '';
    });

    $('#btnResetPicks').addEventListener('click', function () {
      if (!confirm('Clear all picks? Names, lines and records stay put.')) return;
      state.picks = []; save(); renderAll(); toast('Board wiped clean');
    });
    $('#btnResetAll').addEventListener('click', function () {
      if (!confirm('Reset everything back to defaults?')) return;
      state = defaultState(); save(); renderAll(); toast('Fresh start');
    });

    window.addEventListener('hashchange', function () {
      var incoming = readHash();
      if (incoming && encodeState() !== location.hash.slice(3)) {
        state = incoming; renderAll(); toast('Draft loaded from link');
      }
    });
  }

  function readHash() {
    var m = /[#&]d=([A-Za-z0-9\-_]+)/.exec(location.hash);
    if (!m) return null;
    try { return decodeState(m[1]); } catch (e) { return null; }
  }

  /* ---------------- boot ------------------------------------------ */

  function init() {
    var fromLink = readHash(), local = loadLocal();
    if (fromLink) {
      state = fromLink;
      try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
    } else if (local) {
      state = local;
    }
    bind();
    renderAll();
    syncHash();
    if (fromLink) toast('Draft loaded from link');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
