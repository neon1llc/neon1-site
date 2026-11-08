// src/app/public/js/white-rabbit-scene.js - The white rabbit's 3D scene: out of the TV and up to the window.
// Usage: const scene = createScene({ onLost }); await scene.compose(); scene.render(p)
//
// Imported by white-rabbit.js only after a catch, with three.js behind it. The
// still landing becomes the picture on an old CRT. Progress 0 frames that picture
// exactly as the page showed it, so the hand-off has no jump; progress 1 is the
// window, through it, and a white-out over the lakefront below.

import * as T from "/js/vendor/three-0.187.0.rabbit.min.js";
import { createSky, createShafts, LIGHT } from "/js/white-rabbit-sky.js";
import { furnish } from "/js/white-rabbit-room.js";
import { createCar, unpacked } from "/js/white-rabbit-car.js";
import { createWorld, SUNDIR } from "/js/white-rabbit-world.js";


// The white-out, the floor's bounce light, the landing's void, and where the screen sits
// (meters; the floor is y 0, the TV faces +z; the room itself is built in white-rabbit-room.js)
// Media is served with a year-long immutable cache, so every load asks for this release's copy by version
const VER = document.querySelector('meta[name="version"]')?.content || "0";
T.DefaultLoadingManager.setURLModifier((u) => (u.startsWith("/media/") ? `${u}?v=${VER}` : u));
const PAPER = "#F2F4F2", FLOOR = "#D9CDB8", VOID = "#0D0208";
const SW = 0.48, SH = 0.36;                  // screen size
const SC = new T.Vector3(0, 0.51, -1.775);  // screen center
const WINDOW = { z: 0.6, y: 1.45, w: 1.2, h: 1.3 };

