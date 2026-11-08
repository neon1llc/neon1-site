// src/app/public/js/white-rabbit-scene.js - The white rabbit's 3D scene: out of the TV and up to the window.
// Usage: const scene = createScene({ onLost }); await scene.compose(); scene.render(p)
//
// Imported by white-rabbit.js only after a catch, with three.js behind it. The
// still landing becomes the picture on an old CRT. Progress 0 frames that picture
// exactly as the page showed it, so the hand-off has no jump; progress 1 is the
// window, the sun, and a white-out. Everything is built in code: no images or models.

import * as T from "/js/vendor/three-0.187.0.rabbit.min.js";
import { createSky, createShafts, LIGHT } from "/js/white-rabbit-sky.js";
import { furnish } from "/js/white-rabbit-room.js";
import { createCar, unpacked } from "/js/white-rabbit-car.js";


// The white-out, the floor's bounce light, the landing's void, and where the screen sits
// (meters; the floor is y 0, the TV faces +z; the room itself is built in white-rabbit-room.js)
const PAPER = "#F2F4F2", FLOOR = "#D9CDB8", VOID = "#0D0208";
const SW = 0.48, SH = 0.36;                  // screen size
const SC = new T.Vector3(0, 0.51, -1.775);  // screen center
const WINDOW = { z: 0.6, y: 1.45, w: 1.2, h: 1.3 };

// Beats: progress, then camera position and look target; B0 to B2 are filled in from the picture's fit
const KEYS = [0, 0.12, 0.28, 0.40, 0.60, 0.82, 0.94, 1];
const FOV = [40, 40, 44, 50, 55, 52, 48, 48];
const LOOK = [SC, SC, SC, [0, 0.5, -1.8], [0, 0.45, -2.0], [-2.0, 1.45, 0.7], [-2.0, 1.75, 0.6], [-2.0, 1.9, 0.6]];
const POS_ROOM = [[0, 0.52, -0.9], [0.1, 0.55, 0.3], [0.5, 0.95, 1.6], [0.6, 1.0, 2.0]];

// Piecewise smooth interpolation through [progress, value] pairs, flat outside them
function ramp(p, pts) {
  if (p <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    const [p1, v1] = pts[i];
    if (p <= p1) {
      const [p0, v0] = pts[i - 1], t = (p - p0) / (p1 - p0 || 1);
      return v0 + (v1 - v0) * t * t * (3 - 2 * t);
    }
  }
  return pts[pts.length - 1][1];
}


// ---- Shaders ----
// Screen: the CRT look in the screen's own UVs, so it holds up close and across the room
const SCREEN_VERT = /* glsl */`
  uniform float uGeoBulge;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec2 c = position.xy / vec2(${SW / 2}, ${SH / 2});
    vec3 p = position;
    p.z += uGeoBulge * 0.025 * max(0.0, 1.0 - 0.5 * dot(c, c));
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }`;

const SCREEN_FRAG = /* glsl */`
  uniform sampler2D uMap;
  uniform float uBulge, uRipple, uRippleT, uAberr, uScan, uScanCount, uRoll, uSnow, uCorner, uVignette, uPower, uTime;
  varying vec2 vUv;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  vec3 spectral(float x) { return 0.5 + 0.5 * cos(6.2832 * (x + vec3(0.0, 0.33, 0.67))); }
  void main() {
    // Convex bulge, then ripple rings spreading from the center
    vec2 c = vUv * 2.0 - 1.0;
    vec2 s = c;
    c *= 1.0 + uBulge * dot(c, c);
    float d = length(c);
    c += normalize(c + 1e-5) * sin(d * 38.0 - uRippleT * 6.0) * uRipple * (1.0 - min(d, 1.0));
    vec2 uv = c * 0.5 + 0.5;

    // One rolling tear band, then the color fringe
    uv.x += uRoll * step(abs(uv.y - fract(1.0 - uTime * 0.35)), 0.04) * 0.02;
    vec2 o = (uv - 0.5) * uAberr;
    vec3 col = vec3(texture2D(uMap, uv + o).r, texture2D(uMap, uv).g, texture2D(uMap, uv - o).b);
    col *= step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);

    // Scanlines fade out once a line is thinner than about a pixel, so they never shimmer
    float line = 0.5 + 0.5 * sin(uv.y * uScanCount * 6.2832);
    float fade = 1.0 - smoothstep(0.4, 1.0, fwidth(uv.y * uScanCount));
    col *= 1.0 - uScan * fade * (1.0 - line);

    // Ripple rainbow, snow, inner vignette, and brightness
    col += uRipple * 18.0 * spectral(d * 3.0 - uRippleT * 0.2) * max(0.0, sin(d * 38.0 - uRippleT * 6.0)) * col;
    float n = hash(floor(vUv * vec2(320.0, 240.0)) + fract(uTime * 7.0) * 91.0);
    col = mix(col, vec3(n * 0.8), uSnow);
    col *= 1.0 - uVignette * smoothstep(0.5, 1.45, length(s));
    col *= uPower;

    // Rounded corners of the tube: dark glass outside them
    vec2 q = abs(s * vec2(${SW / 2}, ${SH / 2})) - vec2(${SW / 2}, ${SH / 2}) + uCorner;
    float sd = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - uCorner;
    col = mix(col, vec3(0.006, 0.007, 0.005), smoothstep(-0.003, 0.0, sd) * step(0.0001, uCorner));
    gl_FragColor = vec4(col, 1.0);
  }`;

