#!/usr/bin/env node
// scripts/og-card.cjs - Draws the 1200 by 630 link-preview card from the mark, the name, and the landing's first line.
// Usage: node scripts/og-card.cjs [SITE_DIR] [NAME]   (needs Playwright and its Chromium; NAME defaults to og-card-2.png)
//
// Media never changes in place (README, Deploy), so a new card gets a new name here, in scripts/page-shell.mjs, and in
// index.html; then run make rehash.

"use strict";
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const SITE = path.resolve(process.argv[2] || "src/app/public");
const NAME = process.argv[3] || "og-card-2.png";

// The mark as drawn in the bar (see scripts/icons.cjs), and the brand colors from shared/neon1.css
const MARK = "M6 6a24 24 0 0 1 24 24v30M6 12a18 18 0 0 1 18 18v30M6 18a12 12 0 0 1 12 12v30M6 24a6 6 0 0 1 6 6v30" +
  "M34 6a24 24 0 0 1 24 24v30M34 12a18 18 0 0 1 18 18v30M34 18a12 12 0 0 1 12 12v30M34 24a6 6 0 0 1 6 6v30";
const VOID = "#0D0208", NEON = "#6CFFA8", SOFT = "#4FB880";
const font = path.join(SITE, "fonts", "jetbrains-mono-latin-wght-normal.woff2");

// One page: the card centered on the dark ground with a soft glow, the line under the name in two lines so it stays large
const html = `<!doctype html><meta charset="utf-8"><style>
@font-face { font-family: JB; src: url("file://${font}") format("woff2"); font-weight: 100 800; }
html, body { margin: 0; width: 1200px; height: 630px; background: ${VOID}; font-family: JB, monospace; color: ${NEON}; }
.card { position: absolute; left: 150px; top: 120px; width: 900px; height: 390px; box-sizing: border-box; border: 1px solid rgba(108,255,168,.22);
  border-radius: 28px; box-shadow: 0 0 60px rgba(108,255,168,.12); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 22px; }
.name { display: flex; align-items: center; gap: 28px; }
.name span { font-size: 124px; font-weight: 800; letter-spacing: -2px; text-shadow: 0 0 18px rgba(108,255,168,.75), 0 0 44px rgba(108,255,168,.35); }
svg { width: 96px; height: 96px; filter: drop-shadow(0 0 8px rgba(108,255,168,.7)); }
.line { font-size: 31px; font-weight: 500; line-height: 1.35; text-align: center; }
.sub { font-size: 21px; color: ${SOFT}; }
</style><div class="card"><div class="name"><svg viewBox="0 0 64 64" fill="none" stroke="${NEON}" stroke-width="2.6" stroke-linecap="round"><path d="${MARK}"/></svg><span>neon1</span></div>
<div class="line">Independent engineering and<br>technology consulting.</div><div class="sub">1 is glad to be of service.</div></div>`;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  const file = path.join(SITE, "..", "..", "..", ".og-card.html");
  fs.writeFileSync(file, html);
  await page.goto("file://" + file);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(SITE, "media", NAME) });
  fs.unlinkSync(file);
  await browser.close();
  console.log(`og-card: wrote media/${NAME}`);
})();
