/* ------------------------------------------------------------------
   LOJO WINS DRAFT — team reference data
   `line` is the DEFAULT projected win total (averaged sportsbook line).
   Lines are editable in the app; edits are stored with the draft state.
------------------------------------------------------------------ */
const TEAMS = [
  { id: 'lar', abbr: 'LAR', name: 'Los Angeles Rams',     short: 'Rams',       conf: 'NFC', div: 'NFC West',  color: '#003594', alt: '#FFA300', line: 11.5 },
  { id: 'bal', abbr: 'BAL', name: 'Baltimore Ravens',     short: 'Ravens',     conf: 'AFC', div: 'AFC North', color: '#241773', alt: '#9E7C0C', line: 11.5 },
  { id: 'sea', abbr: 'SEA', name: 'Seattle Seahawks',     short: 'Seahawks',   conf: 'NFC', div: 'NFC West',  color: '#002244', alt: '#69BE28', line: 10.5 },
  { id: 'ne',  abbr: 'NE',  name: 'New England Patriots', short: 'Patriots',   conf: 'AFC', div: 'AFC East',  color: '#002244', alt: '#C60C30', line: 10.5 },
  { id: 'sf',  abbr: 'SF',  name: 'San Francisco 49ers',  short: '49ers',      conf: 'NFC', div: 'NFC West',  color: '#AA0000', alt: '#B3995D', line: 10.5 },
  { id: 'phi', abbr: 'PHI', name: 'Philadelphia Eagles',  short: 'Eagles',     conf: 'NFC', div: 'NFC East',  color: '#004C54', alt: '#A5ACAF', line: 10.5 },
  { id: 'buf', abbr: 'BUF', name: 'Buffalo Bills',        short: 'Bills',      conf: 'AFC', div: 'AFC East',  color: '#00338D', alt: '#C60C30', line: 10.5 },
  { id: 'kc',  abbr: 'KC',  name: 'Kansas City Chiefs',   short: 'Chiefs',     conf: 'AFC', div: 'AFC West',  color: '#E31837', alt: '#FFB81C', line: 10.5 },
  { id: 'det', abbr: 'DET', name: 'Detroit Lions',        short: 'Lions',      conf: 'NFC', div: 'NFC North', color: '#0076B6', alt: '#B0B7BC', line: 10.5 },
  { id: 'den', abbr: 'DEN', name: 'Denver Broncos',       short: 'Broncos',    conf: 'AFC', div: 'AFC West',  color: '#FB4F14', alt: '#002244', line: 9.5 },
  { id: 'gb',  abbr: 'GB',  name: 'Green Bay Packers',    short: 'Packers',    conf: 'NFC', div: 'NFC North', color: '#203731', alt: '#FFB612', line: 9.5 },
  { id: 'hou', abbr: 'HOU', name: 'Houston Texans',       short: 'Texans',     conf: 'AFC', div: 'AFC South', color: '#03202F', alt: '#A71930', line: 9.5 },
  { id: 'lac', abbr: 'LAC', name: 'Los Angeles Chargers', short: 'Chargers',   conf: 'AFC', div: 'AFC West',  color: '#0080C6', alt: '#FFC20E', line: 9.5 },
  { id: 'cin', abbr: 'CIN', name: 'Cincinnati Bengals',   short: 'Bengals',    conf: 'AFC', div: 'AFC North', color: '#FB4F14', alt: '#000000', line: 9.5 },
  { id: 'dal', abbr: 'DAL', name: 'Dallas Cowboys',       short: 'Cowboys',    conf: 'NFC', div: 'NFC East',  color: '#041E42', alt: '#869397', line: 9.5 },
  { id: 'chi', abbr: 'CHI', name: 'Chicago Bears',        short: 'Bears',      conf: 'NFC', div: 'NFC North', color: '#0B162A', alt: '#C83803', line: 9.5 },
  { id: 'tb',  abbr: 'TB',  name: 'Tampa Bay Buccaneers', short: 'Buccaneers', conf: 'NFC', div: 'NFC South', color: '#D50A0A', alt: '#B1BABF', line: 9.5 },
  { id: 'jax', abbr: 'JAX', name: 'Jacksonville Jaguars', short: 'Jaguars',    conf: 'AFC', div: 'AFC South', color: '#006778', alt: '#D7A22A', line: 8.5 },
  { id: 'min', abbr: 'MIN', name: 'Minnesota Vikings',    short: 'Vikings',    conf: 'NFC', div: 'NFC North', color: '#4F2683', alt: '#FFC62F', line: 8.5 },
  { id: 'pit', abbr: 'PIT', name: 'Pittsburgh Steelers',  short: 'Steelers',   conf: 'AFC', div: 'AFC North', color: '#101820', alt: '#FFB612', line: 8.5 },
  { id: 'wsh', abbr: 'WSH', name: 'Washington Commanders',short: 'Commanders', conf: 'NFC', div: 'NFC East',  color: '#5A1414', alt: '#FFB612', line: 7.5 },
  { id: 'ind', abbr: 'IND', name: 'Indianapolis Colts',   short: 'Colts',      conf: 'AFC', div: 'AFC South', color: '#002C5F', alt: '#A2AAAD', line: 7.5 },
  { id: 'no',  abbr: 'NO',  name: 'New Orleans Saints',   short: 'Saints',     conf: 'NFC', div: 'NFC South', color: '#101820', alt: '#D3BC8D', line: 7.5 },
  { id: 'nyg', abbr: 'NYG', name: 'New York Giants',      short: 'Giants',     conf: 'NFC', div: 'NFC East',  color: '#0B2265', alt: '#A71930', line: 7.5 },
  { id: 'car', abbr: 'CAR', name: 'Carolina Panthers',    short: 'Panthers',   conf: 'NFC', div: 'NFC South', color: '#0085CA', alt: '#101820', line: 7.5 },
  { id: 'atl', abbr: 'ATL', name: 'Atlanta Falcons',      short: 'Falcons',    conf: 'NFC', div: 'NFC South', color: '#A71930', alt: '#101820', line: 6.5 },
  { id: 'ten', abbr: 'TEN', name: 'Tennessee Titans',     short: 'Titans',     conf: 'AFC', div: 'AFC South', color: '#0C2340', alt: '#4B92DB', line: 6.5 },
  { id: 'cle', abbr: 'CLE', name: 'Cleveland Browns',     short: 'Browns',     conf: 'AFC', div: 'AFC North', color: '#311D00', alt: '#FF3C00', line: 6.5 },
  { id: 'nyj', abbr: 'NYJ', name: 'New York Jets',        short: 'Jets',       conf: 'AFC', div: 'AFC East',  color: '#125740', alt: '#FFFFFF', line: 5.5 },
  { id: 'lv',  abbr: 'LV',  name: 'Las Vegas Raiders',    short: 'Raiders',    conf: 'AFC', div: 'AFC West',  color: '#101820', alt: '#A5ACAF', line: 5.5 },
  { id: 'ari', abbr: 'ARI', name: 'Arizona Cardinals',    short: 'Cardinals',  conf: 'NFC', div: 'NFC West',  color: '#97233F', alt: '#FFB612', line: 4.5 },
  { id: 'mia', abbr: 'MIA', name: 'Miami Dolphins',       short: 'Dolphins',   conf: 'AFC', div: 'AFC East',  color: '#008E97', alt: '#FC4C02', line: 4.5 },
];

const TEAM_BY_ABBR = Object.fromEntries(TEAMS.map(t => [t.abbr, t]));
const GAMES_IN_SEASON = 17;
