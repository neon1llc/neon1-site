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


// ---- SITE-01: the contact form ----
// Synthetic text only; the API is answered by the test, so nothing leaves the loopback origin
const MARK = "SYNTHETIC-CONTACT-7f3a";
const fillForm = async (page, email = "dana@example.com") => {
  await page.locator('label.pick:has(input[value="business"])').click();
  await page.locator(".cstart button").first().click();
  await page.locator("[name=today]").type(MARK);
  await page.locator("[name=name]").fill("Dana Kim");
  await page.locator("[name=email]").fill(email);
};

check("browser", "contact: without script, the form stays hidden and the email link remains", async () => {
  const { page, context } = await open({ javaScriptEnabled: false });
  try {
    expect(await page.locator("#cform").evaluate((f) => f.hidden), "the form shows without its script");
    expect(await page.locator('#contact a[href="mailto:hello@neon1.tech"]').count(), "the email link is missing");
  } finally { await context.close(); }
});

check("browser", "contact: a starter fills the message, and a send posts JSON with the header", async () => {
  const { page, context, errors } = await open();
  try {
    let sent = null;
    await page.route("**/1NEON/api/contact", async (r) => { sent = { body: r.request().postDataJSON(), header: r.request().headers()["x-1neon"] }; await r.fulfill({ status: 200, contentType: "application/json", body: '{"ok":true}' }); });
    await page.locator("#contact").scrollIntoViewIfNeeded();
    await fillForm(page);
    expect((await page.locator("[name=today]").inputValue()).startsWith("We type the same orders"), "the starter did not fill the message");
    await page.locator('#cform [type="submit"]').click();
    await page.waitForSelector("#cdone:not([hidden])");
    expect(sent && sent.header === "1" && sent.body.topic === "business" && sent.body.today.includes(MARK) && !sent.body.website, "unexpected request", sent);
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
    await page.locator('#cform [type="submit"]').click();
    expect(calls === 0, "an incomplete form was sent");
    expect(/Pick what it's about/.test(await page.locator("#cstatus").textContent()), "the problems were not named");
    await fillForm(page);
    await page.locator('#cform [type="submit"]').click();
    await page.waitForFunction(() => /hello@neon1.tech/.test(document.getElementById("cstatus").textContent));
    expect(calls === 1 && !(await page.locator("#cform").evaluate((f) => f.hidden)), "the form did not stay for another try");
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


// ---- SITE-09: case links land on their exact card ----
// The contact form's "a similar project" links point at single cards; each must land on its card

// Resolves once the card is in view vertically, inside the row sideways, focused, and named in the URL
const landed = (page, id) => page.waitForFunction((id) => {
  const card = document.getElementById("case-" + id), rail = document.getElementById("cases");
  const c = card.getBoundingClientRect(), r = rail.getBoundingClientRect();
  return c.top >= 0 && c.top < innerHeight && c.left >= r.left - 2 && c.right <= r.right + 2 &&
    document.activeElement === card.querySelector("[data-case]") && location.hash === "#case-" + id && card.classList.contains("is-target");
}, id, { timeout: 5000 }).then(() => true, () => false);

// Each topic and the card its first starter's link names
const STARTS = [["business", "dermatology"], ["cloud", "accounting"], ["spaces", "home"], ["security", "security"]];
for (const [label, options] of [
  ["reduced motion, wide", { reducedMotion: "reduce" }],
  ["motion, phone", { reducedMotion: "no-preference", viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }],
]) {
  check("browser", `case links: each starter's similar project lands on its card (${label})`, async () => {
    const { page, context, errors } = await open(options);
    try {
      for (const [topic, id] of STARTS) {
        await page.goto(origin + "/#contact", { waitUntil: "domcontentloaded" });
        await page.waitForTimeout(400);
        await page.locator(`label.pick:has(input[value="${topic}"])`).click();
        await page.locator(`.cstart a[href="#case-${id}"]`).first().click();
        expect(await landed(page, id), `${topic} did not land on case-${id}`, await page.evaluate(() => [location.hash, document.activeElement.outerHTML.slice(0, 80)]));
      }
      expect(!errors.length, "page errors", errors);
    } finally { await context.close(); }
  });
}

for (const motion of ["reduce", "no-preference"]) {
  check("browser", `case links: opening /#case-home, then Back and Forward (${motion === "reduce" ? "reduced motion" : "motion"})`, async () => {
    const { page, context, errors } = await open({ reducedMotion: motion }, "/#case-home");
    try {
      expect(await landed(page, "home"), "opening /#case-home did not land on the card");
      await page.goto(origin + "/#contact", { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(400);
      await page.locator('label.pick:has(input[value="cloud"])').click();
      const link = page.locator('.cstart a[href="#case-migration"]');
      const at = await link.evaluate((a) => a.getBoundingClientRect().top + scrollY);
      await link.click();
      expect(await landed(page, "migration"), "the link did not land on case-migration");
      await page.goBack();
      const back = await page.waitForFunction((at) => location.hash !== "#case-migration" && Math.abs(scrollY + innerHeight / 2 - at) < innerHeight / 2, at, { timeout: 5000 }).then(() => true, () => false);
      expect(back, "Back did not return to the form", await page.evaluate(() => [location.hash, scrollY]));
      await page.goForward();
      expect(await landed(page, "migration"), "Forward did not return to case-migration");
      expect(!errors.length, "page errors", errors);
    } finally { await context.close(); }
  });
}


// ---- SITE-06 and SITE-07: the white rabbit ----
const rabbit = (page) => page.evaluate(() => {
  const root = document.getElementById("whiteRabbit"), a = document.activeElement;
  const help = root.querySelector(".white-rabbit-help"), how = help && help.querySelector("p");
  return {
    state: root.dataset.state, mode: root.dataset.mode, progress: root.dataset.progress,
    canvases: document.querySelectorAll(".white-rabbit-gl").length,
    focus: a.id || a.dataset.rabbit || a.tagName,
    helpShown: !!help && getComputedStyle(help).visibility === "visible", howShown: !!how && how.getBoundingClientRect().width > 1,
  };
});
const until = (page, fn, arg, timeout = 15000) => page.waitForFunction(fn, arg, { timeout, polling: 100 }).then(() => true, () => false);
const isState = (page, s) => until(page, (s) => document.getElementById("whiteRabbit").dataset.state === s, s);
// The scene renders in software here, so the GPU checks use a small window
const SMALL = { viewport: { width: 480, height: 320 }, reducedMotion: "no-preference", init: COUNT_FRAMES };

// Tab from the top of the page to the way in; it is off screen until focused, then in view
async function tabToRabbit(page) {
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press("Tab");
    if (await page.evaluate(() => document.activeElement.id === "whiteRabbitIn")) {
      const box = await page.locator("#whiteRabbitIn").boundingBox();
      const vp = page.viewportSize();
      expect(box && box.y >= 0 && box.y + box.height <= vp.height, "the focused way in is not on screen", box);
      return;
    }
  }
  throw new Error("Tab never reached the white rabbit's way in");
}

check("browser", "rabbit: keyboard entry, help, Tab, leave, and focus back (reduced motion card)", async () => {
  const { page, context, errors } = await open({ init: COUNT_FRAMES });
  try {
    await tabToRabbit(page);
    await page.keyboard.press("Enter");
    let r = await rabbit(page);
    expect(r.state === "caught" && r.mode === "card" && r.focus === "leave", "Enter did not catch and focus the way back", r);
    expect(r.helpShown && r.howShown, "the help line is not shown while caught", r);
    for (let i = 0; i < 6; i++) await page.keyboard.press("PageDown");
    r = await rabbit(page);
    expect(r.state === "playing" || r.state === "done", "the down keys did not play the card", r);
    await page.keyboard.press("Tab"); await page.keyboard.press("Shift+Tab");
    r = await rabbit(page);
    expect(r.focus === "leave" && r.helpShown, "Tab left the help line while the page is covered", r);
    await page.keyboard.press("Enter");
    expect(await isState(page, "idle"), "back to the page did not end the entry", await rabbit(page));
    r = await rabbit(page);
    expect(r.focus === "whiteRabbitIn" && !r.helpShown, "focus did not return to the way in", r);
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

check("browser", "rabbit: a touch screen can leave the card with the visible button", async () => {
  const { page, context } = await open({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }, "/?rabbit=p0.5");
  try {
    expect(await isState(page, "playing"), "the test flag did not catch a rabbit", await rabbit(page));
    await page.locator('[data-rabbit="leave"]').tap();
    expect(await isState(page, "idle"), "tapping back to the page did not leave", await rabbit(page));
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
    expect(r.mode === "card" && r.canvases === 0 && r.helpShown, "the scene did not hand over to the card", r);
    expect(!(await sceneFrames(page)), "the scene loop kept running in the card");
    await page.locator('[data-rabbit="leave"]').click();
    expect(await isState(page, "idle"), "the card did not leave", await rabbit(page));
    expect(!errors.length, "page errors", errors);
  } finally { await context.close(); }
});

check("gpu", "rabbit: the car's button shows while the car is in view and starts it from the keyboard", async () => {
  const { page, context, errors } = await open(SMALL, "/?rabbit=p0.7");
  try {
    expect(await until(page, () => !!document.getElementById("whiteRabbit").dataset.progress, null, 90000), "the scene never rendered", await rabbit(page));
    const car = page.locator('[data-rabbit="car"]');
    expect(await until(page, () => !document.querySelector('[data-rabbit="car"]').hidden), "the car's button did not show at the window");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    const focus = (await rabbit(page)).focus;
    expect(focus === "car" || focus === "leave", "Tab did not move between the help line's buttons", focus);
    await car.focus();
    await page.keyboard.press("Enter");
    expect(await until(page, () => document.querySelector('[data-rabbit="car"]').textContent === "stop the car"), "Enter on the car's button did not start it", await car.textContent());
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