// Glass: the window reflected as a soft diagonal band, a bright spot up high, and a sheen toward the rim
const GLASS_FRAG = /* glsl */`
  uniform float uStrength;
  varying vec2 vUv;
  void main() {
    vec2 c = vUv * 2.0 - 1.0;
    float band = smoothstep(0.22, 0.0, abs(vUv.x * 0.8 - vUv.y + 0.35)) * 0.7;
    float spot = exp(-dot(c - vec2(-0.45, 0.5), c - vec2(-0.45, 0.5)) * 9.0) * 1.6;
    float edge = smoothstep(0.55, 1.1, length(c));
    gl_FragColor = vec4(vec3(0.85, 0.92, 1.0) * uStrength * (band + spot + edge), 1.0);
  }`;

// Grade: grain, outer vignette, exposure, the room's warm or cool tint, a filmic curve for the lit room, and the white-out
const GRADE = {
  uniforms: {
    tDiffuse: { value: null }, uGrain: { value: 0 }, uVignette: { value: 0 }, uExposure: { value: 1 },
    uTone: { value: 0 }, uWhite: { value: 0 }, uTime: { value: 0 }, uPaper: { value: new T.Color(PAPER) },
    uTint: { value: new T.Vector3(1, 1, 1) },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float uGrain, uVignette, uExposure, uTone, uWhite, uTime;
    uniform vec3 uPaper, uTint;
    varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
    void main() {
      vec4 t = texture2D(tDiffuse, vUv);
      vec3 c = t.rgb * uExposure * uTint;
      c = mix(c, aces(c * 0.9), uTone);
      c += (hash(vUv * 1000.0 + fract(uTime) * 100.0) - 0.5) * uGrain;
      c *= 1.0 - uVignette * smoothstep(0.35, 0.95, distance(vUv, vec2(0.5)));
      gl_FragColor = vec4(mix(c, uPaper, uWhite), t.a);
    }`,
};


// ---- The landing as a picture ----
// Opacity an element really shows with, through its ancestors
function opacity(el) {
  let a = 1;
  for (let e = el; e && e.nodeType === 1; e = e.parentElement) a *= +getComputedStyle(e).opacity;
  return a;
}

// CSS text-shadow layers as [color, x, y, blur]
function shadows(cs) {
  const out = [], re = /(rgba?\([^)]*\)|#[0-9a-f]+)\s+(-?[\d.]+)px\s+(-?[\d.]+)px(?:\s+([\d.]+)px)?/gi;
  for (let m; (m = re.exec(cs.textShadow));) out.push([m[1], +m[2], +m[3], +(m[4] || 0)]);
  return out;
}

// Paints an element's box, SVG icons, and words where the page shows them; s is page px to picture px
async function paint(g, el, s, alpha) {
  const cs = getComputedStyle(el);
  if (cs.display === "none") return;
  alpha *= +cs.opacity;
  const r = el.getBoundingClientRect();
  if (!r.width || !r.height || alpha < 0.01) return;

  // Background and border on one rounded box
  const radius = parseFloat(cs.borderTopLeftRadius) || 0, bw = parseFloat(cs.borderTopWidth) || 0;
  g.globalAlpha = alpha;
  if (!/rgba\(.*, 0\)|transparent/.test(cs.backgroundColor)) {
    g.fillStyle = cs.backgroundColor; g.beginPath(); g.roundRect(r.left, r.top, r.width, r.height, radius); g.fill();
  }
  if (bw && cs.borderTopStyle !== "none" && !/rgba\(.*, 0\)/.test(cs.borderTopColor)) {
    g.strokeStyle = cs.borderTopColor; g.lineWidth = bw;
    g.beginPath(); g.roundRect(r.left + bw / 2, r.top + bw / 2, r.width - bw, r.height - bw, Math.max(0, radius - bw / 2)); g.stroke();
  }

  // An inline SVG becomes an image in its own color
  if (el instanceof SVGSVGElement) {
    const copy = el.cloneNode(true);
    copy.setAttribute("width", r.width); copy.setAttribute("height", r.height);
    copy.setAttribute("color", cs.color); copy.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    const img = new Image();
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(new XMLSerializer().serializeToString(copy));
    try { await img.decode(); g.globalAlpha = alpha; g.drawImage(img, r.left, r.top, r.width, r.height); } catch { /* the icon is left out */ }
    return;
  }

  // Words: each placed by its own range, so wrapped lines land where the page put them
  for (const node of el.childNodes) {
    if (node.nodeType === 1) { await paint(g, node, s, alpha); continue; }
    if (node.nodeType !== 3 || !node.textContent.trim()) continue;
    g.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    if ("letterSpacing" in g) g.letterSpacing = cs.letterSpacing === "normal" ? "0px" : cs.letterSpacing;
    g.textBaseline = "alphabetic"; g.textAlign = "left";
    const range = document.createRange(), glow = shadows(cs);
    for (const m of node.textContent.matchAll(/\S+/g)) {
      range.setStart(node, m.index); range.setEnd(node, m.index + m[0].length);
      const box = range.getBoundingClientRect(), met = g.measureText(m[0]);
      const asc = met.fontBoundingBoxAscent, desc = met.fontBoundingBoxDescent;
      const y = box.top + (box.height - asc - desc) / 2 + asc;
      // Glow layers alone: the text is drawn far away and only its shadow lands here
      for (const [color, ox, oy, blur] of glow) {
        g.save(); g.globalAlpha = alpha; g.fillStyle = "#000";
        g.shadowColor = color; g.shadowBlur = blur * s; g.shadowOffsetX = 10000 * s + ox * s; g.shadowOffsetY = oy * s;
        g.fillText(m[0], box.left - 10000, y); g.restore();
      }
      g.globalAlpha = alpha; g.fillStyle = cs.color; g.fillText(m[0], box.left, y);
    }
  }
}

// Draws the landing into a 4:3 picture: rain, lens, veil, then the header, hero, and controls
// Bands around a viewport of another shape repeat the rain mirrored and darker; the bezel hides the seams
async function picture(out) {
  const W = innerWidth, H = innerHeight;
  const long = Math.min(2048, Math.round(Math.max(W, H) * (devicePixelRatio || 1)));
  out.width = long; out.height = Math.round(long * 0.75);
  const cw = out.width, ch = out.height, s = Math.min(cw / W, ch / H);
  const rw = W * s, rh = H * s, rx = (cw - rw) / 2, ry = (ch - rh) / 2;
  const g = out.getContext("2d");
  const rain = document.getElementById("rain"), lens = document.getElementById("lens"), veil = document.querySelector(".veil");
  const ra = +getComputedStyle(rain).opacity;
  g.fillStyle = VOID; g.fillRect(0, 0, cw, ch);

  // Mirrored bands on either side, or above and below
  g.globalAlpha = ra;
  for (const k of [-1, 1]) {
    g.save();
    if (rx > 0) { g.translate(k < 0 ? rx : rx + 2 * rw, ry); g.scale(-1, 1); }
    else { g.translate(rx, k < 0 ? ry : ry + 2 * rh); g.scale(1, -1); }
    g.drawImage(rain, 0, 0, rw, rh);
    g.restore();
  }
  g.globalAlpha = 1; g.fillStyle = "rgba(13, 2, 8, .3)"; g.fillRect(0, 0, cw, ch);

  // The viewport itself, in page px from here on
  g.save();
  g.beginPath(); g.rect(rx, ry, rw, rh); g.clip();
  g.setTransform(s, 0, 0, s, rx, ry);
  g.fillStyle = VOID; g.fillRect(0, 0, W, H);
  g.globalAlpha = ra; g.drawImage(rain, 0, 0, W, H);
  g.globalAlpha = +getComputedStyle(lens).opacity; g.drawImage(lens, 0, 0, W, H);

  // The veil: an ellipse 70% by 45% of the screen at 50% 48%, dark at the middle
  g.globalAlpha = +getComputedStyle(veil).opacity;
  g.save();
  g.translate(W * 0.5, H * 0.48); g.scale(W * 0.7, H * 0.45);
  const v = g.createRadialGradient(0, 0, 0, 0, 0, 1);
  v.addColorStop(0, "rgba(13,2,8,.6)"); v.addColorStop(0.75, "rgba(13,2,8,.15)"); v.addColorStop(1, "rgba(13,2,8,.15)");
  g.fillStyle = v; g.fillRect(-W, -H, W * 3, H * 3);
  g.restore();

  // What sits on top of the rain
  for (const el of document.querySelectorAll("header, .hero, .rainctl")) await paint(g, el, s, opacity(el.parentElement));
  g.restore();
  return { cw, ch, rw, rh };
}


// A small blurred environment map of the room for reflections: pale walls, a darker floor, a soft
// ceiling, and the bright window on the left wall, seen from beside the TV. Drawn once
function environment(renderer) {
  const env = new T.Scene(), pm = new T.PMREMGenerator(renderer), stuff = [];
  const part = (geo, color, p, r = [0, 0, 0], back = false) => {
    const m = new T.Mesh(geo, new T.MeshBasicMaterial({ color: new T.Color(...color), side: back ? T.BackSide : T.DoubleSide, toneMapped: false }));
    m.position.set(...p); m.rotation.set(...r); env.add(m); stuff.push(m);
  };
  part(new T.BoxGeometry(4, 2.6, 5), [0.62, 0.61, 0.58], [0, 1.3, 0], [0, 0, 0], true);
  part(new T.PlaneGeometry(4, 5), [0.36, 0.3, 0.24], [0, 0.01, 0], [-Math.PI / 2, 0, 0]);
  part(new T.PlaneGeometry(1.2, 1.3), [7, 6.8, 6.2], [-1.98, 1.45, 0.6], [0, Math.PI / 2, 0]);
  part(new T.PlaneGeometry(1.6, 1.6), [1.1, 1.1, 1.08], [0, 2.58, 0], [Math.PI / 2, 0, 0]);
  const tex = pm.fromScene(env, 0.03, 0.05, 20, { size: 128, position: new T.Vector3(0, 0.6, -1.2) }).texture;
  stuff.forEach((m) => { m.geometry.dispose(); m.material.dispose(); });
  pm.dispose();
  return tex;
}


// The car's reflections: a deep blue dome over dark ground with a bright band at the horizon, and
// the window's glow, so the clear coat stays black but draws a crisp line along the shoulder
function outdoors(renderer) {
  const env = new T.Scene(), pm = new T.PMREMGenerator(renderer), stuff = [];
  const part = (geo, color, p, r = [0, 0, 0]) => {
    const m = new T.Mesh(geo, new T.MeshBasicMaterial({ color: new T.Color(...color), side: T.BackSide, toneMapped: false }));
    m.position.set(...p); m.rotation.set(...r); env.add(m); stuff.push(m);
  };
  part(new T.SphereGeometry(10, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), [0.22, 0.28, 0.4], [0, 0, 0]);
  part(new T.CylinderGeometry(9.8, 9.8, 1.6, 32, 1, true), [2.2, 2.3, 2.4], [0, 0.9, 0]);
  part(new T.SphereGeometry(10, 24, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), [0.05, 0.045, 0.04], [0, 0, 0]);
  part(new T.PlaneGeometry(3, 3), [9, 8.6, 7.6], [-9.5, 2.5, -2], [0, Math.PI / 2, 0]);
  const tex = pm.fromScene(env, 0.01, 0.1, 30, { size: 128 }).texture;
  stuff.forEach((m) => { m.geometry.dispose(); m.material.dispose(); });
  pm.dispose();
  return tex;
}


/**
 * Builds the scene on a new canvas in #whiteRabbit; throws without WebGL. onLost() runs if the
 * context goes; onSound(kind) hears the car on the sill ("click", "crank", "fire", "stop")
 */
export function createScene({ onLost, onSound = () => {} }) {
  const root = document.getElementById("whiteRabbit");
  const touch = matchMedia("(pointer: coarse)").matches;
  let ratio = Math.min(devicePixelRatio || 1, touch ? 1.5 : 2);
  let disposed = false, bloomOn = !touch;

  // Renderer on its own canvas, so a later catch can start a fresh context
  const canvas = document.createElement("canvas");
  canvas.className = "white-rabbit-gl";
  canvas.setAttribute("aria-hidden", "true");
  const renderer = new T.WebGLRenderer({ canvas, antialias: !touch, powerPreference: "high-performance" });
  root.prepend(canvas);
  canvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); if (!disposed) onLost(); });
  renderer.setPixelRatio(ratio);
  renderer.setSize(innerWidth, innerHeight, false);

  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(40, innerWidth / innerHeight, 0.02, 5000);

  // ---- Sky, sun, and clouds, seen only through the window ----
  const sky = createSky({ scene, win: WINDOW, touch });

  // ---- The room, the TV around its screen, the table, and the chairs ----
  const env = environment(renderer);
  const { glossy, ready: photos, pile } = furnish(scene, { win: WINDOW, sc: SC, sw: SW, sh: SH, env, touch });

  // Baked light: the room's lit meshes take geometry with a second UV map from room.glb and a baked
  // occlusion map on it (made by blender/room.py from this same build); the painted stand-in
  // contact shadows go once it is in. If it fails, the room simply stays as built
  const bakedTextures = [];
  const baked = new Promise((done) => new T.GLTFLoader().load("/media/white-rabbit/room.glb", (gltf) => {
    gltf.scene.updateMatrixWorld(true);
    const byName = new Map();
    scene.traverse((o) => { if (o.isMesh && o.userData.bake) byName.set(o.name, o); });
    const loader = new T.TextureLoader();
    gltf.scene.traverse((o) => {
      const target = o.isMesh && byName.get(o.name);
      if (!target) return;
      const g = unpacked(o.geometry).applyMatrix4(o.matrixWorld);
      o.geometry.dispose(); target.geometry.dispose(); target.geometry = g;
      // The carved sign's face keeps its full light, so the letters stay legible on the window wall
      if (target.material.alphaTest > 0) return;
      const t = loader.load(`/media/white-rabbit/lm/${o.name}.webp`);
      t.channel = 1; t.flipY = false; bakedTextures.push(t);
      target.material.aoMap = t; target.material.aoMapIntensity = 0.8; target.material.needsUpdate = true;
    });
    scene.traverse((o) => { if (o.userData.standIn) o.visible = false; });
    renderer.shadowMap.needsUpdate = true;
    // The chairs are too dense to ship twice: their occlusion comes as one byte per vertex, in the
    // same order as their geometry, and darkens the vertex colors they already carry
    const dense = [...byName.values()].filter((m) => !m.geometry.attributes.uv1);
    Promise.all(dense.map((m) => fetch(`/media/white-rabbit/lm/${m.name}.ao`).then((r) => (r.ok ? r.arrayBuffer() : null)).then((buf) => {
      const ao = buf && new Uint8Array(buf), col = m.geometry.attributes.color, n = m.geometry.attributes.position.count;
      if (!ao || ao.length !== n || !col) return;
      for (let i = 0; i < n; i++) col.setXYZ(i, col.getX(i) * ao[i] / 255, col.getY(i) * ao[i] / 255, col.getZ(i) * ao[i] / 255);
      col.needsUpdate = true;
    }).catch(() => {}))).then(done);
  }, undefined, () => done())).then(pile);

  // The model car on the sill, nose turned a little toward the room, kept inside the glass
  const carEnv = outdoors(renderer);
  const car = createCar({ scene, env: carEnv, at: { p: [-1.872, WINDOW.y - WINDOW.h / 2 + 0.028, 0.9], turn: 0.1, scale: 1.25, lite: touch }, onSound });
  sky.block(...car.box);

  // Screen and glass, both curved by the same bulge
  const screenU = {
    uMap: { value: null }, uBulge: { value: 0 }, uGeoBulge: { value: 0 }, uRipple: { value: 0 }, uRippleT: { value: 0 },
    uAberr: { value: 0 }, uScan: { value: 0 }, uScanCount: { value: 480 }, uRoll: { value: 0 }, uSnow: { value: 0 },
    uCorner: { value: 0 }, uVignette: { value: 0 }, uPower: { value: 1 }, uTime: { value: 0 },
  };
  const screenGeo = new T.PlaneGeometry(SW, SH, 48, 36);
  const screen = new T.Mesh(screenGeo, new T.ShaderMaterial({ uniforms: screenU, vertexShader: SCREEN_VERT, fragmentShader: SCREEN_FRAG }));
  screen.position.copy(SC); scene.add(screen);
  const glassU = { uGeoBulge: screenU.uGeoBulge, uStrength: { value: 0 } };
  const glass = new T.Mesh(screenGeo, new T.ShaderMaterial({
    uniforms: glassU, vertexShader: SCREEN_VERT, fragmentShader: GLASS_FRAG,
    transparent: true, blending: T.AdditiveBlending, depthWrite: false,
  }));
  glass.position.copy(SC).add(new T.Vector3(0, 0, 0.002)); scene.add(glass);

  // ---- Lights, and the colors the room shifts between as the sun comes and goes ----
  const COOL = new T.Color("#D8E2F0"), WARM = new T.Color("#F6EEE2");
  const WHITE = new T.Vector3(1, 1, 1), TINT_COOL = new T.Vector3(0.95, 0.98, 1.03), TINT_WARM = new T.Vector3(1.05, 1.0, 0.93);
  const hemi = new T.HemisphereLight("#E6F0F8", FLOOR, 0);
  const sun = new T.DirectionalLight("#FFE2B0", 0);
  // The sun casts the room's one set of shadows; the room doesn't move, so they're drawn once
  sun.position.set(0, 1, 0.5).addScaledVector(LIGHT, 8);
  sun.target.position.set(0, 1, 0.5);
  sun.castShadow = true;
  sun.shadow.mapSize.setScalar(touch ? 512 : 1024);
  Object.assign(sun.shadow.camera, { left: -3.4, right: 3.4, top: 3.4, bottom: -3.4, near: 1, far: 18 });
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.025;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  scene.add(sun.target);
  // Skylight from the window falls across the set from the front left, so the knobs, bezel, and
  // feet throw small shadows to the right; its own small shadow map covers only the TV and table
  const fill = new T.DirectionalLight("#EEF3FA", 0);
  fill.target.position.set(SC.x + 0.06, 0.4, SC.z - 0.1);
  fill.position.copy(fill.target.position).add(new T.Vector3(-1.95, 0.95, 2.2).normalize().multiplyScalar(3));
  fill.castShadow = true;
  fill.shadow.mapSize.setScalar(touch ? 512 : 1024);
  Object.assign(fill.shadow.camera, { left: -1.1, right: 1.1, top: 1, bottom: -0.7, near: 1, far: 6 });
  fill.shadow.camera.updateProjectionMatrix();
  fill.shadow.bias = -0.0001; fill.shadow.normalBias = 0.001; fill.shadow.radius = 2;
  scene.add(fill, fill.target);
  const glow = new T.PointLight("#6CFFA8", 0, 2.5, 2);
  glow.position.set(0, SC.y, -1.55);
  scene.add(hemi, sun, glow);

  // ---- Postprocessing: the scene, light shafts, bloom on desktops, the grade, then sRGB output ----
  const composer = new T.EffectComposer(renderer, new T.WebGLRenderTarget(1, 1, { type: T.HalfFloatType, samples: touch ? 0 : 4 }));
  composer.addPass(new T.RenderPass(scene, camera));
  const shafts = createShafts({ touch });
  composer.addPass(shafts);
  const bloom = new T.UnrealBloomPass(new T.Vector2(innerWidth / 2, innerHeight / 2), 0, 0.2, 2.5);
  bloom.enabled = false;
  composer.addPass(bloom);
  const grade = new T.ShaderPass(GRADE);
  composer.addPass(grade);
  composer.addPass(new T.OutputPass());

  // ---- The picture and its fit ----
  // fit: the viewport's share of the picture, and the distance that fills the view with it
  const pic = document.createElement("canvas");
  let tex = null, fit = { h: SH, d0: 0.5 };
  async function compose() {
    const [{ cw, ch, rh }] = await Promise.all([picture(pic), sky.ready, car.ready, baked, photos]);
    if (disposed) return;
    if (!tex || tex.image.width !== cw || tex.image.height !== ch) {
      if (tex) tex.dispose();
      tex = new T.CanvasTexture(pic);
      tex.colorSpace = T.SRGBColorSpace; tex.minFilter = tex.magFilter = T.LinearFilter; tex.generateMipmaps = false;
      screenU.uMap.value = tex;
    }
    tex.needsUpdate = true;
    const h = (SH * rh) / ch;
    fit = { h, d0: h / 2 / Math.tan(T.MathUtils.degToRad(20)), lines: (innerHeight * ratio * ch) / rh };
    path();
  }

  // Camera curves through the beats; portrait screens sit further back and see wider in the room
  let posCurve = null, lookCurve = null;
  function path() {
    const sz = SC.z, d0 = fit.d0;
    const pos = [[0, SC.y, sz + d0], [0, SC.y, sz + d0 + 0.05], [0, SC.y, sz + Math.max(0.62, d0 + 0.2)], ...POS_ROOM];
    const end = new T.Vector3(...POS_ROOM[3]), toWin = new T.Vector3(...LOOK[7]).sub(end).normalize();
    pos.push(end.clone().addScaledVector(toWin, 0.15).toArray());
    const v = (a) => (a.isVector3 ? a.clone() : new T.Vector3(...a));
    posCurve = new T.CatmullRomCurve3(pos.map(v), false, "centripetal");
    lookCurve = new T.CatmullRomCurve3(LOOK.map(v), false, "centripetal");
    screenU.uScanCount.value = Math.round(fit.lines / 3);
  }

  // Curve parameter for progress: each beat gets its own share of the scroll
  function along(p) {
    let i = 0;
    while (i < KEYS.length - 2 && p > KEYS[i + 1]) i++;
    const t = Math.min(1, Math.max(0, (p - KEYS[i]) / (KEYS[i + 1] - KEYS[i])));
    return (i + t) / (KEYS.length - 1);
  }

  // ---- One frame ----
  const P = new T.Vector3(), L = new T.Vector3(), D = new T.Vector3();
  let frames = 0, spent = 0, lastFrame = 0, prev = 0, facing = 1;
  function render(p, { speed = 0, still = false } = {}) {
    if (disposed || !posCurve) return;
    const now = performance.now(), time = now / 1000, dt = prev ? (now - prev) / 1000 : 0;
    prev = now;
    const aspect = innerWidth / innerHeight, u = along(p);

    // Camera: curve, portrait widening and pull-back, a little handheld sway, and the room's walls
    posCurve.getPoint(u, P); lookCurve.getPoint(u, L);
    let fov = ramp(p, KEYS.map((k, i) => [k, FOV[i]]));
    const wide = T.MathUtils.radToDeg(2 * Math.atan(Math.tan(T.MathUtils.degToRad(19)) / aspect));
    fov += (Math.max(fov, wide) - fov) * ramp(p, [[0.28, 0], [0.45, 1]]);
    const back = Math.max(0, 0.9 / aspect - 0.9) * ramp(p, [[0.3, 0], [0.5, 1]]);
    D.subVectors(P, L).normalize();
    P.addScaledVector(D, back);
    if (!still) {
      const sway = Math.min(1, speed * 3);
      P.x += Math.sin(time * 1.3) * 0.003 * sway; P.y += Math.sin(time * 0.9 + 1) * 0.002 * sway;
      L.x += Math.sin(time * 0.7) * 0.0026 * P.distanceTo(L) * sway;
    }
    P.set(T.MathUtils.clamp(P.x, -1.85, 1.85), T.MathUtils.clamp(P.y, 0.2, 2.4), T.MathUtils.clamp(P.z, -2.35, 2.35));
    camera.position.copy(P); camera.lookAt(L);
    camera.fov = fov; camera.aspect = aspect; camera.updateProjectionMatrix();
    // How squarely and closely the camera faces the set, for the sound of its hum
    camera.getWorldDirection(D);
    const toSet = L.copy(SC).sub(camera.position), far = toSet.length();
    facing = Math.max(0, D.dot(toSet.divideScalar(far))) ** 2 * Math.min(1, 1.1 / (0.3 + far));

    // Screen: still at 0, then ripples, bulge and scanlines, the tube, and a little snow as the room appears
    screenU.uTime.value = time; screenU.uRippleT.value = time;
    screenU.uRipple.value = ramp(p, [[0, 0], [0.06, 0.012], [0.12, 0.004], [0.4, 0]]);
    screenU.uAberr.value = ramp(p, [[0, 0], [0.12, 0.004], [0.4, 0.004], [0.6, 0.002]]);
    screenU.uScan.value = ramp(p, [[0, 0], [0.12, 0.25], [0.28, 0.35]]);
    screenU.uBulge.value = ramp(p, [[0.12, 0], [0.28, 0.12]]);
    screenU.uGeoBulge.value = ramp(p, [[0.12, 0], [0.28, 1]]);
    screenU.uCorner.value = ramp(p, [[0.12, 0], [0.28, 0.035]]);
    screenU.uVignette.value = ramp(p, [[0.12, 0], [0.28, 0.5]]);
    screenU.uRoll.value = ramp(p, [[0.3, 0], [0.33, 1], [0.37, 0]]);
    screenU.uSnow.value = ramp(p, [[0.36, 0], [0.4, 0.15], [0.46, 0]]);
    screenU.uPower.value = ramp(p, [[0.28, 1], [0.6, 0.85]]);
    glassU.uStrength.value = ramp(p, [[0.12, 0], [0.4, 0.08], [0.6, 0.16], [0.82, 0.12]]);

    // Room light comes up as the room appears; then the sun, as the clouds let it, warms the room
    // and lays the window's panes on the floor, and the room cools again when a cloud covers it
    const light = ramp(p, [[0.12, 0], [0.28, 0.14], [0.4, 0.42], [0.6, 0.75], [0.82, 1]]);
    const room = ramp(p, [[0.4, 0], [0.6, 1]]);
    sky.update(dt, ramp(p, [[0.5, 0], [0.7, 1]]), ratio);
    const s = sky.sun;
    hemi.intensity = light * (0.62 + 0.15 * s) * ramp(p, [[0.55, 3.5], [0.86, 1.3]]); // the room dims a little as the window takes over
    hemi.color.copy(COOL).lerp(WARM, s);
    sun.intensity = light * (0.15 + 1.2 * s);
    fill.intensity = light * (0.55 + 0.35 * s);
    for (const [m, k] of glossy) m.envMapIntensity = k * light;
    car.update(time, light);
    glow.intensity = ramp(p, [[0, 0], [0.28, 0.6], [0.6, 0.3], [0.82, 0.2]]) * 0.02;
    grade.uniforms.uTint.value.copy(WHITE).lerp(TINT_COOL.clone().lerp(TINT_WARM, s), room);

    // Grade and bloom; both are off at 0 so the first frame matches the page
    grade.uniforms.uTime.value = time;
    grade.uniforms.uGrain.value = ramp(p, [[0, 0], [0.12, 0.015]]);
    grade.uniforms.uVignette.value = ramp(p, [[0.28, 0], [0.6, 0.25], [0.94, 0.1]]);
    grade.uniforms.uTone.value = ramp(p, [[0.12, 0], [0.4, 1]]);
    grade.uniforms.uExposure.value = ramp(p, [[0.4, 1], [0.58, 1.15], [0.82, 1.15], [0.94, 1.25], [1, 1.6]]); // brighter once out of the TV
    grade.uniforms.uWhite.value = ramp(p, [[0.94, 0], [0.985, 1]]);
    bloom.strength = bloomOn ? ramp(p, [[0.6, 0], [0.94, 0.12]]) : 0;
    bloom.enabled = bloom.strength > 0.001;
    sky.aim(camera, shafts, ramp(p, [[0.55, 0], [0.75, 1]]) * 0.55);
    composer.render();

    // Slow frames step the pixel ratio down, and bloom goes first
    if (!still && lastFrame) {
      spent += now - lastFrame; frames++;
      if (frames === 30) {
        if (spent / frames > 20 && ratio > 1) {
          ratio = ratio > 1.25 ? 1.25 : 1; bloomOn = false;
          renderer.setPixelRatio(ratio); composer.setPixelRatio(ratio); resize();
        }
        frames = 0; spent = 0;
      }
    }
    lastFrame = still ? 0 : now;
  }

  // True when the point (client px) lands on the car, which then starts or stops unless only looking
  const ray = new T.Raycaster(), ndc = new T.Vector2();
  function pick(x, y, look = false) {
    if (disposed || !posCurve) return false;
    const b = canvas.getBoundingClientRect();
    ndc.set(((x - b.left) / b.width) * 2 - 1, -((y - b.top) / b.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    return car.pick(ray, look);
  }

  // Fits the renderer to the window; the picture is redrawn by the caller
  function resize() {
    renderer.setSize(innerWidth, innerHeight, false);
    composer.setSize(innerWidth, innerHeight);
    bloom.setSize(innerWidth / 2, innerHeight / 2);
  }
  resize();

  // Frees every GPU resource the scene made, then the context and its canvas
  function dispose() {
    disposed = true;
    scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        for (const k of ["map", "normalMap", "alphaMap"]) if (o.material[k]) o.material[k].dispose();
        o.material.dispose();
      }
    });
    if (tex) tex.dispose();
    env.dispose(); carEnv.dispose(); sky.dispose(); car.dispose(); bakedTextures.forEach((t) => t.dispose());
    composer.passes.forEach((pass) => pass.dispose && pass.dispose());
    composer.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    canvas.remove();
  }

  return { compose, render, resize, dispose, pick, over: (x, y) => pick(x, y, true), get facing() { return facing; }, get wind() { return sky.wind; } };
}
