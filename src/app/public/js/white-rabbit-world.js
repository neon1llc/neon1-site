// src/app/public/js/white-rabbit-world.js - The lakefront below the white rabbit's window.
// Usage: const world = createWorld({ scene, touch }); await world.ready; world.update(time, wind, phase, sun)
//
// Imported by white-rabbit-scene.js. The room is a full second story over a raised first floor, so the
// ground is 4.3 m below its floor (y -4.3). Out from the house (toward -x): a fenced back lawn with a swing set and a bed of sunflowers,
// a row of autumn trees on the verge, a sidewalk, a two-way road, another sidewalk, and a neighborhood
// park around an old quarry pond: a skewed closed loop of water with a stone rim, a gravel walkway all
// the way around, trees beyond it, and a few ducks paddling about, with a wooded rise and hazy hills
// behind. Everything is cheap: the ground is one plane whose shader paints each strip and the pond's
// rings, the trees are sprites from one atlas (rendered in Blender by blender/world.py) that turn to
// face the camera, and the water is one plane cut to the pond's outline, with moving ripples, the sky
// in them, and the sun's reflection and glitter. All of it is lit by the same sun, dimmed
// as clouds cover it, and fades into the haze with distance. The trees, swings, and flowers move with
// the wind the sound and the room share.

import * as T from "/js/vendor/three-0.187.0.rabbit.min.js";


// The ground's height, the sun's direction as painted in the sky, and the haze far things fade into
const GROUND = -4.3, LAKE = -4.6;
export const SUNDIR = new T.Vector3(-30.2, 11.3, -12.4).normalize();
const HAZE = new T.Color(0.74, 0.81, 0.9);

// Strips out from the house, as x where each ends (meters; the house wall is at x -2.05)
const STRIP = { fence: -30, sidewalk1: [-31.6, -33.4], road: [-33.4, -40.6], sidewalk2: [-40.6, -42.4] };
// The pond: its center, its half-widths across (x) and along (z), and the outline as a radius that
// wanders with the angle, so it is a skewed loop, not a circle (the same in JS and GLSL). It is a big
// old quarry: about 0.9 by 1.3 km, so the walkway around it is near 3 km (1.85 miles), with its near
// bank 50 m out, past the road and a strip of park
const POND = { x: -514, z: 3, ax: 380, az: 560 };
const SHAPE = (a) => 1 + 0.16 * Math.sin(2 * a + 0.7) + 0.09 * Math.sin(3 * a + 2.1) + 0.05 * Math.sin(5 * a + 0.3);
const SHAPE_GLSL = /* glsl */`
  float shape(float a) { return 1.0 + 0.16 * sin(2.0 * a + 0.7) + 0.09 * sin(3.0 * a + 2.1) + 0.05 * sin(5.0 * a + 0.3); }
  // Meters outside the pond's edge (negative inside), roughly
  float pondEdge(vec2 xz) {
    vec2 q = (xz - vec2(${POND.x.toFixed(1)}, ${POND.z.toFixed(1)})) / vec2(${POND.ax.toFixed(1)}, ${POND.az.toFixed(1)});
    return (length(q) - shape(atan(q.y, q.x))) * ${((POND.ax + POND.az) / 2).toFixed(1)};
  }`;
const BED = [-29.7, -28.3, -6.5, 11.5];   // the garden along the back fence: x0, x1, z0, z1
// The yard: the back fence, and the side fences from the house to it (the right side, toward -z, meets
// a cross street; the left, toward +z, a neighbor's house), and the deck below the window
const YARD = { back: -30, right: -10, left: 12.5 };
// The yard is laid out in its own plan (the layout fitted to the photos, when the deck reached 11.4 m out), then drawn
// SHIFT over from it: toward the house by as much as the deck shrank to its true 3.56 m, so the bed, the lawn, and the
// concrete keep their places against the deck's front; and 2.8 m to the right, so the deck is centered on the window
// as in the photo from it. Every shader
// works in plan coordinates (see shaderMat); only where things land on screen moves
const SHIFT = new T.Vector3(11.4 - 2.05 - (16 * 0.16 + 1.0), 0, -2.8), HOUSE_X = -2.05 - SHIFT.x;   // the house wall, in plan coordinates
const DECK_FRONT = HOUSE_X - (16 * 0.16 + 1.0);   // the deck's front edge (see DECK)
// The right side of the yard is concrete, parted from the lawn on the left by a curving raised bed of
// stone (CURVE, plan points [x, z] from the foot of the deck's front stairs out toward the back); soil
// borders run along the right fence and the back fence (SOIL wide); a circle is cut from the concrete for
// a pear tree and its mint; the greenhouse stands square in the back-right corner of the concrete
const C_SHAPE = [[-12.9, 2.7], [-15.6, 0.9], [-19.0, -0.5], [-22.2, -0.6], [-24.6, 0.4], [-26.2, 1.6]];   // the backward C as first fitted to the photos (it began 1.5 m past a 9.35 m deck)
const CURVE = C_SHAPE;   // starting 1.5 m past the deck's front, right of its front stairs; no straight lead, so it never reads as a question mark
const SOIL = 1.8;
// Edges are never ruled straight: every soil, concrete, and mulch boundary wanders by a few centimeters
const WOB = (s) => 0.07 * Math.sin(s * 1.13 + 0.7) + 0.045 * Math.sin(s * 2.71 + 2.1) + 0.025 * Math.sin(s * 6.3 + 4.0);
const WOB_GLSL = "float wob(float s) { return 0.07 * sin(s * 1.13 + 0.7) + 0.045 * sin(s * 2.71 + 2.1) + 0.025 * sin(s * 6.3 + 4.0); }";
const MINT = [-24.0, -2.55, 0.85];
const GREEN = { x0: -28.2, x1: -23.0, z0: -8.2, z1: -4.9, eave: 2.05, ridge: 2.75 };   // about 1.4 times the 8 x 12 ft kit
// The square of soil in front of the greenhouse, a foot from its door, where the squash trellis stands
const PATCH = { x0: GREEN.x1 + 0.3, x1: GREEN.x1 + 0.3 + (GREEN.x1 - GREEN.x0), z0: GREEN.z0, z1: GREEN.z1 };
// Its depth is the right side's own count: 7 spindles from the front corner to the right stairs, the stairs (1 m),
// and 7 more back to the house, at 16 cm apart
const DECK = { x0: DECK_FRONT, x1: HOUSE_X, z0: 0.1, z1: YARD.left - SOIL, y: GROUND + 0.8 };   // out from the house on the left, its left side by the left border, its right side at z0
const CROSS = { walk1: [-10.6, -12.6], road: [-12.6, -19.6], walk2: [-19.6, -21.6] };

// The atlas cells: u0, v0, u1, v1, and width over height (from blender/world.py), and each kind's height in meters
const CELLS = [[0.0306, 0.5, 0.3021, 1.0, 0.652], [0.3333, 0.5, 0.6667, 0.8125, 1.28], [0.6667, 0.5, 1.0, 0.8453, 1.158],
  [0.0, 0.0, 0.3333, 0.3445, 1.161], [0.3333, 0.0, 0.6667, 0.3453, 1.158], [0.6667, 0.0, 1.0, 0.2469, 1.62]];
const TALL = [8.5, 11, 7.5, 11.5, 7.8, 10];

// Lighting and haze shared by every outdoor shader: the sun's share by the clouds, and fog by distance
const COMMON = /* glsl */`
  uniform vec3 uSunDir, uHaze;
  uniform float uSun;
  vec3 outdoor(vec3 albedo, vec3 n, vec3 world) {
    float lam = max(dot(n, uSunDir), 0.0);
    vec3 lit = albedo * (vec3(0.42, 0.47, 0.56) + vec3(1.05, 0.95, 0.8) * lam * (0.35 + 0.65 * uSun));
    float d = distance(world, cameraPosition);
    return mix(lit, uHaze, 1.0 - exp(-d / 1100.0));
  }`;
const hash = /* glsl */`
  float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
  // Octaves at turned angles, so no grid shows through
  float fbm(vec2 p) { return 0.5 * noise(mat2(0.8, -0.6, 0.6, 0.8) * p) + 0.3 * noise(mat2(0.36, 0.93, -0.93, 0.36) * p * 2.07 + 5.2) + 0.2 * noise(mat2(-0.5, 0.87, -0.87, -0.5) * p * 4.13 + 1.7); }`;


