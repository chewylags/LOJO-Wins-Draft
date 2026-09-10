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
               `replaced` records a team swapped in under the QB rule — a
               season-ending injury to a quarterback before week 6 lets you
               trade that team for another. abbr/line describe the team that
               was given up; everything else describes the replacement.

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
      // week 1, so the QB rule applied and the Packers came in. The note
      // gives no line for the Packers; 8.5 was the 2023 market number.
      { abbr: 'GB',  by: 1, line: 8.5,  w: 9,  l: 8,  t: 0,
        replaced: { abbr: 'NYJ', line: 9.5, note: 'Aaron Rodgers, week 1' } },
      { abbr: 'BAL', by: 0, line: 10.5, w: 13, l: 4,  t: 0 },
      { abbr: 'DET', by: 1, line: 9.5,  w: 12, l: 5,  t: 0 },
      { abbr: 'LAC', by: 0, line: 9.5,  w: 5,  l: 12, t: 0 },
      { abbr: 'NO',  by: 1, line: 9.5,  w: 9,  l: 8,  t: 0 },
      { abbr: 'MIA', by: 0, line: 9.5,  w: 11, l: 6,  t: 0 },
    ],
  },
];
