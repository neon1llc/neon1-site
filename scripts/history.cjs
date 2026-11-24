#!/usr/bin/env node
// scripts/history.cjs - Back, Forward, and reload put every page back at the exact spot its history entry was left.
// Usage: node scripts/history.cjs [SITE_DIR]   (make history; needs Playwright with Chromium and WebKit)
//
// A matrix on an iPhone profile, in both browser engines and both looks (Sentinel and Matrix): every link in the phone menu, the
// landing's buttons, its footer, its cards and panels, and the pages they lead to (Knowledge Center, a document, the blog, a post).
// Each case goes A, then B, then Back, then Forward, and where a page stands is compared with where it stood when the entry was
// left, to within 2px. Walks of several steps back and forward, and reloads at each stop, follow.
// Env: ENGINES="webkit,chromium" picks engines, LOOKS="sentinel,matrix" picks looks, ONLY="regex" picks cases.

"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");

let pw;
try { pw = require("playwright"); } catch {
  console.error("history: Playwright is not installed (npm i -g playwright, then npx playwright install chromium webkit)");
  process.exit(2);
}

const SITE = path.resolve(process.argv[2] || "src/app/public");
const ENGINES = (process.env.ENGINES || "webkit,chromium").split(",");
const LOOKS = (process.env.LOOKS || "sentinel,matrix").split(",");
const ONLY = process.env.ONLY ? new RegExp(process.env.ONLY) : null;
const TOLERANCE = 2;

// ---- Server: SITE_DIR on loopback; a directory answers with its index.html ----
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".woff2": "font/woff2", ".webp": "image/webp",
  ".png": "image/png", ".glb": "model/gltf-binary", ".m4a": "audio/mp4", ".txt": "text/plain", ".xml": "application/xml", ".json": "application/json", ".svg": "image/svg+xml" };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://local").pathname);
  if (p.endsWith("/")) p += "index.html";
  const file = path.join(SITE, p);
  if (!file.startsWith(SITE) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end("not found"); return; }
  res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
});

// ---- Cases ----
let failed = 0, ran = 0;
// On CI's shared machines a case that fails once gets one more try in a fresh session, so a slow moment in WebKit's
// software rendering doesn't hold a release; a real regression fails both times. A case that passed only on the
// retry is named at the end, with why the first try failed, so a flake stays visible
const RETRIES = Number(process.env.RETRIES ?? (process.env.CI ? 1 : 0));
const retried = [];
async function check(name, fn) {
  if (ONLY && !ONLY.test(name)) return;
  ran++;
  const t0 = Date.now();
  for (let tries = RETRIES; ; tries--) {
    try { await fn(); console.log(`ok   ${name} (${Date.now() - t0} ms)`); return; }
    catch (e) {
      const why = String(e.message).split("\n")[0];
      if (tries > 0) { console.log(`retry ${name}: ${why}`); retried.push(`${name}: ${why}`); continue; }
      failed++; console.log(`FAIL ${name}: ${why}`); return;
    }
  }
}
const expect = (ok, message, detail) => { if (!ok) throw new Error(detail === undefined ? message : `${message} ${JSON.stringify(detail)}`); };

