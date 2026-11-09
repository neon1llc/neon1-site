#!/usr/bin/env node
// scripts/perf.cjs - Measures the white rabbit's 3D scene and holds it to a budget.
// Usage: node scripts/perf.cjs [SITE_DIR]   (make perf; needs Playwright and its Chromium)
//        PERF_REPORT=docs/perf-report.md node scripts/perf.cjs   rewrites the report from this run
//
// Serves SITE_DIR on loopback, enters the scene the way a visitor does (?rabbit=now, then a click on the
// rabbit), and scrolls to fixed checkpoints, on a desktop viewport and on an emulated Pixel 7 with its CPU
// slowed 4x. At each checkpoint it records three.js's renderer.info for 12 frames: draw calls and triangles
// for the scene itself (the RenderPass) and for the whole frame (every postprocessing pass), and the live
// geometries, textures, and shader programs. Those counts depend on the scene, not the machine.
//
// Headless Chromium renders WebGL in software (SwiftShader), so the frame times and the time to the first
// frame are recorded but only for comparing runs on one machine; they are not a device's speed. The scene's
// own adaptive step also sees those slow frames and lowers its pixel ratio and turns bloom off, so the report
// notes the pixel ratio and pass count it ran at. The budget (scripts/perf-budget.json) covers only the
// device-independent counts, and the run fails if any profile goes over it.
//
// Nothing is changed in the site: the server appends a few lines to the three.js bundle it serves that
// wrap EffectComposer.render and RenderPass.render to read renderer.info.

"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");

let chromium, devices;
try { ({ chromium, devices } = require("playwright")); } catch {
  console.error("perf: Playwright is not installed (npm i -g playwright, then npx playwright install chromium)");
  process.exit(2);
}

const SITE = path.resolve(process.argv[2] || "src/app/public");
const BUDGET_FILE = path.join(__dirname, "perf-budget.json");
const REPORT = process.env.PERF_REPORT || "";
const THREE = "/js/vendor/three-0.187.0.rabbit.min.js";
const FRAMES = 12;                                 // frames recorded at each checkpoint
const CHECKPOINTS = [                              // scroll progress (data-progress), and what is in view
  [0.05, "at the TV, the landing on its screen"],
  [0.3, "gliding back across the floor, the set and both chairs"],
  [0.45, "turned to the window, the sun in the eyes"],
  [0.7, "walking over, the car on the sill"],
  [0.85, "at the open window, the yard below"],
  [0.95, "out through the opening, the yard and the water"],
];
const PROFILES = [
  { name: "desktop", label: "Desktop, 1440x900 at 1x", context: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }, cpu: 1 },
  { name: "phone", label: "Pixel 7 emulation (412x839 at 2.625x, touch), CPU 4x slower", context: { ...devices["Pixel 7"] }, cpu: 4 },
];

// ---- The hook: appended to the bundle it reads, so it runs once the module's own exports exist ----
const HOOK = `
import * as __T from "${THREE}";
{
  const P = (globalThis.__perf = { frames: [], scene: null });
  const rp = __T.RenderPass.prototype, cp = __T.EffectComposer.prototype, rr = rp.render, cr = cp.render;
  rp.render = function (renderer, ...rest) {
    const out = rr.call(this, renderer, ...rest);
    P.scene = { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles };
    return out;
  };
  cp.render = function (...args) {
    const info = this.renderer.info;
    info.autoReset = false; info.reset();
    const t = performance.now();
    const out = cr.apply(this, args);
    P.frames.push({ t, cpu: performance.now() - t, sceneCalls: P.scene ? P.scene.calls : 0, sceneTriangles: P.scene ? P.scene.triangles : 0,
      calls: info.render.calls, triangles: info.render.triangles, geometries: info.memory.geometries, textures: info.memory.textures,
      programs: (info.programs || []).length, ratio: this.renderer.getPixelRatio(), passes: this.passes.filter((p) => p.enabled).length });
    return out;
  };
}
`;

// ---- Server: SITE_DIR on loopback with the production policy's shape; only the bundle is touched ----
const CSP = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'";
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".woff2": "font/woff2", ".webp": "image/webp",
  ".png": "image/png", ".glb": "model/gltf-binary", ".m4a": "audio/mp4", ".txt": "text/plain", ".ao": "application/octet-stream" };
