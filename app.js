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
      updatedAt: 0,      // last local change, for comparing against a publish
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
  // state.records holds MANUAL entries and always wins; `auto` is the feed
  // published by the GitHub Action and is never persisted or shared.
  var auto = {}, autoUpdated = null, autoSource = null;

  function recordOf(abbr) {
    var r = state.records[abbr] || auto[abbr];
    return r ? { w: r.w | 0, l: r.l | 0, t: r.t | 0 } : { w: 0, l: 0, t: 0 };
  }
  /* ---------------- point contest --------------------------------- */

  // A tie counts as half a win, the way a sportsbook settles a win total.
  function effectiveWins(r) { return r.w + r.t * 0.5; }

  // Points a team is worth: whole wins clear of its line. On a 10.5 line
  // 11 wins is +1, 12 is +2, 10 is -1, 9 is -2. Half-point lines can't
  // push; a whole-number line landed exactly is worth 0.
  function pointsFrom(wins, line) {
    if (wins > line) return wins - Math.floor(line);
    if (wins < line) return wins - Math.ceil(line);
    return 0;
  }

  // Where a team is headed: wins banked, plus the rest of its schedule at
  // the rate its own line implies. Anchoring the remainder to the line
  // (rather than to results so far) keeps week 1 sane — one loss nudges a
  // 10.5-win team to 10, it doesn't project them to 0.
  function projectedWins(team) {
    var r = recordOf(team.abbr), gp = r.w + r.l + r.t, eff = effectiveWins(r);
    if (gp >= GAMES_IN_SEASON) return eff;
    return eff + lineOf(team) * ((GAMES_IN_SEASON - gp) / GAMES_IN_SEASON);
  }

  function isFinished(team) {
    var r = recordOf(team.abbr);
    return r.w + r.l + r.t >= GAMES_IN_SEASON;
  }

  // Final once the 17 games are in; a rounded projection until then.
  function pointsFor(team) {
    var line = lineOf(team);
    if (isFinished(team)) return pointsFrom(effectiveWins(recordOf(team.abbr)), line);
    return Math.round(pointsFrom(projectedWins(team), line));
  }

  function isLocked(team) {
    return state.lockNFCW && team.div === LOCKED_DIVISION;
  }

  /* ---------------- persistence ----------------------------------- */

  function save() {
    state.updatedAt = Date.now();
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
    s.updatedAt = typeof o.updatedAt === 'number' ? o.updatedAt : 0;

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
        s.records[k] = { w: clampGame(r.w), l: clampGame(r.l), t: clampGame(r.t) };
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
    var teams = teamsOf(idx), proj = 0, w = 0, l = 0, t = 0, pts = 0, done = teams.length > 0;
    teams.forEach(function (team) {
      proj += lineOf(team);
      var r = recordOf(team.abbr);
      w += r.w; l += r.l; t += r.t;
      pts += pointsFor(team);
      if (!isFinished(team)) done = false;
    });
    return { teams: teams, proj: proj, w: w, l: l, t: t, gp: w + l + t, pts: pts, done: done };
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
    totals.appendChild(numBlock(d.gp ? String(d.w) : fmt(d.proj), d.gp ? 'wins' : 'projected'));
    totals.appendChild(numBlock(d.gp ? signed(d.pts) : '—', d.done ? 'points' : 'proj. pts'));
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
      ? d.w + '-' + d.l + (d.t ? '-' + d.t : '') + '  ·  ' + fmt(d.proj) + ' win lines'
      : fmt(d.proj) + ' projected wins'));
    panel.appendChild(foot);
    return panel;
  }

  function numBlock(value, label) {
    var b = el('div', 'rt-block');
    b.appendChild(el('div', 'rt-num', value));
    b.appendChild(el('span', 'rt-lbl', label));
    return b;
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
    var pts = pointsFor(team), done = isFinished(team);
    var cls = pts > 0 ? 'up' : pts < 0 ? 'down' : 'even';
    var cell = el('span', 'pts ' + cls + (done ? '' : ' is-proj'), gp ? signed(pts) : '—');
    cell.title = gp
      ? (done ? effectiveWins(r) + ' wins' : 'on track for ' + Math.round(projectedWins(team)) + ' wins')
        + ' against a ' + fmt(lineOf(team)) + ' line'
      : 'No games played yet';
    li.appendChild(cell);
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
      var fed = auto[abbr];
      if (fed && fed.w === r.w && fed.l === r.l && fed.t === r.t) delete state.records[abbr];
      else if (!fed && !r.w && !r.l && !r.t) delete state.records[abbr];
      else state.records[abbr] = r;
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

  /* ---------------- records ---------------------------------------- */

  function note(cls, msg) {
    var n = $('#syncNote');
    n.className = 'syncnote' + (cls ? ' ' + cls : '');
    n.textContent = msg;
  }

  /* ---- auto records: published file + live refresh ----------------- */

  // Two sources feed `auto`, and the newer one wins:
  //   1. records.json, rewritten by a scheduled GitHub Action.
  //   2. a live fetch straight from ESPN, on demand.
  // ESPN sends access-control-allow-origin: *, so (2) works from the page;
  // (1) is what a cold visitor sees without pressing anything.
  var LIVE_KEY = 'lojo-wins-draft-live-v1';
  var VALID = { has: function (a) { return !!TEAM_BY_ABBR[a]; } };

  function normalise(records) {
    var out = {};
    Object.keys(records || {}).forEach(function (abbr) {
      if (!TEAM_BY_ABBR[abbr]) return;
      var r = records[abbr];
      out[abbr] = { w: clampGame(r.w), l: clampGame(r.l), t: clampGame(r.t) };
    });
    return out;
  }

  // Keep whichever feed is newer, so a live refresh isn't undone by the
  // published file and vice versa.
  //
  // Merge rather than replace: some sources (the scoreboard especially)
  // only describe the teams playing this week, and adopting one of those
  // wholesale would drop every other team's record.
  function adopt(feed) {
    if (!feed || !feed.records) return false;
    if (autoUpdated && feed.updated && new Date(feed.updated) <= new Date(autoUpdated)) return false;
    var incoming = normalise(feed.records);
    Object.keys(incoming).forEach(function (abbr) { auto[abbr] = incoming[abbr]; });
    autoUpdated = feed.updated || null;
    autoSource = feed.live ? 'live' : 'published';
    renderAll();
    return true;
  }

  function cachedLive() {
    try { return JSON.parse(localStorage.getItem(LIVE_KEY)); } catch (e) { return null; }
  }

  function loadPublished() {
    return fetch('records.json?t=' + Date.now(), { cache: 'no-store' })
      .then(function (res) {
        if (!res.ok) throw new Error('http ' + res.status);
        return res.json();
      })
      .then(function (data) {
        if (!data || !data.records) throw new Error('malformed');
        adopt(data);
      })
      .catch(function () { /* the live cache or a paste can still cover it */ });
    }

  // Try each ESPN source until one yields records, newest-shape-first.
  function fetchLive() {
    var i = 0;
    function attempt() {
      if (i >= RecordsParse.SOURCES.length) return Promise.reject(new Error('all sources failed'));
      var url = RecordsParse.SOURCES[i++];
      return fetch(url, { cache: 'no-store' })
        .then(function (res) {
          if (!res.ok) throw new Error('http ' + res.status);
          return res.json();
        })
        .then(function (json) {
          var records = RecordsParse.harvest(json, VALID);
          if (!Object.keys(records).length) throw new Error('nothing recognised');
          return records;
        })
        .catch(attempt);
    }
    return attempt();
  }

  function refreshLive() {
    var btn = $('#btnRefresh');
    btn.disabled = true;
    note('', 'Fetching the latest scores…');

    return fetchLive().then(function (records) {
      var feed = {
        updated: new Date().toISOString(),
        records: records,
        live: true,
        teams: Object.keys(records).length,
        played: RecordsParse.played(records),
      };
      try { localStorage.setItem(LIVE_KEY, JSON.stringify(feed)); } catch (e) { /* ignore */ }
      autoUpdated = null;               // a deliberate refresh always wins
      adopt(feed);
      note('ok', autoSummary());
      toast('Records updated');
    }).catch(function () {
      note('bad', 'Could not reach ESPN just now. Try again, or type the records in on the Rosters tab.');
    }).then(function () { btn.disabled = false; });
  }

  function autoSummary() {
    var teams = Object.keys(auto).length;
    if (!teams) return 'No records loaded yet — press Update now.';
    var when = autoUpdated ? new Date(autoUpdated) : null;
    var games = 0;
    Object.keys(auto).forEach(function (a) {
      var r = auto[a];
      if (r.w + r.l + r.t > 0) games++;
    });
    return (autoSource === 'live' ? 'Live' : 'Published')
      + ' · ' + teams + ' teams, ' + games + ' with games played'
      + (when && !isNaN(when) ? ' · ' + when.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '');
  }

  /* ---------------- the published draft ---------------------------- */

  // Browsers don't share localStorage — and on iOS a Home Screen app has
  // its own storage separate from Safari's — so a draft made on one device
  // is invisible everywhere else unless it travels. A share link carries
  // it in the hash; draft.json is the standing copy, so the plain URL shows
  // the real draft to anyone who opens it, Logan included.
  function loadPublishedDraft() {
    return fetch('draft.json?t=' + Date.now(), { cache: 'no-store' })
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (data) {
        if (!data || !data.code) return null;
        return { publishedAt: Date.parse(data.publishedAt) || 0, state: decodeState(data.code) };
      })
      .catch(function () { return null; });
  }

  // Adopt it only when it is genuinely newer than what this browser has,
  // so a publish reaches both of you on a refresh without stamping over
  // edits made here since.
  function considerPublishedDraft(fromLink, localAt) {
    if (fromLink) return Promise.resolve();     // an explicit link is deliberate
    return loadPublishedDraft().then(function (pub) {
      if (!pub || !pub.publishedAt || pub.publishedAt <= localAt) return;
      state = pub.state;
      save();
      renderAll();
      toast('Loaded the published draft');
    });
  }

  /* ---------------- new build detection ---------------------------- */

  // Pages serves HTML with max-age=600, so a refresh can hand back a copy
  // up to ten minutes old — and from the Home Screen there is no reload
  // button to lean on. version.txt is fetched no-store, so it is always
  // current; if it names a build newer than the one running, reload onto a
  // URL carrying that build. A URL the cache has never seen has to be
  // fetched fresh, which a plain reload() cannot guarantee. The draft
  // lives in the hash, so it survives the trip.
  function currentBuild() {
    var meta = document.querySelector('meta[name="build"]');
    return meta ? meta.content : 'dev';
  }

  function checkForNewBuild() {
    var running = currentBuild();
    if (running === 'dev') return Promise.resolve(false);   // local, unstamped
    return fetch('version.txt?t=' + Date.now(), { cache: 'no-store' })
      .then(function (res) { return res.ok ? res.text() : null; })
      .then(function (text) {
        var latest = (text || '').trim();
        if (!latest || latest === running) return false;
        // Already asked for this build and still got the old one: stop,
        // rather than bouncing between the same two loads forever.
        if (location.search.indexOf('v=' + latest) !== -1) return false;
        location.replace(location.pathname + '?v=' + encodeURIComponent(latest) + location.hash);
        return true;
      })
      .catch(function () { return false; });
  }

  /* ---------------- pull to refresh -------------------------------- */

  // Added to the Home Screen, this runs with no browser chrome and so no
  // reload button. A pull from the top refreshes the records instead.
  var PULL_TRIGGER = 72;   // px of travel needed to arm it
  var PULL_MAX = 110;
  var PULL_RESIST = 0.5;   // pull feels weighted rather than 1:1

  function refreshAll() {
    // Live scores first; the published file is a cheap same-origin
    // backstop if ESPN doesn't answer. A pull is also the natural moment
    // to notice the site itself has been updated.
    return refreshLive().then(loadPublished).then(checkForNewBuild);
  }

  function initPullToRefresh() {
    var el = $('#pull'), ring = $('.pull-ring', el);
    var startY = 0, dist = 0, pulling = false, busy = false;

    function atTop() {
      return (window.scrollY || document.documentElement.scrollTop || 0) <= 0;
    }

    function draw(d) {
      dist = d;
      el.style.transform = 'translateY(' + Math.min(d, PULL_MAX) + 'px)';
      el.style.opacity = String(Math.min(d / PULL_TRIGGER, 1));
      ring.style.transform = 'rotate(' + Math.round(d * 3) + 'deg)';
      el.classList.toggle('is-ready', d >= PULL_TRIGGER);
    }

    function snapBack() {
      dist = 0;
      el.classList.remove('is-ready');
      el.classList.add('is-snapping');
      el.style.transform = '';
      el.style.opacity = '';
      ring.style.transform = '';
      setTimeout(function () { el.classList.remove('is-snapping'); }, 280);
    }

    document.addEventListener('touchstart', function (e) {
      if (busy || e.touches.length !== 1 || !atTop()) { pulling = false; return; }
      startY = e.touches[0].clientY;
      dist = 0;
      pulling = true;
    }, { passive: true });

    document.addEventListener('touchmove', function (e) {
      if (!pulling || busy) return;
      var d = e.touches[0].clientY - startY;
      if (d <= 0) {                       // swiping up: hand it back to the page
        if (dist > 0) snapBack();
        pulling = false;
        return;
      }
      e.preventDefault();                 // suppress the rubber-band while pulling
      draw(d * PULL_RESIST);
    }, { passive: false });

    document.addEventListener('touchend', function () {
      if (!pulling || busy) return;
      pulling = false;
      if (dist < PULL_TRIGGER) { snapBack(); return; }

      busy = true;
      el.classList.add('is-busy');
      el.classList.remove('is-ready');
      el.style.transform = 'translateY(' + PULL_TRIGGER + 'px)';
      ring.style.transform = '';          // hand rotation over to the animation
      refreshAll().then(function () {
        busy = false;
        el.classList.remove('is-busy');
        snapBack();
      });
    }, { passive: true });
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

    $('#btnRefresh').addEventListener('click', refreshLive);
    $('#btnClearRecords').addEventListener('click', function () {
      if (!confirm('Clear every team record?')) return;
      state.records = {}; save(); renderAll();
      note('', autoSummary());
      toast('Manual entries cleared');
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
    var localAt = local ? local.updatedAt || 0 : 0;
    if (fromLink) {
      state = fromLink;
      try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
    } else if (local) {
      state = local;
    }
    bind();
    initPullToRefresh();
    renderAll();
    syncHash();
    // Published file first as the base — it always describes all 32 teams —
    // then any cached live refresh merged on top if it is more recent.
    loadPublished()
      .then(function () { adopt(cachedLive()); })
      .then(function () { note('', autoSummary()); });
    checkForNewBuild();
    considerPublishedDraft(fromLink, localAt);
    if (fromLink) toast('Draft loaded from link');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
