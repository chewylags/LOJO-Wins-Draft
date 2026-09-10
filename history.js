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
    season: '2024',
    players: ['Josh', 'Logan'],
    // Eight teams each this year. Josh picked first. Records are the final
    // 2024 regular season; the two swapped slots are split at the week the
    // trade took effect, which reproduces the mid-season note exactly.
    picks: [
      { abbr: 'KC',  by: 0, line: 11.5, w: 15, l: 2,  t: 0 },
      { abbr: 'BAL', by: 1, line: 10.5, w: 12, l: 5,  t: 0 },
      { abbr: 'CIN', by: 1, line: 10.5, w: 9,  l: 8,  t: 0 },
      { abbr: 'DET', by: 0, line: 10.5, w: 15, l: 2,  t: 0 },
      { abbr: 'NYJ', by: 1, line: 10.5, w: 5,  l: 12, t: 0 },
      { abbr: 'PHI', by: 0, line: 10.5, w: 14, l: 3,  t: 0 },
      { abbr: 'DAL', by: 1, line: 9.5,  w: 7,  l: 10, t: 0 },
      { abbr: 'HOU', by: 0, line: 9.5,  w: 10, l: 7,  t: 0 },
      { abbr: 'BUF', by: 1, line: 9.5,  w: 13, l: 4,  t: 0 },
      // Dolphins 1-3 through week 4, then Tampa Bay from week 5: their
      // 10-7 less the 3-1 they had already banked.
      { abbr: 'TB',  by: 0, line: 9.5,  w: 7,  l: 6,  t: 0,
        replaced: { abbr: 'MIA', w: 1, l: 3, t: 0, note: 'swapped after week 4' } },
      { abbr: 'GB',  by: 1, line: 9.5,  w: 11, l: 6,  t: 0 },
      { abbr: 'ATL', by: 0, line: 9.5,  w: 8,  l: 9,  t: 0 },
      { abbr: 'CHI', by: 1, line: 8.5,  w: 5,  l: 12, t: 0 },
      // Jaguars 0-3 through week 3, then Minnesota from week 4: their
      // 14-3 less the 3-0 they had already banked.
      { abbr: 'MIN', by: 0, line: 8.5,  w: 11, l: 3,  t: 0,
        replaced: { abbr: 'JAX', w: 0, l: 3, t: 0, note: 'swapped after week 3' } },
      { abbr: 'LAC', by: 1, line: 8.5,  w: 11, l: 6,  t: 0 },
      { abbr: 'IND', by: 0, line: 8.5,  w: 8,  l: 9,  t: 0 },
    ],
  },
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
      // week 1, so the QB rule applied and the Packers came in. The Jets
      // won that opener anyway (22-16 over Buffalo), so the slot is their
      // 1-0 plus Green Bay's 8-8 from week 2 on — which comes to the same
      // 9-8 the Packers posted over the full season.
      { abbr: 'GB',  by: 1, line: 9.5,  w: 8,  l: 8,  t: 0,
        replaced: { abbr: 'NYJ', w: 1, l: 0, t: 0, note: 'Aaron Rodgers, week 1' } },
      { abbr: 'BAL', by: 0, line: 10.5, w: 13, l: 4,  t: 0 },
      { abbr: 'DET', by: 1, line: 9.5,  w: 12, l: 5,  t: 0 },
      { abbr: 'LAC', by: 0, line: 9.5,  w: 5,  l: 12, t: 0 },
      { abbr: 'NO',  by: 1, line: 9.5,  w: 9,  l: 8,  t: 0 },
      { abbr: 'MIA', by: 0, line: 9.5,  w: 11, l: 6,  t: 0 },
    ],
  },
];
