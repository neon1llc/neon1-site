#!/usr/bin/env node
// scripts/models.cjs - Checks the white rabbit's models against the code that names their parts, without a browser.
// Usage: node scripts/models.cjs [SITE_DIR]   (make models, part of make check)
//
// The room's baked light is matched to the room by mesh name, and the names are build order (room-N in
// js/white-rabbit-room.js), so a mesh added or moved in the code silently shifts every name after it.
// This builds the room for real (desktop detail, the build the bake was made from) with three.js in Node,
// canvases stubbed out since only geometry matters, and then requires:
//   - every mesh in room.glb has a baked target of the same name, the same vertex count, and the same
//     bounds to 5 mm, and its occlusion map lm/NAME.webp ships;
//   - every baked target not in room.glb ships lm/NAME.ao with exactly one byte per vertex;
//   - nothing else sits in lm/.
// The car takes its materials by the names given in Blender, so every material name in car.glb and
// car-lite.glb must be one js/white-rabbit-car.js maps (an unknown one silently falls back to trim).

"use strict";
const fs = require("fs");
const path = require("path");
const { register } = require("module");
const { pathToFileURL } = require("url");

const SITE = path.resolve(process.argv[2] || "src/app/public");
const BASE = pathToFileURL(SITE + "/").href;
const LM = path.join(SITE, "media/white-rabbit/lm");
const TOLERANCE = 0.005;   // meters; quantized positions in the model round to well under this

// The site's modules import from "/js/...", which means the site root, not the disk's
register("data:text/javascript," + encodeURIComponent(
  `export async function resolve(s, c, next) { return s.startsWith("/js/") ? { url: new URL("." + s, ${JSON.stringify(BASE)}).href, shortCircuit: true } : next(s, c); }`));

// Just enough page for the room's painted textures and three.js's image loader: every 2D call does nothing
const context2d = () => new Proxy({}, {
  get: (t, k) => (k in t ? t[k]
    : k === "createImageData" || k === "getImageData" ? (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) })
    : k === "measureText" ? () => ({ width: 0 })
    : k.startsWith?.("create") ? () => ({ addColorStop() {} })
    : () => {}),
  set: (t, k, v) => { t[k] = v; return true; },
});
const element = () => ({ width: 0, height: 0, style: {}, getContext: context2d, addEventListener() {}, removeEventListener() {} });
globalThis.document = { createElement: element, createElementNS: element };

const problems = [];
const fail = (msg) => problems.push(msg);

// World-space vertex count and bounds of a mesh
function measure(T, mesh) {
  const pos = mesh.geometry.attributes.position, v = new T.Vector3();
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
    [v.x, v.y, v.z].forEach((x, k) => { lo[k] = Math.min(lo[k], x); hi[k] = Math.max(hi[k], x); });
  }
  return { count: pos.count, lo, hi };
}

function parse(T, file) {
  const buf = fs.readFileSync(path.join(SITE, file));
  return new Promise((done, failed) => new T.GLTFLoader().parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), "", done, failed));
}

async function room(T) {
  const { furnish } = await import(BASE + "js/white-rabbit-room.js");
  const scene = new T.Scene();
  // The same arguments white-rabbit-scene.js passes on a desktop
  furnish(scene, { win: { z: 0.6, y: 1.45, w: 1.2, h: 1.3 }, sc: new T.Vector3(0, 0.51, -1.775), sw: 0.48, sh: 0.36, env: null, touch: false });
  scene.updateMatrixWorld(true);
  const targets = new Map();
  scene.traverse((o) => { if (o.isMesh && o.userData.bake) targets.set(o.name, o); });

  const before = problems.length;
  const gltf = await parse(T, "media/white-rabbit/room.glb");
  gltf.scene.updateMatrixWorld(true);
  const shipped = new Set(), inModel = new Set();
  gltf.scene.traverse((o) => {
    if (!o.isMesh) return;
    inModel.add(o.name);
    const t = targets.get(o.name);
    if (!t) return fail(`room.glb ${o.name}: no baked mesh of that name in js/white-rabbit-room.js`);
    const a = measure(T, o), b = measure(T, t);
    if (a.count !== b.count) fail(`room.glb ${o.name}: ${a.count} vertices, but the room builds it with ${b.count}`);
    const off = Math.max(...a.lo.map((x, k) => Math.abs(x - b.lo[k])), ...a.hi.map((x, k) => Math.abs(x - b.hi[k])));
    if (off > TOLERANCE) fail(`room.glb ${o.name}: bounds are ${off.toFixed(3)} m from the room's mesh of that name (build order changed?)`);
    // Every mesh ships its map (scripts/assets.json expects one per node), though the carved sign's face never loads it
    shipped.add(`${o.name}.webp`);
    if (!fs.existsSync(path.join(LM, `${o.name}.webp`))) fail(`lm/${o.name}.webp: missing for room.glb's ${o.name}`);
  });

  // Baked targets the model doesn't carry take per-vertex occlusion instead
  for (const [name, t] of targets) {
    if (inModel.has(name)) continue;
    shipped.add(`${name}.ao`);
    const file = path.join(LM, `${name}.ao`);
    if (!fs.existsSync(file)) { fail(`lm/${name}.ao: missing for ${name}, a baked mesh not in room.glb`); continue; }
    const n = t.geometry.attributes.position.count, bytes = fs.statSync(file).size;
    if (bytes !== n) fail(`lm/${name}.ao: ${bytes} bytes, but ${name} has ${n} vertices`);
  }
  for (const f of fs.readdirSync(LM)) if (!shipped.has(f)) fail(`lm/${f}: no mesh uses it`);
  if (problems.length === before) console.log(`models: room.glb's ${inModel.size} meshes and ${targets.size - inModel.size} per-vertex maps match the room's build`);
}

async function car(T) {
  const source = fs.readFileSync(path.join(SITE, "js/white-rabbit-car.js"), "utf8");
  const m = source.match(/const mats = \{([^}]*)\}/);
  if (!m) return fail('js/white-rabbit-car.js: no "const mats = { ... }" to read the material names from; update this check with it');
  const known = new Set(m[1].split(",").map((s) => s.split(":")[0].trim()).filter(Boolean));
  for (const file of ["media/white-rabbit/car.glb", "media/white-rabbit/car-lite.glb"]) {
    const gltf = await parse(T, file), names = new Set(), before = problems.length;
    let wheels = 0;
    gltf.scene.children.forEach((o) => { if (o.name.startsWith("wheel-")) wheels++; });
    gltf.scene.traverse((o) => { if (o.isMesh) names.add(o.material.name); });
    for (const n of names) if (!known.has(n)) fail(`${file}: material "${n}" is not one js/white-rabbit-car.js maps`);
    if (!wheels) fail(`${file}: no wheel-* parts, so the wheels would ride the body's rumble`);
    if (problems.length === before) console.log(`models: ${path.basename(file)}'s ${names.size} materials are all mapped, ${wheels} wheel parts`);
  }
}

(async () => {
  const T = await import(BASE + "js/vendor/three-0.187.0.rabbit.min.js");
  await room(T);
  await car(T);
  if (problems.length) { console.error(problems.join("\n")); process.exit(1); }
})().catch((e) => { console.error(`models: ${e.stack || e}`); process.exit(1); });