// ---- The ground: lawn, verge, sidewalks, road, shore, and the soil of the flower bed ----
const GROUND_VERT = /* glsl */`
  varying vec3 vW;
  varying vec2 vUv;
  void main() { vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const GROUND_FRAG = /* glsl */`
  ${COMMON}
  ${hash}
  ${WOB_GLSL}
  ${SHAPE_GLSL}
  uniform vec3 uTrees[48];
  uniform vec4 uBed;
  uniform sampler2D uLawn, uLawnN;
  varying vec3 vW;
  void main() {
    float x = vW.x, z = vW.z, paved = 0.0;
    float e = pondEdge(vW.xz);
    if (e < -0.2) discard;                       // the water shows through here
    // Grass: never one green. Patches of lusher and drier turf, clover in darker clumps, yellowing where it
    // is thin, mowing stripes that wander and fade, longer darker grass where the mower can't reach along
    // the fence, the odd dandelion, bare earth worn under the swing and along the way from the back door to
    // the garden, and autumn leaves scattered under and downwind of the trees
    // A photographed lawn (Poly Haven's leafy grass), sampled at two scales and angles and blended by a
    // slow noise so it never visibly tiles, its normal map catching the sun so the turf has relief
    vec2 u1 = vW.xz / 2.0, u2 = mat2(0.8, -0.6, 0.6, 0.8) * vW.xz / 3.3 + 0.37;
    float pick = smoothstep(0.35, 0.65, noise(vW.xz * 0.18));
    vec3 photo = mix(texture2D(uLawn, u1).rgb, texture2D(uLawn, u2).rgb, pick);
    vec3 tn = mix(texture2D(uLawnN, u1).rgb, texture2D(uLawnN, u2).rgb, pick) * 2.0 - 1.0;
    float mott = fbm(vW.xz * 0.25);
    float dry = smoothstep(0.5, 0.8, fbm(vW.xz * 0.12 + 7.0));
    // The photo's detail, by its brightness, on a lawn's greens (the photo itself is an autumn floor)
    float lum = dot(photo, vec3(0.3, 0.55, 0.15));
    vec3 grass = mix(vec3(0.04, 0.11, 0.03), vec3(0.15, 0.31, 0.08), clamp(lum * 1.7, 0.0, 1.0)) * mix(0.85, 1.1, mott);   // a deep, healthy green, as in the photos
    // Clumps: a mid scale of darker, thicker tufts and thin, paler spots, so the lawn has texture from afar
    grass *= mix(0.74, 1.16, smoothstep(0.25, 0.75, fbm(vW.xz * 2.6 + 11.0))) * mix(0.86, 1.1, fbm(vW.xz * 8.0 + 5.0));   // tufts at two scales, so it has depth
    grass = mix(grass, mix(grass, photo, 0.25) * vec3(1.1, 1.05, 0.75), dry * 0.08);
    grass = mix(grass, grass * vec3(0.7, 0.9, 0.7), smoothstep(0.62, 0.75, noise(vW.xz * 1.6 + 3.0)) * 0.6);
    if (x > ${STRIP.fence.toFixed(1)}) {
      float wander = z + sin(x * 0.4) * 0.5 + noise(vec2(x * 0.3, 0.0)) * 0.8;
      grass *= 0.9 + 0.16 * smoothstep(0.42, 0.58, abs(fract(wander / 3.2) * 2.0 - 1.0)) * (0.4 + 0.6 * fbm(vW.xz * 0.15));
      // Darker, longer grass in the shade at the foot of the fence and round the beds
      float edgeDist = min(min(x - ${YARD.back.toFixed(1)}, z - ${YARD.right.toFixed(1)}), ${YARD.left.toFixed(1)} - z);
      grass *= mix(0.62, 1.0, smoothstep(0.0, 1.1, edgeDist));
      grass *= mix(0.7, 1.0, smoothstep(0.0, 0.7, max(x - uBed.y, 0.0) + step(x, uBed.x) * 9.0));
      grass = mix(grass, vec3(0.12, 0.25, 0.08), smoothstep(-19.0, -19.9, x) * 0.6);
      float wear = smoothstep(1.7, 0.4, distance(vW.xz, vec2(-11.0, -4.0)) + noise(vW.xz * 3.0) * 0.6);
      grass = mix(grass, vec3(0.36, 0.3, 0.2) * (0.8 + 0.4 * hash(floor(vW.xz * 25.0))), wear * 0.85);   // worn only under the swing, no path across the lawn
    }
    float dande = step(0.9965, hash(floor(vW.xz * 7.0))) * step(0.4, noise(vW.xz * 0.5)) * smoothstep(0.2, 0.12, length(fract(vW.xz * 7.0) - 0.5));   // round flower heads
    grass = mix(grass, vec3(0.92, 0.75, 0.12), dande);
    float leaves = 0.0;
    for (int i = 0; i < 48; i++) leaves = max(leaves, smoothstep(uTrees[i].z * 1.1, uTrees[i].z * 0.2, distance(vW.xz, uTrees[i].xy + vec2(2.0, 1.0))));
    float la = hash(floor(vW.xz * 18.0) + 3.1) * 6.283; vec2 lc = fract(vW.xz * 18.0) - 0.5; lc = mat2(cos(la), -sin(la), sin(la), cos(la)) * lc;
    float leaf = step(1.0 - leaves * 0.18, hash(floor(vW.xz * 18.0))) * smoothstep(0.42, 0.36, length(lc * vec2(1.0, 2.2)));   // fallen leaves, each its own way round
    vec3 leafCol = mix(vec3(0.62, 0.28, 0.06), vec3(0.78, 0.55, 0.12), hash(floor(vW.xz * 18.0) + 1.7));
    grass = mix(grass, leafCol, leaf);
    vec3 col = grass;
    // Sidewalks: pale concrete with joints every 1.5 m
    float walk = ((x < ${STRIP.sidewalk1[0].toFixed(1)} && x > ${STRIP.sidewalk1[1].toFixed(1)}) || (x < ${STRIP.sidewalk2[0].toFixed(1)} && x > ${STRIP.sidewalk2[1].toFixed(1)})) ? 1.0 : 0.0;
    vec3 concrete = vec3(0.66, 0.64, 0.6) * (0.9 + 0.12 * noise(vW.xz * 7.0)) * (1.0 - 0.35 * smoothstep(0.03, 0.0, abs(fract(z / 1.5) - 0.5) - 0.47));
    col = mix(col, concrete, walk);
    // The road: dark asphalt, white edge lines, and a double yellow line down the middle
    if (x < ${STRIP.road[0].toFixed(1)} && x > ${STRIP.road[1].toFixed(1)}) {
      vec3 tar = vec3(0.13, 0.13, 0.14) * (0.85 + 0.3 * noise(vW.xz * 9.0)) * (0.92 + 0.12 * noise(vW.xz * 0.6));
      float mid = ${((STRIP.road[0] + STRIP.road[1]) / 2).toFixed(2)};
      float yellow = smoothstep(0.07, 0.05, abs(abs(x - mid) - 0.12));
      float white = smoothstep(0.08, 0.06, abs(x - (${(STRIP.road[0] - 0.3).toFixed(2)}))) + smoothstep(0.08, 0.06, abs(x - (${(STRIP.road[1] + 0.3).toFixed(2)})));
      col = mix(tar, vec3(0.85, 0.66, 0.12), yellow);
      col = mix(col, vec3(0.86), white);
    }
    // The cross street off to the right, running out from beside the house to the road, with its sidewalks
    if (x > ${STRIP.road[1].toFixed(1)}) {
      if ((z < ${CROSS.walk1[0].toFixed(1)} && z > ${CROSS.walk1[1].toFixed(1)}) || (z < ${CROSS.walk2[0].toFixed(1)} && z > ${CROSS.walk2[1].toFixed(1)})) if (x > ${STRIP.sidewalk1[0].toFixed(1)})
        col = vec3(0.66, 0.64, 0.6) * (0.9 + 0.12 * noise(vW.xz * 7.0)) * (1.0 - 0.35 * smoothstep(0.03, 0.0, abs(fract(x / 1.5) - 0.5) - 0.47));
      if (z < ${CROSS.road[0].toFixed(1)} && z > ${CROSS.road[1].toFixed(1)}) {
        float mz = ${((CROSS.road[0] + CROSS.road[1]) / 2).toFixed(2)};
        col = vec3(0.14, 0.14, 0.15) * (0.85 + 0.3 * noise(vW.xz * 9.0)) * (0.9 + 0.15 * noise(vW.xz * 0.5));
        col = mix(col, vec3(0.85, 0.66, 0.12), smoothstep(0.07, 0.05, abs(abs(z - mz) - 0.12)) * step(${STRIP.road[0].toFixed(1)}, x));
        col = mix(col, vec3(0.1), 0.25 * smoothstep(0.6, 0.0, noise(vW.xz * 0.8)));   // patched cracks and oil
      }
    }
    // The yard's right side: soil borders along the right and back fences, concrete inside them up to the
    // stone bed, and the circle of mint round the pear tree
    bool yard = x > ${YARD.back.toFixed(1)} && x < -2.05 && z > ${YARD.right.toFixed(1)} && z < ${YARD.left.toFixed(1)};
    if (yard) {
      float zb = ${CURVE[0][1].toFixed(2)};
      ${CURVE.slice(1).map((p, i) => `if (x < ${CURVE[i][0].toFixed(2)}) zb = mix(${CURVE[i][1].toFixed(2)}, ${p[1].toFixed(2)}, clamp((x - (${CURVE[i][0].toFixed(2)})) / (${(p[0] - CURVE[i][0]).toFixed(2)}), 0.0, 1.0));`).join("\n      ")}
      bool soil = z < ${(YARD.right + SOIL).toFixed(2)} + wob(x) || x < ${(YARD.back + SOIL).toFixed(2)} + 0.25 * wob(z + 3.0) || (z > ${(YARD.left - SOIL).toFixed(2)} + 0.25 * wob(x + 7.0))
        || (x > ${PATCH.x0.toFixed(2)} + wob(z + 11.0) && x < ${PATCH.x1.toFixed(2)} + wob(z + 13.0) && z > ${PATCH.z0.toFixed(2)} && z < ${PATCH.z1.toFixed(2)} + 0.25 * wob(x + 19.0));
      if (soil) {
        // Dark, rich soil
        col = vec3(0.1, 0.058, 0.03) * (0.75 + 0.45 * noise(vW.xz * 6.0)) * (0.85 + 0.3 * hash(floor(vW.xz * 30.0)));
        col = mix(col, vec3(0.3, 0.42, 0.12), 0.25 * step(0.8, noise(vW.xz * 2.3)));          // a weed or two
        // The left border is mulched in red bark chips, thinning to bare soil in patches and around the
        // base of each plant (the andromeda, the branchy bush, the rose, and the dog house)
        // The back border is mulched the same, as it is in the yard
        if (z > ${(YARD.left - SOIL).toFixed(2)} + 0.25 * wob(x + 7.0) || x < ${(YARD.back + SOIL).toFixed(2)} + 0.25 * wob(z + 3.0)) {
          vec2 cp = vW.xz * 26.0; vec2 cell = floor(cp + 0.5 * vec2(hash(floor(cp.yx)), 0.0));
          float chip = hash(cell), edge = smoothstep(0.42, 0.5, max(abs(fract(cp.x + 0.5 * hash(floor(cp.yx))) - 0.5), abs(fract(cp.y) - 0.5)));
          vec3 mulch = mix(vec3(0.17, 0.04, 0.022), vec3(0.27, 0.065, 0.032), chip) * (0.8 + 0.35 * noise(vW.xz * 3.0)) * (1.0 - 0.45 * edge);
          float bare = 0.0;
          ${[[-25.4, YARD.left - 1.1, 0.75], [-21.6, YARD.left - 0.85, 0.55], [-18.4, YARD.left - 0.8, 0.5], [YARD.back + 1.15, YARD.left - 1.25, 1.0]].map(([px, pz, r]) => `bare = max(bare, smoothstep(${(r * 1.1).toFixed(2)}, ${(r * 0.35).toFixed(2)}, distance(vW.xz, vec2(${px.toFixed(2)}, ${pz.toFixed(2)}))) * 0.9);`).join("\n          ")}
          bare = max(bare, smoothstep(0.6, 0.75, noise(vW.xz * 1.7 + 5.0)) * 0.7);
          bare = max(bare, step(0.93, hash(floor(vW.xz * 9.0))) * 0.5);
          // the mulch's ragged edge where it meets the lawn
          float lip = smoothstep(${(YARD.left - SOIL).toFixed(2)}, ${(YARD.left - SOIL + 0.2).toFixed(2)}, z - 0.25 * wob(x + 7.0) + 0.12 * noise(vW.xz * 4.0));
          lip = max(lip, smoothstep(${(YARD.back + SOIL).toFixed(2)}, ${(YARD.back + SOIL - 0.2).toFixed(2)}, x - 0.25 * wob(z + 3.0) - 0.12 * noise(vW.xz * 4.0)));
          col = mix(col, mulch, (1.0 - bare) * lip);
        }
        paved = 1.0;
      } else if (z < zb - 0.75) {
        // One old pour, medium dark grey and rough, cracked in wandering lines over the years, and patched here
        // and there with lighter quick-set cement that has cracked in its turn
        col = vec3(0.17, 0.17, 0.165) * (0.82 + 0.26 * fbm(vW.xz * 0.7)) * (0.86 + 0.28 * hash(floor(vW.xz * 70.0)));
        col *= 1.0 - 0.15 * smoothstep(0.6, 0.72, fbm(vW.xz * 0.3 + 4.0));
        float crack = smoothstep(0.012, 0.0, abs(fbm(vW.xz * 0.55 + 2.0) - 0.5)) * step(0.55, noise(vW.xz * 0.25 + 9.0));
        crack = max(crack, smoothstep(0.008, 0.0, abs(fbm(vW.xz * 1.3 + 7.0) - 0.5)) * step(0.62, noise(vW.xz * 0.5 + 3.0)));
        float patchM = smoothstep(0.66, 0.68, fbm(vW.xz * 0.45 + 13.0)) * step(0.45, noise(vW.xz * 0.2 + 5.0));
        col = mix(col, vec3(0.2, 0.198, 0.19) * (0.9 + 0.2 * hash(floor(vW.xz * 90.0))), patchM);
        crack = max(crack * (1.0 - patchM * 0.6), patchM * smoothstep(0.01, 0.0, abs(fbm(vW.xz * 2.4) - 0.5)));
        // Hairline cracks branching off the big ones, and a few running in from the edges
        crack = max(crack, 0.6 * smoothstep(0.005, 0.0, abs(fbm(vW.xz * 2.1 + 21.0) - 0.5)) * step(0.5, noise(vW.xz * 0.7 + 17.0)));
        crack = max(crack, 0.8 * smoothstep(0.007, 0.0, abs(fbm(vW.zx * 0.9 + 31.0) - 0.5)) * step(0.58, noise(vW.xz * 0.35 + 23.0)));
        col *= 1.0 - 0.6 * crack;
        // Indentations: shallow dents and pitted spots where the surface spalled, dark inside with a worn lip
        float dent = fbm(vW.xz * 1.6 + 41.0);
        col *= 1.0 - 0.24 * smoothstep(0.66, 0.71, dent) + 0.08 * smoothstep(0.58, 0.63, dent) * (1.0 - smoothstep(0.63, 0.66, dent));
        float pit = smoothstep(0.78, 0.86, noise(vW.xz * 9.0 + 3.0)) * step(0.5, noise(vW.xz * 0.6 + 11.0));
        col *= 1.0 - 0.45 * pit;
        paved = 1.0;
        float md = distance(vW.xz, vec2(${MINT[0].toFixed(2)}, ${MINT[1].toFixed(2)}));
        // The mint runs wild, spilling out over the edge of its circle in leafy clumps
        float spill = ${MINT[2].toFixed(2)} + 0.35 * fbm(vec2(atan(vW.z - (${MINT[1].toFixed(2)}), vW.x - (${MINT[0].toFixed(2)})) * 2.0, 1.0));
        if (md < spill) {
          col = mix(vec3(0.025, 0.06, 0.02), vec3(0.07, 0.14, 0.05), fbm(vW.xz * 11.0)) * (0.7 + 0.5 * hash(floor(vW.xz * 60.0)));
          paved = 0.0;
        } else if (md < spill + 0.1) col *= 0.7;
      }
    }
    // Deep shade under the deck
    if (x > ${DECK.x0.toFixed(2)} - 0.3 && x < ${DECK.x1.toFixed(2)} && z > ${DECK.z0.toFixed(2)} - 0.3 && z < ${DECK.z1.toFixed(2)} + 0.3) col *= 0.45;
    // Around the pond: a rim of quarry stone at the water, a strip of grass, then the gravel walkway
    if (e < 0.9) col = vec3(0.52, 0.5, 0.46) * (0.7 + 0.45 * hash(floor(vW.xz * 6.0)));
    else if (e > 2.2 && e < 4.2) col = vec3(0.7, 0.66, 0.58) * (0.85 + 0.25 * hash(floor(vW.xz * 30.0))) * (1.0 - 0.15 * smoothstep(0.3, 0.0, min(e - 2.2, 4.2 - e)));
    // The flower bed: patchy, half grown over (its plants and weeds are in the bed's picture)
    if (x > uBed.x && x < uBed.y && z > uBed.z && z < uBed.w) col = mix(col, vec3(0.24, 0.17, 0.1), 0.35 * noise(vW.xz * 3.0));
    // Soft shade under every tree, offset away from the sun
    float shade = 0.0;
    for (int i = 0; i < 48; i++) {
      vec2 c = uTrees[i].xy - uSunDir.xz / uSunDir.y * uTrees[i].z * 0.45;
      shade = max(shade, smoothstep(uTrees[i].z * 0.42, uTrees[i].z * 0.12, distance(vW.xz, c)));
    }
    col *= 1.0 - 0.45 * shade * (0.3 + 0.7 * uSun);
    // The turf's own relief only on grass, not on paving
    float turf = (x > ${STRIP.sidewalk1[0].toFixed(1)} || (x < ${STRIP.sidewalk2[1].toFixed(1)} && e > 4.2)) ? 1.0 - paved : 0.0;
    // Gentle rolls in the ground (a lawn is never flat), as a slope from a slow noise, catching the sun
    vec2 eps = vec2(0.6, 0.0);
    vec2 roll = vec2(noise(vW.xz * 0.23 + eps) - noise(vW.xz * 0.23 - eps), noise(vW.xz * 0.23 + eps.yx) - noise(vW.xz * 0.23 - eps.yx));
    vec3 n = normalize(vec3((tn.x * 0.9 + roll.x * 3.0) * turf, 1.0, (-tn.y * 0.9 + roll.y * 3.0) * turf));
    gl_FragColor = vec4(outdoor(col, n, vW), 1.0);
  }`;

// ---- Water ----
const WATER_FRAG = /* glsl */`
  ${COMMON}
  ${SHAPE_GLSL}
  uniform float uTime, uWind;
  varying vec3 vW;
  void main() {
    float edge = pondEdge(vW.xz);
    if (edge > 0.0) discard;
    // Ripples: a few moving wave trains, rougher in the wind
    vec2 p = vW.xz;
    // Far off, the ripples blur together (and would shimmer if drawn), so they fade with distance
    float d = distance(vW, cameraPosition);
    float a = (0.6 + 0.8 * uWind) * exp(-d / 90.0);
    vec2 g = vec2(0.0);
    g += vec2(0.8, 0.6) * cos(dot(p, vec2(0.8, 0.6)) * 0.9 + uTime * 1.1) * 0.06;
    g += vec2(-0.5, 0.86) * cos(dot(p, vec2(-0.5, 0.86)) * 1.7 + uTime * 1.6) * 0.04;
    g += vec2(0.97, -0.24) * cos(dot(p, vec2(0.97, -0.24)) * 3.9 + uTime * 2.4) * 0.025;
    g += vec2(0.2, 0.98) * cos(dot(p, vec2(0.2, 0.98)) * 8.3 + uTime * 3.1) * 0.015;
    vec3 n = normalize(vec3(-g.x * a, 1.0, -g.y * a));
    vec3 v = normalize(vW - cameraPosition), r = reflect(v, n);
    // The sky in it: pale at the horizon, bluer above; darker where the far shore's trees would show
    vec3 sky = mix(vec3(0.5, 0.63, 0.82), vec3(0.28, 0.46, 0.78), smoothstep(-0.02, 0.25, r.y));
    sky = mix(vec3(0.22, 0.24, 0.16), sky, smoothstep(0.005, 0.03, r.y));
    float fres = 0.04 + 0.96 * pow(1.0 - max(dot(n, -v), 0.0), 5.0);
    vec3 deep = vec3(0.05, 0.14, 0.2);
    vec3 col = mix(deep, sky, fres);
    // Glitter: the sun on the ripples
    // The sun in the water: a soft broad reflection, and the sharp glitter of it on each ripple
    float toSun = max(dot(r, uSunDir), 0.0);
    col += vec3(1.0, 0.92, 0.75) * (pow(toSun, 60.0) * 0.6 + pow(toSun, 900.0) * 30.0) * uSun;
    // Darker right at the stone rim, where the bank shades the water
    col *= 0.75 + 0.25 * smoothstep(-0.2, -2.0, edge);
    gl_FragColor = vec4(mix(col, uHaze, 1.0 - exp(-d / 1400.0)), 1.0);
  }`;

// ---- Trees: sprites standing on the ground, turned to the camera about their trunks, swaying at the top ----
const TREE_VERT = /* glsl */`
  attribute vec3 aBase;
  attribute vec2 aSize;
  attribute vec4 aCell;
  attribute float aSeed;
  attribute float aBush;
  uniform float uPhase, uWind;
  varying vec2 vUv;
  varying vec3 vW;
  varying float vSeed;
  varying vec4 vCell;
  void main() {
    vec3 toCam = cameraPosition - aBase; toCam.y = 0.0;
    vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), normalize(toCam)));
    float top = position.y * position.y;
    // Wind moves the card itself, the way a tree moves: the trunk holds at the ground and bends more
    // toward the top, the whole crown rocking slowly and leaning off in the gusts, and the outer limbs
    // bobbing a beat apart from it. Every motion is broad (a few waves across the whole tree at most), so
    // limbs and clumps move as pieces and the picture itself never ripples
    float t = uPhase, s0 = aSeed * 6.283, g = uWind, small = 1.0 + 0.5 * (1.0 - smoothstep(1.0, 3.0, aSize.y));   // small plants move a touch more, not much
    float sway = ((0.005 + 0.03 * g) * sin(t * 0.55 + s0) + (0.0025 + 0.012 * g) * sin(t * 1.3 + s0 * 1.7) + 0.03 * g * g) * small;
    float limb = (0.002 + 0.011 * g) * small * smoothstep(0.35, 1.0, position.y) * (0.4 + 1.6 * abs(position.x));
    float lx = limb * sin(t * 1.9 + s0 * 3.1 + position.x * 2.6 + position.y * 1.7);
    float ly = limb * 0.6 * cos(t * 2.2 + s0 * 2.3 + position.x * 3.1) * abs(position.x) * 2.0;
    // Bushes (aBush) hardly sway: they rustle, each clump of leaves stirring on its own, quick and small,
    // more in the gusts, as if the bush were breathing
    vec2 cellId = floor(position.xy * vec2(4.0, 8.0) + 0.5);
    float ph = fract(sin(dot(cellId, vec2(12.9898, 78.233)) + aSeed * 17.0) * 43758.5453) * 6.283;
    float rust = aBush * (0.006 + 0.022 * g) * smoothstep(0.1, 0.4, position.y) * mix(0.5, 1.0, smoothstep(1.0, 3.0, aSize.y));   // small bushes breathe less
    sway *= 1.0 - 0.7 * aBush; lx *= 1.0 - 0.6 * aBush;
    lx += rust * (sin(t * 3.3 + ph) + 0.5 * sin(t * 7.1 + ph * 2.3));
    ly += rust * 0.7 * cos(t * 2.9 + ph * 1.7);
    vec3 w = aBase + right * (position.x * aSize.x + (sway * top + lx) * aSize.y) + vec3(0.0, (position.y + ly) * aSize.y, 0.0);
    vUv = mix(aCell.xy, aCell.zw, position.xy + vec2(0.5, 0.0));
    vW = w; vSeed = aSeed; vCell = aCell;
    gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
  }`;
// Leaves catch the light as they turn in the wind (the motion itself is in TREE_VERT)
const BREATHE = /* glsl */`
  uniform float uPhase, uWind;
  varying vec4 vCell;
  // The picture is never warped (that read as heat haze): the card moves instead (TREE_VERT), and only
  // the light on the leaves flickers (shimmer). Kept as a pass-through so every caller reads the same
  vec2 breathe(vec2 uv, float seed, float amount) { return uv; }
  // Leaves turning in the wind catch the light: a small, quick flicker of brightness, patch by patch
  float shimmer(vec2 uv, float seed) {
    vec2 L = (uv - vCell.xy) / (vCell.zw - vCell.xy), f = L * vec2(30.0, 34.0) + seed * 11.0;
    return 1.0 + (0.05 + 0.07 * uWind) * sin(f.x * 1.3 + f.y + uPhase * 6.0 + 3.0 * sin(f.y * 0.4 - uPhase * 1.7)) * smoothstep(0.2, 0.6, L.y);
  }`;
const TREE_FRAG = /* glsl */`
  ${COMMON}
  ${hash}
  ${BREATHE}
  uniform sampler2D uMap;
  varying vec2 vUv;
  varying vec3 vW;
  varying float vSeed;
  void main() {
    vec4 c = texture2D(uMap, breathe(vUv, vSeed, 0.004));
    if (c.a < 0.45) discard;
    // About a third of the trees wear mixed autumn leaves: patches of the crown turned redder, others more gold
    vec2 L = (vUv - vCell.xy) / (vCell.zw - vCell.xy);
    float mixed = step(0.66, fract(vSeed * 5.3)), leaf = hash(floor(L * vec2(18.0, 22.0) + vSeed * 40.0));
    c.rgb *= mix(vec3(1.0), leaf < 0.33 ? vec3(1.18, 0.72, 0.6) : leaf < 0.66 ? vec3(1.05, 1.05, 0.7) : vec3(0.92, 0.88, 0.8), mixed * smoothstep(0.25, 0.45, L.y));
    gl_FragColor = vec4(outdoor(c.rgb * (0.92 + 0.16 * vSeed) * 1.25 * shimmer(vUv, vSeed), normalize(vec3(0.3, 0.7, 0.2)), vW), 1.0);
  }`;

// ---- Plain lit things: fence, swing set (instanced or not) ----
const SOLID_VERT = /* glsl */`
  varying vec3 vW, vN, vTint;
  void main() {
    mat4 m = modelMatrix;
    vTint = vec3(1.0);
    #ifdef USE_INSTANCING
      m = modelMatrix * instanceMatrix;
    #endif
    #ifdef USE_INSTANCING_COLOR
      vTint = instanceColor;
    #endif
    vec4 w = m * vec4(position, 1.0);
    vW = w.xyz; vN = normalize(mat3(m) * normal);
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;
const SOLID_FRAG = /* glsl */`
  ${COMMON}
  ${hash}
  uniform vec3 uColor;
  uniform float uGrain;
  varying vec3 vW, vN, vTint;
  void main() {
    // Weathering: paint greys and greens toward the ground, where rain splashes and mower clippings land;
    // bare wood (uGrain) shows streaky grain and silvering
    vec3 c = uColor * vTint * mix(vec3(0.72, 0.76, 0.66), vec3(1.0), smoothstep(${GROUND.toFixed(1)}, ${(GROUND + 0.45).toFixed(2)}, vW.y));
    c *= 1.0 - uGrain * (0.18 * noise(vec2(vW.z * 1.3 + vW.x * 30.0, vW.y * 40.0 + vW.x * 7.0)) + 0.08 * noise(vW.xz * 23.0));
    gl_FragColor = vec4(outdoor(c, normalize(vN), vW), 1.0);
  }`;

// A card cut 4 across and 8 up, so the wind can bend it smoothly from trunk to crown (see TREE_VERT)
const cardGrid = (geo) => {
  const pos = [], idx = [], NX = 4, NY = 8;
  for (let j = 0; j <= NY; j++) for (let i = 0; i <= NX; i++) pos.push(i / NX - 0.5, j / NY, 0);
  for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) { const a = j * (NX + 1) + i; idx.push(a, a + 1, a + NX + 2, a, a + NX + 2, a + NX + 1); }
  geo.setAttribute("position", new T.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); return geo;
};

