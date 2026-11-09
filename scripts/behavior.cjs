#!/usr/bin/env node
// scripts/behavior.cjs - Browser checks for the home page's interactive contracts: the brief never
// submits, a case study owns the screen while open, and chooser links land on their exact case.
// Usage: node scripts/behavior.cjs [SITE_DIR]   (make behavior; needs Playwright and its Chromium)
//
// Everything runs against a loopback copy of SITE_DIR served with a CSP like production's; any request
// that leaves the loopback origin is aborted and fails the run. Text typed into fields is synthetic.
// Output lines are tagged [browser] for DOM and keyboard behavior and [gpu] for checks that drive the
// WebGL scene (headless Chromium renders it in software, so these are slow and prove lifecycle, not speed).

"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");

let chromium;
try { ({ chromium } = require("playwright")); } catch {
  console.error("behavior: Playwright is not installed (npm i -g playwright, then npx playwright install chromium)");
  process.exit(2);
}

const SITE = path.resolve(process.argv[2] || "src/app/public");
const ONLY = process.env.ONLY ? new RegExp(process.env.ONLY) : null;

// ---- Server: SITE_DIR on loopback, with the production policy's shape and per-test overrides ----
// Production (neon1-aws-infrastructure) allows scripts, styles, fonts, and connections from the site
// itself and images from the site or data: URLs; inline scripts, styles, and handlers are blocked
const CSP = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'";
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".woff2": "font/woff2", ".webp": "image/webp",
  ".png": "image/png", ".glb": "model/gltf-binary", ".m4a": "audio/mp4", ".txt": "text/plain", ".xml": "application/xml" };
const requests = [];       // every URL the server saw, to search for synthetic text
const overrides = new Map(); // path -> async (body) => body | null (null answers 404), set per test

