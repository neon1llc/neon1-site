#!/usr/bin/env node
// scripts/behavior.cjs - Browser checks for the home page's interactive contracts: the contact form sends
// only what it should, a case study owns the screen while open, case links land on their exact card, and the
// white rabbit can be entered, understood, and left from the keyboard without leaving work behind.
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
// SHARD="k/n" runs every nth check starting at k (0-based), so CI can split the run across jobs; each shard
// still holds the whole-run guarantees below for the checks it ran
const SHARD = /^(\d+)\/(\d+)$/.exec(process.env.SHARD || "");

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
  // A folder URL answers with its index.html, as the CDN does
  const file = path.join(SITE, pathname === "/" ? "index.html" : pathname.endsWith("/") ? pathname + "index.html" : pathname);
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
// The white rabbit lives in Matrix, which a visitor picks on purpose (Sentinel is the default and has no rain), so its checks choose it first
const MATRIX_STYLE = () => { try { localStorage.setItem("neon1.style", "matrix"); } catch {} };
// Init scripts are serialized into the page, so this one repeats the style line instead of calling MATRIX_STYLE
const COUNT_FRAMES = () => {
  try { localStorage.setItem("neon1.style", "matrix"); } catch {}
  const raf = window.requestAnimationFrame.bind(window), caf = window.cancelAnimationFrame.bind(window);
  const pending = (window.__frames = new Map());
  window.requestAnimationFrame = (cb) => { const id = raf((t) => { pending.delete(id); cb(t); }); pending.set(id, cb.name); return id; };
  window.cancelAnimationFrame = (id) => { pending.delete(id); caf(id); };
};
const sceneFrames = (page) => page.evaluate(() => [...window.__frames.values()].filter((n) => n === "frame").length);


// ---- SITE-01: the contact form ----
// Synthetic text only; the API is answered by the test, so nothing leaves the loopback origin
const MARK = "SYNTHETIC-CONTACT-7f3a";
const fillForm = async (page, email = "dana@example.com") => {
  if (!(await page.locator("#cfold").evaluate((d) => d.open))) await page.locator("#cfold > summary").click();
  await page.locator('label.pick:has(input[value="workflows"])').click();
  await page.locator('label.pick:has(input[value="security"])').click();
  await page.locator("[name=other]").fill("Printer setup");
  await page.locator("[name=today]").type(MARK);
  await page.locator("[name=name]").fill("Dana Kim");
  await page.locator("[name=email]").fill(email);
};

check("browser", "contact: without script, the form stays hidden and the email link remains", async () => {
  const { page, context } = await open({ javaScriptEnabled: false });
  try {
    expect(!(await page.locator("#cform").isVisible()), "the form shows without its script");
    expect(await page.locator('#contact a[href="mailto:hello@neon1.tech"]').count(), "the email link is missing");
  } finally { await context.close(); }
});

check("browser", "contact: the fold opens with its arrow turned down, and a send posts every pick and the visitor's words", async () => {
  const { page, context, errors } = await open();
  try {
    let sent = null;
    await page.route("**/1NEON/api/contact", async (r) => { sent = { body: r.request().postDataJSON(), header: r.request().headers()["x-1neon"] }; await r.fulfill({ status: 200, contentType: "application/json", body: '{"ok":true}' }); });
    await page.locator("#contact").scrollIntoViewIfNeeded();
    expect(!(await page.locator("#cform").isVisible()), "the form shows before the fold is opened");
    await fillForm(page);
    const turned = await page.locator("#cfold > summary").evaluate((s) => getComputedStyle(s, "::after").transform);
    expect(turned !== "none", "the arrow did not turn when the fold opened", turned);
    await page.locator('#cform [type="submit"]').click();
    await page.waitForSelector("#cdone:not([hidden])");
    const b = sent && sent.body;
    expect(sent && sent.header === "1" && b.topics.join() === "workflows,security" && b.other === "Printer setup" && b.today.includes(MARK) && !b.website, "unexpected request", sent);
    expect((await page.locator("#cdoneTo").textContent()) === "dana@example.com", "the confirmation names the wrong address");
    expect(!page.url().includes(MARK), "the message reached the URL");
    const stored = await page.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }));
    expect(!stored.includes(MARK), "the message reached browser storage");
    expect(!errors.length, "page errors", errors);
  } finally { await context.close(); }
});