/** Builds the lakefront into scene; ready resolves when the tree atlas is in */
// Every outdoor shader is written in plan coordinates: vW, the camera, the trees' bases, and the grass all stay
// in the plan, and only gl_Position is moved over by SHIFT (meshes get it from the group's position; the trees
// and the grass, which build their points from attributes, add it themselves)
const OFF_GLSL = `#define OFF vec3(${SHIFT.x.toFixed(2)}, ${SHIFT.y.toFixed(2)}, ${SHIFT.z.toFixed(2)})\n`;
const planCam = (src) => src.replace(/\bcameraPosition\b/g, "(cameraPosition - OFF)");
const shaderMat = (o) => new T.ShaderMaterial({ ...o,
  vertexShader: OFF_GLSL + planCam(o.vertexShader).replace(/vW = w\.xyz/g, "vW = w.xyz - OFF").replace(/viewMatrix \* vec4\(w, 1\.0\)/g, "viewMatrix * vec4(w + OFF, 1.0)"),
  fragmentShader: OFF_GLSL + planCam(o.fragmentShader) });

export function createWorld({ scene, touch }) {
  const common = { uSunDir: { value: SUNDIR }, uHaze: { value: HAZE }, uSun: { value: 1 } };
  const timed = { uTime: { value: 0 }, uPhase: { value: 0 }, uWind: { value: 0 } };
  const group = new T.Group(), textures = [];
  const keep = (o) => { group.add(o); return o; };
  scene.add(group); group.position.copy(SHIFT);
  const rnd = (() => { let n = 7; return () => ((n = (n * 16807) % 2147483647) - 1) / 2147483646; })();

  // Trees: on the verge past the fence and along the shore, thinned where the window looks out (z near
  // 0.6) so the lake shows between them, and a few in the yard's corners
  const trees = [];
  for (let z = -46; z < 46; z += 6 + rnd() * 4) if ((Math.abs(z - 0.6) > 9 || rnd() < 0.2) && (z > -10 || z < -22.5)) trees.push([STRIP.fence - 0.9 - rnd() * 0.5, z, rnd(), 1]);
  // Along the cross street: a row on the far side of its far sidewalk, and a few on the verge beyond the back
  // street's far sidewalk, each tree flagged to wear mixed autumn leaves (see TREE_FRAG)
  for (let x = -27; x < 1; x += 6.5 + rnd() * 3.5) trees.push([x, CROSS.walk2[1] - 0.9 - rnd() * 0.5, rnd(), 0.95 + rnd() * 0.15]);
  for (let z = -18; z < 30; z += 9 + rnd() * 6) trees.push([STRIP.sidewalk2[1] - 1.2 - rnd() * 0.6, z, rnd(), 1]);
  // In the park on the near bank, behind the walkway, spaced so the water shows between them; the far
  // banks, a kilometer off, get a continuous wooded line instead (below)
  for (let a = -0.4; a < 0.4 && trees.length < 48; a += 0.025 + rnd() * 0.03) {
    if (rnd() < 0.3) continue;
    const r = SHAPE(a) + (7 + rnd() * 6) / POND.ax;
    trees.push([POND.x + Math.cos(a) * POND.ax * r, POND.z + Math.sin(a) * POND.az * r, rnd(), 0.9]);
  }
  const base = [], size = [], cell = [], seed = [], shade = [];
  for (const [x, z, r, scale] of trees) {
    const k = Math.floor(r * 6) % 6, h = TALL[k] * scale * (0.85 + rnd() * 0.3), c = CELLS[k];
    base.push(x, GROUND, z); size.push(h * c[4], h); cell.push(c[0], c[1], c[2], c[3]); seed.push(rnd());
    if (shade.length < 48) shade.push(new T.Vector3(x, z, h * c[4]));
  }
  while (shade.length < 48) shade.push(new T.Vector3(999, 999, 0));
  const quad = new T.InstancedBufferGeometry();
  cardGrid(quad);
  quad.setAttribute("aBase", new T.InstancedBufferAttribute(new Float32Array(base), 3));
  quad.setAttribute("aSize", new T.InstancedBufferAttribute(new Float32Array(size), 2));
  quad.setAttribute("aCell", new T.InstancedBufferAttribute(new Float32Array(cell), 4));
  quad.setAttribute("aSeed", new T.InstancedBufferAttribute(new Float32Array(seed), 1));
  quad.setAttribute("aBush", new T.InstancedBufferAttribute(new Float32Array(trees.length), 1));   // trees sway, never rustle
  quad.instanceCount = trees.length;
  const atlas = { value: null };
  const treeMesh = keep(new T.Mesh(quad, shaderMat({ uniforms: { ...common, ...timed, uMap: atlas }, vertexShader: TREE_VERT, fragmentShader: TREE_FRAG, side: T.DoubleSide })));
  treeMesh.frustumCulled = false;
  const loader = new T.TextureLoader();
  const ready = new Promise((done) => loader.load("/media/white-rabbit/trees-atlas.webp", (t) => {
    t.colorSpace = T.SRGBColorSpace; atlas.value = t; textures.push(t); done();
  }, undefined, () => done()));

  // The ground, from the house out past the pond; the lawn photo and its relief tile
  const tile = (name, srgb) => { const t = loader.load(`/media/white-rabbit/tex/${name}.webp`); t.wrapS = t.wrapT = T.RepeatWrapping; if (srgb) t.colorSpace = T.SRGBColorSpace; textures.push(t); return t; };
  const lawn = tile("lawn-color", true), lawnN = tile("lawn-normal", false);
  const ground = keep(new T.Mesh(new T.PlaneGeometry(1100, 1800), shaderMat({
    uniforms: { ...common, uTrees: { value: shade }, uBed: { value: new T.Vector4(...BED) }, uLawn: { value: lawn }, uLawnN: { value: lawnN } }, vertexShader: GROUND_VERT, fragmentShader: GROUND_FRAG,
  })));
  ground.rotation.x = -Math.PI / 2; ground.position.set(-2.0 - 550, GROUND, 0);
  // The concrete is a slab an inch proud of the soil around it: its outline runs along the right border,
  // around the trellis square, up the back border, and along the stone bed, with the mint's circle cut out;
  // it wears the same ground shader, so its top and edges paint as concrete
  {
    const SLAB = 0.025, X1 = -2.1, zr = YARD.right + SOIL, xb = YARD.back + SOIL;
    const edge = (x) => { let zb = CURVE[0][1]; for (let i = 1; i < CURVE.length; i++) if (x < CURVE[i - 1][0]) zb = CURVE[i - 1][1] + (CURVE[i][1] - CURVE[i - 1][1]) * Math.min(1, Math.max(0, (x - CURVE[i - 1][0]) / (CURVE[i][0] - CURVE[i - 1][0]))); return zb - 0.75; };
    const sh = new T.Shape();
    const run = (a, b, f) => { const n = Math.max(2, Math.ceil(Math.abs(b - a) / 0.2)); for (let i = 0; i <= n; i++) f(a + (b - a) * i / n); };
    const px1 = (z) => PATCH.x1 + WOB(z + 13), px0 = (z) => PATCH.x0 + WOB(z + 11), pz1 = (x) => PATCH.z1 + 0.25 * WOB(x + 19), rz = (x) => zr + WOB(x), bx = (z) => xb + 0.25 * WOB(z + 3);
    sh.moveTo(X1, rz(X1));
    run(X1, px1(zr), (x) => sh.lineTo(x, rz(x)));
    run(zr, PATCH.z1, (z) => sh.lineTo(px1(z), z));
    run(px1(PATCH.z1), px0(PATCH.z1), (x) => sh.lineTo(x, pz1(x)));
    run(PATCH.z1, zr, (z) => sh.lineTo(px0(z), z));
    run(px0(zr), bx(zr), (x) => sh.lineTo(x, rz(x)));
    run(zr, edge(xb), (z) => sh.lineTo(bx(z), z));
    for (let x = xb + 0.25; x <= X1 + 0.001; x += 0.25) sh.lineTo(x, edge(x));
    sh.lineTo(X1, edge(X1));
    const hole = new T.Shape(); hole.absarc(MINT[0], MINT[1], MINT[2] + 0.12, 0, Math.PI * 2, true); sh.holes.push(hole);
    const slab = keep(new T.Mesh(new T.ExtrudeGeometry(sh, { depth: SLAB, bevelEnabled: false, curveSegments: 40 }), ground.material));
    slab.rotation.x = Math.PI / 2; slab.position.y = GROUND + SLAB;
  }

  // Grass blades over the lawn, so it has a pile and is never a flat picture: tufts of six thin blades each,
  // scattered over the lawn alone (off the beds, borders, and concrete), each turned and sized its own way,
  // olive green going darker toward the roots as in the photos, the tips nodding in the wind
  {
    const zb = (x) => { let z = CURVE[0][1]; for (let i = 1; i < CURVE.length; i++) if (x < CURVE[i - 1][0]) z = CURVE[i - 1][1] + (CURVE[i][1] - CURVE[i - 1][1]) * Math.min(1, Math.max(0, (x - CURVE[i - 1][0]) / (CURVE[i][0] - CURVE[i - 1][0]))); return z; };
    const pos = [], tip = [];
    for (let b = 0; b < 6; b++) {
      const a = rnd() * 6.283, r = rnd() * 0.05, bx = Math.cos(a) * r, bz = Math.sin(a) * r, h = 0.06 + rnd() * 0.07, turn = rnd() * 6.283, w = 0.006 + rnd() * 0.004;
      const lx = Math.cos(a) * h * 0.35, lz = Math.sin(a) * h * 0.35, cx = Math.cos(turn) * w, cz = Math.sin(turn) * w;
      pos.push(bx - cx, 0, bz - cz, bx + cx, 0, bz + cz, bx + lx, h, bz + lz); tip.push(0, 0, 1);
    }
    const geo = new T.InstancedBufferGeometry();
    geo.setAttribute("position", new T.Float32BufferAttribute(pos, 3)); geo.setAttribute("aTip", new T.Float32BufferAttribute(tip, 1));
    const off = [], N = 7000, x0 = YARD.back + SOIL + 0.12, x1 = DECK.x0 - 0.15, zl = YARD.left - SOIL - 0.1;
    for (let i = 0; i < N * 3 && off.length < N * 4; i++) {
      const x = x0 + rnd() * (x1 - x0), z = rnd() * 12 - 1;
      if (z > zl + 0.25 * WOB(x + 7) || z < zb(x) + 0.78 || x < x0 + 0.25 * WOB(z + 3)) continue;
      off.push(x, z, 0.7 + rnd() * 0.6, rnd() * 6.283);
    }
    geo.setAttribute("aOff", new T.InstancedBufferAttribute(new Float32Array(off), 4)); geo.instanceCount = off.length / 4;
    const blades = keep(new T.Mesh(geo, shaderMat({
      uniforms: { ...common, ...timed }, side: T.DoubleSide,
      vertexShader: `attribute vec4 aOff; attribute float aTip; uniform float uPhase, uWind; varying vec3 vW; varying float vTip;
        void main() { float c = cos(aOff.w), s = sin(aOff.w); vec3 p = position * aOff.z; p.xz = mat2(c, -s, s, c) * p.xz;
          float k = aTip * (0.012 + 0.035 * uWind);
          p.x += k * (sin(uPhase * 1.6 + aOff.x * 0.8 + aOff.y * 0.3) + 0.4 * sin(uPhase * 3.7 + aOff.y * 2.1));
          p.z += k * 0.6 * cos(uPhase * 1.3 + aOff.y * 0.7);
          vec3 w = vec3(aOff.x, ${GROUND.toFixed(2)}, aOff.y) + p; vW = w; vTip = aTip;
          gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0); }`,
      fragmentShader: `${COMMON}\n${hash}\nvarying vec3 vW; varying float vTip;
        void main() { float patchy = fbm(vW.xz * 0.25), clump = noise(vW.xz * 2.6 + 11.0);
          vec3 c = mix(vec3(0.03, 0.08, 0.025), vec3(0.15, 0.31, 0.08) * mix(0.85, 1.1, patchy) * mix(0.85, 1.1, clump), vTip);
          gl_FragColor = vec4(outdoor(c, vec3(0.0, 1.0, 0.0), vW), 1.0); }`,
    })));
    blades.frustumCulled = false;
  }

  // The pond's water, cut to its outline in the shader
  const water = keep(new T.Mesh(new T.PlaneGeometry(POND.ax * 2.8, POND.az * 2.8), shaderMat({ uniforms: { ...common, ...timed }, vertexShader: GROUND_VERT, fragmentShader: WATER_FRAG })));
  water.rotation.x = -Math.PI / 2; water.position.set(POND.x, LAKE, POND.z);

  // The far banks: the old far tree row as a wooded line around the far side of the pond, in segments
  // facing across the water, with hazy hills behind
  const shoreTex = loader.load("/media/white-rabbit/trees-far.webp", (t) => { t.colorSpace = T.SRGBColorSpace; });
  shoreTex.wrapS = T.RepeatWrapping; textures.push(shoreTex);
  const bankMat = shaderMat({
    uniforms: { ...common, uMap: { value: shoreTex } }, vertexShader: GROUND_VERT, side: T.DoubleSide,
    fragmentShader: `${COMMON}\nuniform sampler2D uMap; varying vec3 vW; varying vec2 vUv;
      void main() { vec4 c = texture2D(uMap, vUv * vec2(3.0, 1.0)); if (c.a < 0.4) discard; vec3 k = c.rgb * vec3(0.78, 0.66, 0.5); gl_FragColor = vec4(outdoor(k, vec3(0.3, 0.8, 0.2), vW), 1.0); }`,
  });
  for (let i = 0; i < 12; i++) {
    const a0 = 1.2 + (i / 12) * 3.9, a1 = 1.2 + ((i + 1) / 12) * 3.9, out = 60 / POND.ax;
    const p0 = new T.Vector3(POND.x + Math.cos(a0) * POND.ax * (SHAPE(a0) + out), 0, POND.z + Math.sin(a0) * POND.az * (SHAPE(a0) + out));
    const p1 = new T.Vector3(POND.x + Math.cos(a1) * POND.ax * (SHAPE(a1) + out), 0, POND.z + Math.sin(a1) * POND.az * (SHAPE(a1) + out));
    const len = p0.distanceTo(p1) * 1.08, bank = keep(new T.Mesh(new T.PlaneGeometry(len, 22), bankMat));
    bank.position.set((p0.x + p1.x) / 2, GROUND + 9, (p0.z + p1.z) / 2);
    bank.rotation.y = -Math.atan2(p1.z - p0.z, p1.x - p0.x);
  }
  const hills = keep(new T.Mesh(new T.PlaneGeometry(7000, 200), shaderMat({
    uniforms: { ...common }, vertexShader: GROUND_VERT,
    fragmentShader: `${COMMON}\n${hash}\nvarying vec3 vW; varying vec2 vUv;
      void main() { float h = 0.25 + 0.18 * noise(vec2(vUv.x * 9.0, 0.0)) + 0.1 * noise(vec2(vUv.x * 31.0, 0.0)); if (vUv.y > h) discard;
        gl_FragColor = vec4(mix(vec3(0.36, 0.42, 0.4), uHaze, 0.72), 1.0); }`,
  })));
  hills.rotation.y = Math.PI / 2; hills.position.set(-2600, GROUND + 70, 0);

  // The fences, as they are: six-foot white vinyl privacy panels across the back and down the right side
  // (tongue-and-groove boards between a top and bottom rail, square posts with flat caps every 1.83 m,
  // grimed a little toward the ground), and down the left side an old six-foot cedar stockade gone
  // silver-brown, its pointed boards uneven, on two rails, sagging here and there
  const solid = (color, grain = 0) => shaderMat({ uniforms: { ...common, uColor: { value: new T.Color(color) }, uGrain: { value: grain } }, vertexShader: SOLID_VERT, fragmentShader: SOLID_FRAG });
  const m = new T.Matrix4(), qq = new T.Quaternion(), e = new T.Euler(), at0 = new T.Vector3(), sc0 = new T.Vector3(), tint = new T.Color();
  const FH = 1.83, PANEL = 1.83, runs = [[YARD.back, YARD.right, YARD.back, YARD.left, "vinyl"], [-2.1, YARD.right, YARD.back, YARD.right, "vinyl"], [-2.1, YARD.left, YARD.back, YARD.left, "wood"]];
  // Vinyl: the boards' grooves run up the panel, every 18 cm along it, and it weathers a little at the foot
  const vinyl = (along) => shaderMat({
    uniforms: { ...common }, vertexShader: SOLID_VERT,
    fragmentShader: `${COMMON}\n${hash}\nvarying vec3 vW, vN, vTint;
      void main() { float a = ${along}, y = vW.y - ${GROUND.toFixed(1)};
        vec3 c = vec3(0.8, 0.79, 0.75) * (1.0 - 0.18 * smoothstep(0.012, 0.0, abs(fract(a / 0.178) - 0.5) - 0.48));
        c *= mix(vec3(0.74, 0.76, 0.68), vec3(1.0), smoothstep(0.0, 0.5, y)) * (0.96 + 0.06 * noise(vec2(a * 3.0, y * 2.0)));
        c *= 1.0 - 0.08 * smoothstep(0.65, 0.9, noise(vec2(a * 0.7, y * 1.3) + 4.0));   // a streak of dirt from the rain
        gl_FragColor = vec4(outdoor(c, normalize(vN), vW), 1.0); }`,
  });
  const cedar = solid("#6F6658", 1), post5 = solid("#E6E3DA");
  for (const [x0, z0, x1, z1, kind] of runs) {
    const len = Math.hypot(x1 - x0, z1 - z0), turn = Math.atan2(x1 - x0, z1 - z0), at = (d) => [x0 + ((x1 - x0) * d) / len, z0 + ((z1 - z0) * d) / len];
    if (kind === "vinyl") {
      const mat = vinyl(Math.abs(x1 - x0) > Math.abs(z1 - z0) ? "vW.x" : "vW.z");
      for (let d = 0; d < len - 0.01; d += PANEL) {
        const w = Math.min(PANEL, len - d), [cx, cz] = at(d + w / 2);
        const pan = keep(new T.Mesh(new T.BoxGeometry(0.035, FH - 0.12, w), mat)); pan.position.set(cx, GROUND + 0.06 + (FH - 0.12) / 2 + (rnd() - 0.5) * 0.01, cz); pan.rotation.y = turn;
        pan.rotation.x = (rnd() - 0.5) * 0.006;
        for (const [y, h] of [[FH - 0.05, 0.1], [0.08, 0.08]]) { const r = keep(new T.Mesh(new T.BoxGeometry(0.06, h, w), post5)); r.position.set(cx, GROUND + y, cz); r.rotation.y = turn; }
      }
      for (let d = 0; d <= len + 0.01; d += PANEL) {
        const [x, z] = at(Math.min(d, len)), lean = (rnd() - 0.5) * 0.012;
        const po = keep(new T.Mesh(new T.BoxGeometry(0.127, FH + 0.08, 0.127), post5)); po.position.set(x, GROUND + (FH + 0.08) / 2, z); po.rotation.set(lean, turn, (rnd() - 0.5) * 0.012);
        const cp = keep(new T.Mesh(new T.BoxGeometry(0.155, 0.05, 0.155), post5)); cp.position.set(x, GROUND + FH + 0.1, z); cp.rotation.y = turn;
      }
    } else {
      // Stockade: 9 cm boards, tops cut to a point, each its own height, shade, and tilt; sections sag
      const n = Math.ceil(len / 0.095), boards = keep(new T.InstancedMesh(new T.BoxGeometry(0.02, 1, 0.09), cedar, n)), tips = keep(new T.InstancedMesh(new T.ConeGeometry(0.064, 0.09, 4).rotateY(Math.PI / 4).scale(0.3, 1, 1), cedar, n));
      for (let i = 0; i < n; i++) {
        const d = (i + 0.5) * 0.095, [x, z] = at(d), sag = 0.04 * Math.sin((d / 2.4) * Math.PI) ** 2, h = FH - 0.09 + (rnd() - 0.5) * 0.04 - sag;
        e.set((rnd() - 0.5) * 0.02, turn, (rnd() - 0.5) * 0.025, "YXZ");
        boards.setMatrixAt(i, m.compose(at0.set(x, GROUND + h / 2, z), qq.setFromEuler(e), sc0.set(1, h, 1)));
        tips.setMatrixAt(i, m.compose(at0.set(x, GROUND + h + 0.045, z), qq.setFromEuler(e), sc0.set(1, 1, 1)));
        const w = 0.72 + rnd() * 0.4; boards.setColorAt(i, tint.setRGB(w, w * 0.97, w * 0.93)); tips.setColorAt(i, tint.setRGB(w, w * 0.97, w * 0.93));
      }
      for (const y of [0.35, FH - 0.35]) { const r = keep(new T.Mesh(new T.BoxGeometry(0.04, 0.09, len), cedar)); const [cx, cz] = at(len / 2); r.position.set(cx, GROUND + y, cz + 0.035); r.rotation.y = turn; }   // rails and posts on the neighbor's side
      for (let d = 0; d <= len + 0.01; d += 2.4) { const [x, z] = at(Math.min(d, len)); const po = keep(new T.Mesh(new T.BoxGeometry(0.1, FH + 0.02, 0.1), cedar)); po.position.set(x, GROUND + (FH + 0.02) / 2, z + 0.07); po.rotation.y = turn; }
    }
  }

  // Scalloped grey edging stones, three arches along each top, set on the soil side of the lawn's left and
  // back edges and of the trellis square's edge toward the lawn, following each edge's wander: each sunk
  // its own depth, a little out of line and tipped, its own grey, with a gap here and there
  {
    const BL = 0.3, BH = 0.14, sh = new T.Shape();
    sh.moveTo(0, 0); sh.lineTo(BL, 0); sh.lineTo(BL, BH - 0.025);
    for (let k = 2; k >= 0; k--) { const c = (k + 0.5) * BL / 3; sh.absarc(c, BH - 0.025 - 0.04, 0.065, Math.atan2(0.04, BL / 6), Math.PI - Math.atan2(0.04, BL / 6), false); }
    sh.lineTo(0, 0);
    const geo = new T.ExtrudeGeometry(sh, { depth: 0.05, bevelEnabled: true, bevelSize: 0.004, bevelThickness: 0.004, bevelSegments: 1, curveSegments: 6 }).translate(-BL / 2, 0, -0.025);
    const edges = [
      [(d) => [d, YARD.left - SOIL + 0.25 * WOB(d + 7) + 0.04], YARD.back + SOIL + 0.1, DECK.x0 - 0.3],     // the left mulch border, along x, up to the deck's front-left corner
      [(d) => [YARD.back + SOIL + 0.25 * WOB(d + 3) - 0.04, d], CURVE[CURVE.length - 1][1] + 0.75, YARD.left - SOIL],   // the back border, along z
      [(d) => [d, PATCH.z1 + 0.25 * WOB(d + 19) - 0.04], PATCH.x0, PATCH.x1],                              // the trellis square's lawn-side edge
    ];
    const count = edges.reduce((a, [, a0, a1]) => a + Math.ceil(Math.abs(a1 - a0) / BL) + 2, 0);
    const stones = keep(new T.InstancedMesh(geo, solid("#FFFFFF", 0.4), count)); let nb = 0;
    for (const [f, a0, a1] of edges) {
      for (let d = Math.min(a0, a1); d < Math.max(a0, a1) - 0.1; d += BL + 0.008 + rnd() * 0.012) {
        if (rnd() < 0.03) continue;                                                                   // one gone
        const [x, z] = f(d + BL / 2), [x2, z2] = f(d + BL / 2 + 0.05), yaw = Math.atan2(-(z2 - z), x2 - x);
        const odd = rnd() < 0.08;   // straight and true along the edge, the odd one a little off
        e.set((rnd() - 0.5) * (odd ? 0.08 : 0.015), yaw + (rnd() - 0.5) * (odd ? 0.06 : 0.008), (rnd() - 0.5) * (odd ? 0.04 : 0.01), "YXZ");
        stones.setMatrixAt(nb, m.compose(at0.set(x, GROUND - 0.04 - (odd ? rnd() * 0.03 : rnd() * 0.006), z), qq.setFromEuler(e), sc0.set(1, 1, 1)));
        const g = 0.36 + rnd() * 0.14; stones.setColorAt(nb++, tint.setRGB(g, g * 0.99, g * 0.96));
      }
    }
    stones.count = nb;
  }

  // The neighbor's house past the left fence: two stories of pale clapboard under a dark shingle gable, with
  // white-trimmed windows (a few lit warm, a couple with blinds half down), a back door and step, and a
  // downspout, weathered a little where the rain runs
  const HOUSE = { x0: -18.5, x1: -7.5, z0: 14, z1: 24, h: 6.2, ridge: 9.0 };
  const siding = shaderMat({
    uniforms: { ...common }, vertexShader: SOLID_VERT,
    fragmentShader: `${COMMON}\n${hash}\nvarying vec3 vW, vN, vTint;
      void main() {
        vec3 n = normalize(vN), c = vec3(0.7, 0.74, 0.76);
        float y = vW.y - ${GROUND.toFixed(1)};
        c *= 0.86 + 0.14 * smoothstep(0.0, 0.03, fract(y / 0.2));                 // clapboard shadow lines
        c *= 0.92 + 0.08 * noise(vW.xz * 0.7 + y * 0.3);
        c = mix(c * 0.8, c, smoothstep(0.0, 0.6, y));                               // splash grime at the foot
        vec2 f = abs(n.z) > 0.5 ? vec2(vW.x, y) : vec2(vW.z, y);
        // Windows: two rows, set unevenly along the wall, each a white frame round dark glass
        for (int r = 0; r < 2; r++) {
          float wy = r == 0 ? 1.0 : 4.1;
          for (int k = 0; k < 4; k++) {
            float wx = (abs(n.z) > 0.5 ? -16.9 : 15.2) + float(k) * 2.9 + (r == 1 && k == 2 ? 0.4 : 0.0);
            vec2 d = abs(f - vec2(wx, wy + 0.75)) - vec2(0.48, 0.72);
            float frame = step(max(d.x, d.y), 0.08), glass = step(max(d.x, d.y), 0.0);
            float blind = step(wy + 0.75 + 0.72 - (hash(vec2(float(k), float(r))) > 0.6 ? 0.6 : 0.0), y);
            vec3 g = mix(vec3(0.08, 0.1, 0.12), vec3(0.85, 0.7, 0.45), step(0.85, hash(vec2(float(k) + 3.0, float(r)))) * 0.6);
            g = mix(g, vec3(0.8, 0.78, 0.7), blind * glass);
            c = mix(c, vec3(0.93), frame); c = mix(c, g, glass);
          }
        }
        gl_FragColor = vec4(outdoor(c, n, vW), 1.0);
      }`,
  });
  const walls = keep(new T.Mesh(new T.BoxGeometry(HOUSE.x1 - HOUSE.x0, HOUSE.h, HOUSE.z1 - HOUSE.z0), siding));
  walls.position.set((HOUSE.x0 + HOUSE.x1) / 2, GROUND + HOUSE.h / 2, (HOUSE.z0 + HOUSE.z1) / 2);
  // The gable roof, ridge running along x, with a little overhang and a dark shingle texture
  {
    const ox = 0.35, x0 = HOUSE.x0 - ox, x1 = HOUSE.x1 + ox, z0 = HOUSE.z0 - ox, z1 = HOUSE.z1 + ox, zm = (HOUSE.z0 + HOUSE.z1) / 2, y0 = GROUND + HOUSE.h - 0.25, y1 = GROUND + HOUSE.ridge;
    const v = [x0, y0, z0, x1, y0, z0, x1, y1, zm, x0, y0, z0, x1, y1, zm, x0, y1, zm, x1, y0, z1, x0, y0, z1, x0, y1, zm, x1, y0, z1, x0, y1, zm, x1, y1, zm,
      x0, y0, z0, x0, y1, zm, x0, y0, z1, x1, y0, z1, x1, y1, zm, x1, y0, z0];
    const g = new T.BufferGeometry(); g.setAttribute("position", new T.Float32BufferAttribute(v, 3)); g.computeVertexNormals();
    keep(new T.Mesh(g, shaderMat({
      uniforms: { ...common }, vertexShader: SOLID_VERT, side: T.DoubleSide,
      fragmentShader: `${COMMON}\n${hash}\nvarying vec3 vW, vN, vTint;
        void main() { vec3 n = normalize(vN); float row = floor((vW.y) / 0.14);
          vec3 c = vec3(0.2, 0.19, 0.18) * (0.8 + 0.35 * hash(vec2(floor(vW.x / 0.33 + row * 0.5), row)));
          if (abs(n.x) > 0.9) c = vec3(0.72, 0.75, 0.77);                    // the gable ends are sided
          gl_FragColor = vec4(outdoor(c, n, vW), 1.0); }`,
    })));
  }
  const spout = keep(new T.Mesh(new T.BoxGeometry(0.07, HOUSE.h, 0.07), solid("#E8E6E0")));
  spout.position.set(HOUSE.x1 + 0.05, GROUND + HOUSE.h / 2, HOUSE.z0 + 0.4);

  // The deck, as in the photo from the window: 3.56 m out from the house and 6.6 m across, centered on the window, painted a deep brownish
  // burgundy, a little worn where feet go. 5/4 x 6 decking boards run left to right with thin gaps, in staggered
  // lengths, over a rim joist on 6x6 posts. The railing has a wide, flat 2x6 cap over turned spindles 16 cm apart
  // and a bottom rail; big square posts stand at every corner and stair, rising above the cap under their own
  // caps, and the same posts sit flush under the cap between them. Stairs go down off the front, left of
  // center, to the lawn, and off the right side, 7 spindles from the front corner, to the concrete; the left side
  // runs railed all the way back to the house
  {
    const paint = solid("#34201F", 1), worn = new T.Color(), H = DECK.y, OC = 0.16, PS = 0.12, CAP = 0.92;
    const D = DECK.x1 - DECK.x0, L = DECK.z1 - DECK.z0, BW = 0.14, rows = Math.floor(D / (BW + 0.01));
    const planks = keep(new T.InstancedMesh(new T.BoxGeometry(BW, 0.025, 1), paint, rows * 6));
    let k = 0;
    for (let i = 0; i < rows; i++) {
      const x = DECK.x0 + BW / 2 + 0.01 + i * (BW + 0.01);   // a 1 cm gap between boards, dark below
      let u = -rnd() * 2.4;                                               // butt joints staggered row to row
      while (u < L) {
        const len = 2.4 + Math.floor(rnd() * 3) * 0.6, a = Math.max(0, u), b = Math.min(L, u + len);
        if (b - a > 0.05) {
          planks.setMatrixAt(k, m.compose(at0.set(x, H + (rnd() - 0.5) * 0.003, DECK.z0 + (a + b) / 2), qq.identity(), sc0.set(1, 1, b - a - 0.004)));
          const w = 0.88 + rnd() * 0.18, scuff = rnd() < 0.1 ? 1.18 : 1;
          planks.setColorAt(k++, worn.setRGB(w * scuff, w * (0.95 + rnd() * 0.06) * scuff, w * scuff));
        }
        u += len;
      }
    }
    planks.count = k;
    const piece = (w, h, d, x, y, z, ry = 0) => { const o = keep(new T.Mesh(new T.BoxGeometry(w, h, d), paint)); o.position.set(x, y, z); o.rotation.y = ry; return o; };
    // Rim joists (2x10) round the open sides, 6x6 posts under them to the ground
    piece(0.05, 0.24, L, DECK.x0, H - 0.13, (DECK.z0 + DECK.z1) / 2);
    for (const z of [DECK.z0, DECK.z1]) piece(D, 0.24, 0.05, (DECK.x0 + DECK.x1) / 2, H - 0.13, z);
    for (let z = DECK.z0 + 0.08; z < DECK.z1; z += 2.4) piece(0.14, H - GROUND, 0.14, DECK.x0 + 0.1, (H + GROUND) / 2, z);
    for (const z of [DECK.z0 + 0.08, DECK.z1 - 0.08]) for (let x = DECK.x0 + 0.1; x < DECK.x1 - 0.5; x += 2.4) piece(0.14, H - GROUND, 0.14, x, (H + GROUND) / 2, z);
    // Turned spindles: a lathe profile with beads and a slim waist, instanced along every railing
    const prof = [[0.001, 0], [0.019, 0], [0.019, 0.07], [0.014, 0.09], [0.022, 0.13], [0.012, 0.2], [0.01, 0.45], [0.016, 0.55], [0.01, 0.6], [0.012, 0.66], [0.02, 0.69], [0.019, 0.76], [0.001, 0.76]];
    const spindle = new T.LatheGeometry(prof.map(([r, y]) => new T.Vector2(r, y)), 10);
    const spindles = keep(new T.InstancedMesh(spindle, paint, 900)); let ns = 0;
    // A main post rises above the cap under its own cap; an inner one stops flush under the cap
    const post = (x, y, z, main) => {
      const h = main ? CAP + 0.14 : CAP - 0.038; piece(PS, h, PS, x, y + h / 2, z);
      if (main) { piece(PS + 0.04, 0.03, PS + 0.04, x, y + h + 0.015, z); piece(PS + 0.01, 0.025, PS + 0.01, x, y + h + 0.042, z); }
    };
    // A railing from (x0, y0, z0) to (x1, y1, z1): main posts at its ends, inner posts at most 1.9 m apart, a wide
    // flat cap and a bottom rail, and spindles 16 cm apart (measured level, as on the stairs)
    const railing = (x0, y0, z0, x1, y1, z1, ends = [true, true]) => {
      const run = Math.hypot(x1 - x0, z1 - z0), turn = Math.atan2(x1 - x0, z1 - z0), slope = Math.atan2(y1 - y0, run), len = Math.hypot(run, y1 - y0);
      const mx = (x0 + x1) / 2, my = (y0 + y1) / 2, mz = (z0 + z1) / 2;
      const cap = piece(0.14, 0.038, len, mx, my + CAP - 0.019, mz, turn); cap.rotation.order = "YXZ"; cap.rotation.x = -slope;
      const bot = piece(0.089, 0.038, len, mx, my + 0.08, mz, turn); bot.rotation.order = "YXZ"; bot.rotation.x = -slope;
      if (ends[0]) post(x0, y0, z0, true); if (ends[1]) post(x1, y1, z1, true);
      const bays = Math.max(1, Math.ceil(run / 1.9));
      for (let b = 1; b < bays; b++) { const t = b / bays; post(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, z0 + (z1 - z0) * t, false); }
      const n = Math.max(1, Math.round(run / OC));
      for (let i = 1; i < n; i++) {
        const t = i / n, sy = (CAP - 0.04 - 0.1) / 0.76;
        if (bays > 1 && Math.abs((t * bays) - Math.round(t * bays)) * run / bays < PS * 0.7) continue;   // not through an inner post
        spindles.setMatrixAt(ns++, m.compose(at0.set(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t + 0.1, z0 + (z1 - z0) * t), qq.identity(), sc0.set(1, sy, 1)));
      }
    };
    // Openings: the front stairs (F0 to F1, centered on the lawn between the bed and the left border) and the right stairs (R0 to R1, 7 spindles in from the front corner)
    const F0 = 6.1, F1 = 7.3, R0 = DECK.x0 + 8 * OC, R1 = R0 + 1.0;   // R1 to the house is 7 spindles too
    railing(DECK.x0, H, DECK.z1, DECK.x0, H, F1); railing(DECK.x0, H, F0, DECK.x0, H, DECK.z0);
    railing(DECK.x0, H, DECK.z0, R0, H, DECK.z0, [false, true]); railing(R1, H, DECK.z0, DECK.x1, H, DECK.z0);
    railing(DECK.x0, H, DECK.z1, DECK.x1, H, DECK.z1, [false, true]);
    // Stairs: open risers of 2x12 treads on three stringers, five rises to the ground, a railing each side
    const stairs = (x, z, dx, dz, width) => {
      const rise = (H - GROUND) / 5, n = 5, tread = 0.28, along = dz !== 0, run = tread * (n - 0.3);
      for (let i = 0; i < n; i++) {
        const y = H - rise * (i + 1) + 0.02, d = tread * (i + 0.5);
        if (y < GROUND + 0.05) break;
        piece(along ? width : tread + 0.02, 0.038, along ? tread + 0.02 : width, x + dx * d, y, z + dz * d);
      }
      for (const o of [-width / 2 + 0.03, 0, width / 2 - 0.03]) {
        const sx = along ? o : 0, sz = along ? 0 : o, sl = Math.hypot(run, H - GROUND);
        const st = piece(0.045, 0.28, sl, x + dx * run / 2 + sx, (H + GROUND) / 2 - 0.1, z + dz * run / 2 + sz, Math.atan2(dx, dz));
        st.rotation.order = "YXZ"; st.rotation.x = Math.atan2(H - GROUND, run);
      }
      for (const o of [-width / 2, width / 2]) {
        const sx = along ? o : 0, sz = along ? 0 : o;
        railing(x + sx, H, z + sz, x + dx * run + sx, GROUND + 0.05, z + dz * run + sz, [false, true]);
      }
    };
    stairs(DECK.x0, (F0 + F1) / 2, -1, 0, F1 - F0);
    stairs((R0 + R1) / 2, DECK.z0, 0, -1, R1 - R0);
    spindles.count = ns;
  }

  // The porch swing and the garden: rendered in Blender (planning folder, blender/yard.blend) from the way
  // the window looks at them, with their own shadows, so each stands as a card facing the house. The swing
  // is a three-seat porch swing on an A-frame of matte black tube, modeled after the owner's own: rounded
  // shoulders into the top bar, braces and stretchers, silver bolts at the joints, and rust coming through
  // at the feet. Its seat, hung on springs, carries a one-piece seat-and-back cushion, and is a second card
  // hung from the bar, swinging a little in the wind. The garden runs along the back fence: sunflowers (Sketchfab,
  // by zvanstone, CC BY 4.0), late in the season and wilting, among weeds and grass clumps (Poly Haven, CC0);
  // a long raised bed with two leaning lattice trellises, squash vines climbing them and running on along
  // the fence with big leaves, yellow flowers, and long squash hanging (the fruit from a scan by
  // vtIndigenousCommunityGarden, Sketchfab, CC BY 4.0); and a bed of cherry tomatoes in wire cages (Sketchfab,
  // by zvanstone, CC BY 4.0). The plants sway with the wind, more toward their tops
  const sprite = (url, w, h, at, toward, sway = 0, parent = group) => {
    const map = { value: null };
    loader.load(url, (t) => { t.colorSpace = T.SRGBColorSpace; map.value = t; textures.push(t); });
    const card = new T.PlaneGeometry(w, h, 24, 4); card.translate(0, h / 2, 0);
    const mesh = new T.Mesh(card, shaderMat({
      uniforms: { ...common, ...timed, uMap: map, uSway: { value: sway } }, transparent: true, depthWrite: false, side: T.DoubleSide,
      vertexShader: `uniform float uPhase, uWind, uSway; varying vec3 vW; varying vec2 vUv;
        void main() { vUv = uv; vec3 p = position;
          float k = uv.y * uv.y * uSway;
          p.x += (sin(uPhase * 0.9 + uv.x * 9.0) * 0.04 + sin(uPhase * 1.9 + uv.x * 17.0) * 0.012) * (1.0 + 2.0 * uWind) * k + uWind * 0.07 * k;   // each plant a beat apart, never a ripple
          vec4 w = modelMatrix * vec4(p, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: `${COMMON}\nuniform sampler2D uMap; varying vec3 vW; varying vec2 vUv;
        void main() { vec4 c = texture2D(uMap, vUv); if (c.a < 0.02) discard;
          float d = distance(vW, cameraPosition);
          gl_FragColor = vec4(mix(c.rgb * (0.78 + 0.22 * uSun), uHaze, 1.0 - exp(-d / 1100.0)), c.a); }`,
    }));
    parent.add(mesh);
    mesh.position.set(at[0], at[1], at[2]);
    if (toward) mesh.rotation.y = Math.atan2(toward[0], toward[2]);
    return mesh;
  };
  // The porch swing, built in 3D: parallel to the right fence (its top bar runs along x), on the concrete in
  // line with the greenhouse and the trellis square, just past the square toward the house. Matte black A-frame
  // with a little dark rust at the feet; the seat hangs from springs on the bar, facing left (+z), with a thick
  // cushion stitched into three seats and three backs in a cream fabric printed with green and light orange
  // leaves. It swings left and right, about the bar
  const SWING = [-14.5, GROUND, (GREEN.z0 + GREEN.z1) / 2 + 0.6];
  const seat = new T.Group();
  {
    const sw = new T.Group(); sw.position.set(SWING[0], SWING[1], SWING[2]); sw.rotation.y = 0.03; keep(sw);
    const black = solid("#141414", 0.3), rust = solid("#2E1A10", 0.8), steel = solid("#A8ACB0");
    const BAR = 2.05, HALF = 1.18, FOOT = 0.78;
    // A tube from a to b
    const tube = (mat, r, a, b, parent = sw) => {
      const A = new T.Vector3(...a), B = new T.Vector3(...b), d = B.clone().sub(A);
      const o = new T.Mesh(new T.CylinderGeometry(r, r, d.length(), 8), mat);
      o.position.copy(A).add(B).multiplyScalar(0.5); o.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), d.normalize()); parent.add(o); return o;
    };
    tube(black, 0.03, [-HALF - 0.04, BAR, 0], [HALF + 0.04, BAR, 0]);                             // the top bar
    for (const x of [-HALF, HALF]) {
      for (const z of [-FOOT, FOOT]) { tube(black, 0.024, [x, BAR, 0], [x, 0.03, z]); tube(rust, 0.025, [x, 0.0, z], [x, 0.16, z * 0.93]); }
      tube(black, 0.02, [x, 0.03, -FOOT - 0.02], [x, 0.03, FOOT + 0.02]);                       // the foot bar
      tube(rust, 0.021, [x, 0.03, -0.25], [x, 0.03, 0.2]);
      tube(black, 0.016, [x, 0.95, -0.42], [x, 0.95, 0.42]);                                     // the stretcher
      const inward = x < 0 ? 1 : -1;
      // braces from partway down each leg up into the bar, joined at both ends
      const t = 0.55 / (BAR - 0.03);
      for (const z of [-FOOT, FOOT]) tube(black, 0.016, [x, BAR - 0.55, z * t], [x + inward * 0.42, BAR, 0]);
    }
    // The seat on its springs, its frame black, chains in a V to each end
    seat.position.set(SWING[0], SWING[1] + BAR, SWING[2]); seat.rotation.y = 0.03; keep(seat);
    const SY = 0.48 - BAR, SL = 1.86, SD = 0.62;
    for (const x of [-0.9, 0.9]) {
      tube(steel, 0.018, [x, -0.02, 0], [x, -0.17, 0], seat);
      for (const z of [-SD / 2, SD / 2]) tube(black, 0.007, [x, -0.17, 0], [x * 1.02, SY + 0.05, z], seat);
    }
    for (const z of [-SD / 2, SD / 2]) tube(black, 0.018, [-SL / 2, SY, z], [SL / 2, SY, z], seat);
    for (const x of [-SL / 2, SL / 2]) { tube(black, 0.018, [x, SY, -SD / 2], [x, SY, SD / 2], seat); tube(black, 0.016, [x, SY + 0.22, SD / 2], [x, SY + 0.22, -SD / 2 + 0.05], seat); tube(black, 0.016, [x, SY, SD / 2], [x, SY + 0.22, SD / 2], seat); tube(black, 0.016, [x, SY, -SD / 2], [x, SY + 0.62, -SD / 2 - 0.2], seat); }
    tube(black, 0.016, [-SL / 2, SY + 0.62, -SD / 2 - 0.2], [SL / 2, SY + 0.62, -SD / 2 - 0.2], seat);
    // The fabric: cream, scattered with pointed leaves in greens and light orange on thin curling stems
    const fc = document.createElement("canvas"); fc.width = fc.height = 256; const f = fc.getContext("2d");
    f.fillStyle = "#E3DCC8"; f.fillRect(0, 0, 256, 256);
    f.strokeStyle = "#5E7A44"; f.lineWidth = 1.2;
    for (let i = 0; i < 9; i++) { f.beginPath(); let x = rnd() * 256, y = rnd() * 256; f.moveTo(x, y); for (let k = 0; k < 6; k++) { const nx = x + (rnd() - 0.5) * 70, ny = y + (rnd() - 0.5) * 70; f.quadraticCurveTo(x + (rnd() - 0.5) * 60, y + (rnd() - 0.5) * 60, nx, ny); x = nx; y = ny; } f.stroke(); }
    const leafCols = ["#3F6B2A", "#57803A", "#6E9445", "#E9A262", "#F0B47A", "#4C7533"];
    for (let i = 0; i < 70; i++) {
      const x = rnd() * 256, y = rnd() * 256, a = rnd() * 6.28, l = 9 + rnd() * 9, w = l * (0.32 + rnd() * 0.15);
      f.save(); f.translate(x, y); f.rotate(a); f.fillStyle = leafCols[Math.floor(rnd() * leafCols.length)];
      f.beginPath(); f.moveTo(-l, 0); f.quadraticCurveTo(0, -w * 2, l, 0); f.quadraticCurveTo(0, w * 2, -l, 0); f.fill();
      f.strokeStyle = "rgba(40,50,25,0.35)"; f.lineWidth = 0.6; f.beginPath(); f.moveTo(-l * 0.9, 0); f.lineTo(l * 0.9, 0); f.stroke(); f.restore();
    }
    const fabTex = new T.CanvasTexture(fc); fabTex.colorSpace = T.SRGBColorSpace; fabTex.wrapS = fabTex.wrapT = T.RepeatWrapping; textures.push(fabTex);
    // Sun-faded: the cream gone dull and a little yellowed, the print paler, the seat most of all
    const fabricFor = (fade) => shaderMat({
      uniforms: { ...common, uMap: { value: fabTex }, uFade: { value: fade } },
      vertexShader: `varying vec3 vW, vN; varying vec2 vUv; void main() { vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: `${COMMON}\nuniform sampler2D uMap; varying vec3 vW, vN; varying vec2 vUv;
        uniform float uFade;
        void main() { vec3 c = texture2D(uMap, vUv).rgb * 0.82; float g = dot(c, vec3(0.33));
          c = mix(c, vec3(g) * vec3(0.95, 0.9, 0.78), uFade) * (1.0 - 0.18 * uFade);
          gl_FragColor = vec4(outdoor(c, normalize(vN), vW), 1.0); }`,
    });
    const fabric = fabricFor(0.35), fabricSeat = fabricFor(0.6);
    // One cushion for the seat and one for the back, each the full width: puffed thick, and pulled in along two
    // stitched seams so it reads as three places to sit
    const cushion = (w, h, d, thick, mat) => {
      const g = new T.BoxGeometry(w, h, d, 48, thick === 1 ? 4 : 10, thick === 1 ? 10 : 4), pos = g.attributes.position, uvs = g.attributes.uv;
      const half = [w / 2, h / 2, d / 2], cross = thick === 1 ? 2 : 1;
      for (let i = 0; i < pos.count; i++) {
        const v = [pos.getX(i), pos.getY(i), pos.getZ(i)], q = v.map((c, k) => c / half[k]);
        const sec = ((v[0] + w / 2) / (w / 3)) % 1, along = Math.max(0, Math.sin(sec * Math.PI));           // 0 at the seams, 1 mid-seat
        const sx = (v[0] + w / 2) / (w / 3), seam = Math.exp(-(((sx - 1) / 0.06) ** 2)) + Math.exp(-(((sx - 2) / 0.06) ** 2));
        const bulge = (0.35 + 0.65 * along ** 0.6) * (1 - q[cross] ** 2) * (1 - q[0] ** 8);
        // the stitched seams pull in, and each place is tufted with a button at its middle
        const tuft = Math.exp(-(((sec - 0.5) / 0.09) ** 2) - ((q[cross] / 0.16) ** 2));
        v[thick] *= (1 + 1.1 * bulge) * (1 - 0.55 * Math.min(1, seam) * (q[thick] > 0 ? 1 : 0.3)) * (1 - 0.32 * tuft * (q[thick] > 0 ? 1 : 0));
        v[cross] *= 1 - 0.1 * Math.abs(q[thick]) ** 2;
        v[0] *= 1 - 0.04 * Math.abs(q[thick]) ** 2;
        pos.setXYZ(i, v[0], v[1], v[2]); uvs.setXY(i, (v[0] + v[2]) * 1.6, (v[1] + v[2] * 0.5) * 1.6);
      }
      g.computeVertexNormals(); const o = new T.Mesh(g, mat);
      for (let i = 0; i < 3; i++) {
        const b = new T.Mesh(new T.SphereGeometry(0.022, 10, 6), mat); b.scale.setComponent(thick, 0.45);
        const at = [(-1 + i) * w / 3, 0, 0]; at[thick] = half[thick] * 2.1 * 0.68; b.position.set(...at); o.add(b);
      }
      return o;
    };
    const cs = cushion(SL - 0.02, 0.13, SD - 0.04, 1, fabricSeat); cs.position.set(0, SY + 0.11, 0.03); seat.add(cs);
    const cb = cushion(SL - 0.02, 0.52, 0.12, 2, fabric); cb.position.set(0, SY + 0.44, -SD / 2 - 0.02); cb.rotation.x = -0.32; seat.add(cb);
  }
  // The garden was rendered square on to its row and lies along it (the back fence), so both its ends
  // stand at their true depths from any view
  sprite("/media/white-rabbit/yard-garden.webp", 17.04, 2.99, [(BED[0] + BED[1]) / 2, GROUND - 0.32, (BED[2] + BED[3]) / 2 + 0.17], [1, 0, 0], 1);   // set into the soil

  // The stone bed: a low curving wall along CURVE of tan split-face retaining blocks, as in the photos, each a
  // little rough and its own shade of sun-faded tan, laid in three staggered courses on both faces and across
  // both ends, filled with dirt that the
  // plants grow from; planted from end to end: a bushy green plant, flowers, a rose, more
  // flowers, a run of daylily leaves, and a last rose (plants rendered in Blender into one atlas; the rose
  // from Sketchfab, by RosticOstafi, CC BY 4.0; nettle, gazania, and periwinkle from Poly Haven, CC0)
  {
    const path = new T.CatmullRomCurve3(CURVE.map(([x, z]) => new T.Vector3(x, 0, z)), false, "centripetal");
    const len = path.getLength(), W = 1.43, Hb = 0.55, n = Math.ceil(len / 0.3);
    const stone = solid("#FFFFFF", 0.6), dirt = solid("#26170C", 1), mossMat = solid("#FFFFFF", 1);
    // Four rough stone shapes: a subdivided box with every corner pushed about (shared corners move
    // together, so the faces stay closed), chipped and lumpy; each placement also stretches and turns its own
    const rough = (k) => {
      const g = new T.BoxGeometry(1, 1, 1, 4, 2, 2).toNonIndexed(), pos = g.attributes.position, off = new Map();
      for (let i = 0; i < pos.count; i++) {
        const key = `${pos.getX(i).toFixed(3)},${pos.getY(i).toFixed(3)},${pos.getZ(i).toFixed(3)}`;
        if (!off.has(key)) off.set(key, [(rnd() - 0.5) * 0.05, (rnd() - 0.5) * 0.07, (rnd() - 0.5) * (k === 4 ? 0.22 : 0.12)]);   // blocks: square, faces a little split and rough
        const o = off.get(key); pos.setXYZ(i, pos.getX(i) * (1 + o[0]), pos.getY(i) * (1 + o[1]) + (pos.getY(i) > 0 ? o[1] * 0.4 : 0), pos.getZ(i) + o[2] * 0.5);
      }
      g.computeVertexNormals(); return g;
    };
    const cap = Math.ceil(len / 0.4) * 2 + 40;
    const sets = [0, 1, 2, 3].map((k) => keep(new T.InstancedMesh(rough(k), stone, cap))), used = [0, 0, 0, 0];
    const p = new T.Vector3(), tng = new T.Vector3(), nrm = new T.Vector3();
    const lay = (x, y, z, yaw, sx, sy, sz) => {
      const k = Math.floor(rnd() * 4), inst = sets[k];
      e.set((rnd() - 0.5) * 0.08, yaw + (rnd() - 0.5) * 0.1, (rnd() - 0.5) * 0.08, "YXZ");
      inst.setMatrixAt(used[k], m.compose(at0.set(x, y, z), qq.setFromEuler(e), sc0.set(sx, sy, sz)));
      // Every block its own sun-faded tan, a few darker with weather
      const g = (0.34 + rnd() * 0.1) * (rnd() < 0.15 ? 0.8 : 1);
      inst.setColorAt(used[k]++, tint.setRGB(g, g * 0.86, g * 0.64));
    };
    // Dark green moss grown into the joints: tufts in the gaps between stones and runs along the course line
    const moss = keep(new T.InstancedMesh(rough(4), mossMat, cap * 2)); let km = 0;
    const tuft = (x, y, z, yaw, sx, sy, sz) => {
      if (km >= cap * 2) return;
      e.set(0, yaw + (rnd() - 0.5) * 0.3, (rnd() - 0.5) * 0.3, "YXZ");
      moss.setMatrixAt(km, m.compose(at0.set(x, y, z), qq.setFromEuler(e), sc0.set(sx, sy, sz)));
      const g = 0.7 + rnd() * 0.5; moss.setColorAt(km++, tint.setRGB(0.045 * g, 0.1 * g, 0.032 * g));
    };
    // Both faces: each course walks the curve laying stones of its own lengths, so the joints never line up
    for (const side of [-1, 1]) for (const [y0, h0] of [[0.0, 0.19], [0.18, 0.19], [0.36, 0.19]]) {
      let s0 = rnd() * 0.3;
      while (s0 < len - 0.05) {
        const L = Math.min(0.42 * (0.92 + rnd() * 0.16), len - s0), u = (s0 + L / 2) / len;
        path.getPointAt(Math.min(u, 1), p); path.getTangentAt(Math.min(u, 1), tng); nrm.set(-tng.z, 0, tng.x);
        const th = 0.26 + rnd() * 0.03, h = h0 + (rnd() - 0.5) * 0.015, inset = W / 2 - th / 2 + (rnd() - 0.5) * 0.02;
        const yaw = Math.atan2(tng.x, tng.z), face = inset + th / 2 - 0.01;
        lay(p.x + nrm.x * side * inset, GROUND + y0 + h / 2, p.z + nrm.z * side * inset, yaw, th, h, L + 0.04);
        // moss in the joint at this stone's end, and along the course line under the upper stones
        if (rnd() < 0.12) { const ex = tng.x * L / 2, ez = tng.z * L / 2; tuft(p.x + nrm.x * side * face + ex, GROUND + y0 + h * (0.3 + rnd() * 0.4), p.z + nrm.z * side * face + ez, yaw, 0.05, h * (0.4 + rnd() * 0.5), 0.045 + rnd() * 0.03); }
        if (y0 > 0.1 && rnd() < 0.1) { const o = (rnd() - 0.5) * L * 0.5; tuft(p.x + nrm.x * side * face + tng.x * o, GROUND + y0 + 0.005, p.z + nrm.z * side * face + tng.z * o, yaw, 0.045, 0.035 + rnd() * 0.02, L * (0.25 + rnd() * 0.4)); }
        s0 += L + (rnd() - 0.5) * 0.04;
      }
    }
    // Both ends: stones laid across, again of mixed lengths
    for (const u of [0, 1]) {
      path.getPointAt(u, p); path.getTangentAt(u, tng); nrm.set(-tng.z, 0, tng.x);
      const yaw = Math.atan2(nrm.x, nrm.z), back = u === 0 ? 1 : -1;
      for (const [y0, h0] of [[0.0, 0.19], [0.18, 0.19], [0.36, 0.19]]) {
        let w0 = -W / 2 + rnd() * 0.15;
        while (w0 < W / 2 - 0.05) {
          const L = Math.min(0.42 * (0.92 + rnd() * 0.16), W / 2 + 0.05 - w0), c = w0 + L / 2, th = 0.26 + rnd() * 0.03, h = h0 + (rnd() - 0.5) * 0.015;
          lay(p.x + nrm.x * c + tng.x * back * th / 2, GROUND + y0 + h / 2, p.z + nrm.z * c + tng.z * back * th / 2, yaw, th, h, L + 0.03);
          w0 += L;
        }
      }
    }
    for (let k = 0; k < 4; k++) sets[k].count = used[k];
    moss.count = km;
    // The dirt inside, a little below the stones' tops, clumped and uneven
    for (let i = 0; i < n; i++) {
      const u = (i + 0.5) / n; path.getPointAt(u, p); path.getTangentAt(u, tng);
      const top = Hb - 0.06 + (rnd() - 0.5) * 0.03;
      const core = keep(new T.Mesh(new T.BoxGeometry(W - 0.22, top, len / n + 0.03), dirt)); core.position.set(p.x, GROUND + top / 2, p.z); core.rotation.y = Math.atan2(tng.x, tng.z);
    }
    // The plants, standing in the bed and turning to the camera like the trees
    const FLORA = { bush: [0.0, 0.5, 0.25, 0.8145, 1.3, 0.85], mint: [0.0, 0.5, 0.25, 0.8145, 1.0, 0.78], flowersA: [0.25, 0.5, 0.5, 0.9219, 0.75, 0.55], flowersB: [0.5, 0.5, 0.75, 0.8906, 0.85, 0.6],
      rose: [0.7964, 0.5, 0.9531, 1.0, 1.0, 1.45], andromeda: [0.2788, 0.0, 0.4707, 0.5, 3.0, 2.6], andromedaXL: [0.2788, 0.0, 0.4707, 0.5, 3.3, 4.2],
      mintLow: [0.0, 0.5, 0.25, 0.8145, 1.45, 0.42], branchy: [0.5259, 0.0, 0.7241, 0.5, 2.0, 2.7],
      pinkrose: [0.7964, 0.5, 0.9531, 1.0, 1.3, 2.1], daylily: [0.0, 0.0, 0.25, 0.2627, 1.25, 0.62], crepe: [0.2788, 0.0, 0.4707, 0.5, 4.4, 5.8], pear: [0.5054, 0.0, 0.7437, 0.5, 5.25, 5.5] };
    // As the photos have it, planted thick: a crowd of color at the deck end (marigolds and cosmos), then the
    // bed filled on up its length, two staggered rows of daylily leaves, mint, bushy plants, roses, and more
    // flowers, with the long-leafed spiky shrub (built below) at the deck end, before the flowers
    const plan = [], near = ["flowersA", "flowersB", "flowersA", "flowersB", "flowersA", "flowersB", "daylily", "flowersB"];
    const along = ["daylily", "flowersB", "mint", "bush", "flowersA", "daylily", "mintLow", "bush", "flowersB", "rose", "daylily", "mint"];
    for (let i = 0, u = 0.075; u < 0.95; i++, u += u < 0.22 ? 0.016 : 0.024) plan.push([u < 0.22 ? near[i % near.length] : along[i % along.length], u, i % 2 ? 1 : -1]);
    const tan = new T.Vector3();
    const items = plan.map(([k, u, side]) => {
      path.getPointAt(u, p); path.getTangentAt(u, tan);
      const off = side * (0.18 + rnd() * 0.12);   // across the bed, alternating sides
      return [k, p.x - tan.z * off + (rnd() - 0.5) * 0.08, GROUND + Hb - 0.05, p.z + tan.x * off + (rnd() - 0.5) * 0.08, k === "mint" ? 5 : 0];
    });
    items.push(["crepe", YARD.back + 0.9, GROUND, YARD.right + 0.9, 1], ["pear", MINT[0], GROUND, MINT[1], 0]);
    // At the bed's deck end, a full, spiky shrub of long, stiff, sword-like leaves, like a much longer-leafed agave,
    // all one green a little darker than the lawn: each leaf a slim tapered blade, folded down its middle, that
    // rises from the crown and arches out, short ones upright at the heart and many long outer ones bending over
    // and down to the plant's foot, so it reads as a full, frilled mound
    {
      path.getPointAt(0.02, p);
      const pos = [], N = 130;
      for (let i = 0; i < N; i++) {
        const a = i * 2.39996 + rnd() * 0.3, t = i / N, tilt = 0.1 + 1.0 * t + (rnd() - 0.5) * 0.12;   // inner leaves upright, outer ones splayed
        const L = 0.5 + 0.8 * t + rnd() * 0.25, w = 0.04 + 0.02 * rnd(), droop = t < 0.45 ? 0.2 * t : 0.4 + 1.9 * (t - 0.45) + rnd() * 0.3;   // the outer half arcs over and down
        const ca = Math.cos(a), sa = Math.sin(a), seg = 6, pts = [];
        for (let k = 0; k <= seg; k++) {
          const f = k / seg, ang = tilt + droop * f * f, r = L * f * Math.sin(ang), y = L * f * Math.cos(ang) - 0.05 * t * f * f * L;
          const half = w * (1 - f) * (k === seg ? 0 : 1);
          pts.push([[ca * r - sa * half, y, sa * r + ca * half], [ca * r, y + 0.012 * (1 - f), sa * r], [ca * r + sa * half, y, sa * r - ca * half]]);
        }
        for (let k = 0; k < seg; k++) for (const [e0, e1] of [[0, 1], [1, 2]]) {
          const A = pts[k][e0], B = pts[k][e1], C = pts[k + 1][e0], D = pts[k + 1][e1];
          pos.push(...A, ...B, ...C, ...B, ...D, ...C);
        }
      }
      const g = new T.BufferGeometry(); g.setAttribute("position", new T.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
      const mat = solid("#2C5424", 0.5); mat.side = T.DoubleSide;
      const agave = keep(new T.Mesh(g, mat)); agave.position.set(p.x, GROUND + Hb - 0.08, p.z); agave.scale.setScalar(1.25);
    }
    // An andromeda behind the greenhouse; and the left border, from the back corner toward the house: the dog
    // house (built below), a huge Japanese andromeda, a smaller bush on long thick branches with its leaves
    // up top, and a tall pink rose
    items.push(["andromeda", YARD.back + 0.95, GROUND, (GREEN.z0 + GREEN.z1) / 2, 3]);
    items.push(["andromedaXL", -25.4, GROUND - 1.2, YARD.left - 1.75, 3], ["branchy", -21.6, GROUND, YARD.left - 1.05, 0], ["pinkrose", -18.4, GROUND, YARD.left - 0.8, 4]);
    // and nearer the deck, as in the photos: low rounded shrubs and leafy clumps along the stockade, mulch between
    // The peach tree, in the left border just past the deck's front-left corner
    items.push(["pear", DECK_FRONT - 0.9, GROUND, YARD.left - 0.9, 0]);   // the peach, in the left border just past the deck's front-left corner
    items.push(["bush", -9.2, GROUND, YARD.left - 0.7, 0], ["mintLow", -10.6, GROUND, YARD.left - 1.25, 0]);
    // low shrubs and leafy clumps in the stretch of border beside the deck's front
    items.push(["mintLow", -13.1, GROUND, YARD.left - 1.25, 0], ["bush", -14.1, GROUND, YARD.left - 0.75, 0], ["bush", -15.3, GROUND, YARD.left - 0.6, 0],
      ["mintLow", -16.2, GROUND, YARD.left - 1.3, 0], ["andromeda", -17.0, GROUND - 1.1, YARD.left - 0.8, 3], ["mintLow", -19.6, GROUND, YARD.left - 1.2, 0], ["bush", -20.4, GROUND, YARD.left - 0.7, 0]);
    // Mint, a dark crowd of it filling the pear's circle and over the edge: the clumps in the middle stand up,
    // and the ones around the outside are shoved over, low and sprawling
    for (let i = 0; i < 70; i++) {
      const a = rnd() * 6.28, f = Math.sqrt(rnd()), r = MINT[2] * (0.15 + f * 1.1);
      items.push([f > 0.7 ? "mintLow" : "mint", MINT[0] + Math.cos(a) * r, GROUND, MINT[1] + Math.sin(a) * r, 5]);
    }
    // Leafy bushes rustle in the wind; the trees, the flowers on their stems, and the daylilies sway
    const BUSHY = new Set(["bush", "mint", "mintLow", "rose", "pinkrose", "andromeda", "andromedaXL", "branchy"]);
    const base = [], size = [], cell = [], seed = [], pinks = [], bush = [];
    for (const [k, x, y, z, pink] of items) {
      const f = FLORA[k], s = 0.9 + rnd() * 0.2;
      base.push(x, y, z); size.push(f[4] * s, f[5] * s); cell.push(f[0], f[1], f[2], f[3]); seed.push(rnd()); pinks.push(pink + (k === "rose" ? 2 : 0)); bush.push(BUSHY.has(k) ? 1 : 0);
    }
    const fq = new T.InstancedBufferGeometry();
    cardGrid(fq);
    fq.setAttribute("aBase", new T.InstancedBufferAttribute(new Float32Array(base), 3));
    fq.setAttribute("aSize", new T.InstancedBufferAttribute(new Float32Array(size), 2));
    fq.setAttribute("aCell", new T.InstancedBufferAttribute(new Float32Array(cell), 4));
    fq.setAttribute("aSeed", new T.InstancedBufferAttribute(new Float32Array(seed), 1));
    fq.setAttribute("aPink", new T.InstancedBufferAttribute(new Float32Array(pinks), 1));
    fq.setAttribute("aBush", new T.InstancedBufferAttribute(new Float32Array(bush), 1));
    fq.instanceCount = items.length;
    const flora = { value: null };
    loader.load("/media/white-rabbit/flora-atlas.webp", (t) => { t.colorSpace = T.SRGBColorSpace; flora.value = t; textures.push(t); });
    const fm = keep(new T.Mesh(fq, shaderMat({
      uniforms: { ...common, ...timed, uMap: flora }, side: T.DoubleSide,
      // Each plant is mirrored or not, leans its own way, and is a little wider or narrower than the last,
      // so repeats of the same plant never match: the flowers stay true, the growth doesn't
      vertexShader: TREE_VERT.replace("attribute float aSeed;", "attribute float aSeed;\n  attribute float aPink;\n  varying float vPink;")
        .replace("vec3 w = aBase + right * (position.x * aSize.x", "float flip = fract(aSeed * 7.31) > 0.5 ? 1.0 : -1.0, lean = (fract(aSeed * 13.7) - 0.5) * 0.35 * (1.0 - step(4.0, aSize.y)), stretch = 0.8 + 0.4 * fract(aSeed * 3.9);\n    vec3 w = aBase + right * (position.x * aSize.x * stretch * flip + lean * aSize.y * top")
        .replace("vW = w; vSeed = aSeed;", "vW = w; vSeed = aSeed; vPink = aPink;"),
      fragmentShader: `${COMMON}\n${hash}\n${BREATHE}\nuniform sampler2D uMap; varying vec2 vUv; varying vec3 vW; varying float vSeed, vPink;
        void main() { vec4 c = texture2D(uMap, breathe(vUv, vSeed, 0.0035)); if (c.a < 0.45) discard;
          vec3 k = c.rgb * (0.92 + 0.16 * vSeed) * 1.2 * shimmer(vUv, vSeed);
          // The crepe myrtle's crown in pink bloom, flecked through the green; the roses lifted from near black to deep red
          if (vPink > 0.5 && vPink < 1.5) k = mix(k, vec3(0.95, 0.42, 0.66) * (0.7 + 0.5 * hash(floor(vUv * 400.0))), 0.7 * step(0.35, hash(floor(vUv * 260.0))) * smoothstep(0.2, 0.5, (vUv.y - ${(0.0).toFixed(1)}) * 2.0));
          if (vPink > 1.5 && vPink < 2.5) k = k * vec3(2.4, 1.6, 1.6) + vec3(0.06, 0.0, 0.01);
          // The andromeda: dense dark evergreen, hung with strings of tiny white flowers
          if (vPink > 2.5 && vPink < 3.5) { vec2 Lc = (vUv - vCell.xy) / (vCell.zw - vCell.xy); k *= vec3(0.6, 0.85, 0.55); k = mix(k, vec3(0.93, 0.92, 0.86), 0.45 * step(0.9, hash(floor(Lc * vec2(150.0, 170.0)))) * smoothstep(0.15, 0.4, Lc.y)); }
          // The tall rose in pink
          if (vPink > 3.5 && vPink < 4.5) { float red = smoothstep(0.02, 0.12, c.r - c.g); k = mix(k * vec3(1.5, 2.0, 1.4), vec3(0.97, 0.55, 0.7), red * 0.9); }
          // Mint: a deep, dull green, never bright
          if (vPink > 4.5) k *= vec3(0.42, 0.55, 0.4) * (0.8 + 0.4 * hash(floor(vUv * 90.0 + vSeed * 7.0)));
          gl_FragColor = vec4(outdoor(k, normalize(vec3(0.3, 0.7, 0.2)), vW), 1.0); }`,
    })));
    fm.frustumCulled = false;
  }

  // The greenhouse: an 8 by 12 foot kit (Palram-style) square in the back-right corner of the concrete,
  // its gable door facing the house: silver aluminum frame, clear twin-wall panels, two roof vents
  {
    const g = GREEN, alu = solid("#B8BCC0"), panelMat = shaderMat({
      uniforms: { ...common }, vertexShader: SOLID_VERT, transparent: true, depthWrite: false, side: T.DoubleSide,
      fragmentShader: `${COMMON}\nvarying vec3 vW, vN, vTint;
        void main() { vec3 n = normalize(vN); float rib = 0.5 + 0.5 * sin((abs(n.x) > 0.5 ? vW.z : vW.x) * 260.0);
          vec3 c = vec3(0.86, 0.9, 0.92) * (0.9 + 0.1 * rib);
          gl_FragColor = vec4(outdoor(c, n, vW), 0.32 + 0.08 * rib); }`,
    });
    const L = g.x1 - g.x0, Wd = g.z1 - g.z0, cx = (g.x0 + g.x1) / 2, cz = (g.z0 + g.z1) / 2, Y = GROUND;
    const bar = (w, h, d, x, y, z, rx = 0, ry = 0, rz = 0) => { const o = keep(new T.Mesh(new T.BoxGeometry(w, h, d), alu)); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); return o; };
    const pane = (w, h, x, y, z, ry, rx = 0) => { const o = keep(new T.Mesh(new T.PlaneGeometry(w, h), panelMat)); o.position.set(x, y, z); o.rotation.order = "YXZ"; o.rotation.set(rx, ry, 0); return o; };
    // Base, corners, eaves, ridge, and studs every 0.62 m along the sides
    for (const z of [g.z0, g.z1]) { bar(L, 0.06, 0.05, cx, Y + 0.03, z); bar(L, 0.05, 0.05, cx, Y + g.eave, z); for (let x = g.x0; x <= g.x1 + 0.01; x += L / 6) bar(0.035, g.eave, 0.035, x, Y + g.eave / 2, z); }
    for (const x of [g.x0, g.x1]) bar(0.05, 0.06, Wd, x, Y + 0.03, cz);
    bar(L, 0.06, 0.06, cx, Y + g.ridge, cz);
    const slope = Math.atan2(g.ridge - g.eave, Wd / 2), rl = Math.hypot(Wd / 2, g.ridge - g.eave);
    for (let x = g.x0; x <= g.x1 + 0.01; x += L / 6) for (const s of [-1, 1]) bar(0.035, 0.035, rl, x, Y + (g.eave + g.ridge) / 2, cz + s * Wd / 4, s * slope);
    // Side and roof panels
    for (const [z, ry] of [[g.z0, 0], [g.z1, Math.PI]]) pane(L, g.eave, cx, Y + g.eave / 2, z, ry);
    for (const s of [-1, 1]) { const r = pane(L, rl, cx, Y + (g.eave + g.ridge) / 2, cz + s * Wd / 4, 0); r.rotation.set(-s * (Math.PI / 2 - slope), 0, 0); }
    // Gable ends: a wall and a triangle each, with the double door on the house end
    for (const [x, door] of [[g.x0, false], [g.x1, true]]) {
      pane(Wd, g.eave, x, Y + g.eave / 2, cz, Math.PI / 2);
      const tri = new T.BufferGeometry(); tri.setAttribute("position", new T.Float32BufferAttribute([0, Y + g.eave, g.z0, 0, Y + g.eave, g.z1, 0, Y + g.ridge, cz], 3)); tri.computeVertexNormals();
      const t = keep(new T.Mesh(tri, panelMat)); t.position.x = x;
      for (const z of [g.z0, g.z1]) { const r = bar(0.04, rl, 0.04, x, Y + (g.eave + g.ridge) / 2, (z + cz) / 2); r.rotation.x = (z < cz ? 1 : -1) * (Math.PI / 2 - slope); }
      if (door) { for (const z of [cz - 0.42, cz, cz + 0.42]) bar(0.04, 1.85, 0.04, x + 0.02, Y + 0.93, z); bar(0.04, 0.04, 0.88, x + 0.02, Y + 1.85, cz); bar(0.04, 0.035, 0.84, x + 0.02, Y + 0.95, cz); }
    }
    // Two roof vents propped open on the left slope
    for (const x of [g.x0 + L * 0.3, g.x0 + L * 0.7]) { const v = bar(0.6, 0.03, 0.5, x, Y + g.ridge - 0.12, cz + 0.3); v.rotation.x = slope + 0.35; }
  }

  // Inside the greenhouse, seen through its panels: a wooden workbench at the back with a swivel office
  // chair, a folding table along the left wall, and a twin bed on a low metal frame along the right; and
  // a black handle on each door
  {
    const g = GREEN, Y = GROUND, cz = (g.z0 + g.z1) / 2, wood = solid("#8B6A48", 1), metal = solid("#9AA0A4"), black = solid("#151515"), linen = solid("#E9E6DF"), fold = solid("#D8D5CC");
    const box = (mat, w, h, d, x, y, z, ry = 0) => { const o = keep(new T.Mesh(new T.BoxGeometry(w, h, d), mat)); o.position.set(x, y, z); o.rotation.y = ry; return o; };
    // Workbench along the back wall
    box(wood, 0.6, 0.05, 1.7, g.x0 + 0.38, Y + 0.9, cz); for (const dz of [-0.8, 0.8]) for (const dx of [0.08, 0.6]) box(wood, 0.06, 0.88, 0.06, g.x0 + dx, Y + 0.44, cz + dz);
    box(wood, 0.5, 0.03, 1.6, g.x0 + 0.38, Y + 0.3, cz);
    // The swivel chair, turned a little from the bench
    const chair = new T.Group(); chair.position.set(g.x0 + 0.95, Y, cz + 0.15); chair.rotation.y = 0.5; keep(chair);
    const cb = (mat, w, h, d, x, y, z) => { const o = new T.Mesh(new T.BoxGeometry(w, h, d), mat); o.position.set(x, y, z); chair.add(o); };
    cb(black, 0.48, 0.07, 0.48, 0, 0.48, 0); cb(black, 0.06, 0.5, 0.46, -0.24, 0.78, 0); cb(metal, 0.05, 0.4, 0.05, 0, 0.26, 0);
    for (let i = 0; i < 5; i++) { const o = new T.Mesh(new T.BoxGeometry(0.32, 0.03, 0.04), black); o.position.set(Math.cos(i * 1.26) * 0.16, 0.05, Math.sin(i * 1.26) * 0.16); o.rotation.y = -i * 1.26; chair.add(o); }
    // Folding table against the left wall (toward +z)
    box(fold, 1.8, 0.04, 0.7, (g.x0 + g.x1) / 2 + 0.3, Y + 0.74, g.z1 - 0.45); for (const dx of [-0.8, 0.8]) for (const dz of [-0.28, 0.28]) box(metal, 0.03, 0.72, 0.03, (g.x0 + g.x1) / 2 + 0.3 + dx, Y + 0.36, g.z1 - 0.45 + dz);
    // The twin bed along the right wall, on a low metal frame
    const bx = (g.x0 + g.x1) / 2 + 0.2, bz = g.z0 + 0.6;
    box(metal, 1.95, 0.05, 0.98, bx, Y + 0.32, bz); for (const dx of [-0.95, 0.95]) for (const dz of [-0.46, 0.46]) box(metal, 0.04, 0.32, 0.04, bx + dx, Y + 0.16, bz + dz);
    box(linen, 1.9, 0.16, 0.95, bx, Y + 0.43, bz); box(linen, 0.35, 0.1, 0.6, bx - 0.75, Y + 0.56, bz);
    box(metal, 0.04, 0.55, 0.98, bx - 0.97, Y + 0.6, bz);
    // Door handles
    for (const dz of [-0.06, 0.06]) box(black, 0.05, 0.16, 0.025, g.x1 + 0.05, Y + 1.0, cz + dz);
  }

  // The squash trellis in the soil square before the greenhouse: an arched A-frame of green-coated steel
  // hoops and rails with netting stretched over it, the vines climbing it thick with leaves and yellow
  // flowers, long squash hanging under (Crookneck-style fruit stretched, as in the back garden)
  {
    const P = PATCH, green = solid("#2F5A2B"), cx = (P.x0 + P.x1) / 2, cz = (P.z0 + P.z1) / 2, Y = GROUND;
    const Lr = Math.min(3.2, (P.x1 - P.x0) - 0.6), span = 1.5, Ht = 1.95, hoops = 4;
    const arch = new T.Group(); arch.position.set(cx, Y, cz); arch.rotation.y = 0.04; keep(arch);
    const tube = (pts, r = 0.016) => { const c = new T.CatmullRomCurve3(pts.map((q) => new T.Vector3(...q))); arch.add(new T.Mesh(new T.TubeGeometry(c, 24, r, 6, false), green)); };
    for (let i = 0; i < hoops; i++) {
      const x = -Lr / 2 + (i / (hoops - 1)) * Lr, pts = [];
      for (let k = 0; k <= 12; k++) { const t = k / 12 * Math.PI; pts.push([x, Math.sin(t) * 0.35 + (1 - Math.abs(Math.cos(t))) * (Ht - 0.35), Math.cos(t) * span / 2 * (1 - 0.15 * Math.sin(t))]); }
      tube(pts);
    }
    for (const [y, z] of [[0.6, span / 2 - 0.03], [1.3, span / 2 - 0.12], [0.6, -span / 2 + 0.03], [1.3, -span / 2 + 0.12]]) tube([[-Lr / 2, y, z], [Lr / 2, y, z]], 0.012);
    // Netting: a mesh texture on the two sloping faces and over the top
    const nc = document.createElement("canvas"); nc.width = nc.height = 64; const ng = nc.getContext("2d"); ng.strokeStyle = "#3c6a35"; ng.lineWidth = 3; ng.strokeRect(0, 0, 64, 64);
    const net = new T.CanvasTexture(nc); net.wrapS = net.wrapT = T.RepeatWrapping; net.repeat.set(Lr / 0.15, 15); textures.push(net);
    const netMat = new T.MeshBasicMaterial({ map: net, transparent: true, alphaTest: 0.3, side: T.DoubleSide, color: "#5d8a52" });
    for (const sgn of [-1, 1]) { const q = new T.Mesh(new T.PlaneGeometry(Lr, Ht), netMat); q.position.set(0, Ht / 2, sgn * span * 0.3); q.rotation.x = sgn * 0.33; arch.add(q); }
    // Leaves (big lobed squash leaves on a canvas), flowers, and squash, all over the frame
    const lc = document.createElement("canvas"); lc.width = lc.height = 64; const lg = lc.getContext("2d");
    lg.fillStyle = "#2f6b24"; lg.beginPath(); for (let i = 0; i <= 40; i++) { const a = i / 40 * 6.28, r = 28 * (0.78 + 0.22 * Math.abs(Math.cos(2.5 * a))); lg.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r); } lg.fill();
    lg.strokeStyle = "#5b8f3a"; lg.lineWidth = 1.5; for (let i = 0; i < 5; i++) { lg.beginPath(); lg.moveTo(32, 32); lg.lineTo(32 + Math.cos(i * 1.26 - 1.57) * 26, 32 + Math.sin(i * 1.26 - 1.57) * 26); lg.stroke(); }
    const leafTex = new T.CanvasTexture(lc); leafTex.colorSpace = T.SRGBColorSpace; textures.push(leafTex);
    const leaves = new T.InstancedMesh(new T.PlaneGeometry(1, 1), new T.MeshLambertMaterial({ map: leafTex, alphaTest: 0.5, side: T.DoubleSide }), 260);
    const flowers = new T.InstancedMesh(new T.SphereGeometry(0.035, 6, 4), new T.MeshLambertMaterial({ color: "#f2b81c", emissive: "#3a2a00" }), 40);
    const fruits = new T.InstancedMesh(new T.CylinderGeometry(0.035, 0.045, 0.42, 8), new T.MeshLambertMaterial({ color: "#5e7a2c" }), 18);
    const mm = new T.Matrix4(), qa = new T.Quaternion(), ea = new T.Euler(), va = new T.Vector3(), vs = new T.Vector3();
    const onFrame = () => { const x = (rnd() - 0.5) * Lr, t = rnd() * Math.PI, side = Math.cos(t); return [x, Math.sin(t) * 0.35 + (1 - Math.abs(side)) * (Ht - 0.35) * (0.6 + 0.4 * rnd()) + (rnd() - 0.5) * 0.15, side * span / 2 * 0.9]; };
    for (let i = 0; i < 260; i++) { const [x, y, z] = onFrame(); ea.set(rnd() * 6.28, rnd() * 6.28, rnd() * 6.28); const k = 0.16 + rnd() * 0.14; leaves.setMatrixAt(i, mm.compose(va.set(x, y * (0.3 + 0.7 * rnd() ** 0.5), z), qa.setFromEuler(ea), vs.set(k, k, k))); }
    for (let i = 0; i < 40; i++) { const [x, y, z] = onFrame(); flowers.setMatrixAt(i, mm.compose(va.set(x, y, z * 1.03), qa.identity(), vs.set(1, 1, 1))); }
    for (let i = 0; i < 18; i++) { const [x, y, z] = onFrame(); ea.set((rnd() - 0.5) * 0.4, 0, (rnd() - 0.5) * 0.4); fruits.setMatrixAt(i, mm.compose(va.set(x, Math.max(0.3, y - 0.3), z * 0.92), qa.setFromEuler(ea), vs.set(1, 0.8 + rnd() * 0.5, 1))); }
    arch.add(leaves, flowers, fruits);
  }

  // The old dog house in the back-left corner, wide and low, turned a little off square toward the yard:
  // weathered boards, a shingle roof gone mossy, and a doorway hung with three dark plastic flaps
  {
    const wood = solid("#7A6650", 1), trim = solid("#5E4D3B", 1), dark = solid("#151210"), roof = solid("#3E3C34"), flap = solid("#2C3236", 0.15);
    const dh = new T.Group(); dh.position.set(YARD.back + 1.15, GROUND, YARD.left - 1.25); dh.rotation.y = Math.PI / 2 - 0.35; keep(dh);
    const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => { const o = new T.Mesh(geo, mat); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); dh.add(o); return o; };
    const D = 1.65;
    add(new T.BoxGeometry(0.9, 0.75, D), wood, 0, 0.42, 0);
    add(new T.BoxGeometry(0.02, 0.47, 0.5), dark, 0.456, 0.31, 0.12);                                          // the doorway
    for (const [y, h, z, w] of [[0.56, 0.04, 0.12, 0.58], [0.31, 0.47, -0.15, 0.04], [0.31, 0.47, 0.39, 0.04]]) add(new T.BoxGeometry(0.03, h, w), trim, 0.462, y, z);
    // Three flaps, hung from the top of the frame, none quite plumb
    for (let i = 0; i < 3; i++) add(new T.BoxGeometry(0.008, 0.44, 0.158), flap, 0.472, 0.32, 0.12 + (i - 1) * 0.163, (rnd() - 0.5) * 0.04, 0, (rnd() - 0.4) * 0.12);
    for (const s of [-1, 1]) add(new T.BoxGeometry(0.62, 0.03, D + 0.12), roof, s * 0.24, 0.98, 0, 0, 0, s * -0.72);
    const g = D / 2;
    // The gables are the short ends: fill each end under the ridge
    const ends = new T.BufferGeometry(); ends.setAttribute("position", new T.Float32BufferAttribute([-0.45, 0.8, -g, 0.45, 0.8, -g, 0, 1.15, -g, 0.45, 0.8, g, -0.45, 0.8, g, 0, 1.15, g], 3));
    ends.computeVertexNormals(); add(ends, wood, 0, 0, 0).material.side = T.DoubleSide;
    add(new T.BoxGeometry(0.96, 0.08, D + 0.06), wood, 0, 0.04, 0);                                           // the base, sunk a little
  }

  // Ducks: a few mallards and one white duck, each paddling a slow loop of its own near the near bank
  const ducks = [], drake = solid("#5A4632"), hen = solid("#7A6046"), green = solid("#1F4F2E"), white = solid("#F2F0E8"), bill = solid("#E0A028");
  for (let i = 0; i < 5; i++) {
    const duck = new T.Group(), kind = i === 2 ? white : i % 2 ? hen : drake;
    const body = new T.Mesh(new T.SphereGeometry(0.16, 10, 8), kind); body.scale.set(1.9, 0.9, 1.1); duck.add(body);
    const head = new T.Mesh(new T.SphereGeometry(0.075, 8, 6), i === 2 ? white : i % 2 ? hen : green); head.position.set(0.24, 0.14, 0); duck.add(head);
    const beak = new T.Mesh(new T.BoxGeometry(0.08, 0.02, 0.04), bill); beak.position.set(0.32, 0.13, 0); duck.add(beak);
    duck.userData = { r: 2.5 + rnd() * 6, a: rnd() * 6.28, speed: (0.05 + rnd() * 0.05) * (rnd() < 0.5 ? -1 : 1), cx: -60 - rnd() * 14, cz: POND.z + (rnd() - 0.5) * 40 };
    keep(duck); ducks.push(duck);
  }

  // Each frame: the clock and the wind for the moving things, and the sun's share by the clouds
  function update(time, wind, phase, sunShare) {
    for (const d of ducks) {
      const u = d.userData, a = u.a + time * u.speed;
      d.position.set(u.cx + Math.cos(a) * u.r * 0.7, LAKE + 0.02 + Math.sin(time * 1.7 + u.a) * 0.01, u.cz + Math.sin(a) * u.r);
      d.rotation.y = -Math.atan2(Math.cos(a) * u.r * Math.sign(u.speed), -Math.sin(a) * u.r * 0.7 * Math.sign(u.speed));
    }
    common.uSun.value = sunShare;
    timed.uTime.value = time; timed.uPhase.value = phase; timed.uWind.value = wind;
    // The swing drifts on its chains, further in the gusts
    seat.rotation.x = Math.sin(phase * 0.85) * (0.04 + 0.16 * wind) + Math.sin(phase * 2.3 + 1) * 0.012 + wind * 0.05;
  }

  // Frees what the world made
  function dispose() {
    group.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
    textures.forEach((t) => t.dispose());
    scene.remove(group);
  }

  return { ready, update, dispose };
}
