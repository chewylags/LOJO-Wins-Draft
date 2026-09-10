/* ------------------------------------------------------------------
   LOJO WINS DRAFT — past seasons

   Everything else (points, totals, the winner) is calculated from this,
   using the same scoring as the live season, so adding a year only means
   adding its picks here.

   Shape of a season:
     season  : the year, as a string
     players : [player 0, player 1] — names as they were that year
     picks   : in draft order. `by` is the index into `players`.
               line is the preseason win total; w/l/t is the final record.
               `replaced` records the QB rule — a season-ending injury to a
               quarterback before week 6 lets you trade that team away.
               `abbr` is the team given up and its w/l/t is what it went
               BEFORE the swap; the row's own w/l/t is then what the
               replacement went AFTER it. The two add up to one 17-game
               season for the slot. Omit that w/l/t if the split was never
               recorded — the row's record is then taken as the whole slot.
               `line` is always the line of the team DRAFTED, swap or not:
               you are still judged against the bet you made on draft day.

   Example:
     {
       season: '2025',
       players: ['Josh', 'Logan'],
       picks: [
         { abbr: 'BUF', by: 1, line: 10.5, w: 13, l: 4, t: 0 },
         { abbr: 'BAL', by: 0, line: 11.5, w: 12, l: 5, t: 0 },
       ],
     }
------------------------------------------------------------------ */

const HISTORY = [
  {
    season: '2023',
    players: ['Josh', 'Logan'],
    // Josh picked first, so Josh, Logan, Logan, then alternating — the
    // same rule as now. The separate "worst teams" draft that year is
    // deliberately not included.
    picks: [
      { abbr: 'KC',  by: 0, line: 11.5, w: 11, l: 6,  t: 0 },
      { abbr: 'PHI', by: 1, line: 10.5, w: 11, l: 6,  t: 0 },
      { abbr: 'CIN', by: 1, line: 10.5, w: 9,  l: 8,  t: 0 },
      { abbr: 'BUF', by: 0, line: 10.5, w: 11, l: 6,  t: 0 },
      { abbr: 'DAL', by: 1, line: 9.5,  w: 12, l: 5,  t: 0 },
      { abbr: 'JAX', by: 0, line: 9.5,  w: 9,  l: 8,  t: 0 },
      // Drafted the Jets; Aaron Rodgers tore his Achilles four snaps into
      // week 1, so the QB rule applied and the Packers came in. The line is
      // the Jets' 9.5, the team drafted. The 2023 note recorded only the
      // Packers' full season rather than splitting it at the swap, so no
      // pre-swap record is given and 9-8 stands as the whole slot.
      { abbr: 'GB',  by: 1, line: 9.5,  w: 9,  l: 8,  t: 0,
        replaced: { abbr: 'NYJ', note: 'Aaron Rodgers, week 1' } },
      { abbr: 'BAL', by: 0, line: 10.5, w: 13, l: 4,  t: 0 },
      { abbr: 'DET', by: 1, line: 9.5,  w: 12, l: 5,  t: 0 },
      { abbr: 'LAC', by: 0, line: 9.5,  w: 5,  l: 12, t: 0 },
      { abbr: 'NO',  by: 1, line: 9.5,  w: 9,  l: 8,  t: 0 },
      { abbr: 'MIA', by: 0, line: 9.5,  w: 11, l: 6,  t: 0 },
    ],
  },
];
