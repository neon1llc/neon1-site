#!/usr/bin/env node
// scripts/rabbit_lifecycle.cjs - Lifetime checks for the white rabbit's controller, without a browser.
// Usage: node scripts/rabbit_lifecycle.cjs [SITE_DIR]   (part of make logic)
//
// Runs the real js/white-rabbit.js in a small stub of the page whose imports, timers, and animation
// frames the test steps by hand, so the two lifetime faults found in review replay exactly:
//   - a context lost mid-scene, the still card, then leaving: no scene frame may stay scheduled;
//   - caught, left, and caught again before the scene module arrives: one scene is built, and every
//     scene built is disposed once the entry ends.
// The controller's private steps are reached by appending them to its return value in this copy only.

"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const SITE = path.resolve(process.argv[2] || "src/app/public");
const ANCHOR = "return { ready };";
const source = fs.readFileSync(path.join(SITE, "js/white-rabbit.js"), "utf8");
if (!source.includes(ANCHOR) || !source.includes("export function whiteRabbit")) {
  console.error(`rabbit_lifecycle: js/white-rabbit.js no longer ends with "${ANCHOR}"; update this check with it`);
  process.exit(1);
}
const code = source
  .replace("export function whiteRabbit", "function whiteRabbit")
  .replaceAll("import(", "stubImport(")
  .replace(ANCHOR, "return { ready, audit: { catchIt, step, fallback, card, leave, get state() { return state; }, get mode() { return mode; } } };");

// ---- A page just big enough for the controller: class lists, styles, and the elements it looks up ----
const classes = () => { const s = new Set(); return { add: (...x) => x.forEach((c) => s.add(c)), remove: (...x) => x.forEach((c) => s.delete(c)), contains: (c) => s.has(c), toggle: (c, on) => (on ? s.add(c) : s.delete(c)) }; };
const style = () => ({ setProperty() {}, removeProperty() {} });
const element = (extra = {}) => ({ hidden: false, dataset: {}, style: style(), classList: classes(), focus() {}, contains: () => false, closest: () => null, ...extra });

function world() {
  let time = 0, serial = 0;
  const frames = new Map(), timers = new Map();
  const grass = element({ textContent: "", parentElement: element() });
  const how = element();
  const root = element({ querySelector: (s) => ({ ".white-rabbit-grass": grass, ".white-rabbit-how": how })[s] || null });
  const body = element(), html = element(), menu = element({ hidden: true });
  const doc = { body, documentElement: html, hidden: false, activeElement: body, addEventListener() {},
    getElementById: (id) => (id === "menu" ? menu : id === "whiteRabbitIn" ? element() : null), querySelector: () => null, querySelectorAll: () => [] };
  const ctx = {
    document: doc, window: {}, localStorage: { removeItem() {} }, URLSearchParams, location: { search: "" }, scrollY: 0, innerHeight: 900,
    matchMedia: () => ({ matches: false, addEventListener() {} }), addEventListener() {},
    performance: { now: () => time },
    setTimeout: (f) => { const id = ++serial; timers.set(id, f); return id; }, clearTimeout: (id) => timers.delete(id),
    setInterval: () => 0, clearInterval() {},
    requestAnimationFrame: (f) => { const id = ++serial; frames.set(id, f); return id; }, cancelAnimationFrame: (id) => frames.delete(id),
    stubImport: () => Promise.resolve({ createScene: () => ({ compose: () => Promise.resolve(), render() {}, dispose() {} }) }),
  };
  vm.createContext(ctx);
  vm.runInContext(code, ctx);
  ctx.root = root;
  ctx.rain = { halt: () => Promise.resolve(), resume() {} };
  // One animation frame, if any is scheduled; timers run all at once, time moved past any idle wait
  const frame = () => { const next = frames.entries().next().value; if (!next) return false; time += 16; frames.delete(next[0]); next[1](time); return true; };
  const runTimers = () => { time += 1200; for (const [id, f] of [...timers]) { timers.delete(id); f(); } };
  return { ctx, root, frames, frame, runTimers, egg: () => vm.runInContext("whiteRabbit({ root, rain })", ctx) };
}

const flush = () => new Promise((r) => setImmediate(r));
let failed = 0;
const report = (name, ok, detail) => { if (!ok) failed++; console.log(`${ok ? "ok  " : "FAIL"} [logic] ${name}${ok ? "" : " " + JSON.stringify(detail)}`); };

(async () => {
  // Context lost mid-scene -> card -> leave: the loop stops with the scene, and stays stopped
  {
    const w = world(), egg = w.egg();
    let disposed = 0;
    w.ctx.stubImport = () => Promise.resolve({ createScene: () => ({ compose: () => Promise.resolve(), render() {}, dispose() { disposed++; } }) });
    egg.audit.catchIt(); await flush(); await flush();
    egg.audit.step(0.2); w.frame();
    const playing = { state: w.root.dataset.state, frames: w.frames.size };
    egg.audit.fallback();
    const fallback = { mode: w.root.dataset.mode, frames: w.frames.size, disposed };
    egg.audit.card(-1); w.runTimers();
    let ran = 0;
    for (let i = 0; i < 20; i++) if (w.frame()) ran++;
    const after = { state: w.root.dataset.state, frames: w.frames.size, ran };
    report("context lost mid-scene, card, leave: no scene frame outlives the scene",
      playing.frames === 1 && fallback.mode === "card" && fallback.frames === 0 && fallback.disposed === 1 && after.state === "idle" && after.ran === 0,
      { playing, fallback, after });
  }

  // Caught, left, and caught again before the module lands: one scene, freed when the entry ends
  {
    const w = world(), egg = w.egg();
    let resolve, built = 0, freed = 0;
    w.ctx.stubImport = () => new Promise((r) => (resolve = r));
    egg.audit.catchIt(); egg.audit.leave(); egg.audit.catchIt();
    resolve({ createScene: () => { built++; return { compose: () => Promise.resolve(), render() {}, dispose() { freed++; } }; } });
    await flush(); await flush();
    const caught = { built, freed };
    egg.audit.leave(); w.runTimers();
    report("catch, leave, catch before the import resolves: one scene built, and freed on leaving",
      caught.built === 1 && caught.freed === 0 && built === 1 && freed === 1, { caught, built, freed });
  }

  // A compose that finishes after its entry ended doesn't count for the next one, and a stale failure
  // doesn't push the next entry into the card
  {
    const w = world(), egg = w.egg();
    let fail;
    w.ctx.stubImport = () => Promise.resolve({ createScene: () => ({ compose: () => new Promise((_, no) => (fail = no)), render() {}, dispose() {} }) });
    egg.audit.catchIt(); await flush(); await flush();
    egg.audit.leave();
    w.ctx.stubImport = () => new Promise(() => {}); // the next entry's scene is still loading
    egg.audit.catchIt();
    fail(new Error("synthetic late failure")); await flush();
    report("a late compose failure from an ended entry leaves the new entry alone",
      egg.audit.mode === "scene" && egg.audit.state === "caught", { mode: egg.audit.mode, state: egg.audit.state });
  }

  console.log(failed ? `rabbit_lifecycle: ${failed} failed` : "rabbit_lifecycle: all checks passed");
  process.exit(failed ? 1 : 0);
})();
