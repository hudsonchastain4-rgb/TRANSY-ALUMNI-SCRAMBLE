// Builds a single self-contained, static HTML archive of the app.
//
// How it works:
//   1. Fetches the built JS/CSS bundles and /api/state from a running deployment.
//   2. Composes an interactive "renderer" page (bundles + frozen state with
//      EventSource/fetch shimmed) and serves it from a throwaway local server —
//      served over http:// so React Router works normally.
//   3. Uses headless Chrome to render each route and captures the resulting DOM.
//   4. Stitches the captured pages into ONE static HTML file. The app's own tab
//      bar keeps working via a small click-delegation script (no React, no
//      router), so the archive opens from file:// in any browser — including
//      Safari, which blocks module scripts and history.pushState on file://.
//
// Usage: node scripts/export-archive.mjs <baseUrl> <outFile>
//   e.g. node scripts/export-archive.mjs https://bbh-ryder-cup-production.up.railway.app archive/bbh-2026.html
// Requires Google Chrome locally (override binary with CHROME_BIN env var).

import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileP = promisify(execFile);

const base = (process.argv[2] || 'http://localhost:3001').replace(/\/$/, '');
const outPath =
  process.argv[3] || `bbh-archive-${new Date().toISOString().slice(0, 10)}.html`;
const CHROME =
  process.env.CHROME_BIN ||
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

// Routes to capture: [route, section id, must-contain sanity marker]
const PAGES = [
  ['/scoreboard', 'scoreboard', 'Transy Alumni Scramble'],
  ['/players', 'players', 'performance'],
  ['/picks', 'picks', 'Spectator picks'],
  ['/final', 'final', 'Transy Alumni Scramble'],
];

async function text(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url} → ${r.status}`);
  return r.text();
}

console.log(`Fetching app + state from ${base} …`);
const indexHtml = await text(`${base}/`);
const jsPath = indexHtml.match(/\/assets\/index-[^"]+\.js/)?.[0];
const cssPath = indexHtml.match(/\/assets\/index-[^"]+\.css/)?.[0];
if (!jsPath || !cssPath) throw new Error('could not find asset paths in index.html');

const [js, css, stateText] = await Promise.all([
  text(`${base}${jsPath}`),
  text(`${base}${cssPath}`),
  text(`${base}/api/state`),
]);
const state = JSON.parse(stateText);

const escScript = (s) => s.replace(/<\/script/gi, '<\\/script');

// ---------------------------------------------------------------------------
// Step 1: interactive renderer page (only ever served over http, never shipped)
// ---------------------------------------------------------------------------
const shim = `
(function () {
  var SNAPSHOT = window.__ARCHIVE_STATE__;
  function ArchiveES() {
    var self = this;
    this._l = {};
    setTimeout(function () {
      self._emit('open', {});
      self._emit('state', { data: JSON.stringify(SNAPSHOT) });
    }, 0);
  }
  ArchiveES.prototype.addEventListener = function (t, f) { (this._l[t] = this._l[t] || []).push(f); };
  ArchiveES.prototype.removeEventListener = function (t, f) {
    if (this._l[t]) this._l[t] = this._l[t].filter(function (x) { return x !== f; });
  };
  ArchiveES.prototype.close = function () {};
  ArchiveES.prototype._emit = function (t, ev) {
    (this._l[t] || []).forEach(function (f) { try { f(ev); } catch (e) {} });
  };
  window.EventSource = ArchiveES;

  var origFetch = window.fetch ? window.fetch.bind(window) : null;
  window.fetch = function (input, init) {
    var url = typeof input === 'string' ? input : (input && input.url) || '';
    if (url.indexOf('/api') === 0) {
      var json = function (obj, status) {
        return Promise.resolve(new Response(JSON.stringify(obj), {
          status: status || 200,
          headers: { 'Content-Type': 'application/json' },
        }));
      };
      if (url.indexOf('/api/auth/me') === 0) return json({ isScorekeeper: false, isAdmin: false });
      if (url.indexOf('/api/state') === 0) return json(SNAPSHOT);
      return json({ error: 'archived snapshot — read only' }, 403);
    }
    return origFetch ? origFetch(input, init) : Promise.reject(new Error('offline'));
  };
})();
`;

const rendererHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <style>${css}</style>
  </head>
  <body class="bg-cream text-ink min-h-screen antialiased">
    <div id="root"></div>
    <script>window.__ARCHIVE_STATE__ = ${escScript(JSON.stringify(state))};</script>
    <script>${escScript(shim)}</script>
    <script>"use strict";${escScript(js)}</script>
  </body>
</html>
`;