const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, "http://local").pathname);
  const file = path.join(SITE, pathname === "/" ? "index.html" : pathname);
  if (!file.startsWith(SITE + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.statusCode = 404; res.end(); return; }
  let body = fs.readFileSync(file);
  if (pathname === THREE) body = Buffer.concat([body, Buffer.from(HOOK)]);
  res.setHeader("Content-Type", TYPES[path.extname(file)] || "application/octet-stream");
  res.setHeader("Content-Security-Policy", CSP);
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Length", body.length);
  res.end(body);
});

const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor((s.length - 1) / 2)] : 0; };
const pct = (xs, q) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.ceil(q * s.length) - 1)] : 0; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function until(page, fn, arg, ms = 120000) {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (await page.evaluate(fn, arg)) return true; await wait(100); }
  return false;
}

// Sends scroll as wheel events: the controller turns PASS (16) viewport heights of scroll into the whole walk
const scrollTo = (page, from, to) => page.evaluate(([a, b]) => {
  dispatchEvent(new WheelEvent("wheel", { deltaY: (b - a) * 16 * innerHeight, cancelable: true }));
}, [from, to]);

async function measure(browser, origin, profile) {
  const context = await browser.newContext({ ...profile.context, reducedMotion: "no-preference" });
  // Every request stays on loopback; audio contexts are noted so the hidden-tab check can see them
  await context.route("**/*", (r) => (r.request().url().startsWith(origin) ? r.continue() : r.abort()));
  await context.addInitScript(() => {
    const AC = window.AudioContext;
    if (!AC) return;
    window.__audio = [];
    window.AudioContext = class extends AC { constructor(...a) { super(...a); window.__audio.push(this); } };
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  let bytes = 0, counting = false;
  page.on("response", async (r) => { if (counting) { const n = +(r.headers()["content-length"] || 0); bytes += n; } });
  if (profile.cpu > 1) { const cdp = await context.newCDPSession(page); await cdp.send("Emulation.setCPUThrottlingRate", { rate: profile.cpu }); }

  await page.goto(origin + "/?rabbit=now", { waitUntil: "load" });
  if (!await until(page, () => !!document.getElementById("whiteRabbit").dataset.spot, null, 60000)) throw new Error(`${profile.name}: the rabbit never appeared`);

  // Catch it where it is (it may have moved since the spot was written, so try a few times), then scroll at once,
  // so the loop is running and the first composed frame marks the scene as ready
  counting = true;
  let t0 = 0;
  for (let i = 0; i < 20 && !t0; i++) {
    const [x, y] = (await page.evaluate(() => document.getElementById("whiteRabbit").dataset.spot)).split(" ").map(Number);
    const at = Date.now();
    if (profile.context.hasTouch) await page.touchscreen.tap(x, y); else await page.mouse.click(x, y);
    if (await until(page, () => document.getElementById("whiteRabbit").dataset.state !== "idle", null, 1500)) t0 = at;
  }
  if (!t0) throw new Error(`${profile.name}: could not catch the rabbit`);
  const caughtAt = await page.evaluate(() => performance.now());
  await scrollTo(page, 0, CHECKPOINTS[0][0]);
  if (!await until(page, () => (globalThis.__perf || { frames: [] }).frames.length > 0, null, 240000)) throw new Error(`${profile.name}: the scene never rendered`, { cause: errors });
  const ready = await page.evaluate((c) => globalThis.__perf.frames[0].t - c, caughtAt);
  const touch = await page.evaluate(() => matchMedia("(pointer: coarse)").matches);

  // Each checkpoint: scroll there, let the spring settle, then record FRAMES frames
  const rows = [];
  let at = CHECKPOINTS[0][0];
  for (const [cp, what] of CHECKPOINTS) {
    if (cp !== at) { await scrollTo(page, at, cp); at = cp; }
    await until(page, (want) => Math.abs(+document.getElementById("whiteRabbit").dataset.progress - want) < 0.002, cp, 240000);
    const from = await page.evaluate(() => globalThis.__perf.frames.length);
    await until(page, (n) => globalThis.__perf.frames.length >= n, from + FRAMES + 1, 600000);
    const frames = await page.evaluate(([a, n]) => globalThis.__perf.frames.slice(a, a + n), [from, FRAMES + 1]);
    const gaps = frames.slice(1).map((f, i) => f.t - frames[i].t), use = frames.slice(1);
    rows.push({
      cp, what, progress: await page.evaluate(() => document.getElementById("whiteRabbit").dataset.progress),
      sceneCalls: median(use.map((f) => f.sceneCalls)), sceneCallsMax: Math.max(...use.map((f) => f.sceneCalls)),
      sceneTriangles: median(use.map((f) => f.sceneTriangles)), calls: median(use.map((f) => f.calls)), triangles: median(use.map((f) => f.triangles)),
      geometries: Math.max(...use.map((f) => f.geometries)), textures: Math.max(...use.map((f) => f.textures)), programs: Math.max(...use.map((f) => f.programs)),
      p50: median(gaps), p95: pct(gaps, 0.95), ratio: use[use.length - 1].ratio, passes: use[use.length - 1].passes,
    });
    console.log(`perf: ${profile.name} ${cp.toFixed(2)}  scene ${rows.at(-1).sceneCalls} calls ${rows.at(-1).sceneTriangles} tris, frame ${rows.at(-1).calls} calls, p50 ${rows.at(-1).p50.toFixed(0)} ms`);
  }

  // A hidden tab: headless pages are always visible, so the page is told it is hidden the way a browser
  // would tell it (visibilityState and the event); the browser itself stops animation frames for hidden pages
  const hidden = await page.evaluate(async () => {
    const audio = (window.__audio || [])[0];
    const before = audio ? audio.state : "none";
    const was = Object.getOwnPropertyDescriptor(Document.prototype, "hidden"), vis = Object.getOwnPropertyDescriptor(Document.prototype, "visibilityState");
    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));
    await new Promise((r) => setTimeout(r, 400));
    const during = audio ? audio.state : "none";
    delete document.hidden; delete document.visibilityState;
    void was; void vis;
    document.dispatchEvent(new Event("visibilitychange"));
    await new Promise((r) => setTimeout(r, 400));
    return { before, during, after: audio ? audio.state : "none" };
  });
  counting = false;
  await context.close();
  return { profile, ready, touch, rows, hidden, bytes, errors };
}