let base = "";
const browsers = {};
// A fresh phone-sized context in one look, so cases never share a history
async function session(engine, look, start = "/") {
  const context = await browsers[engine].newContext({ ...pw.devices["iPhone 13"] });
  await context.addInitScript(([l]) => { try { localStorage.setItem("neon1.style", l); localStorage.setItem("neon1.mode", "light"); } catch { /* storage off */ } }, [look]);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  // Anything that leaves the loopback origin is aborted, so a case never depends on the network
  await page.route((url) => !url.href.startsWith(base), (route) => route.abort());
  await page.goto(base + start, { waitUntil: "load" });
  await page.waitForTimeout(1200);
  return { context, page, errors };
}
// Where the page stands, once it has stopped moving
// A page that is still navigating (WebKit under load can finish a Back or reload late) destroys the context under a
// read; the read is made again once the page has loaded
async function read(page, fn) {
  for (let i = 0; ; i++) {
    try { return await page.evaluate(fn); }
    catch (e) {
      if (i >= 3 || !/context was destroyed|navigation/i.test(String(e.message))) throw e;
      await page.waitForLoadState("load").catch(() => {});
      await page.waitForTimeout(300);
    }
  }
}
async function at(page) {
  let last = -1, y = await read(page, () => Math.round(scrollY));
  for (let i = 0; i < 12 && y !== last; i++) { last = y; await page.waitForTimeout(250); y = await read(page, () => Math.round(scrollY)); }
  return {
    y, path: await read(page, () => location.pathname), hash: await read(page, () => location.hash),
    panel: await read(page, () => document.body.classList.contains("case-open")),
  };
}
// A wheel event first (mobile WebKit has no wheel to send), so the page knows a visitor has taken over, then the move itself
const takeOver = (page) => page.evaluate(() => dispatchEvent(new WheelEvent("wheel", { deltaY: 1, bubbles: true, cancelable: true })));
async function scrollTo(page, y) {
  await takeOver(page);
  await page.evaluate((to) => scrollTo({ top: to, behavior: "instant" }), y);
  await page.waitForTimeout(900);
}
const near = (a, b) => Math.abs(a - b) <= TOLERANCE;
const label = (s) => `${s.path}${s.hash} y=${s.y}${s.panel ? " (panel)" : ""}`;
const same = (got, want, what) => expect(got.path === want.path && near(got.y, want.y) && got.panel === want.panel, `${what}: stands at ${label(got)}, left at ${label(want)}`);
// A press as a finger makes it: pointerdown (the page notes the visitor has taken over, and keeps the spot being left), then the click
const click = (page, selector) => page.evaluate((s) => {
  const el = document.querySelector(s);
  el.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true, pointerType: "touch" }));
  el.click();
}, selector);
const go = async (page, href) => {
  await page.evaluate((h) => {
    const a = document.createElement("a"); a.href = h; document.body.append(a);
    a.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true, pointerType: "touch" }));
    a.click();
  }, href);
  await page.waitForLoadState("load"); await page.waitForTimeout(1200);
};
// The phone menu's way to a link
async function viaMenu(page, selector) {
  await click(page, "#menuBtn");
  await page.waitForTimeout(700);
  await click(page, selector);
  await page.waitForTimeout(1500);
}
async function back(page) { await page.goBack({ waitUntil: "load" }).catch(() => {}); await page.waitForTimeout(1500); }
async function forward(page) { await page.goForward({ waitUntil: "load" }).catch(() => {}); await page.waitForTimeout(1500); }

