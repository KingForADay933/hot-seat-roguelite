# Releasing to itch.io

Install first, then one command builds and packs the upload:

```
npm install
npm run package:itch
```

That writes `hot-seat-itch.zip` in the repo root — about 200 KB, nine files. Upload that file and nothing else.

Both `dist-itch/` and `hot-seat-itch.zip` are gitignored; they are build output, rebuilt on demand.

## `npm install` first, every time you have pulled

Not ceremony. `package.json` travels with a commit; `node_modules` does not — and it is per checkout,
so a git worktree has its own. A change developed in a worktree can pass every check there, be merged,
and leave the checkout you release from with the dependency **listed and not installed**.

That is exactly how the Barlow Condensed release broke:

```
Error: [vite]: Rolldown failed to resolve import
"@fontsource/barlow-condensed/latin-600.css" from "src/main.tsx"
```

The build had been green everywhere it was tested. `npm install` in the release checkout was the whole
fix. If `package:itch` ever fails to resolve an import that plainly exists in `package.json`, this is
why — reach for `npm install` before you go looking for anything cleverer.

---

## Why not just zip the project folder

Zipping the working folder sweeps in `node_modules`, which is why the first attempt hit **"Too many files in zip (2734 > 1000)"**. itch.io does not run your source; it serves an already-built static site. Almost everything in the repo is input to that build, not part of it.

The build output is nine files:

```
index.html
favicon.svg
icons.svg
assets/index-<hash>.css
assets/index-<hash>.js
assets/barlow-condensed-latin-600-normal-<hash>.woff2
assets/barlow-condensed-latin-700-normal-<hash>.woff2
assets/barlow-condensed-latin-600-normal-<hash>.woff
assets/barlow-condensed-latin-700-normal-<hash>.woff
```

The display face ships as a bundled asset rather than a CDN link, because an itch build has to work
with no network. Only the `.woff2` of the weight in use is actually fetched; the `.woff` pair is a
fallback for engines that predate woff2, and is the obvious thing to drop if the zip ever needs
trimming. Latin only — the unscoped `@fontsource` entrypoints also pull Cyrillic, Greek and
Vietnamese, which would ship in the zip and never be requested.

## The two traps this script exists to avoid

Both produce a zip that looks completely correct and a game that loads as a blank white page.

**1. The base path.** `npm run build` targets GitHub Pages, which serves from `/hot-seat-roguelite/`, so it writes absolute asset URLs with that prefix. itch unzips to a path nobody can predict and serves it in an iframe, so those URLs would 404. `--mode itch` (see `vite.config.ts`) switches the base to `./`, making every URL relative and therefore correct wherever it lands.

**2. Path separators inside the zip.** PowerShell's `Compress-Archive` writes Windows separators into entry names (`assets\index-abc.js`). The ZIP spec requires forward slashes, and an extractor that takes the name literally ends up serving a file *called* `assets\index-abc.js` while the page asks for `assets/index-abc.js`. `scripts/package-itch.ps1` writes the entries by hand for this reason — do not swap it back for `Compress-Archive`.

## Settings on the itch page

- **Kind of project:** HTML
- On the uploaded file, tick **"This file will be played in the browser"**
- **Embed options:** manually set the viewport. The UI is a single scrolling column and comfortable around **1280 × 800**. Tick **Fullscreen button**; **Mobile friendly** is best left off — the roster and box-score tables need the width.
- The game saves runs to IndexedDB. It works in itch's iframe, but a browser that blocks third-party storage (Safari's default, some privacy extensions) will drop saves between sessions. Worth a line on the page telling playtesters to use the fullscreen button if a run does not survive a reload.

## Verifying a build before uploading

The failure modes above only show up when the game is served from a path it did not expect, so serving `dist-itch/` at the root will not catch them. Extract the zip into a randomly named subfolder, serve the folder *above* it, and open the subfolder's URL:

```
npx vite preview --outDir <folder containing the extracted subfolder> --port 4173
```

Then load `http://localhost:4173/<random-subfolder>/`. The page should render, the browser console should be empty, and a run should survive a reload.