function check(results, budget) {
  const over = [];
  for (const r of results) {
    const b = budget.profiles[r.profile.name];
    const worst = {
      sceneCalls: Math.max(...r.rows.map((x) => x.sceneCalls)), sceneTriangles: Math.max(...r.rows.map((x) => x.sceneTriangles)),
      calls: Math.max(...r.rows.map((x) => x.calls)), geometries: Math.max(...r.rows.map((x) => x.geometries)),
      textures: Math.max(...r.rows.map((x) => x.textures)), programs: Math.max(...r.rows.map((x) => x.programs)),
    };
    r.worst = worst;
    for (const [k, v] of Object.entries(worst)) if (b && b[k] !== undefined && v > b[k]) over.push(`${r.profile.name}: ${k} ${v} is over the budget of ${b[k]}`);
  }
  return over;
}

function report(results, budget, over, version, browserVersion) {
  const n = (x) => x.toLocaleString("en-US");
  const lines = [
    "# White rabbit scene: performance report",
    "",
    `Measured by \`make perf\` (scripts/perf.cjs) on site v${version}, in headless Chromium ${browserVersion}, on ${new Date().toISOString().slice(0, 10)}.`,
    "",
    "## How it is measured",
    "",
    "The script serves the site on loopback, enters the scene the way a visitor does (`?rabbit=now`, then a click or tap on the rabbit), and scrolls to six fixed checkpoints. At each one it waits for the scroll to settle and records 12 frames of three.js's `renderer.info`: draw calls and triangles for the scene itself (the RenderPass, including any shadow map update) and for the whole frame (every postprocessing pass), and the live geometries, textures, and shader programs. Counts are the median frame; geometries, textures, and programs are the most seen.",
    "",
    "Those counts depend on the scene, not the machine, so they are what the budget holds. Headless Chromium draws WebGL in software (SwiftShader), so **frame times and the time to the first frame are software-rendered**: useful only for comparing runs on the same machine, never as a phone's or a desktop's real speed. The scene's adaptive step sees those slow frames too and lowers its pixel ratio and drops bloom, so each row notes the pixel ratio and the number of postprocessing passes it ran at; a real desktop GPU keeps bloom, which adds about a dozen full-screen draws to the frame from the window on (the scene's own counts do not change).",
    "",
    "Scene ready is the time from the catch to the first composed frame: the rain's stop, the scene's modules, the models and maps, and building the room and the yard.",
    "",
  ];
  for (const r of results) {
    lines.push(`## ${r.profile.label}`, "",
      `Pointer is ${r.touch ? "coarse (the phone path: pixel ratio capped at 1.5, the lighter car, no bloom, no antialiasing)" : "fine (the desktop path)"}. Scene ready: ${n(Math.round(r.ready))} ms (software-rendered). Bytes fetched after the catch: ${n(Math.round(r.bytes / 1024))} KB.`, "",
      "| Progress | In view | Scene calls | Scene triangles | Frame calls | Frame triangles | Geometries | Textures | Programs | Frame p50 / p95 ms (software) | Pixel ratio, passes |",
      "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |");
    for (const x of r.rows) {
      lines.push(`| ${x.cp.toFixed(2)} | ${x.what} | ${n(x.sceneCalls)}${x.sceneCallsMax > x.sceneCalls ? ` (max ${n(x.sceneCallsMax)})` : ""} | ${n(x.sceneTriangles)} | ${n(x.calls)} | ${n(x.triangles)} | ${x.geometries} | ${x.textures} | ${x.programs} | ${x.p50.toFixed(0)} / ${x.p95.toFixed(0)} | ${x.ratio}, ${x.passes} |`);
    }
    lines.push("", `Hidden tab: audio ${r.hidden.before} before, ${r.hidden.during} while hidden, ${r.hidden.after} after.${r.errors.length ? ` Page errors: ${r.errors.join("; ")}` : ""}`, "");
  }
  lines.push("## Budget", "",
    "`scripts/perf-budget.json` holds the most each profile may reach at any checkpoint. It was set from v0.31.0's counts with about 10% headroom, rounded up (the desktop's frame calls, textures, and programs also leave room for bloom, which a real GPU keeps on), so a new feature in the room or the yard that adds draw calls, triangles, textures, or programs past that shows up as a failed `make perf` and gets a deliberate budget change instead of a silent one. Frame times are not budgeted, since this runner can't measure them.",
    "",
    "| Profile | Scene calls | Scene triangles | Frame calls | Geometries | Textures | Programs |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: |");
  for (const r of results) {
    const b = budget.profiles[r.profile.name] || {}, w = r.worst;
    const cell = (k) => `${n(w[k])} of ${b[k] !== undefined ? n(b[k]) : "none"}`;
    lines.push(`| ${r.profile.name} | ${cell("sceneCalls")} | ${cell("sceneTriangles")} | ${cell("calls")} | ${cell("geometries")} | ${cell("textures")} | ${cell("programs")} |`);
  }
  lines.push("", over.length ? `Over budget: ${over.join("; ")}.` : "Every profile is within its budget.", "",
    "## Hidden tabs", "",
    "The scene draws only from `requestAnimationFrame`, which browsers stop for hidden tabs, and the controller suspends the audio device on `visibilitychange` and resumes it on return (the rows above show it). Headless pages are always visible, so the script reports the page as hidden through `visibilityState` and the event, as a browser would. The scene's adaptive quality step ignores a frame gap longer than a second, so coming back to the tab doesn't count the time away as one slow frame and lower the quality for the rest of the visit.",
    "",
    "## Running it", "",
    "```bash",
    "make perf                                   # measure and check the budget",
    "PERF_REPORT=docs/perf-report.md make perf   # also rewrite this report",
    "```", "",
    "It needs Node's `playwright` package and its Chromium, like `make behavior`, so it stays out of `make check`. A desktop and a phone run take a few minutes in software rendering. Run it before adding to the room or the yard, and raise a budget only on purpose, in the same change as what needs it.", "");
  return lines.join("\n");
}

