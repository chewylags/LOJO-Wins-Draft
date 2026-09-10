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
  // 2023, 2024 and 2025 go here, newest first.
];
