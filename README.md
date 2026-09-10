# LOJO Wins Draft

Josh vs. Logan, the annual NFL win-total draft — the shared Apple Note, rebuilt as a website.

All 32 teams sit on a board ranked by their averaged sportsbook win total. You each draft
six of them, then track how the real season treats your picks.

## How it works

**The draft order** matches the rule you've always used: pick 1 goes to whoever's up first,
the other player takes picks **2 and 3** back to back, and then it alternates the rest of the
way. Each side ends up with six teams.

**The NFC West is locked out by default** — Rams, Seahawks, 49ers and Cardinals are struck
off the board so nobody's Rams fandom tips the scales. It's a toggle on the Setup tab if you
ever want them back in.

**Records update themselves**, from two directions:

- A scheduled Action (`.github/workflows/records.yml`) fetches the standings and commits
  them to `records.json` — every morning, and every half hour while games are being played.
  That file is what someone sees on a cold load without pressing anything.
- **Update now** (Setup → Records) fetches the live scores straight from the page, for when
  you want the early Sunday slate reflected while the late one is still going. ESPN serves
  `access-control-allow-origin: *`, so the browser is allowed to ask it directly.

Whichever is more recent wins, and feeds merge rather than replace — some endpoints only
describe the teams playing this week, so overwriting wholesale would drop everyone else.

On a phone, **pull down from the top** to refresh — the same gesture as anywhere else.
That matters if you add the site to your Home Screen: it launches without browser chrome,
so the pull is the only reload affordance there.

Records can also be typed by hand on the Rosters tab. Anything typed overrides the feed for
that team until *Clear manual entries*.

## The point contest

Every team scores whole wins clear of its line. On a 10.5-win line, 11 wins is **+1**, 12 is
**+2**, 13 is **+3**; 10 wins is **-1**, 9 is **-2**, 8 is **-3**. A half-point line can't
land exactly, so there are no zeroes unless you enter a whole-number line and the team hits
it on the nose. Ties count as half a win, the way a sportsbook settles a win total, so a
10-6-1 finish against a 10.5 line pushes to 0.

Your score is the sum across your six teams, shown in the Rosters tab. The scoreboard at the
top stays on wins.

Mid-season the figure is a **projection**, shown slightly dimmed and labelled `proj. pts`.
It takes the wins a team has banked and plays out the rest of its schedule at the rate its
own line implies. That keeps early weeks meaningful instead of absurd: before kickoff every
team sits at 0, one win in week 1 is +1 and one loss is -1, and the number converges on the
real result as games accumulate. Once a team has played all 17, it's no longer a projection
and the points are final.

The records job commits with `GITHUB_TOKEN`, and GitHub deliberately does not let such a
push trigger other workflows, so the Pages deploy is chained to that job finishing via a
`workflow_run` trigger rather than to its commit.

> GitHub disables scheduled workflows in a repository with no pushes for 60 days. If records
> ever stop refreshing in the offseason, re-enable the workflow from the Actions tab.

## Sharing it without a server

Browsers do not share storage with each other, and on iOS a Home Screen app has its own
storage separate from Safari's. A draft made in one place is invisible everywhere else
unless it travels. Two things carry it:

**The Share link.** Every pick, name, win total and manual record is encoded into the `#d=…`
part of the URL. Tap **Share**, send the link, and whoever opens it sees that exact board.
The link must keep its `#…` part — a bare URL with the fragment stripped is a blank slate.

**The published draft.** `draft.json` is the standing copy that the plain site URL serves to
everyone. To set it: tap Share, copy the link, then run the **Publish draft** workflow
(Actions → Publish draft → Run workflow) and paste the link in. It validates the teams,
commits `draft.json` and redeploys.

The page then picks whichever is most authoritative: an explicit share link wins, otherwise
a published draft newer than this browser's own copy wins, otherwise the browser keeps what
it has. So a publish reaches both of you on a refresh without ever overwriting edits made
since.

Records need none of this — they come from `records.json`, which both of you already load
from the site, so those stay in sync on their own.

## The old sharing notes

There is no backend, no database, no login — and you can still both use it.

The **entire draft is encoded into the page URL**. Every pick, name, win total and record
lives in the `#d=…` part of the link. Hit **Share**, send the link over text, and whoever
opens it sees the exact board you're looking at.

The trade-off worth knowing: this is *share-on-demand*, not live sync. If you both make picks
at the same moment in separate browsers, the links diverge and the last one opened wins. In
practice that's fine — one of you runs the board during the draft and sends the link after,
the same way one of you was editing the Note.

Each browser also remembers the last draft you had open, so refreshing or coming back later
picks up right where you left off. **Export file** / **Import file** give you a permanent
copy to keep between seasons.

## Cache busting

GitHub Pages serves with `Cache-Control: max-age=600`, so a browser can hand back a copy up
to ten minutes old — and from the Home Screen there is no reload button to fall back on.

The deploy stamps the commit SHA into the page, publishes it as `version.txt`, and appends
it to the CSS and JS URLs. The running app fetches `version.txt` (no-store, so never cached)
on load and on every pull-to-refresh; if it names a newer build, the app reloads onto
`?v=<sha>`. A URL the cache has never seen must be fetched fresh, which a plain `reload()`
cannot guarantee. The draft lives in the URL hash, so it survives the trip, and the app
refuses to redirect twice for the same build so a stale cache can't cause a reload loop.

## Running it

It's plain HTML, CSS and JavaScript — no build step, no dependencies.

- **Live site:** enable GitHub Pages (Settings → Pages → Source: *GitHub Actions*). The
  workflow in `.github/workflows/pages.yml` publishes `main` on every push.
- **Locally:** open `index.html`, or run `npx http-server .` and visit the printed URL.

## Updating next season's lines

Flip on **Edit win totals** in Setup and every line on the board becomes an input — paste in
the new numbers, and the board re-ranks itself as you go. To change the baseline defaults
that a fresh browser starts from, edit the `line` values in `teams.js`.

## Files

| File | What's in it |
| --- | --- |
| `index.html` | Page structure |
| `styles.css` | All styling |
| `teams.js` | The 32 teams — colors, divisions, default win totals |
| `app.js` | Draft logic, board rendering, URL encoding, record loading |
| `records-parse.js` | ESPN response parser, shared by the page and the CI script |
| `records.json` | Current records, rewritten by the scheduled Action |
| `scripts/fetch-records.mjs` | Fetches standings in CI and commits `records.json` |
