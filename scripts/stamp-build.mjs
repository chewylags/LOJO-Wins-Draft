/* ------------------------------------------------------------------
   Stamp the deployed build.

   GitHub Pages serves with Cache-Control: max-age=600, so a browser can
   hand back a page up to ten minutes old — and from the Home Screen there
   is no reload button to fall back on. Two things fix that:

     - version.txt, which the running app fetches no-store to notice that
       a newer build exists;
     - ?v=<sha> on every asset URL, so freshly fetched HTML can never pair
       with a cached copy of the old CSS or JS.

   Run from the repo root during deploy. Fails rather than shipping a page
   that was not stamped.
------------------------------------------------------------------ */

import { readFile, writeFile } from 'node:fs/promises';

const ASSETS = [
  ['href', 'styles.css'],
  ['src', 'teams.js'],
  ['src', 'history.js'],
  ['src', 'records-parse.js'],
  ['src', 'app.js'],
];

const sha = (process.env.GITHUB_SHA || '').slice(0, 8);
if (!sha) {
  console.error('GITHUB_SHA is not set');
  process.exit(1);
}

let html = await readFile('index.html', 'utf8');

html = html.replace('<meta name="build" content="dev">', `<meta name="build" content="${sha}">`);
for (const [attr, file] of ASSETS) {
  html = html.replace(`${attr}="${file}"`, `${attr}="${file}?v=${sha}"`);
}

const missing = [];
if (!html.includes(`content="${sha}"`)) missing.push('build meta tag');
for (const [, file] of ASSETS) {
  if (!html.includes(`${file}?v=${sha}`)) missing.push(file);
}
if (missing.length) {
  console.error(`::error::build stamp did not apply to: ${missing.join(', ')}`);
  process.exit(1);
}

await writeFile('index.html', html);
await writeFile('version.txt', sha);

console.log(`stamped build ${sha}`);
for (const line of html.split('\n')) {
  if (/meta name="build"|\?v=/.test(line)) console.log('  ' + line.trim());
}