(async () => {
  const budget = JSON.parse(fs.readFileSync(BUDGET_FILE, "utf8"));
  const version = (fs.readFileSync(path.join(SITE, "index.html"), "utf8").match(/<meta name="version" content="([^"]+)"/) || [])[1] || "?";
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch();
  const browserVersion = browser.version();
  const only = process.env.PROFILE;
  const results = [];
  try {
    for (const p of PROFILES) if (!only || only === p.name) results.push(await measure(browser, origin, p));
  } finally {
    await browser.close().catch(() => {});
    server.close();
  }
  const over = check(results, budget);
  for (const r of results) {
    console.log(`perf: ${r.profile.name}: ready ${Math.round(r.ready)} ms (software), worst ${JSON.stringify(r.worst)}; audio hidden ${r.hidden.during}`);
    if (r.hidden.before === "running" && r.hidden.during === "running") over.push(`${r.profile.name}: the audio kept running in a hidden tab`);
  }
  if (REPORT) { fs.mkdirSync(path.dirname(path.resolve(REPORT)), { recursive: true }); fs.writeFileSync(REPORT, report(results, budget, over, version, browserVersion)); console.log(`perf: wrote ${REPORT}`); }
  if (over.length) { console.error(over.join("\n")); process.exit(1); }
  console.log("perf: within budget");
})().catch((e) => { console.error(`perf: ${e.stack || e}`); process.exit(1); });