const server = http.createServer(async (req, res) => {
  requests.push(req.url);
  const pathname = decodeURIComponent(new URL(req.url, "http://local").pathname);
  const file = path.join(SITE, pathname === "/" ? "index.html" : pathname);
  if (!file.startsWith(SITE + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.statusCode = 404; res.end(); return; }
  let body = fs.readFileSync(file);
  const hook = overrides.get(pathname);
  if (hook) body = await hook(body);
  if (body === null) { res.statusCode = 404; res.end(); return; }
  res.setHeader("Content-Type", TYPES[path.extname(file)] || "application/octet-stream");
  res.setHeader("Content-Security-Policy", CSP);
  res.setHeader("Cache-Control", "no-store");
  res.end(body);
});

// ---- Runner: each check is a named async function; failures are collected, not thrown past the run ----
const checks = [];
const check = (tag, name, fn) => checks.push({ tag, name, fn });
function expect(ok, message, detail) {
  if (!ok) throw new Error(message + (detail === undefined ? "" : ` (${JSON.stringify(detail)})`));
}

let browser, origin;
const leaks = [], violations = [];

// A fresh context per check: loopback only, CSP violations and page errors recorded
async function open(options = {}, url = "/") {
  const { init, ...contextOptions } = options;
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce", ...contextOptions });
  await context.route("**/*", (r) => {
    if (r.request().url().startsWith(origin)) return r.continue();
    leaks.push(r.request().url());
    return r.abort();
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (/Content.Security.Policy|Refused to/i.test(m.text())) violations.push(m.text()); });
  if (init) await page.addInitScript(init);
  await page.goto(origin + url, { waitUntil: "domcontentloaded" });
  return { page, context, errors };
}

// Rabbit's animation-frame callbacks by name, so a check can see whether the scene loop still runs
const COUNT_FRAMES = () => {
  const raf = window.requestAnimationFrame.bind(window), caf = window.cancelAnimationFrame.bind(window);
  const pending = (window.__frames = new Map());
  window.requestAnimationFrame = (cb) => { const id = raf((t) => { pending.delete(id); cb(t); }); pending.set(id, cb.name); return id; };
  window.cancelAnimationFrame = (id) => { pending.delete(id); caf(id); };
};
const sceneFrames = (page) => page.evaluate(() => [...window.__frames.values()].filter((n) => n === "frame").length);


// ---- SITE-01: the brief stays on the page ----
// Without script, with brief.js blocked, and with brief.js failing as it starts, Enter in any field
// must not navigate or send the synthetic answers anywhere
const MARK = "SYNTHETIC-BRIEF-7f3a";
for (const mode of ["javascript disabled", "brief.js blocked", "brief.js fails to start"]) {
  check("browser", `brief: Enter sends nothing with ${mode}`, async () => {
    if (mode === "brief.js blocked") overrides.set("/js/brief.js", async () => null);
    if (mode === "brief.js fails to start") overrides.set("/js/brief.js", async (b) => `throw new Error("synthetic start failure");\n${b}`);
    const { page, context } = await open({ javaScriptEnabled: mode !== "javascript disabled" });
    try {
      const before = page.url(), seen = requests.length;
      await page.locator(".brief-wrap summary").click();
      await page.locator("[name=today]").fill(MARK + "-today");
      await page.locator("[name=better]").fill(MARK + "-better");
      await page.locator("[name=timing]").fill(MARK + "-timing");
      for (const name of ["timing", "today"]) await page.locator(`[name=${name}]`).press("Enter");
      await page.waitForTimeout(400);
      expect(page.url() === before, "the page navigated", page.url());
      const sent = requests.slice(seen).filter((u) => u.includes(MARK));
      expect(!sent.length, "a request carried the brief", sent);
      expect(!(await page.locator(".brief-wrap form, #brief form").count()), "the brief sits in a form element again");
    } finally { overrides.delete("/js/brief.js"); await context.close(); }
  });
}

// With the script, the preview, copy, and save work, and nothing lands in storage or on the network
check("browser", "brief: preview, copy, and save stay local", async () => {
  const { page, context } = await open({ permissions: ["clipboard-read", "clipboard-write"] });
  try {
    const seen = requests.length;
    await page.locator(".brief-wrap summary").click();
    await page.locator("[name=today]").fill(MARK + " orders retyped");
    await page.locator("[name=timing]").press("Enter");
    expect((await page.locator("#briefOut").textContent()).includes(MARK), "the preview did not follow the fields");
    await page.locator("#briefCopy").click();
    await page.waitForFunction(() => /Copied|Selected/.test(document.getElementById("briefDone").textContent));
    const [download] = await Promise.all([page.waitForEvent("download"), page.locator("#briefSave").click()]);
    expect(download.suggestedFilename() === "neon1-brief.txt", "unexpected download name", download.suggestedFilename());
    const stored = await page.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }));
    expect(!stored.includes(MARK), "the brief reached browser storage");
    const dbs = await page.evaluate(async () => (indexedDB.databases ? (await indexedDB.databases()).length : 0));
    expect(dbs === 0, "an IndexedDB database was created", dbs);
    expect(!requests.slice(seen).some((u) => u.includes(MARK)), "a request carried the brief");
  } finally { await context.close(); }
});


// ---- SITE-05: a case study owns the screen while open ----
// Where focus is, whether it sits inside the panel, and whether the page behind is inert
const caseState = (page) => page.evaluate(() => {
  const a = document.activeElement, panel = document.querySelector(".case-panel");
  return {
    open: !document.getElementById("caseLayer").hidden,
    locked: document.body.classList.contains("case-open") || document.documentElement.classList.contains("case-lock"),
    inPanel: panel.contains(a), onPanel: a === panel,
    focused: a.dataset.case || a.className || a.tagName,
    inert: ["header", ".awake", ".top", ".rainctl"].map((s) => document.querySelector(s).inert),
    last: a === [...panel.querySelectorAll("a[href], button")].pop(),
  };
});