async function main() {
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${server.address().port}`;
  for (const e of ENGINES) browsers[e] = await pw[e].launch();

  // A knowledge document and a blog post to walk to, found in the built site
  const doc = "/knowledge/engagement/pricing/";
  const post = fs.readdirSync(path.join(SITE, "blog")).find((d) => fs.existsSync(path.join(SITE, "blog", d, "index.html")));
  const postPath = `/blog/${post}/`;

  const MENU = ["#services", "#projects", "#why", "#process", "#work", "#faq", "#contact"];
  for (const engine of ENGINES) for (const look of LOOKS) {
    const tag = `${engine} ${look}`;

    // An in-page link from the landing: Back returns to where it was pressed, Forward to where the link led
    for (const spot of [0, 2600]) for (const link of MENU) {
      await check(`${tag}: menu ${link} from y=${spot}, Back, Forward, Back, reload`, async () => {
        const { context, page, errors } = await session(engine, look);
        try {
          if (spot) await scrollTo(page, spot);
          const before = await at(page);
          await viaMenu(page, `#menu a[href="${link}"]`);
          const target = await at(page);
          expect(target.hash === link, "the link did not put its section in the address", target);
          await back(page);
          same(await at(page), before, "Back");
          await forward(page);
          same(await at(page), target, "Forward");
          await back(page);
          same(await at(page), before, "Back again");
          await page.reload({ waitUntil: "load" }); await page.waitForTimeout(1800);
          same(await at(page), before, "reload");
          expect(!errors.length, "page errors", errors);
        } finally { await context.close(); }
      });
    }

    // The buttons and the logo on the landing page
    for (const [name, selector] of [["Discuss a project", ".hero a[href='#contact'], .hero a[data-view='contact']"], ["See the work", ".hero a[href='#projects']"], ["logo", ".n1-logo"]]) {
      if (look === "matrix" && name === "See the work") continue; // Matrix's first screen has one quiet line, not the buttons
      await check(`${tag}: ${name} from y=2600, Back, Forward`, async () => {
        const { context, page } = await session(engine, look);
        try {
          await scrollTo(page, 2600);
          const before = await at(page);
          await click(page, selector);
          await page.waitForTimeout(1500);
          const target = await at(page);
          await back(page);
          same(await at(page), before, "Back");
          await forward(page);
          same(await at(page), target, "Forward");
        } finally { await context.close(); }
      });
    }

    // A link to another page, and Back, Forward, and reload between the two
    for (const spot of [0, 2600, 6000]) for (const [name, href, there] of [["knowledge", "/knowledge/", 900], ["blog", "/blog/", 600], ["knowledge document", doc, 1200], ["blog post", postPath, 800]]) {
      await check(`${tag}: landing y=${spot} to ${name}, scrolled, Back, Forward, reload`, async () => {
        const { context, page } = await session(engine, look);
        try {
          if (spot) await scrollTo(page, spot);
          const before = await at(page);
          await go(page, href);
          await scrollTo(page, there);
          const target = await at(page);
          await back(page);
          same(await at(page), before, "Back");
          await forward(page);
          same(await at(page), target, "Forward");
          await page.reload({ waitUntil: "load" }); await page.waitForTimeout(1800);
          same(await at(page), target, "reload");
        } finally { await context.close(); }
      });
    }

    // The links a visitor presses: the footer's, and the menu's pages
    for (const [name, selector] of [["footer knowledge center", ".foot a[href='/knowledge/']"], ["footer blog", ".foot a[href='/blog/']"], ["menu knowledge", "#menu a[href='/knowledge/']"], ["menu blog", "#menu a[href='/blog/']"]]) {
      await check(`${tag}: ${name} from y=2600, Back, Forward`, async () => {
        const { context, page } = await session(engine, look);
        try {
          await scrollTo(page, 2600);
          const before = await at(page);
          if (name.startsWith("menu")) { await click(page, "#menuBtn"); await page.waitForTimeout(700); }
          await Promise.all([page.waitForNavigation({ waitUntil: "load" }), click(page, selector)]);
          await page.waitForTimeout(1200);
          const target = await at(page);
          await back(page);
          same(await at(page), before, "Back");
          await forward(page);
          same(await at(page), target, "Forward");
        } finally { await context.close(); }
      });
    }

    // A case card or panel: opening one is an entry, Back closes it and returns where the link was, Forward opens it again
    for (const [name, selector] of [["case card button", "[data-case=accounting]"], ["service card", ".svc [data-case]"]]) {
      await check(`${tag}: ${name} from the landing, Back, Forward`, async () => {
        const { context, page } = await session(engine, look);
        try {
          await scrollTo(page, 2600);
          const before = await at(page);
          await click(page, selector);
          await page.waitForTimeout(1300);
          expect((await at(page)).panel, "the panel did not open");
          await back(page);
          const closed = await at(page);
          expect(!closed.panel, "Back left the panel open", closed);
          expect(near(closed.y, before.y), `Back left the page at y=${closed.y}, not y=${before.y}`);
          await forward(page);
          expect((await at(page)).panel, "Forward did not reopen the panel");
        } finally { await context.close(); }
      });
    }
    // A walk: landing, Knowledge Center, a document, the blog, a post, each scrolled, then Back all the way and Forward all the way,
    // with a reload in the middle, every stop at the spot it was left
    await check(`${tag}: five-page walk, Back to the start, Forward to the end, reload midway`, async () => {
      const { context, page } = await session(engine, look);
      try {
        const stops = [];
        const visit = async (href, y) => {
          if (href) await go(page, href);
          await scrollTo(page, y);
          stops.push(await at(page));
        };
        await visit(null, 2600);
        await visit("/knowledge/", 700);
        await visit(doc, 1500);
        await visit("/blog/", 500);
        await visit(postPath, 900);
        for (let i = stops.length - 2; i >= 0; i--) {
          await back(page);
          same(await at(page), stops[i], `Back to stop ${i}`);
          if (i === 2) { await page.reload({ waitUntil: "load" }); await page.waitForTimeout(1800); same(await at(page), stops[2], "reload midway"); }
        }
        for (let i = 1; i < stops.length; i++) { await forward(page); same(await at(page), stops[i], `Forward to stop ${i}`); }
      } finally { await context.close(); }
    });

    // The landing's own sections walked with the menu, then Back through all of them
    await check(`${tag}: three menu sections in a row, Back through them, Forward through them`, async () => {
      const { context, page } = await session(engine, look);
      try {
        await takeOver(page);
        const stops = [await at(page)];
        for (const link of ["#services", "#process", "#contact"]) { await viaMenu(page, `#menu a[href="${link}"]`); stops.push(await at(page)); }
        for (let i = stops.length - 2; i >= 0; i--) { await back(page); same(await at(page), stops[i], `Back to stop ${i}`); }
        for (let i = 1; i < stops.length; i++) { await forward(page); same(await at(page), stops[i], `Forward to stop ${i}`); }
      } finally { await context.close(); }
    });

    // A reload where the visitor is, on the landing and in a document
    for (const [name, start, y] of [["landing", "/", 3400], ["knowledge document", doc, 1100], ["blog post", postPath, 900]]) {
      await check(`${tag}: reload of the ${name} at y=${y}`, async () => {
        const { context, page } = await session(engine, look, start);
        try {
          await scrollTo(page, y);
          const before = await at(page);
          await page.reload({ waitUntil: "load" }); await page.waitForTimeout(1800);
          same(await at(page), before, "reload");
        } finally { await context.close(); }
      });
    }
  }

  for (const e of ENGINES) await browsers[e].close();
  server.close();
  if (retried.length) console.log(`\n${retried.length} case${retried.length === 1 ? "" : "s"} passed only on a retry:\n  ${retried.join("\n  ")}\n`);
  console.log(`history: ${ran - failed} of ${ran} passed${failed ? `, ${failed} failed` : ""}`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(2); });
