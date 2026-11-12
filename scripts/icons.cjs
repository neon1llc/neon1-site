#!/usr/bin/env node
// scripts/icons.cjs - Draws neon1's square brand icons from the mark in the bar: favicons, the touch icon, and the logo.
// Usage: node scripts/icons.cjs [SITE_DIR]   (make icons; needs Playwright and its Chromium)
//
// Writes favicon.ico (16, 32, and 48 px), favicon-48.png, favicon-192.png (for search results), and apple-touch-icon.png (180 px) at the site root,
// where browsers and search crawlers look for them, and media/neon1-logo-512.png, the square logo the
// structured data names. Media never changes in place (README, Deploy), so a redrawn logo needs a new
// name here and in index.html; then run make rehash. Chromium's rasterizer can differ between versions,
// so a rerun may change bytes without changing the picture.

"use strict";
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const SITE = path.resolve(process.argv[2] || "src/app/public");

// The mark as drawn in the bar (index.html, frame:logo): two arches of nested arcs falling into columns.
// Small sizes keep the outer and third arcs only, thicker, like the old inline favicon, so they stay legible
const FULL = "M6 6a24 24 0 0 1 24 24v30M6 12a18 18 0 0 1 18 18v30M6 18a12 12 0 0 1 12 12v30M6 24a6 6 0 0 1 6 6v30" +
  "M34 6a24 24 0 0 1 24 24v30M34 12a18 18 0 0 1 18 18v30M34 18a12 12 0 0 1 12 12v30M34 24a6 6 0 0 1 6 6v30";
const SIMPLE = "M6 6a24 24 0 0 1 24 24v30M6 18a12 12 0 0 1 12 12v30M34 6a24 24 0 0 1 24 24v30M34 18a12 12 0 0 1 12 12v30";
const VOID = "#0D0208", NEON = "#6CFFA8"; // shared/neon1.css --void and --neon

// A square SVG: the dark brand ground edge to edge (touch icons and search results crop to their own shape),
// the mark centered with room around it
function svg(size, small) {
  const pad = small ? 5 : 12, box = 64 + 2 * pad;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${-pad} ${-pad + 1} ${box} ${box}">` +
    `<rect x="${-pad}" y="${-pad + 1}" width="${box}" height="${box}" fill="${VOID}"/>` +
    `<path d="${small ? SIMPLE : FULL}" fill="none" stroke="${NEON}" stroke-width="${small ? 5.5 : 2.6}" stroke-linecap="round"/></svg>`;
}

// An ICO whose entries are PNGs (supported by every current browser), largest last
function ico(pngs) {
  const head = Buffer.alloc(6 + 16 * pngs.length);
  head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(pngs.length, 4);
  let offset = head.length;
  pngs.forEach(([size, data], i) => {
    const e = 6 + 16 * i;
    head.writeUInt8(size % 256, e); head.writeUInt8(size % 256, e + 1);
    head.writeUInt16LE(1, e + 4); head.writeUInt16LE(32, e + 6);
    head.writeUInt32LE(data.length, e + 8); head.writeUInt32LE(offset, e + 12);
    offset += data.length;
  });
  return Buffer.concat([head, ...pngs.map(([, d]) => d)]);
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  const draw = async (size, small) => {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<!doctype html><style>html,body{margin:0}svg{display:block}</style>${svg(size, small)}`);
    return page.screenshot({ type: "png", clip: { x: 0, y: 0, width: size, height: size } });
  };
  const small = {};
  for (const s of [16, 32, 48]) small[s] = await draw(s, true);
  fs.writeFileSync(path.join(SITE, "favicon.ico"), ico([[16, small[16]], [32, small[32]], [48, small[48]]]));
  fs.writeFileSync(path.join(SITE, "favicon-48.png"), small[48]);
  fs.writeFileSync(path.join(SITE, "apple-touch-icon.png"), await draw(180, false));
  // Search results show one icon to everyone, at a multiple of 48 px: matrix green on the dark ground
  fs.writeFileSync(path.join(SITE, "favicon-192.png"), await draw(192, false));
  fs.writeFileSync(path.join(SITE, "media/neon1-logo-512.png"), await draw(512, false));
  await browser.close();
  console.log("icons: favicon.ico, favicon-48.png, favicon-192.png, apple-touch-icon.png, media/neon1-logo-512.png");
})().catch((e) => { console.error(e); process.exit(1); });