check("browser", "case: Shift+Tab from the panel, full Tab cycle, Escape, and focus back on the opener", async () => {
  const { page, context, errors } = await open();
  try {
    await page.locator("[data-case=accounting]").focus();
    await page.keyboard.press("Enter");
    let s = await caseState(page);
    expect(s.open && s.onPanel, "focus did not move to the open panel", s);
    expect(s.inert.every(Boolean), "the page behind the panel is not inert", s.inert);
    await page.keyboard.press("Shift+Tab");
    s = await caseState(page);
    expect(s.inPanel && s.last, "Shift+Tab from the panel left it or missed its last control", s);
    const count = await page.locator(".case-panel").evaluate((p) => p.querySelectorAll("a[href], button").length);
    for (let i = 0; i < count + 2; i++) {
      await page.keyboard.press(i % 3 === 2 ? "Shift+Tab" : "Tab");
      s = await caseState(page);
      expect(s.inPanel, `Tab ${i + 1} left the panel`, s);
    }
    await page.keyboard.press("Escape");
    s = await caseState(page);
    expect(!s.open && !s.locked && s.focused === "accounting", "Escape did not close and return focus to the opener", s);
    expect(!s.inert[0] && !s.inert[1], "the page stayed inert after closing", s.inert);
    await page.keyboard.press("Escape");
    expect(!(await caseState(page)).open, "a second Escape reopened or broke the panel");
    expect(!errors.length, "page errors", errors);
  } finally { await context.close(); }
});