check("browser", "contact: missing fields are named and nothing is sent; a refusal says what to do", async () => {
  const { page, context } = await open();
  try {
    let calls = 0;
    await page.route("**/1NEON/api/contact", (r) => { calls++; return r.fulfill({ status: 429, contentType: "application/json", body: '{"error":"too_many","message":"That\'s a lot of messages in an hour."}' }); });
    await page.locator("#contact").scrollIntoViewIfNeeded();
    await page.locator("#cfold > summary").click();
    await page.locator('#cform [type="submit"]').click();
    expect(calls === 0, "an incomplete form was sent");
    expect(/Say what's going on/.test(await page.locator("#cstatus").textContent()), "the problems were not named");
    await fillForm(page);
    await page.locator('#cform [type="submit"]').click();
    await page.waitForFunction(() => /hello@neon1.tech/.test(document.getElementById("cstatus").textContent));
    expect(calls === 1 && !(await page.locator("#cform").evaluate((f) => f.hidden)), "the form did not stay for another try");
  } finally { await context.close(); }
});


// PS-02: a send that never answers ends in an uncertain-outcome message within the deadline, keeps the
// draft, sends once, and leaves retrying to the visitor. The page clock is faked, so no real wait
check("browser", "contact: a send that never answers stops waiting, keeps the draft, and sends only once", async () => {
  const { page, context, errors } = await open();
  try {
    await page.clock.install();
    let calls = 0;
    await page.route("**/1NEON/api/contact", () => { calls++; }); // never fulfilled
    await page.locator("#contact").scrollIntoViewIfNeeded();
    await fillForm(page);
    await page.locator('#cform [type="submit"]').click();
    await page.locator("[name=email]").press("Enter"); // a second submit while the first is pending
    expect(await page.locator('#cform [type="submit"]').isDisabled(), "the send button stays enabled while pending");
    await page.clock.runFor(14000);
    expect(/Sending/.test(await page.locator("#cstatus").textContent()), "gave up before the deadline");
    await page.clock.runFor(2000);
    await page.waitForFunction(() => /couldn't confirm/.test(document.getElementById("cstatus").textContent));
    const after = await page.evaluate(() => ({ today: document.querySelector("[name=today]").value, email: document.querySelector("[name=email]").value,
      disabled: document.querySelector('#cform [type="submit"]').disabled, hidden: document.getElementById("cform").hidden }));
    expect(after.today.includes(MARK) && after.email === "dana@example.com" && !after.disabled && !after.hidden, "the draft or the form was not kept", after);
    expect(/hello@neon1.tech/.test(await page.locator("#cstatus").textContent()), "the message does not name the email address");
    expect(calls === 1, "the message was sent more than once", calls);
    expect(!errors.length, "page errors", errors);
  } finally { await context.close(); }
});

// ---- The first screen is the wordmark and tagline; the bar's contact link settles on contact, and the views still snap ----
check("browser", "home: the first screen has no offer block, and the bar's contact link settles on contact (motion, wide)", async () => {
  const { page, context, errors } = await open({ reducedMotion: "no-preference" });
  try {
    await page.waitForLoadState("load");
    expect(!(await page.locator(".hero .offer, .hero .start").count()), "the offer block is back on the first screen");
    await page.locator('.links a[data-view="contact"]').click();
    await page.waitForFunction(() => Math.abs(document.getElementById("contact").getBoundingClientRect().top - 64) < 3, null, { timeout: 5000 });
    // The address says where the visitor is, so the view can be shared; only the logo goes home to "/"
    expect((await page.evaluate(() => location.pathname + location.hash)) === "/#contact", "the bar's contact link leaves #contact in the address");
    await page.locator('.n1-logo').click();
    await page.waitForTimeout(600);
    expect((await page.evaluate(() => location.pathname + location.hash)) === "/", "the logo returns the address to /");
    expect(!errors.length, "page errors", errors);
  } finally { await context.close(); }
});

// The Sentinel landing is the default and says what neon1 is, what it does, for whom, and the next step; Matrix, chosen on purpose,
// keeps the wordmark and slogan on the rain and shows none of the pitch
check("browser", "home: Sentinel's first screen states the offer and the next step, with no account and no rain; Matrix shows only the wordmark and slogan", async () => {
  const sentinel = await open({ reducedMotion: "reduce" });
  try {
    await sentinel.page.waitForLoadState("load");
    const p = sentinel.page;
    expect((await p.evaluate(() => document.documentElement.dataset.siteStyle)) === "sentinel", "a fresh visitor does not get Sentinel");
    const text = await p.locator(".pitch").innerText();
    expect(/independent engineering and technology consulting/i.test(text), "the first screen doesn't say what neon1 is", text);
    expect((await p.locator(".pitch-services a").count()) === 4, "the first screen doesn't name the four services");
    expect((await p.locator('.pitch a[href^="mailto:hello@"]').count()) === 1, "the first screen has no email link");
    expect(/no account needed/i.test(text), "the first screen doesn't say no account is needed");
    expect(/1 is glad to be of service/.test(await p.locator(".hero").innerText()), "the slogan is gone");
    expect(!(await p.locator("#rain").isVisible()), "Sentinel's first screen shows the rain");
    expect(!sentinel.errors.length, "page errors", sentinel.errors);
  } finally { await sentinel.context.close(); }
  const matrix = await open({ reducedMotion: "reduce", init: MATRIX_STYLE });
  try {
    await matrix.page.waitForLoadState("load");
    const p = matrix.page;
    expect((await p.evaluate(() => document.documentElement.dataset.siteStyle)) === "matrix", "a chosen Matrix did not stay");
    expect(!(await p.locator(".pitch").isVisible()), "Matrix's first screen shows the pitch");
    expect(await p.locator("#rain").isVisible(), "Matrix's first screen has no rain");
    expect(/1 is glad to be of service/.test(await p.locator(".hero").innerText()), "Matrix lost the slogan");
    expect(!matrix.errors.length, "page errors", matrix.errors);
  } finally { await matrix.context.close(); }
});

check("browser", "home: one wheel gesture from the first screen settles on services (motion, wide)", async () => {
  const { page, context } = await open({ reducedMotion: "no-preference" });
  try {
    await page.waitForLoadState("load");
    await page.mouse.move(640, 450);
    for (let i = 0; i < 10; i++) { await page.mouse.wheel(0, 30); await page.waitForTimeout(20); }
    await page.waitForFunction(() => Math.abs(document.getElementById("services").getBoundingClientRect().top - 64) < 3, null, { timeout: 5000 });
  } finally { await context.close(); }
});

// ---- CP-16: the code section lists neon1's repositories and the tools in folds; every row says whether it is
// public or private and names its license, public rows open GitHub in a new tab, and private rows link nowhere ----
check("browser", "code and resources: three folds open with their arrows turned, every row names a license, public rows (education ones included) open GitHub in a new tab, private rows link nowhere, any other row opens the Knowledge Center", async () => {
  const { page, context, errors } = await open();
  try {
    await page.locator("#work").scrollIntoViewIfNeeded();
    const folds = page.locator("#work details.fold");
    expect((await folds.count()) === 3, "there aren't three groups");
    for (let i = 0; i < 3; i++) {
      await folds.nth(i).locator("summary").click();
      expect(await folds.nth(i).evaluate((d) => d.open && getComputedStyle(d.querySelector(":scope > summary"), "::after").transform !== "none"), "a group did not open with its arrow turned");
    }
    const rows = await page.$$eval("#work .repo", (rs) => rs.map((r) => ({ state: r.querySelector(".state").textContent, links: [...r.querySelectorAll("a")].map((a) => [a.href, a.target, a.rel]) })));
    expect(rows.length >= 8, "rows are missing", rows);
    for (const r of rows) {
      // A license placeholder (TBD) or a missing one fails here, so no row ships without its real license
      expect(/ · (MIT|Apache-2\.0|CC BY-SA 4\.0|CC BY-ND 4\.0|FSL-1\.1)/.test(r.state) && !/TBD/.test(r.state), "a row doesn't name its license", r);
      // The section says all of it is public, so a row opens its repository on GitHub in a new tab (a row that links elsewhere is a teaching row and opens the Knowledge Center in place)
      if (r.links.length === 1 && /^https:\/\/github\.com\/neon1llc\//.test(r.links[0][0])) expect(r.links[0][1] === "_blank" && /noopener/.test(r.links[0][2]), "a row doesn't open GitHub in a new tab", r);
      else expect(r.links.length === 1 && new URL(r.links[0][0]).pathname.startsWith("/knowledge/") && !r.links[0][1], "a teaching row doesn't open the Knowledge Center in place", r);
    }
    expect(!errors.length, "page errors", errors);
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

// A link inside a service card goes where it points with the card closed, to this page's contact or to another page, and
// Back from that page doesn't find the card still open
for (const [label, options] of [["wide", {}], ["phone", { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }]]) {
  check("browser", `case: a link inside a service card closes the card on the way (${label})`, async () => {
    const { page, context, errors } = await open({ reducedMotion: "no-preference", ...options }, "/#services");
    try {
      await page.waitForTimeout(1500);
      await page.locator("[data-case=service-workflow]").click();
      await page.waitForTimeout(700);
      expect((await caseState(page)).open, "the service card did not open");
      await page.locator('.case-panel a[href="/#contact"]').click();
      await page.waitForTimeout(2200);
      const s = await caseState(page), inContact = await page.evaluate(() => { const c = document.getElementById("contact").getBoundingClientRect(); return c.top < innerHeight && c.bottom > 0; });
      expect(!s.open && !s.locked && inContact, "the card stayed over the page, or the page didn't reach contact", { s, inContact });
      await page.locator("[data-case=service-workflow]").evaluate((b) => b.scrollIntoView({ block: "center", behavior: "instant" }));
      await page.waitForTimeout(800);
      await page.locator("[data-case=service-workflow]").click();
      await page.waitForTimeout(700);
      await page.locator('.case-panel a[href^="/knowledge/"]').first().click();
      await page.waitForURL(/\/knowledge\//);
      await page.waitForTimeout(800);
      await page.goBack();
      await page.waitForTimeout(2000);
      const back = await caseState(page);
      expect(!back.open && !back.locked, "Back found the card still open", back);
      expect(!realErrors(errors).length, "page errors", errors);
    } finally { await context.close(); }
  });
}

check("browser", "case: on a phone, the menu can't open over an open case study", async () => {
  const { page, context } = await open({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  try {
    await page.locator("[data-case=migration]").click();
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

// Making the page behind the menu inert restyles all of it; done in the frame the menu starts to move, that was a visible stutter
// on phones. So the page behind turns inert only once the menu has finished moving, and the menu itself has no backdrop blur
for (const [style, mode] of [["sentinel", "light"], ["sentinel", "dark"], ["matrix", "light"], ["matrix", "dark"]]) {
  check("browser", `menu: on a phone the page behind turns inert after the menu moves, not as it starts (${style}, ${mode})`, async () => {
    const look = ([s, m]) => { try { localStorage.setItem("neon1.style", s); localStorage.setItem("neon1.mode", m); } catch {} };
    const { page, context, errors } = await open({ reducedMotion: "no-preference", ...PHONE });
    try {
      await page.evaluate(look, [style, mode]); await page.reload({ waitUntil: "load" }); await page.waitForTimeout(1200);
      const state = () => page.evaluate(() => ({ shown: !document.getElementById("menu").hidden, inert: !!document.querySelector(".top")?.inert, blur: getComputedStyle(document.getElementById("menu")).backdropFilter }));
      const atOpen = await page.evaluate(() => { document.getElementById("menuBtn").click(); return { shown: !document.getElementById("menu").hidden, inert: !!document.querySelector(".top")?.inert }; });
      expect(atOpen.shown && !atOpen.inert, "the page behind turned inert in the frame the menu opened", atOpen);
      await page.waitForTimeout(600);
      const opened = await state();
      expect(opened.shown && opened.inert, "the page behind is not inert once the menu is open", opened);
      expect(!opened.blur || opened.blur === "none", "the menu blurs the page behind it, which costs every frame it moves", opened);
      const atClose = await page.evaluate(() => { document.getElementById("menuBtn").click(); return { inert: !!document.querySelector(".top")?.inert }; });
      expect(atClose.inert, "the page behind left inert in the frame the menu started to close", atClose);
      await page.waitForTimeout(600);
      const closed = await state();
      expect(!closed.shown && !closed.inert, "the menu did not settle closed", closed);
      expect(!errors.length, "page errors", errors);
    } finally { await context.close(); }
  });
}

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


// ---- SITE-09: case links land on their exact card ----
// A link to a single card, from anywhere on the page, must land on that card. The test puts the links in
// the contact view, the farthest view from the cards

// Resolves once the card is in view vertically, inside the row sideways, focused, and named in the URL
const landed = (page, id) => page.waitForFunction((id) => {
  const card = document.getElementById("case-" + id), rail = document.getElementById("cases");
  const c = card.getBoundingClientRect(), r = rail.getBoundingClientRect();
  return c.top >= 0 && c.top < innerHeight && c.left >= r.left - 2 && c.right <= r.right + 2 &&
    document.activeElement === card.querySelector("[data-case]") && location.hash === "#case-" + id && card.classList.contains("is-target");
}, id, { timeout: 5000 }).then(() => true, () => false);

// The cards a link is tried on, and a link to one placed in the contact view
const CARDS = ["dermatology", "accounting", "migration", "security"];
const caseLink = (page, id) => page.evaluate((id) => {
  const a = Object.assign(document.createElement("a"), { href: "#case-" + id, textContent: "case " + id, className: "test-case-link" });
  // In the middle of the view, clear of the fixed bar, so clicking it needs no scroll
  document.querySelector("#contact .fit div:last-child dd").append(" ", a);
}, id);
for (const [label, options] of [
  ["reduced motion, wide", { reducedMotion: "reduce" }],
  ["motion, phone", { reducedMotion: "no-preference", viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }],
]) {
  check("browser", `case links: a link from the contact view lands on its card (${label})`, async () => {
    const { page, context, errors } = await open(options);
    try {
      for (const id of CARDS) {
        await page.goto(origin + "/#contact", { waitUntil: "domcontentloaded" });
        await page.waitForTimeout(400);
        await caseLink(page, id);
        await page.locator(`a.test-case-link[href="#case-${id}"]`).click();
        expect(await landed(page, id), `the link did not land on case-${id}`, await page.evaluate(() => [location.hash, document.activeElement.outerHTML.slice(0, 80)]));
      }
      expect(!errors.length, "page errors", errors);
    } finally { await context.close(); }
  });
}

for (const motion of ["reduce", "no-preference"]) {
  check("browser", `case links: opening /#case-migration, then Back and Forward (${motion === "reduce" ? "reduced motion" : "motion"})`, async () => {
    const { page, context, errors } = await open({ reducedMotion: motion }, "/#case-migration");
    try {
      expect(await landed(page, "migration"), "opening /#case-migration did not land on the card");
      await page.goto(origin + "/#contact", { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(400);
      // The visitor goes to contact from the bar, so the page rests at the top of that view
      await page.locator('.links a[data-view="contact"]').click();
      // At rest means the same place twice, a moment apart, near the top of the screen
      await page.waitForFunction(() => new Promise((ok) => { const a = document.getElementById("contact").getBoundingClientRect().top; setTimeout(() => { const b = document.getElementById("contact").getBoundingClientRect().top; ok(a === b && b >= -2 && b <= 160); }, 250); }), null, { timeout: 5000, polling: 300 });
      await caseLink(page, "migration");
      const link = page.locator('a.test-case-link[href="#case-migration"]');
      const at = await link.evaluate((a) => a.getBoundingClientRect().top + scrollY);
      await link.click();
      expect(await landed(page, "migration"), "the link did not land on case-migration");
      await page.goBack();
      const back = await page.waitForFunction((at) => location.hash !== "#case-migration" && Math.abs(scrollY + innerHeight / 2 - at) < innerHeight / 2, at, { timeout: 5000 }).then(() => true, () => false);
      expect(back, "Back did not return to the form", { at, now: await page.evaluate(() => [location.hash, scrollY, innerHeight]) });
      await page.goForward();
      expect(await landed(page, "migration"), "Forward did not return to case-migration");
      expect(!errors.length, "page errors", errors);
    } finally { await context.close(); }
  });
}


// ---- Back, Forward, and reload return to the exact spot ----
// Every page remembers where each history entry was left (js/views.js on the home page, js/scroll-memory.js elsewhere). These
// walk the paths that lost a spot before: a section reached from the menu, a page opened at a #fragment (the browser's smooth jump
// to it beat the restored scroll), a phone whose toolbar shifts the layout as the next page starts, and reduced motion
// Chromium reports a cross-document page transition that a quick Back cuts short as an uncaught error; it is the browser's, not the page's
const realErrors = (errors) => errors.filter((e) => !/ViewTransition/.test(e));
const spot = (page) => page.evaluate(() => ({ url: location.pathname + location.hash, y: Math.round(scrollY) }));
const sameSpot = (a, b) => a.url === b.url && Math.abs(a.y - b.y) <= 3;
const jump = async (page, y) => { await page.evaluate((y) => scrollTo({ top: y, behavior: "instant" }), y); await page.waitForTimeout(900); };
// Leave through the bar's logo (a link to "/"), wait for the home page to show, then come Back
const leaveAndBack = async (page) => {
  await page.evaluate(() => document.querySelector('.n1-bar a[href="/"], header a[href="/"]').click());
  await page.waitForLoadState("load");
  await page.waitForTimeout(2200);
  await page.goBack();
  await page.waitForTimeout(2500);
};
const HAS_KC = fs.existsSync(path.join(SITE, "knowledge", "index.html"));
const PHONE = { viewport: { width: 390, height: 780 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 };
for (const [label, options] of [
  ["motion, wide", { reducedMotion: "no-preference" }],
  ["motion, phone", { reducedMotion: "no-preference", ...PHONE }],
  ["reduced motion, wide", { reducedMotion: "reduce" }],
  ["reduced motion, phone", { reducedMotion: "reduce", ...PHONE }],
]) {
  const phone = !!options.isMobile;
  check("browser", `back: contact from the menu, scrolled, a link out, then Back returns to the same spot (${label})`, async () => {
    const { page, context, errors } = await open(options);
    try {
      await page.waitForTimeout(1200);
      if (phone) { await page.locator("#menuBtn").click(); await page.waitForTimeout(500); await page.locator('.menu a[href="#contact"], .menu a[href="/#contact"]').first().click(); }
      else await page.locator('.links a[data-view="contact"]').click();
      await page.waitForTimeout(2000);
      await page.evaluate(() => scrollBy(0, 130));
      await page.waitForTimeout(1200);
      const link = page.locator('a[href^="/knowledge/engagement/services/"]').first();
      await link.evaluate((a) => a.scrollIntoView({ block: "center", behavior: "instant" }));
      await page.waitForTimeout(1200);
      const box = await link.boundingBox(), before = await spot(page);
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForURL(/\/knowledge\//);
      await page.waitForLoadState("load");
      await page.waitForTimeout(1000);
      await page.goBack();
      await page.waitForTimeout(3000);
      const after = await spot(page);
      expect(sameSpot(before, after), "Back did not return to the spot the page was left at", { before, after });
      expect(!realErrors(errors).length, "page errors", errors);
    } finally { await context.close(); }
  });
}

// A browser that resets or restores the scroll after the page is shown (iOS WebKit from its cache, a toolbar settling) must not leave the
// home page on the first section while the address names another (some fire popstate on load, which must not stop the correction): the remembered view, else the linked #section, wins
for (const [label, options] of [["wide", {}], ["phone", PHONE]]) {
  check("browser", `back: Back puts the page on the spot saved when its link was pressed, whatever the browser did meanwhile (${label})`, async () => {
    // As iOS can: the entry's own state is corrupted as the page is left, then the scroll is reset after the page shows, with a stray popstate
    const reset = () => {
      addEventListener("pagehide", () => { try { history.replaceState({ pos: { v: "services", i: 0, dy: 0 } }, ""); } catch {} });
      addEventListener("pageshow", () => { if ((performance.getEntriesByType("navigation")[0] || {}).type === "back_forward") { setTimeout(() => dispatchEvent(new PopStateEvent("popstate", { state: null })), 50); for (const t of [400, 900]) setTimeout(() => scrollTo(0, 800), t); } });
    };
    const { page, context, errors } = await open({ reducedMotion: "no-preference", ...options, init: reset });
    try {
      await page.waitForTimeout(1200);
      if (options.isMobile) { await page.locator("#menuBtn").click(); await page.waitForTimeout(500); await page.locator('.menu a[href="#contact"], .menu a[href="/#contact"]').first().click(); }
      else await page.locator('.links a[data-view="contact"]').click();
      await page.waitForTimeout(2000);
      await page.evaluate(() => scrollBy(0, 130));
      await page.waitForTimeout(1200);
      const link = page.locator('a[href^="/knowledge/engagement/services/"]').first();
      await link.evaluate((a) => a.scrollIntoView({ block: "center", behavior: "instant" }));
      await page.waitForTimeout(1200);
      const box = await link.boundingBox(), before = await spot(page);
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForURL(/\/knowledge\//);
      await page.waitForTimeout(800);
      await page.goBack();
      await page.waitForTimeout(3500);
      const after = await page.evaluate(() => { const c = document.getElementById("contact").getBoundingClientRect(); return { url: location.hash, inContact: c.top < innerHeight && c.bottom > 0, y: Math.round(scrollY) }; });
      expect(after.inContact, "the page rests away from the contact view", { before, after });
      expect(!realErrors(errors).length, "page errors", errors);
    } finally { await context.close(); }
  });
}

for (const [label, options] of [["wide", {}], ["phone", PHONE]]) {
  if (!HAS_KC) break;
  check("browser", `back: a Knowledge Center page opened at a #fragment, scrolled, left, then Back returns to the scroll (${label})`, async () => {
    const { page, context, errors } = await open({ reducedMotion: "no-preference", ...options }, "/knowledge/engagement/services/#which-one-sounds-like-you");
    try {
      await page.waitForTimeout(1800);
      await jump(page, 1100);
      const before = await spot(page);
      await leaveAndBack(page);
      const after = await spot(page);
      expect(sameSpot(before, after), "Back went to the #fragment instead of where the page was left", { before, after });
      await page.reload({ waitUntil: "load" });
      await page.waitForTimeout(2500);
      expect(sameSpot(before, await spot(page)), "reload did not keep the spot", { before, now: await spot(page) });
      expect(!realErrors(errors).length, "page errors", errors);
    } finally { await context.close(); }
  });

  check("browser", `back: On this page's jump is its own entry; Back and Forward move between the two spots (${label})`, async () => {
    const { page, context, errors } = await open({ reducedMotion: "no-preference", ...options }, "/knowledge/engagement/services/");
    try {
      await page.waitForTimeout(1800);
      await jump(page, 700);
      const first = await spot(page);
      const sel = options.isMobile ? ".kc-toc-fold a[href^='#']" : ".kc-toc-side a[href^='#']";
      if (options.isMobile) { await page.evaluate(() => { document.querySelector(".kc-toc-fold").open = true; }); await page.waitForTimeout(300); }
      await page.evaluate((sel) => document.querySelectorAll(sel)[2].click(), sel);
      await page.waitForTimeout(1800);
      if (options.isMobile) await page.evaluate(() => { document.querySelector(".kc-toc-fold").open = false; });
      await jump(page, (await spot(page)).y + 260);
      const second = await spot(page);
      expect(second.url !== first.url, "the jump did not start a history entry", { first, second });
      await leaveAndBack(page);
      expect(sameSpot(second, await spot(page)), "Back from the next page did not return to the jump's spot", { second, now: await spot(page) });
      await page.goBack();
      await page.waitForTimeout(2000);
      expect(sameSpot(first, await spot(page)), "Back within the page did not return to the spot before the jump", { first, now: await spot(page) });
      await page.goForward();
      await page.waitForTimeout(2000);
      expect(sameSpot(second, await spot(page)), "Forward did not return to the jump's spot", { second, now: await spot(page) });
      expect(!realErrors(errors).length, "page errors", errors);
    } finally { await context.close(); }
  });

  check("browser", `back: a blog post and the Knowledge Center index return to their scroll (${label})`, async () => {
    const { page, context, errors } = await open({ reducedMotion: "no-preference", ...options }, "/blog/why-neon1/");
    try {
      for (const [url, y] of [["/blog/why-neon1/", 900], ["/knowledge/", 1500]]) {
        await page.goto(origin + url, { waitUntil: "load" });
        await page.waitForTimeout(1800);
        await jump(page, y);
        const before = await spot(page);
        await leaveAndBack(page);
        expect(sameSpot(before, await spot(page)), `Back did not return to the scroll on ${url}`, { before, now: await spot(page) });
      }
      expect(!realErrors(errors).length, "page errors", errors);
    } finally { await context.close(); }
  });

  // Each entry keeps its own spot, so a walk several steps deep comes back right at every step, both ways, even when one
  // page is in the history twice at different spots. A new link opens at its top, and a new tab starts with nothing remembered
  check("browser", `back: a five-page walk with the same page twice, Back to the start and Forward to the end, each at its spot (${label})`, async () => {
    const { page, context, errors } = await open({ reducedMotion: "no-preference", ...options }, "/knowledge/");
    try {
      const walk = [["/knowledge/", 1200], ["/blog/why-neon1/", 700], ["/knowledge/", 400], ["/knowledge/engagement/services/", 1500], ["/blog/why-neon1/", 300]];
      const spots = [];
      for (const [at, [url, y]] of walk.entries()) {
        if (at) {
          // Followed as a reader would, through a link on the page, so the click saves the spot first
          await page.evaluate((url) => { const a = Object.assign(document.createElement("a"), { href: url }); document.body.append(a); a.click(); }, url);
          await page.waitForURL((u) => u.pathname === url);
          await page.waitForLoadState("load");
          await page.waitForTimeout(1500);
          const top = await spot(page);
          expect(top.y === 0, `a new link to ${url} did not open at its top`, top);
        } else await page.waitForTimeout(1800);
        await jump(page, y);
        spots.push(await spot(page));
      }
      for (let i = spots.length - 2; i >= 0; i--) {
        await page.goBack();
        await page.waitForTimeout(2200);
        expect(sameSpot(spots[i], await spot(page)), `Back to step ${i + 1} missed its spot`, { want: spots[i], now: await spot(page) });
      }
      for (let i = 1; i < spots.length; i++) {
        await page.goForward();
        await page.waitForTimeout(2200);
        expect(sameSpot(spots[i], await spot(page)), `Forward to step ${i + 1} missed its spot`, { want: spots[i], now: await spot(page) });
      }
      await page.reload({ waitUntil: "load" });
      await page.waitForTimeout(2200);
      expect(sameSpot(spots[spots.length - 1], await spot(page)), "reload at the end of the walk missed its spot", { want: spots[spots.length - 1], now: await spot(page) });
      // A new tab shares nothing with this one
      const tab = await context.newPage();
      await tab.goto(origin + "/blog/why-neon1/", { waitUntil: "load" });
      await tab.waitForTimeout(1800);
      expect((await spot(tab)).y === 0, "a new tab opened at a remembered spot", await spot(tab));
      await tab.close();
      expect(!realErrors(errors).length, "page errors", errors);
    } finally { await context.close(); }
  });
}

// The home page's views keep their own spot per entry too: two visits to the home page in one walk return to their own views
for (const [label, options] of [["wide", {}], ["phone", PHONE]]) {
  if (!HAS_KC) break;
  check("browser", `back: the home page twice in one walk, Back returns each visit to its own view (${label})`, async () => {
    const { page, context, errors } = await open({ reducedMotion: "no-preference", ...options });
    try {
      const view = () => page.evaluate(() => { const v = [...document.querySelectorAll(".view")].find((e) => { const r = e.getBoundingClientRect(); return r.top <= innerHeight / 2 && r.bottom > innerHeight / 2; }); return { id: v && v.id, y: Math.round(scrollY) }; });
      const goView = async (id) => { await page.evaluate((id) => document.getElementById(id).scrollIntoView({ behavior: "instant" }), id); await page.mouse.wheel(0, 1); await page.waitForTimeout(1500); };
      const follow = async (url) => { await page.evaluate((url) => { const a = Object.assign(document.createElement("a"), { href: url }); document.body.append(a); a.click(); }, url); await page.waitForURL((u) => u.pathname + u.hash === url || u.pathname === url); await page.waitForLoadState("load"); await page.waitForTimeout(1800); };
      await page.waitForTimeout(1500);
      await goView("process");
      const first = await view();
      await follow("/knowledge/");
      await jump(page, 900);
      const kc = await spot(page);
      await follow("/");
      await goView("faq");
      const second = await view();
      await follow("/blog/why-neon1/");
      await page.goBack(); await page.waitForTimeout(2800);
      expect((await view()).id === second.id, "Back to the second home visit missed its view", { second, now: await view() });
      await page.goBack(); await page.waitForTimeout(2200);
      expect(sameSpot(kc, await spot(page)), "Back to the Knowledge Center missed its spot", { kc, now: await spot(page) });
      await page.goBack(); await page.waitForTimeout(2800);
      expect((await view()).id === first.id, "Back to the first home visit missed its view", { first, now: await view() });
      expect(!realErrors(errors).length, "page errors", errors);
    } finally { await context.close(); }
  });
}


// ---- SITE-06 and SITE-07: the white rabbit ----
const rabbit = (page) => page.evaluate(() => {
  const root = document.getElementById("whiteRabbit"), a = document.activeElement;
  const how = root.querySelector(".white-rabbit-how");
  // Anything on screen that could be pressed or read as a control: there should never be one over the scene or the card
  const shown = (el) => { const r = el.getBoundingClientRect(), c = getComputedStyle(el); return r.width > 1 && r.height > 1 && c.visibility === "visible" && c.display !== "none"; };
  return {
    state: root.dataset.state, mode: root.dataset.mode, progress: root.dataset.progress,
    canvases: document.querySelectorAll(".white-rabbit-gl").length,
    focus: a.id || a.tagName,
    controls: [...root.querySelectorAll("button, a, [role=group], .chip")].filter(shown).length,
    howShown: !!how && shown(how), howText: how ? how.textContent : "",
  };
});
const until = (page, fn, arg, timeout = 15000) => page.waitForFunction(fn, arg, { timeout, polling: 100 }).then(() => true, () => false);
const isState = (page, s) => until(page, (s) => document.getElementById("whiteRabbit").dataset.state === s, s);
// The scene renders in software here, so the GPU checks use a small window
const SMALL = { viewport: { width: 480, height: 320 }, reducedMotion: "no-preference", init: COUNT_FRAMES };

// Tab from the top of the page to the way in; it is off screen until focused, then in view
async function tabToRabbit(page) {
  // The way in joins the tab order once the rabbit is wired
  await page.waitForSelector("#whiteRabbitIn:not([hidden])", { state: "attached", timeout: 15000 });
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press("Tab");
    if (await page.evaluate(() => document.activeElement.id === "whiteRabbitIn")) {
      const box = await page.locator("#whiteRabbitIn").boundingBox();
      const vp = page.viewportSize();
      expect(box && box.y >= 0 && box.y + box.height <= vp.height, "the focused way in is not on screen", box);
      const shown = await page.evaluate(() => getComputedStyle(document.getElementById("whiteRabbitIn")).opacity === "1");
      expect(shown, "the focused way in is not visible");
      return;
    }
  }
  throw new Error("Tab never reached the white rabbit's way in");
}

check("browser", "rabbit: keyboard entry, no controls on screen, Tab, Esc, and focus back (reduced motion card)", async () => {
  const { page, context, errors } = await open({ init: COUNT_FRAMES });
  try {
    await tabToRabbit(page);
    await page.keyboard.press("Enter");
    let r = await rabbit(page);
    expect(r.state === "caught" && r.mode === "card" && r.focus === "whiteRabbitHow", "Enter did not catch and focus the line that says how to move", r);
    expect(!r.howShown && /Esc leaves/.test(r.howText) && r.controls === 0, "something explains or controls the scene on screen", r);
    // Each press moves the card 0.15 x CARD_GAIN, so two presses play it without reaching the end, where a control shows
    for (let i = 0; i < 2; i++) await page.keyboard.press("PageDown");
    r = await rabbit(page);
    expect(r.state === "playing" || r.state === "done", "the down keys did not play the card", r);
    expect(r.controls === 0, "a control showed over the card", r);
    await page.keyboard.press("Tab"); await page.keyboard.press("Shift+Tab");
    r = await rabbit(page);
    expect(r.focus === "whiteRabbitHow", "Tab left the rabbit while the page is covered", r);
    await page.keyboard.press("Escape");
    expect(await isState(page, "idle"), "Esc did not end the entry", await rabbit(page));
    r = await rabbit(page);
    expect(r.focus === "whiteRabbitIn", "focus did not return to the way in", r);
    // Again, leaving with Esc while only caught
    await page.keyboard.press("Enter");
    expect((await rabbit(page)).state === "caught", "a second entry did not catch");
    await page.keyboard.press("Escape");
    r = await rabbit(page);
    expect(r.state === "idle" && r.focus === "whiteRabbitIn", "Esc while caught did not leave and restore focus", r);
    expect(!(await sceneFrames(page)), "the card started the scene loop");
    expect(!errors.length, "page errors", errors);
  } finally { await context.close(); }
});

check("browser", "rabbit: the keyboard way in shows only with keyboard focus, never after a touch entry", async () => {
  const { page, context } = await open({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, init: MATRIX_STYLE }, "/?rabbit=p0.5");
  try {
    const seen = () => page.evaluate(() => { const c = getComputedStyle(document.getElementById("whiteRabbitIn")); return c.opacity !== "0" && c.clipPath === "none"; });
    expect(!(await seen()), "the way in shows before anyone tabs to it");
    expect(await isState(page, "playing"), "the test flag did not catch a rabbit", await rabbit(page));
    await page.keyboard.press("Escape");
    expect(await isState(page, "idle"), "Esc did not leave", await rabbit(page));
    await page.evaluate(() => scrollTo(0, innerHeight * 2));
    await page.waitForTimeout(300);
    expect(!(await seen()), "the way in shows after leaving, or over the sections below");
  } finally { await context.close(); }
});

check("browser", "rabbit: a touch screen leaves the card by swiping back up", async () => {
  const { page, context } = await open({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, init: MATRIX_STYLE }, "/?rabbit=p0.5");
  try {
    expect(await isState(page, "playing"), "the test flag did not catch a rabbit", await rabbit(page));
    expect((await rabbit(page)).controls === 0, "a control showed over the card", await rabbit(page));
    const cdp = await context.newCDPSession(page);
    const touch = (type, y) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x: 195, y }] });
    for (let i = 0; i < 40 && (await rabbit(page)).state !== "idle"; i++) {
      await touch("touchStart", 200);
      for (let y = 260; y <= 800; y += 60) await touch("touchMove", y);
      await touch("touchEnd");
    }
    expect(await isState(page, "idle"), "swiping back up did not leave", await rabbit(page));
  } finally { await context.close(); }
});

check("gpu", "rabbit: turning on reduced motion mid-scene switches to the still card and stops the loop", async () => {
  const { page, context, errors } = await open(SMALL, "/?rabbit=p0.4");
  try {
    expect(await until(page, () => !!document.getElementById("whiteRabbit").dataset.progress, null, 90000), "the scene never rendered", await rabbit(page));
    expect(await sceneFrames(page) === 1, "the scene loop is not running");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await until(page, () => document.getElementById("whiteRabbit").dataset.mode === "card");
    let r = await rabbit(page);
    expect(r.mode === "card" && r.canvases === 0 && r.controls === 0, "the scene did not hand over to the card", r);
    expect(!(await sceneFrames(page)), "the scene loop kept running in the card");
    await page.keyboard.press("Escape");
    expect(await isState(page, "idle"), "the card did not leave", await rabbit(page));
    expect(!errors.length, "page errors", errors);
  } finally { await context.close(); }
});

check("gpu", "rabbit: nothing to press shows at the window, and Tab stays on the rabbit", async () => {
  const { page, context, errors } = await open(SMALL, "/?rabbit=p0.7");
  try {
    expect(await until(page, () => !!document.getElementById("whiteRabbit").dataset.progress, null, 90000), "the scene never rendered", await rabbit(page));
    let r = await rabbit(page);
    expect(r.controls === 0 && !r.howShown, "something to press showed over the scene at the window", r);
    await page.keyboard.press("Tab");
    r = await rabbit(page);
    expect(r.focus === "whiteRabbitHow", "Tab left the rabbit while the scene covers the page", r);
    expect(!errors.length, "page errors", errors);
  } finally { await context.close(); }
});

check("browser", "rabbit: at the end of the card, \"go back\" is the one control, Tab reaches it, and Enter fades back to the landing", async () => {
  const { page, context, errors } = await open({ init: COUNT_FRAMES });
  try {
    await tabToRabbit(page);
    await page.keyboard.press("Enter");
    expect(await isState(page, "caught"), "Enter did not catch the rabbit", await rabbit(page));
    await page.keyboard.press("End");
    expect(await isState(page, "done"), "End did not finish the card", await rabbit(page));
    let r = await rabbit(page);
    expect(r.controls === 1, "\"go back\" is not the one control at the end", r);
    await page.keyboard.press("Tab");
    expect(await page.evaluate(() => document.activeElement.classList.contains("white-rabbit-back")), "Tab did not reach \"go back\"", await rabbit(page));
    await page.keyboard.press("Tab");
    expect((await rabbit(page)).focus === "whiteRabbitHow", "Tab did not cycle back to the line that says how to move", await rabbit(page));
    await page.keyboard.press("Tab");
    await page.keyboard.press("Enter");
    expect(await isState(page, "idle"), "\"go back\" did not return to the landing", await rabbit(page));
    r = await rabbit(page);
    expect(r.focus === "whiteRabbitIn", "focus did not return to the way in", r);
    expect(!(await sceneFrames(page)), "the card started the scene loop");
    expect(!errors.length, "page errors", errors);
  } finally { await context.close(); }
});

check("gpu", "rabbit: \"go back\" shows only at the end and plays the walk back calmly to the landing", async () => {
  const { page, context, errors } = await open(SMALL, "/?rabbit=p1");
  try {
    expect(await isState(page, "done"), "the scene never reached the end", await rabbit(page));
    let r = await rabbit(page);
    expect(r.controls === 1, "\"go back\" is not the one control at the end", r);
    await page.click(".white-rabbit-back");
    r = await rabbit(page);
    expect(r.state === "reversing" && r.controls === 0, "\"go back\" did not start playing back, or stayed on screen", r);
    // Calm: after two seconds most of the walk is still ahead, and the progress only ever goes down
    const seen = [];
    for (let i = 0; i < 8; i++) { await page.waitForTimeout(250); seen.push(+(await rabbit(page)).progress); }
    expect(seen[seen.length - 1] > 0.6, "\"go back\" rushed: too much of the walk went by in two seconds", seen);
    expect(seen.every((x, i) => !i || x <= seen[i - 1] + 0.001), "the walk did not play steadily back", seen);
    expect(await until(page, () => document.getElementById("whiteRabbit").dataset.state === "idle", null, 60000), "\"go back\" never reached the landing", await rabbit(page));
    expect(!(await sceneFrames(page)), "the scene loop kept running after the landing returned");
    expect(!errors.length, "page errors", errors);
  } finally { await context.close(); }
});

for (const [when, p] of [["at the start", "0.02"], ["midway", "0.5"], ["at the end", "1"]]) {
  check("gpu", `rabbit: context lost ${when}, then the card, then leaving, leaves no scene loop`, async () => {
    const { page, context, errors } = await open(SMALL, `/?rabbit=p${p}`);
    try {
      expect(await until(page, () => !!document.getElementById("whiteRabbit").dataset.progress, null, 90000), "the scene never rendered", await rabbit(page));
      await page.evaluate(() => document.querySelector(".white-rabbit-gl").getContext("webgl2").getExtension("WEBGL_lose_context").loseContext());
      expect(await until(page, () => document.getElementById("whiteRabbit").dataset.mode === "card"), "no fallback after the context was lost", await rabbit(page));
      let r = await rabbit(page);
      expect(r.canvases === 0 && !(await sceneFrames(page)), "the scene or its loop outlived the fallback", { r, frames: await sceneFrames(page) });
      await page.keyboard.press("Escape");
      expect(await isState(page, "idle"), "Esc did not leave the card", await rabbit(page));
      await page.waitForTimeout(500);
      expect(!(await sceneFrames(page)), "a scene frame was scheduled after leaving");
      expect(!errors.length, "page errors", errors);
    } finally { await context.close(); }
  });
}

check("gpu", "rabbit: catch, leave, and catch again before the scene loads builds one scene, and leaving frees it", async () => {
  let release;
  const gate = new Promise((r) => (release = r));
  overrides.set("/js/white-rabbit-scene.js", async (b) => { await gate; return b; });
  const { page, context, errors } = await open(SMALL);
  try {
    await tabToRabbit(page);
    await page.keyboard.press("Enter");
    await page.keyboard.press("Escape");
    await page.locator("#whiteRabbitIn").focus();
    await page.keyboard.press("Enter");
    expect((await rabbit(page)).state === "caught", "the second catch did not take");
    release();
    expect(await until(page, () => !!document.querySelector(".white-rabbit-gl"), null, 30000), "no scene was built");
    await page.waitForTimeout(1000);
    expect((await rabbit(page)).canvases === 1, "more than one scene was built", await rabbit(page));
    await page.keyboard.press("PageDown");
    expect(await until(page, () => !!document.getElementById("whiteRabbit").dataset.progress, null, 90000), "the scene never played", await rabbit(page));
    await page.keyboard.press("Escape");
    expect(await isState(page, "idle"), "Esc did not play back out", await rabbit(page));
    await page.waitForTimeout(1500);
    const r = await rabbit(page);
    expect(r.canvases === 0 && !(await sceneFrames(page)), "the scene was not freed after leaving", r);
    expect(!errors.length, "page errors", errors);
  } finally { overrides.delete("/js/white-rabbit-scene.js"); await context.close(); }
});

check("gpu", "rabbit: a room model that lands after leaving is dropped, and repeat entries keep one scene at most", async () => {
  let release;
  const gate = new Promise((r) => (release = r));
  overrides.set("/media/white-rabbit/room.glb", async (b) => { await gate; return b; });
  const { page, context, errors } = await open(SMALL);
  try {
    await tabToRabbit(page);
    await page.keyboard.press("Enter");
    expect(await until(page, () => !!document.querySelector(".white-rabbit-gl"), null, 30000), "no scene was built");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(1500); // past the delayed drop
    expect((await rabbit(page)).canvases === 0, "the scene outlived its entry", await rabbit(page));
    release();
    await page.waitForTimeout(1500);
    overrides.delete("/media/white-rabbit/room.glb");
    let most = 0;
    for (let i = 0; i < 3; i++) {
      await page.locator("#whiteRabbitIn").focus();
      await page.keyboard.press("Enter");
      await page.waitForTimeout(400);
      most = Math.max(most, (await rabbit(page)).canvases);
      await page.keyboard.press("Escape");
      await page.waitForTimeout(200);
    }
    await page.waitForTimeout(1500);
    const r = await rabbit(page);
    expect(most <= 1 && r.canvases === 0 && r.state === "idle", "entries left scenes behind", { most, r });
    expect(!(await sceneFrames(page)), "a scene frame is still scheduled");
    expect(!errors.length, "page errors", errors);
  } finally { overrides.delete("/media/white-rabbit/room.glb"); await context.close(); }
});


// ---- Run ----
// ---- Review 2026-11-11: menu, focus, case links, nested scrolling, and field errors ----
// Each check names the review finding it holds closed
check("browser", "AS-01: at 1024x600 the menu scrolls, so its last link can be reached and seen", async () => {
  const { page, context } = await open({ viewport: { width: 1024, height: 600 } });
  try {
    await page.locator("#menuBtn").click();
    const links = page.locator("#menu a");
    const last = links.nth((await links.count()) - 1);
    await last.focus();
    const box = await last.evaluate((a) => { const r = a.getBoundingClientRect(); return [r.top, r.bottom, innerHeight]; });
    expect(box[0] >= 0 && box[1] <= box[2], "the last menu link is off screen when focused", box);
  } finally { await context.close(); }
});

for (const motion of ["reduce", "no-preference"]) {
  check("browser", `AS-02: menu -> contact puts focus in the contact section (motion ${motion})`, async () => {
    const { page, context } = await open({ viewport: { width: 390, height: 844 }, reducedMotion: motion });
    try {
      await page.waitForTimeout(400);
      await page.locator("#menuBtn").click();
      await page.locator('#menu a[href="#contact"]').focus();
      await page.keyboard.press("Enter");
      await page.waitForTimeout(1500);
      expect(await page.evaluate(() => !!document.activeElement.closest("#contact")), "focus is not in the contact section");
    } finally { await context.close(); }
  });
}

check("browser", "AS-02: widening past the menu's breakpoint leaves focus on something visible", async () => {
  const { page, context } = await open({ viewport: { width: 1024, height: 700 } });
  try {
    await page.locator("#menuBtn").click();
    await page.setViewportSize({ width: 1336, height: 700 });
    await page.waitForTimeout(200);
    const at = await page.evaluate(() => { const a = document.activeElement; return a !== document.body && a.offsetParent !== null; });
    expect(at, "focus fell to the page body or a hidden element");
  } finally { await context.close(); }
});

check("browser", "RC-C1: the security case's contact link closes the case and lands on contact", async () => {
  const { page, context } = await open();
  try {
    await page.locator('#case-security [data-case]').click();
    await page.waitForSelector("#caseLayer:not([hidden])");
    const link = page.locator('.case-panel a[href="#contact"]');
    expect(await link.count(), "the case has no in-page contact link");
    expect(!(await page.locator('.case-panel a[href$=".md"]').count()), "the case still links a Markdown source");
    await link.first().focus();
    await page.keyboard.press("Enter");
    await page.waitForTimeout(800);
    const st = await page.evaluate(() => ({ hidden: document.getElementById("caseLayer").hidden, open: document.body.classList.contains("case-open"), inContact: !!document.activeElement.closest("#contact") }));
    expect(st.hidden && !st.open && st.inContact, "the case stayed open or focus missed contact", st);
  } finally { await context.close(); }
});

check("browser", "AS-03: the wheel over a long contact message scrolls the box, not the page", async () => {
  const { page, context } = await open({ reducedMotion: "no-preference" }, "/#contact");
  try {
    await page.waitForTimeout(1200);
    await page.locator("#cfold > summary").click();
    // The fold eases open while its view glides to the top; the check starts once both have settled
    await page.waitForFunction(() => document.getElementById("cfold").open && !document.getElementById("cfold").style.height);
    await page.waitForTimeout(100);
    const box = page.locator("[name=today]");
    await box.fill(Array.from({ length: 40 }, (_, i) => `synthetic line ${i}`).join("\n"));
    await box.evaluate((t) => (t.scrollTop = 0));
    const y0 = await page.evaluate(() => scrollY);
    const b = await box.boundingBox();
    await page.mouse.move(b.x + 20, b.y + 20);
    await page.mouse.wheel(0, 200);
    await page.waitForTimeout(600);
    const moved = (await page.evaluate(() => scrollY)) - y0, inner = await box.evaluate((t) => t.scrollTop);
    expect(moved === 0 && inner > 0, "the page moved or the box didn't", { moved, inner });
  } finally { await context.close(); }
});

check("browser", "AS-09: an empty send marks each required field with its own described error", async () => {
  const { page, context } = await open();
  try {
    let posts = 0;
    await page.route("**/1NEON/api/contact", (r) => { posts++; return r.fulfill({ status: 200, body: "{}" }); });
    await page.locator("#contact").scrollIntoViewIfNeeded();
    await page.locator("#cfold > summary").click();
    await page.locator('#cform [type="submit"]').click();
    const marks = await page.evaluate(() => [...document.querySelectorAll("#cform [aria-invalid=true]")].map((e) => !!document.getElementById(e.getAttribute("aria-describedby") || "")?.textContent));
    expect(marks.length >= 3 && marks.every(Boolean), "a flagged field has no described message", marks);
    expect(posts === 0, "an empty form was sent");
  } finally { await context.close(); }
});


(async () => {
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch();
  let failed = 0;
  for (const [at, { tag, name, fn }] of checks.entries()) {
    if (ONLY && !ONLY.test(name)) continue;
    if (SHARD && at % Number(SHARD[2]) !== Number(SHARD[1])) continue;
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