// Beats, as a person would take them: out of the TV, then gliding back across the floor in one steady
// move, sitting the whole way, until the set and both chairs are in view; still sitting, turning slowly
// toward the window (through the sun, for a moment, right in the eyes) and settling on the sky and treetops;
// a pondering pause; getting up (the view dips and tilts, then rights itself); walking over with the bob
// of each step, glancing down at the car on the sill on the way, then squaring up to the window; a pause
// looking out; a step closer as the sash, already a little up, goes the rest of the way; a breath; and out
// through the opening into the white. Each is [progress, camera position, look target, vertical fov]; the
// first two positions are filled in from the picture's fit. Pauses are pairs of beats a hair apart
const BEATS = [
  [0, null, SC, 40], [0.09, null, SC, 44],                                                               // face right at the screen, hunched
  // then one steady glide back across the floor, still sitting the whole way, until the set and both chairs are in view
  [0.13, [0.03, 0.9, -1.32], [0, 0.56, -1.9], 48], [0.25, [0.47, 0.9, 0.14], [0.01, 0.56, -1.9], 51],
  [0.37, [0.91, 0.9, 1.6], [0.02, 0.56, -1.9], 54],
  [0.42, [0.92, 0.9, 1.6], [-0.86, 1.56, 0.88], 54],             // turning to the window: the sun in the eyes
  [0.46, [0.92, 0.9, 1.6], [-1.95, 1.3, 0.92], 54],              // past it, to the sky and treetops
  [0.51, [0.92, 0.91, 1.59], [-1.95, 1.33, 0.86], 54],           // watching the light and the dust
  [0.55, [0.85, 1.22, 1.55], [-1.9, 0.95, 0.9], 54],             // getting up: the view dips
  [0.59, [0.78, 1.6, 1.5], [-1.95, 1.4, 0.8], 52],               // up
  [0.64, [-0.3, 1.58, 1.62], [-1.87, 0.92, 0.9], 50],            // walking over, a glance at the car
  [0.68, [-0.62, 1.56, 1.05], [-1.95, 1.25, 0.72], 50],          // eyes back to the window
  [0.72, [-0.7, 1.55, 0.62], [-1.95, 1.38, 0.6], 50],            // square to it
  [0.79, [-0.72, 1.55, 0.6], [-1.95, 1.35, 0.6], 50],            // looking out
  [0.85, [-0.95, 1.5, 0.6], [-2.4, 1.2, 0.6], 50],               // a step closer, the sash going up (see OPEN)
  // then, with the sash all the way up: leaning left toward the car, looking right and down through the opening to
  // the concrete, the greenhouse, and the right fence; across to the right, looking left and down at the lawn,
  // the left border, and the stockade; and back to center, square to the window, gliding in until the frame is
  // gone and only the yard is ahead, held there before the white
  [0.875, [-1.5, 1.12, 1.0], [-5.5, 0.05, -2.0], 54], [0.885, [-1.51, 1.12, 1.0], [-5.5, 0.04, -2.03], 54],   // low, under the raised sash, looking out over the yard to the far trees and the water, both sides of the frame in view
  [0.915, [-1.5, 1.12, 0.2], [-5.5, 0.05, 3.3], 54], [0.925, [-1.51, 1.12, 0.2], [-5.5, 0.04, 3.33], 54],
  [0.945, [-1.55, 1.3, 0.6], [-3.1, 1.02, 0.6], 52],
  [0.97, [-2.37, 1.1, 0.62], [-3.6, 1.0, 0.6], 52],             // through the opening: the yard straight on
  [0.985, [-2.37, 1.1, 0.62], [-3.6, 1.0, 0.6], 52],            // held, before the white
  [1, [-2.37, 1.1, 0.62], [-3.6, 1.0, 0.6], 52],
];
const KEYS = BEATS.map((b) => b[0]), FOV = BEATS.map((b) => b[3]), LOOK = BEATS.map((b) => b[2]);
// The sash starts a little up and goes the rest of the way as the camera steps closer
const OPEN = [[0.79, 0.3], [0.85, 1]];
// Getting up tilts the view (counterclockwise, in radians), and the walk bobs with each step
const ROLL = [[0.51, 0], [0.55, 0.07], [0.58, -0.015], [0.6, 0]];
const WALK = [0.59, 0.72], STEPS = 7;
// The lighting, screen, and grade below were timed on an earlier, shorter walk; this maps progress
// onto that timeline (the room appearing, the window coming into view, the white-out)
const LEGACY = [[0, 0], [0.09, 0.28], [0.17, 0.4], [0.33, 0.6], [0.64, 0.82], [0.89, 0.94], [0.985, 0.95], [1, 1]];
// The scroll's whole span (q) runs the walk (its progress, pr) straight through to the yard, then holds the
// view outside for a pause of scrolling (HOLD), and the last stretch whitens
const HOLD = [0.94, 0.975];
function progress(q) {
  if (q <= HOLD[0]) return (q / HOLD[0]) * 0.97;
  if (q <= HOLD[1]) return 0.97 + ((q - HOLD[0]) / (HOLD[1] - HOLD[0])) * 0.015;
  return 0.985 + ((q - HOLD[1]) / (1 - HOLD[1])) * 0.015;
}
function linear(p, pts) {
  if (p <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) if (p <= pts[i][0]) { const [a, x] = pts[i - 1], [b, y] = pts[i]; return x + ((y - x) * (p - a)) / (b - a); }
  return pts[pts.length - 1][1];
}

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