check("browser", "case: on a phone, the menu can't open over an open case study", async () => {
  const { page, context } = await open({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  try {
    await page.locator("[data-case=home]").click();
    const box = await page.locator("#menuBtn").boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    const menuHidden = await page.locator("#menu").evaluate((m) => m.hidden);
    const s = await caseState(page);
    expect(menuHidden && s.open, "the menu opened over the case study", { menuHidden, s });
    await page.locator(".case-close").click();
    await page.locator("#menuBtn").click();
    expect(!(await page.locator("#menu").evaluate((m) => m.hidden)), "the menu no longer opens after the case study closed");
  } finally { await context.close(); }
});

check("browser", "case: closing settles after repeated input, cancelled animations, and a motion change", async () => {
  const { page, context, errors } = await open({ reducedMotion: "no-preference" });
  try {
    const settled = async (why) => {
      await page.waitForTimeout(900);
      const s = await caseState(page);
      expect(!s.open && !s.locked && s.focused === "dermatology" && !s.inert[1], `${why}: the panel did not settle closed`, s);
    };
    const btn = page.locator("[data-case=dermatology]");
    await btn.click(); await page.waitForTimeout(120);
    await page.keyboard.press("Escape"); await page.keyboard.press("Escape");
    await settled("double Escape");
    await btn.click(); await page.waitForTimeout(120);
    await page.keyboard.press("Escape");
    await page.evaluate(() => document.getAnimations().forEach((a) => a.cancel()));
    await settled("cancelled close animation");
    await btn.click(); await page.waitForTimeout(60);
    await page.keyboard.press("Escape");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await settled("reduced motion turned on mid-close");
    await btn.click();
    expect((await caseState(page)).open, "the panel did not reopen after the interrupted closes");
    await page.keyboard.press("Escape");
    expect(!(await caseState(page)).open, "with reduced motion now on, Escape should close at once");
    expect(!errors.length, "page errors", errors);
  } finally { await context.close(); }
});


// ---- SITE-09: chooser case links land on their exact card ----
// Each outcome: the area and need to pick, and the card its link names
const CHOOSER = [["biz", "retype", "dermatology"], ["biz", "connect", "dermatology"], ["cloud", "find", "accounting"],
  ["cloud", "servers", "migration"], ["space", "wifi", "home"], ["space", "cameras", "home"], ["safe", "phish", "security"], ["safe", "audit", "security"]];

// Resolves once the card is in view vertically, inside the row sideways, focused, and named in the URL
const landed = (page, id) => page.waitForFunction((id) => {
  const card = document.getElementById("case-" + id), rail = document.getElementById("cases");
  const c = card.getBoundingClientRect(), r = rail.getBoundingClientRect();
  return c.top >= 0 && c.top < innerHeight && c.left >= r.left - 2 && c.right <= r.right + 2 &&
    document.activeElement === card.querySelector("[data-case]") && location.hash === "#case-" + id && card.classList.contains("is-target");
}, id, { timeout: 5000 }).then(() => true, () => false);

for (const [label, options, picks] of [
  ["reduced motion, wide", { reducedMotion: "reduce" }, CHOOSER],
  ["reduced motion, phone", { reducedMotion: "reduce", viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }, CHOOSER.filter((c, i) => i % 2 === 0)],
  ["motion, wide", { reducedMotion: "no-preference" }, CHOOSER.filter((c, i) => i % 2 === 1)],
  ["motion, phone", { reducedMotion: "no-preference", viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }, CHOOSER.filter((c, i) => i % 2 === 0)],
]) {
  check("browser", `chooser: every outcome lands on its card (${label})`, async () => {
    const { page, context, errors } = await open(options);
    try {
      for (const [area, need, id] of picks) {
        await page.goto(origin + "/#services", { waitUntil: "domcontentloaded" });
        await page.waitForTimeout(300);
        const chooser = page.locator(".choose");
        if (!(await chooser.evaluate((d) => d.open))) await page.locator(".choose summary").click();
        await page.locator(`label:has(#fit-${area})`).click();
        await page.locator(`label:has(#fit-${need})`).click();
        await page.locator(`.choose-result[data-need=${need}] a[href="#case-${id}"]`).click();
        expect(await landed(page, id), `${area}/${need} did not land on case-${id}`, await page.evaluate(() => [location.hash, document.activeElement.outerHTML.slice(0, 80)]));
      }
      expect(!errors.length, "page errors", errors);
    } finally { await context.close(); }
  });
}

for (const motion of ["reduce", "no-preference"]) {
  check("browser", `chooser: opening /#case-home, then Back and Forward (${motion === "reduce" ? "reduced motion" : "motion"})`, async () => {
    const { page, context, errors } = await open({ reducedMotion: motion }, "/#case-home");
    try {
      expect(await landed(page, "home"), "opening /#case-home did not land on the card");
      // From the chooser: Back returns to the chooser's spot, Forward to the card again
      await page.goto(origin + "/#services", { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(400);
      await page.locator(".choose summary").click();
      await page.locator("label:has(#fit-cloud)").click();
      await page.locator("label:has(#fit-servers)").click();
      const link = page.locator('.choose-result[data-need=servers] a[href="#case-migration"]');
      const at = await link.evaluate((a) => a.getBoundingClientRect().top + scrollY);
      await link.click();
      expect(await landed(page, "migration"), "the link did not land on case-migration");
      await page.goBack();
      const back = await page.waitForFunction((at) => location.hash !== "#case-migration" && Math.abs(scrollY + innerHeight / 2 - at) < innerHeight / 2, at, { timeout: 5000 }).then(() => true, () => false);
      expect(back, "Back did not return to the chooser", await page.evaluate(() => [location.hash, scrollY]));
      await page.goForward();
      expect(await landed(page, "migration"), "Forward did not return to case-migration");
      expect(!errors.length, "page errors", errors);
    } finally { await context.close(); }
  });
}


// ---- Run ----
(async () => {
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch();
  let failed = 0;
  for (const { tag, name, fn } of checks) {
    if (ONLY && !ONLY.test(name)) continue;
    const t0 = Date.now();
    try { await fn(); console.log(`ok   [${tag}] ${name} (${Date.now() - t0} ms)`); }
    catch (e) { failed++; console.log(`FAIL [${tag}] ${name}: ${e.message}`); }
  }
  // Whole-run guarantees: nothing left loopback, and the policy blocked nothing the page needs
  if (leaks.length) { failed++; console.log(`FAIL [browser] requests left the loopback origin: ${[...new Set(leaks)].join(", ")}`); }
  if (violations.length) { failed++; console.log(`FAIL [browser] content security policy violations: ${[...new Set(violations)].join(" | ")}`); }
  await browser.close();
  server.close();
  console.log(failed ? `behavior: ${failed} failed` : "behavior: all checks passed");
  process.exit(failed ? 1 : 0);
})();