// ---------------------------------------------------------------------------
// Step 2: serve it and capture each route with headless Chrome
// ---------------------------------------------------------------------------
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(rendererHtml);
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;

async function captureRoute(route) {
  const { stdout } = await execFileP(
    CHROME,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      '--virtual-time-budget=8000',
      '--dump-dom',
      `http://127.0.0.1:${port}${route}`,
    ],
    { maxBuffer: 64 * 1024 * 1024 }
  );
  const start = stdout.indexOf('<div id="root">');
  if (start === -1) throw new Error(`${route}: no root div in dump`);
  const afterRoot = stdout.slice(start + '<div id="root">'.length);
  const scriptIdx = afterRoot.indexOf('<script>');
  let inner = scriptIdx === -1 ? afterRoot : afterRoot.slice(0, scriptIdx);
  // Trim the root div's own closing tag.
  const lastClose = inner.lastIndexOf('</div>');
  if (lastClose !== -1) inner = inner.slice(0, lastClose);
  return inner.trim();
}

const captured = {};
for (const [route, id, marker] of PAGES) {
  process.stdout.write(`Rendering ${route} … `);
  const inner = await captureRoute(route);
  if (!inner.includes(marker) || inner.length < 500) {
    throw new Error(`${route}: capture failed sanity check (${inner.length} chars)`);
  }
  captured[id] = inner;
  console.log(`${Math.round(inner.length / 1024)} KB`);
}
server.close();

// ---------------------------------------------------------------------------
// Step 3: stitch into one static file
// ---------------------------------------------------------------------------
const stamp = new Date().toISOString().slice(0, 10);

const tabScript = `
(function () {
  var MAP = { '/scoreboard': 'scoreboard', '/players': 'players', '/picks': 'picks', '/final': 'final' };
  function show(id) {
    document.querySelectorAll('[data-archive-page]').forEach(function (el) {
      el.style.display = el.getAttribute('data-archive-page') === id ? '' : 'none';
    });
  }
  document.addEventListener('click', function (e) {
    var a = e.target.closest ? e.target.closest('a') : null;
    if (!a) return;
    var href = a.getAttribute('href') || '';
    e.preventDefault();
    var clean = href.split('?')[0];
    if (MAP[clean]) show(MAP[clean]);
  });
  // Neutralize buttons/forms — this is a read-only archive.
  document.addEventListener('submit', function (e) { e.preventDefault(); });
  show('scoreboard');
})();
`;

const sections = PAGES.map(
  ([, id]) => `<div data-archive-page="${id}" style="display:none">${captured[id]}</div>`
).join('\n');

const finalHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="theme-color" content="#faf6ec" />
    <title>Transy Alumni Golf Scramble · Archive ${stamp}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Bitter:wght@500;700;900&family=Inter:wght@400;500;600;700&display=swap"
      rel="stylesheet"
    />
    <style>${css}</style>
  </head>
  <body class="bg-cream text-ink min-h-screen antialiased">
    ${sections}
    <script>${escScript(tabScript)}</script>
  </body>
</html>
`;

fs.mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true });
fs.writeFileSync(outPath, finalHtml);
console.log(
  `Wrote ${outPath} (${Math.round(finalHtml.length / 1024)} KB) — ` +
    `totals ${state.totals?.a}–${state.totals?.b}, ${state.matches?.length} matches, ${PAGES.length} pages`
);
