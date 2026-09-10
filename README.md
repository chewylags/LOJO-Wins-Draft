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

**Records update themselves.** A scheduled GitHub Action (`.github/workflows/records.yml`)
runs every morning, fetches the current standings, and commits them to `records.json`. The
page reads that file from its own origin, which is the whole point: fetching a sports API
directly from the browser is at the mercy of CORS, while a fetch from a CI runner is not.

That leaves two manual paths, both under Setup → Records:

- **Paste a standings table** — copy the standings off ESPN, NFL.com or anywhere else and
  drop the text in. Team names and their W-L are picked out automatically; surrounding
  columns (PCT, home/away splits, points for/against) are ignored.
- **Type a record** on the Rosters tab. Anything typed by hand overrides the feed for that
  team until *Clear manual entries*.

Each team then shows how far ahead of or behind its line it's running: a team on a 10.5 line
sitting at 6-2 reads `+0.6`, because eight games in it "should" have about 5.4 wins.

The records job commits with `GITHUB_TOKEN`, and GitHub deliberately does not let such a
push trigger other workflows, so the Pages deploy is chained to that job finishing via a
`workflow_run` trigger rather than to its commit.

> GitHub disables scheduled workflows in a repository with no pushes for 60 days. If records
> ever stop refreshing in the offseason, re-enable the workflow from the Actions tab.

## Sharing it without a server

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
| `records.json` | Current records, rewritten each morning by the Action |
| `scripts/fetch-records.mjs` | Fetches standings; runs in CI, never in the browser |