// Glass: the tube's convex face reflecting the room. Its normal bows outward toward the rim (the face is
// a shallow dome, more curved than the bulge the picture takes), and each point reflects the view
// direction off it into a simple room: the window as a soft bright pane with its sash bars, a pale
// ceiling and walls, and a darker floor, weighted by Fresnel so the glare is faint face on and stronger
// at a slant. So the window's reflection is a small curved highlight that slides and stretches across
// the screen as the camera moves, never a fixed blotch
const GLASS_VERT = /* glsl */`
  uniform float uGeoBulge;
  varying vec3 vWorld, vNormal;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec2 c = position.xy / vec2(${SW / 2}, ${SH / 2});
    vec3 p = position;
    p.z += uGeoBulge * 0.025 * max(0.0, 1.0 - 0.5 * dot(c, c));
    vNormal = normalize(mat3(modelMatrix) * vec3(c.x * 0.3, c.y * 0.24, 1.0));
    vec4 w = modelMatrix * vec4(p, 1.0);
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;
const GLASS_FRAG = /* glsl */`
  uniform float uStrength;
  uniform vec3 uWin, uWinSize;
  varying vec3 vWorld, vNormal;
  varying vec2 vUv;
  void main() {
    vec3 n = normalize(vNormal), v = normalize(vWorld - cameraPosition), r = reflect(v, n);
    // Where the reflected ray meets the window wall (x = uWin.x), in the window's own across and up
    float t = (uWin.x - vWorld.x) / min(r.x, -1e-3);
    vec3 hit = vWorld + r * t;
    vec2 q = vec2((hit.z - uWin.z) / uWinSize.x, (hit.y - uWin.y) / uWinSize.y);
    float pane = (r.x < -0.05) ? smoothstep(0.62, 0.42, abs(q.x)) * smoothstep(0.62, 0.42, abs(q.y)) : 0.0;
    pane *= 1.0 - 0.55 * smoothstep(0.05, 0.0, abs(q.y - 0.2));   // the meeting rail, raised with the lower sash
    // The room around it: brighter above, dim below
    float room = 0.07 + 0.08 * smoothstep(-0.3, 0.8, r.y);
    // A broad, soft glow around the window's reflection, as the tube's glass is never a perfect mirror
    float halo = (r.x < -0.05) ? exp(-dot(q, q) * 1.6) * 0.32 : 0.0;
    float fres = 0.04 + 0.96 * pow(1.0 - max(0.0, dot(n, -v)), 5.0);
    float edge = smoothstep(0.75, 1.0, length(vUv * 2.0 - 1.0)) * 0.25;
    vec3 col = vec3(0.92, 0.96, 1.0) * (pane * 1.3 + halo + room + edge) * mix(0.35, 1.0, fres);
    gl_FragColor = vec4(col * uStrength * 2.2, 1.0);
  }`;

// Grade: grain, outer vignette, exposure, the room's warm or cool tint, a filmic curve for the lit room, and the white-out
const GRADE = {
  uniforms: {
    tDiffuse: { value: null }, uGrain: { value: 0 }, uVignette: { value: 0 }, uExposure: { value: 1 },
    uTone: { value: 0 }, uWhite: { value: 0 }, uTime: { value: 0 }, uPaper: { value: new T.Color(PAPER) },
    uTint: { value: new T.Vector3(1, 1, 1) }, uFlare: { value: new T.Vector3(0.5, 0.5, 0) }, uAspect: { value: 1 },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float uGrain, uVignette, uExposure, uTone, uWhite, uTime, uAspect;
    uniform vec3 uPaper, uTint, uFlare;
    varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
    void main() {
      vec4 t = texture2D(tDiffuse, vUv);
      vec3 c = t.rgb * uExposure * uTint;
      c = mix(c, aces(c * 0.9), uTone);
      c += (hash(vUv * 1000.0 + fract(uTime) * 100.0) - 0.5) * uGrain;
      c *= 1.0 - uVignette * smoothstep(0.35, 0.95, distance(vUv, vec2(0.5)));
      // The sun in your eyes: a hot core and a wide glow around it, a faint horizontal streak, a few
      // ghosts of the lens along the line through the middle, and a veil of light over everything
      if (uFlare.z > 0.001) {
        vec2 a = vec2(uAspect, 1.0), d = (vUv - uFlare.xy) * a;
        float r = length(d);
        vec3 warm = vec3(1.0, 0.9, 0.74);
        vec3 f = warm * (exp(-r * 30.0) * 2.2 + exp(-r * 7.0) * 0.55 + exp(-r * 2.2) * 0.18);
        f += warm * exp(-abs(d.y) * 160.0) * exp(-abs(d.x) * 4.0) * 0.28;
        for (int i = 1; i <= 3; i++) {
          vec2 gp = mix(uFlare.xy, vec2(0.5), 1.0 + float(i) * 0.45);
          float gr = length((vUv - gp) * a);
          f += vec3(0.55, 0.75, 1.0) * smoothstep(0.05 + 0.03 * float(i), 0.0, gr) * 0.06 / float(i);
        }
        c = c * (1.0 - 0.12 * uFlare.z) + f * uFlare.z + warm * 0.1 * uFlare.z;
      }
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
  part(new T.BoxGeometry(5.2, 2.6, 5), [0.62, 0.61, 0.58], [0.6, 1.3, 0], [0, 0, 0], true);
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
  const world = createWorld({ scene, touch });

  // ---- The room, the TV around its screen, the table, and the chairs ----
  const env = environment(renderer);
  const { glossy, ready: photos, pile, openWindow } = furnish(scene, { win: WINDOW, sc: SC, sw: SW, sh: SH, env, touch });

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
    Promise.all(dense.map((m) => fetch(`/media/white-rabbit/lm/${m.name}.ao?v=${VER}`).then((r) => (r.ok ? r.arrayBuffer() : null)).then((buf) => {
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
  const glassU = {
    uGeoBulge: screenU.uGeoBulge, uStrength: { value: 0 },
    uWin: { value: new T.Vector3(-1.99, WINDOW.y, WINDOW.z) }, uWinSize: { value: new T.Vector3(WINDOW.w, WINDOW.h, 0) },
  };
  const glass = new T.Mesh(screenGeo, new T.ShaderMaterial({
    uniforms: glassU, vertexShader: GLASS_VERT, fragmentShader: GLASS_FRAG,
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
    const [{ cw, ch, rh }] = await Promise.all([picture(pic), sky.ready, car.ready, baked, photos, world.ready]);
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
    const pos = [[0, SC.y, sz + d0], [0, SC.y, sz + Math.max(0.62, d0 + 0.2)], ...BEATS.slice(2).map((b) => b[1])];
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
  const P = new T.Vector3(), L = new T.Vector3(), D = new T.Vector3(), sunAt = new T.Vector3(), stirV = new T.Vector3(), lastCam = new T.Vector3();
  let frames = 0, spent = 0, lastFrame = 0, prev = 0, facing = 1, beat = 0, open = 0;
  function render(q, { speed = 0, still = false } = {}) {
    if (disposed || !posCurve) return;
    const pr = progress(q);
    const now = performance.now(), time = now / 1000, dt = prev ? (now - prev) / 1000 : 0;
    prev = now;
    // pr is the walk's progress; p is the same moment on the lighting's timeline (see LEGACY)
    const aspect = innerWidth / innerHeight, u = along(pr), p = linear(pr, LEGACY);
    beat = p;

    // Camera: curve, portrait widening and pull-back, a little handheld sway, and the room's walls
    // (only until the camera goes out through the window)
    posCurve.getPoint(u, P); lookCurve.getPoint(u, L);
    let fov = ramp(pr, KEYS.map((k, i) => [k, FOV[i]]));
    const wide = T.MathUtils.radToDeg(2 * Math.atan(Math.tan(T.MathUtils.degToRad(19)) / aspect));
    fov += (Math.max(fov, wide) - fov) * ramp(p, [[0.28, 0], [0.45, 1]]);
    // Wide screens: the view across is held to about 72 degrees, past which a flat picture stretches
    // whatever sits near its sides, like looking through a fishbowl
    const across = T.MathUtils.radToDeg(2 * Math.atan(Math.tan(T.MathUtils.degToRad(36)) / aspect));
    fov += (Math.min(fov, across) - fov) * ramp(p, [[0.12, 0], [0.28, 1]]);
    const back = Math.max(0, 0.9 / aspect - 0.9) * ramp(p, [[0.3, 0], [0.5, 1]]) * ramp(pr, [[0.84, 1], [0.94, 0]]);
    D.subVectors(P, L).normalize();
    P.addScaledVector(D, back);
    if (!still) {
      const sway = Math.min(1, speed * 3);
      P.x += Math.sin(time * 1.3) * 0.003 * sway; P.y += Math.sin(time * 0.9 + 1) * 0.002 * sway;
      L.x += Math.sin(time * 0.7) * 0.0026 * P.distanceTo(L) * sway;
    }
    // The walk's bob: down at each footfall, with a little sway side to side, in step with the scroll
    if (pr > WALK[0] && pr < WALK[1]) {
      const w = (pr - WALK[0]) / (WALK[1] - WALK[0]), fade = Math.sin(w * Math.PI), ph = w * STEPS * Math.PI * 2;
      P.y -= (0.5 - 0.5 * Math.cos(ph)) * 0.028 * fade; P.z += Math.sin(ph / 2) * 0.012 * fade;
    }
    if (pr < 0.9) P.set(T.MathUtils.clamp(P.x, -1.85, 3.05), T.MathUtils.clamp(P.y, 0.2, 2.4), T.MathUtils.clamp(P.z, -2.35, 2.35));
    camera.position.copy(P); camera.lookAt(L);
    camera.rotateZ(ramp(pr, ROLL));
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
    world.update(time, sky.wind, sky.phase, s);
    hemi.intensity = light * (0.62 + 0.15 * s) * ramp(p, [[0.55, 3.5], [0.86, 1.3]]); // the room dims a little as the window takes over
    hemi.color.copy(COOL).lerp(WARM, s);
    sun.intensity = light * (0.15 + 1.2 * s);
    fill.intensity = light * (0.55 + 0.35 * s);
    for (const [m, k] of glossy) m.envMapIntensity = k * light;
    car.update(time, light);
    // The lower sash goes up with the scroll; moving it redraws the shadows it throws
    open = ramp(pr, OPEN);
    if (openWindow(open)) renderer.shadowMap.needsUpdate = true;
    glow.intensity = ramp(p, [[0, 0], [0.28, 0.6], [0.6, 0.3], [0.82, 0.2]]) * 0.02;
    grade.uniforms.uTint.value.copy(WHITE).lerp(TINT_COOL.clone().lerp(TINT_WARM, s), room);

    // Grade and bloom; both are off at 0 so the first frame matches the page
    grade.uniforms.uTime.value = time;
    grade.uniforms.uGrain.value = ramp(p, [[0, 0], [0.12, 0.015]]);
    grade.uniforms.uVignette.value = ramp(p, [[0.28, 0], [0.6, 0.25], [0.94, 0.1]]);
    grade.uniforms.uTone.value = ramp(p, [[0.12, 0], [0.4, 1]]);
    grade.uniforms.uExposure.value = ramp(p, [[0.4, 1], [0.58, 1.15], [0.82, 1.15], [0.94, 1.25], [1, 1.6]]); // brighter once out of the TV
    grade.uniforms.uWhite.value = ramp(pr, [[0.985, 0], [0.999, 1]]);  // after the long look outside
    bloom.strength = bloomOn ? ramp(p, [[0.6, 0], [0.94, 0.12]]) : 0;
    bloom.enabled = bloom.strength > 0.001;
    sky.aim(camera, shafts, ramp(p, [[0.55, 0], [0.75, 1]]) * 0.3);
    sky.open = open;
    // The camera's own speed stirs the dust it moves through
    if (dt > 0) sky.stir = stirV.subVectors(camera.position, lastCam).divideScalar(Math.max(dt, 1 / 120)).clampLength(0, 2);
    lastCam.copy(camera.position);
    // The sun in the eyes: where it sits on screen, and how much of it reaches the camera: through the
    // window opening while inside, past the clouds, and only when it is near the middle of the view
    sunAt.copy(camera.position).addScaledVector(SUNDIR, 1000);
    const sp = sunAt.clone().project(camera);
    let seen = 0;
    if (sp.z < 1 && Math.abs(sp.x) < 1.3 && Math.abs(sp.y) < 1.3) {
      if (camera.position.x < -1.97) seen = 1;
      else {
        const k = (-1.95 - camera.position.x) / SUNDIR.x, hy = camera.position.y + SUNDIR.y * k, hz = camera.position.z + SUNDIR.z * k;
        const y0 = WINDOW.y - WINDOW.h / 2, y1 = WINDOW.y + WINDOW.h / 2, z0 = WINDOW.z - WINDOW.w / 2, z1 = WINDOW.z + WINDOW.w / 2;
        seen = T.MathUtils.smoothstep(Math.min(hy - y0, y1 - hy, hz - z0, z1 - hz), 0, 0.06);
      }
    }
    camera.getWorldDirection(D);
    const facingSun = Math.max(0, D.dot(SUNDIR)) ** 6;
    grade.uniforms.uFlare.value.set((sp.x + 1) / 2, (sp.y + 1) / 2, seen * s * facingSun * 0.9 * ramp(p, [[0.5, 0], [0.62, 1]]));
    grade.uniforms.uAspect.value = aspect;
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
    env.dispose(); carEnv.dispose(); sky.dispose(); world.dispose(); car.dispose(); bakedTextures.forEach((t) => t.dispose());
    composer.passes.forEach((pass) => pass.dispose && pass.dispose());
    composer.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    canvas.remove();
  }

  return { compose, render, resize, dispose, pick, over: (x, y) => pick(x, y, true), get facing() { return facing; }, get wind() { return sky.wind; }, get carRunning() { return car.running; }, get beat() { return beat; }, get open() { return open; } };
}
