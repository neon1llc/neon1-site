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
// The right side of the yard is concrete, parted from the lawn on the left by a curving raised bed of
// stone (CURVE, plan points [x, z] from the foot of the deck's front stairs out toward the back); soil
// borders run along the right fence and the back fence (SOIL wide); a circle is cut from the concrete for
// a pear tree and its mint; the greenhouse stands square in the back-right corner of the concrete
const CURVE = [[-12.9, 5.9], [-15.6, 4.1], [-19.0, 2.7], [-22.2, 2.6], [-24.6, 3.6], [-26.2, 4.8]];
const SOIL = 1.8;
const MINT = [-24.4, -2.8, 1.5];
const GREEN = { x0: -28.2, x1: -24.5, z0: -8.2, z1: -5.8, eave: 1.85, ridge: 2.45 };
const DECK = { x0: -11.4, x1: -2.05, z0: -2.3, z1: 10.5, y: GROUND + 0.8 };   // out from the house on the left, its right side at z0
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
    vec3 grass = mix(vec3(0.07, 0.16, 0.03), vec3(0.3, 0.46, 0.12), clamp(lum * 1.7, 0.0, 1.0)) * mix(0.72, 1.18, mott);
    // Clumps: a mid scale of darker, thicker tufts and thin, paler spots, so the lawn has texture from afar
    grass *= mix(0.8, 1.12, smoothstep(0.25, 0.75, fbm(vW.xz * 2.6 + 11.0)));
    grass = mix(grass, mix(grass, photo, 0.25) * vec3(1.25, 1.05, 0.65), dry * 0.55);
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
      vec2 a = vec2(-12.6, 2.8), b = vec2(-18.0, 6.5), ab = b - a;
      float t = clamp(dot(vW.xz - a, ab) / dot(ab, ab), 0.0, 1.0);
      float path = smoothstep(0.55, 0.15, distance(vW.xz, a + ab * t) + (noise(vW.xz * 2.0) - 0.5) * 0.5) * 0.55;
      grass = mix(grass, vec3(0.36, 0.3, 0.2) * (0.8 + 0.4 * hash(floor(vW.xz * 25.0))), max(wear * 0.85, path));
    }
    float dande = step(0.9965, hash(floor(vW.xz * 7.0))) * step(0.4, noise(vW.xz * 0.5));
    grass = mix(grass, vec3(0.92, 0.75, 0.12), dande);
    float leaves = 0.0;
    for (int i = 0; i < 48; i++) leaves = max(leaves, smoothstep(uTrees[i].z * 1.1, uTrees[i].z * 0.2, distance(vW.xz, uTrees[i].xy + vec2(2.0, 1.0))));
    float leaf = step(1.0 - leaves * 0.18, hash(floor(vW.xz * 18.0)));
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
      bool soil = z < ${(YARD.right + SOIL).toFixed(2)} || x < ${(YARD.back + SOIL).toFixed(2)} || (z > ${(YARD.left - SOIL).toFixed(2)} && x < ${(DECK.x0 - 0.2).toFixed(2)});
      if (soil) {
        col = vec3(0.17, 0.11, 0.07) * (0.75 + 0.45 * noise(vW.xz * 6.0)) * (0.85 + 0.3 * hash(floor(vW.xz * 30.0)));
        col = mix(col, vec3(0.3, 0.42, 0.12), 0.25 * step(0.8, noise(vW.xz * 2.3)));          // a weed or two
        paved = 1.0;
      } else if (z < zb - 0.3) {
        // Poured concrete in slabs, joints every 2 m, weathered: stains, hairline cracks, a darker damp edge
        vec2 j = abs(fract(vW.xz / 2.0) - 0.5);
        col = vec3(0.39, 0.38, 0.36) * (0.86 + 0.18 * fbm(vW.xz * 0.9)) * (0.94 + 0.06 * hash(floor(vW.xz * 40.0)));
        col *= 1.0 - 0.4 * smoothstep(0.485, 0.5, max(j.x, j.y));
        col *= 1.0 - 0.18 * smoothstep(0.62, 0.7, fbm(vW.xz * 0.35 + 4.0));
        col *= 1.0 - 0.35 * smoothstep(0.015, 0.0, abs(fbm(vW.xz * 1.7) - 0.5)) * step(0.6, noise(vW.xz * 0.4));
        paved = 1.0;
        float md = distance(vW.xz, vec2(${MINT[0].toFixed(2)}, ${MINT[1].toFixed(2)}));
        if (md < ${MINT[2].toFixed(2)}) {
          col = mix(vec3(0.07, 0.2, 0.05), vec3(0.22, 0.42, 0.12), fbm(vW.xz * 9.0)) * (0.8 + 0.4 * hash(floor(vW.xz * 50.0)));
          paved = 0.0;
        } else if (md < ${(MINT[2] + 0.1).toFixed(2)}) col *= 0.72;
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
  uniform float uPhase, uWind;
  varying vec2 vUv;
  varying vec3 vW;
  varying float vSeed;
  void main() {
    vec3 toCam = cameraPosition - aBase; toCam.y = 0.0;
    vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), normalize(toCam)));
    float top = position.y * position.y;
    float sway = (sin(uPhase * 0.8 + aSeed * 6.3) * 0.012 + sin(uPhase * 2.1 + aSeed * 13.0) * 0.004) * (1.0 + 2.2 * uWind) + uWind * 0.02;
    vec3 w = aBase + right * (position.x * aSize.x + sway * aSize.y * top) + vec3(0.0, position.y * aSize.y, 0.0);
    vUv = mix(aCell.xy, aCell.zw, position.xy + vec2(0.5, 0.0));
    vW = w; vSeed = aSeed;
    gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
  }`;
const TREE_FRAG = /* glsl */`
  ${COMMON}
  uniform sampler2D uMap;
  varying vec2 vUv;
  varying vec3 vW;
  varying float vSeed;
  void main() {
    vec4 c = texture2D(uMap, vUv);
    if (c.a < 0.45) discard;
    gl_FragColor = vec4(outdoor(c.rgb * (0.92 + 0.16 * vSeed) * 1.25, normalize(vec3(0.3, 0.7, 0.2)), vW), 1.0);
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

/** Builds the lakefront into scene; ready resolves when the tree atlas is in */
export function createWorld({ scene, touch }) {
  const common = { uSunDir: { value: SUNDIR }, uHaze: { value: HAZE }, uSun: { value: 1 } };
  const timed = { uTime: { value: 0 }, uPhase: { value: 0 }, uWind: { value: 0 } };
  const group = new T.Group(), textures = [];
  const keep = (o) => { group.add(o); return o; };
  scene.add(group);
  const rnd = (() => { let n = 7; return () => ((n = (n * 16807) % 2147483647) - 1) / 2147483646; })();

  // Trees: on the verge past the fence and along the shore, thinned where the window looks out (z near
  // 0.6) so the lake shows between them, and a few in the yard's corners
  const trees = [];
  for (let z = -46; z < 46; z += 6 + rnd() * 4) if ((Math.abs(z - 0.6) > 9 || rnd() < 0.2) && (z > -10 || z < -22.5)) trees.push([STRIP.fence - 0.9 - rnd() * 0.5, z, rnd(), 1]);
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
    shade.push(new T.Vector3(x, z, h * c[4]));
  }
  while (shade.length < 48) shade.push(new T.Vector3(999, 999, 0));
  const quad = new T.InstancedBufferGeometry();
  quad.setAttribute("position", new T.Float32BufferAttribute([-0.5, 0, 0, 0.5, 0, 0, 0.5, 1, 0, -0.5, 1, 0], 3));
  quad.setIndex([0, 1, 2, 0, 2, 3]);
  quad.setAttribute("aBase", new T.InstancedBufferAttribute(new Float32Array(base), 3));
  quad.setAttribute("aSize", new T.InstancedBufferAttribute(new Float32Array(size), 2));
  quad.setAttribute("aCell", new T.InstancedBufferAttribute(new Float32Array(cell), 4));
  quad.setAttribute("aSeed", new T.InstancedBufferAttribute(new Float32Array(seed), 1));
  quad.instanceCount = trees.length;
  const atlas = { value: null };
  const treeMesh = keep(new T.Mesh(quad, new T.ShaderMaterial({ uniforms: { ...common, ...timed, uMap: atlas }, vertexShader: TREE_VERT, fragmentShader: TREE_FRAG, side: T.DoubleSide })));
  treeMesh.frustumCulled = false;
  const loader = new T.TextureLoader();
  const ready = new Promise((done) => loader.load("/media/white-rabbit/trees-atlas.webp", (t) => {
    t.colorSpace = T.SRGBColorSpace; atlas.value = t; textures.push(t); done();
  }, undefined, () => done()));

  // The ground, from the house out past the pond; the lawn photo and its relief tile
  const tile = (name, srgb) => { const t = loader.load(`/media/white-rabbit/tex/${name}.webp`); t.wrapS = t.wrapT = T.RepeatWrapping; if (srgb) t.colorSpace = T.SRGBColorSpace; textures.push(t); return t; };
  const lawn = tile("lawn-color", true), lawnN = tile("lawn-normal", false);
  const ground = keep(new T.Mesh(new T.PlaneGeometry(1100, 1800), new T.ShaderMaterial({
    uniforms: { ...common, uTrees: { value: shade }, uBed: { value: new T.Vector4(...BED) }, uLawn: { value: lawn }, uLawnN: { value: lawnN } }, vertexShader: GROUND_VERT, fragmentShader: GROUND_FRAG,
  })));
  ground.rotation.x = -Math.PI / 2; ground.position.set(-2.0 - 550, GROUND, 0);

  // The pond's water, cut to its outline in the shader
  const water = keep(new T.Mesh(new T.PlaneGeometry(POND.ax * 2.8, POND.az * 2.8), new T.ShaderMaterial({ uniforms: { ...common, ...timed }, vertexShader: GROUND_VERT, fragmentShader: WATER_FRAG })));
  water.rotation.x = -Math.PI / 2; water.position.set(POND.x, LAKE, POND.z);

  // The far banks: the old far tree row as a wooded line around the far side of the pond, in segments
  // facing across the water, with hazy hills behind
  const shoreTex = loader.load("/media/white-rabbit/trees-far.webp", (t) => { t.colorSpace = T.SRGBColorSpace; });
  shoreTex.wrapS = T.RepeatWrapping; textures.push(shoreTex);
  const bankMat = new T.ShaderMaterial({
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
  const hills = keep(new T.Mesh(new T.PlaneGeometry(7000, 200), new T.ShaderMaterial({
    uniforms: { ...common }, vertexShader: GROUND_VERT,
    fragmentShader: `${COMMON}\n${hash}\nvarying vec3 vW; varying vec2 vUv;
      void main() { float h = 0.25 + 0.18 * noise(vec2(vUv.x * 9.0, 0.0)) + 0.1 * noise(vec2(vUv.x * 31.0, 0.0)); if (vUv.y > h) discard;
        gl_FragColor = vec4(mix(vec3(0.36, 0.42, 0.4), uHaze, 0.72), 1.0); }`,
  })));
  hills.rotation.y = Math.PI / 2; hills.position.set(-2600, GROUND + 70, 0);

  // The fence: white pickets 1.5 m tall on two rails between posts every 2.4 m, around the back and both
  // sides of the yard, years old. Pickets differ a little in height and lean, sections sag, the paint has
  // weathered unevenly and gone grey and green near the ground, a few pickets lean hard, and here and there
  // one is missing
  const solid = (color, grain = 0) => new T.ShaderMaterial({ uniforms: { ...common, uColor: { value: new T.Color(color) }, uGrain: { value: grain } }, vertexShader: SOLID_VERT, fragmentShader: SOLID_FRAG });
  const m = new T.Matrix4(), qq = new T.Quaternion(), e = new T.Euler(), at0 = new T.Vector3(), sc0 = new T.Vector3(), tint = new T.Color();
  const PICKET = 1.5, runs = [[YARD.back, YARD.right, YARD.back, YARD.left], [-2.1, YARD.right, YARD.back, YARD.right], [-2.1, YARD.left, YARD.back, YARD.left]];
  const lens = runs.map(([x0, z0, x1, z1]) => Math.hypot(x1 - x0, z1 - z0)), total = lens.reduce((a, b) => a + b, 0);
  const pickets = keep(new T.InstancedMesh(new T.BoxGeometry(0.02, PICKET, 0.09), solid("#FFFFFF"), Math.ceil(total / 0.16) + 3));
  // 4x4 posts at the corners and every 2.4 m, standing a little above the pickets under pyramid caps
  const POST = PICKET + 0.2, nPosts = Math.ceil(total / 2.4) + 6;
  const posts = keep(new T.InstancedMesh(new T.BoxGeometry(0.089, POST, 0.089), solid("#E4E1D8"), nPosts));
  const caps = keep(new T.InstancedMesh(new T.ConeGeometry(0.075, 0.09, 4).rotateY(Math.PI / 4), solid("#E4E1D8"), nPosts));
  let np = 0, nq = 0;
  runs.forEach(([x0, z0, x1, z1], r) => {
    const len = lens[r], turn = Math.atan2(x1 - x0, z1 - z0), sag = (d) => 0.035 * Math.sin((d / 2.4) * Math.PI) ** 2 * (0.4 + 0.6 * Math.abs(Math.sin(d * 0.37 + r)));
    const at = (d) => [x0 + ((x1 - x0) * d) / len, z0 + ((z1 - z0) * d) / len];
    for (let d = 0.08; d < len; d += 0.16) {
      const hard = rnd() < 0.004, gone = rnd() < 0.002, h = 1 + (rnd() - 0.5) * 0.05, [x, z] = at(d + (rnd() - 0.5) * 0.015);
      e.set((rnd() - 0.5) * 0.04 + (hard ? (rnd() - 0.5) * 0.4 : 0), turn, (rnd() - 0.5) * 0.04 + (hard ? 0.16 : 0), "YXZ");
      at0.set(x + (rnd() - 0.5) * 0.01, GROUND + (PICKET / 2) * h - sag(d), z); sc0.set(1, gone ? 0.0001 : h, 1);
      pickets.setMatrixAt(np, m.compose(at0, qq.setFromEuler(e), sc0));
      const w = 0.82 + rnd() * 0.18;
      pickets.setColorAt(np++, tint.setRGB(0.93 * w, 0.92 * w, 0.88 * w - rnd() * 0.04));
    }
    for (let d = 0; d <= len + 0.01; d += 2.4) {
      const [x, z] = at(Math.min(d, len));
      e.set((rnd() - 0.5) * 0.05, turn, (rnd() - 0.5) * 0.06, "YXZ");
      e.set((rnd() - 0.5) * 0.015, turn, (rnd() - 0.5) * 0.015, "YXZ");
      posts.setMatrixAt(nq, m.compose(at0.set(x, GROUND + POST / 2, z), qq.setFromEuler(e), sc0.set(1, 1, 1)));
      caps.setMatrixAt(nq++, m.compose(at0.set(x, GROUND + POST + 0.045, z), qq.setFromEuler(e), sc0.set(1, 1, 1)));
    }
    for (const y of [0.35, PICKET - 0.3]) {
      const rail = keep(new T.Mesh(new T.BoxGeometry(0.04, 0.08, len, 1, 1, Math.ceil(len * 3)), solid("#DAD6CA")));
      const pos = rail.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) pos.setY(i, pos.getY(i) - sag(pos.getZ(i) + len / 2));
      rail.geometry.computeVertexNormals();
      const [cx, cz] = at(len / 2); rail.position.set(cx, GROUND + y, cz); rail.rotation.y = turn;
    }
  });
  pickets.count = np; posts.count = nq; caps.count = nq;

  // The neighbor's house past the left fence: two stories of pale clapboard under a dark shingle gable, with
  // white-trimmed windows (a few lit warm, a couple with blinds half down), a back door and step, and a
  // downspout, weathered a little where the rain runs
  const HOUSE = { x0: -18.5, x1: -7.5, z0: 14, z1: 24, h: 6.2, ridge: 9.0 };
  const siding = new T.ShaderMaterial({
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
    keep(new T.Mesh(g, new T.ShaderMaterial({
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

  // The deck: off the back of the house on the left, built heavy. Floor boards are 2x4s running left to
  // right, laid in three staggered lengths over a deep rim joist on 6x6 posts. The railing has a flat 2x4
  // cap and a bottom rail, turned spindles evenly spaced between 4x4 posts with caps, at every corner and
  // stair. One wide flight goes down off the front toward the garden; a second goes down off the right
  // side. All of it is painted a deep mahogany, a little worn where feet and hands go
  {
    const paint = solid("#56221A", 1), worn = new T.Color(), H = DECK.y;
    const D = DECK.x1 - DECK.x0, L = DECK.z1 - DECK.z0, rows = Math.floor(D / 0.095);
    const planks = keep(new T.InstancedMesh(new T.BoxGeometry(0.089, 0.038, 1), paint, rows * 3));
    let k = 0;
    for (let i = 0; i < rows; i++) {
      const x = DECK.x0 + 0.05 + i * 0.095, a = 0.2 + rnd() * 0.25, b = a + 0.3 + rnd() * 0.2;
      for (const [u, v] of [[0, a], [a, b], [b, 1]]) {
        const len = (v - u) * L - 0.005;
        planks.setMatrixAt(k, m.compose(at0.set(x, H + (rnd() - 0.5) * 0.003, DECK.z0 + ((u + v) / 2) * L), qq.identity(), sc0.set(1, 1, len)));
        const w = 0.86 + rnd() * 0.22, scuff = rnd() < 0.08 ? 1.25 : 1;
        planks.setColorAt(k++, worn.setRGB(w * scuff, w * (0.96 + rnd() * 0.06) * scuff, w * scuff));
      }
    }
    planks.count = k;
    const piece = (w, h, d, x, y, z, ry = 0) => { const o = keep(new T.Mesh(new T.BoxGeometry(w, h, d), paint)); o.position.set(x, y, z); o.rotation.y = ry; return o; };
    // Rim joists (2x10) round the open sides, 6x6 posts under them to the ground
    piece(0.05, 0.24, L, DECK.x0, H - 0.14, (DECK.z0 + DECK.z1) / 2);
    piece(D, 0.24, 0.05, (DECK.x0 + DECK.x1) / 2, H - 0.14, DECK.z0);
    for (let z = DECK.z0 + 0.08; z < DECK.z1; z += 2.4) piece(0.14, H - GROUND, 0.14, DECK.x0 + 0.1, (H + GROUND) / 2, z);
    for (let x = DECK.x0 + 0.1; x < DECK.x1 - 0.5; x += 2.4) piece(0.14, H - GROUND, 0.14, x, (H + GROUND) / 2, DECK.z0 + 0.08);
    // Turned spindles: a lathe profile with beads and a slim waist, instanced along every railing
    const prof = [[0.001, 0], [0.019, 0], [0.019, 0.07], [0.014, 0.09], [0.022, 0.13], [0.012, 0.2], [0.01, 0.45], [0.016, 0.55], [0.01, 0.6], [0.012, 0.66], [0.02, 0.69], [0.019, 0.76], [0.001, 0.76]];
    const spindle = new T.LatheGeometry(prof.map(([r, y]) => new T.Vector2(r, y)), 10);
    const spindles = keep(new T.InstancedMesh(spindle, paint, 900)); let ns = 0;
    const post = (x, y, z, h = 1.05) => { piece(0.089, h, 0.089, x, y + h / 2, z); piece(0.13, 0.03, 0.13, x, y + h + 0.015, z); piece(0.1, 0.025, 0.1, x, y + h + 0.042, z); };
    // A railing from (x0, y0, z0) to (x1, y1, z1): posts at both ends, a flat 2x4 cap and a bottom rail, spindles between
    const railing = (x0, y0, z0, x1, y1, z1, ends = [true, true]) => {
      const run = Math.hypot(x1 - x0, z1 - z0), turn = Math.atan2(x1 - x0, z1 - z0), slope = Math.atan2(y1 - y0, run), len = Math.hypot(run, y1 - y0);
      const mx = (x0 + x1) / 2, my = (y0 + y1) / 2, mz = (z0 + z1) / 2;
      const cap = piece(0.089, 0.038, len, mx, my + 0.9, mz, turn); cap.rotation.order = "YXZ"; cap.rotation.x = -slope;
      const bot = piece(0.06, 0.06, len, mx, my + 0.08, mz, turn); bot.rotation.order = "YXZ"; bot.rotation.x = -slope;
      if (ends[0]) post(x0, y0, z0); if (ends[1]) post(x1, y1, z1);
      const n = Math.max(1, Math.round(run / 0.115));
      for (let i = 1; i < n; i++) {
        const t = i / n, sy = (0.9 - 0.1) / 0.76;
        spindles.setMatrixAt(ns++, m.compose(at0.set(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t + 0.11, z0 + (z1 - z0) * t), qq.identity(), sc0.set(1, sy, 1)));
      }
    };
    // The front edge, with the stair opening toward the garden, and the right side, with its own stair opening
    const F0 = 4.2, F1 = 5.8, R0 = -8.0, R1 = -9.3;
    railing(DECK.x0, H, DECK.z1, DECK.x0, H, F1); railing(DECK.x0, H, F0, DECK.x0, H, DECK.z0);
    railing(DECK.x0, H, DECK.z0, R1, H, DECK.z0, [false, true]); railing(R0, H, DECK.z0, DECK.x1, H, DECK.z0);
    // Stairs: open risers of 2x12 treads on three stringers, five rises to the grass, a railing each side
    const stairs = (x, z, dx, dz, width) => {
      const rise = (H - GROUND) / 5, n = 5, tread = 0.28, along = dz !== 0, run = tread * (n - 0.3);
      for (let i = 0; i < n - 1 + 1; i++) {
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
        railing(x + sx, H, z + sz, x + dx * run + sx, GROUND + 0.05, z + dz * run + sz);
      }
    };
    stairs(DECK.x0, (F0 + F1) / 2, -1, 0, F1 - F0);
    stairs((R0 + R1) / 2, DECK.z0, 0, -1, R0 - R1);
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
    const mesh = new T.Mesh(card, new T.ShaderMaterial({
      uniforms: { ...common, ...timed, uMap: map, uSway: { value: sway } }, transparent: true, depthWrite: false, side: T.DoubleSide,
      vertexShader: `uniform float uPhase, uWind, uSway; varying vec3 vW; varying vec2 vUv;
        void main() { vUv = uv; vec3 p = position;
          float k = uv.y * uv.y * uSway;
          p.x += (sin(uPhase * 1.1 + uv.x * 23.0) * 0.05 + sin(uPhase * 2.7 + uv.x * 61.0) * 0.015) * (1.0 + 2.0 * uWind) * k + uWind * 0.07 * k;
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
  // Parallel to the right fence, a couple of feet in front of its soil, facing left; it swings left and right
  const SWING = [-16, GROUND, -7.2], SWING_TO = [14.8, 0, 8.0], SW = 2.48 * 1.04, SH = 2.92, PIVOT = 0.848 * SH;
  sprite("/media/white-rabbit/yard-swing.webp", SW, SH, SWING, SWING_TO);
  const hinge = new T.Group(); hinge.position.set(SWING[0], SWING[1] + PIVOT, SWING[2]); hinge.rotation.y = Math.atan2(SWING_TO[0], SWING_TO[2]); keep(hinge);
  const seat = new T.Group(); hinge.add(seat);
  sprite("/media/white-rabbit/yard-swing-seat.webp", SW, SH, [0, -PIVOT, 0.01], null, 0, seat);
  // The garden was rendered square on to its row and lies along it (the back fence), so both its ends
  // stand at their true depths from any view
  sprite("/media/white-rabbit/yard-garden.webp", 17.04, 2.99, [(BED[0] + BED[1]) / 2, GROUND, (BED[2] + BED[3]) / 2 + 0.17], [1, 0, 0], 1);

  // The stone bed: big rectangular stones mortared into a low curving wall along CURVE, two courses on
  // each face and a cap, soil inside, planted from end to end: a bushy green plant, flowers, a rose, more
  // flowers, a run of daylily leaves, and a last rose (plants rendered in Blender into one atlas; the rose
  // from Sketchfab, by RosticOstafi, CC BY 4.0; nettle, gazania, and periwinkle from Poly Haven, CC0)
  {
    const path = new T.CatmullRomCurve3(CURVE.map(([x, z]) => new T.Vector3(x, 0, z)), false, "centripetal");
    const len = path.getLength(), W = 0.62, Hb = 0.55, n = Math.ceil(len / 0.3);
    const stone = solid("#8A857C", 0.4), mortar = solid("#6C675F");
    const stones = keep(new T.InstancedMesh(new T.BoxGeometry(1, 1, 1), stone, n * 6)); let ks = 0;
    const p = new T.Vector3(), tng = new T.Vector3(), nrm = new T.Vector3();
    for (let i = 0; i < n; i++) {
      const u = (i + 0.5) / n; path.getPointAt(u, p); path.getTangentAt(u, tng); nrm.set(-tng.z, 0, tng.x);
      const yaw = Math.atan2(tng.x, tng.z);
      for (const side of [-1, 1]) for (const [y, hgt] of [[0.13, 0.24], [0.38, 0.22]]) {
        const sl = 0.42 + rnd() * 0.12, off = (y > 0.2 ? 0.15 : 0);
        e.set((rnd() - 0.5) * 0.04, yaw + (rnd() - 0.5) * 0.06, (rnd() - 0.5) * 0.04, "YXZ");
        stones.setMatrixAt(ks, m.compose(at0.set(p.x + nrm.x * side * (W / 2 - 0.06) + tng.x * off, GROUND + y, p.z + nrm.z * side * (W / 2 - 0.06) + tng.z * off), qq.setFromEuler(e), sc0.set(0.14, hgt - 0.02, sl)));
        const w = 0.82 + rnd() * 0.3; stones.setColorAt(ks++, tint.setRGB(w, w * (0.95 + rnd() * 0.08), w * (0.88 + rnd() * 0.1)));
      }
      e.set(0, yaw + (rnd() - 0.5) * 0.05, 0, "YXZ");
      stones.setMatrixAt(ks, m.compose(at0.set(p.x, GROUND + Hb - 0.03, p.z), qq.setFromEuler(e), sc0.set(W + 0.04, 0.07, 0.28)));
      stones.setColorAt(ks++, tint.setRGB(0.95, 0.93, 0.88));
      const core = keep(new T.Mesh(new T.BoxGeometry(W - 0.12, Hb - 0.1, len / n + 0.02), mortar)); core.position.set(p.x, GROUND + (Hb - 0.1) / 2, p.z); core.rotation.y = yaw;
    }
    stones.count = ks;
    // The plants, standing in the bed and turning to the camera like the trees
    const FLORA = { bush: [0.0, 0.5, 0.25, 0.8145, 1.3, 0.85], flowersA: [0.25, 0.5, 0.5, 0.9219, 0.75, 0.55], flowersB: [0.5, 0.5, 0.75, 0.8906, 0.85, 0.6],
      rose: [0.7964, 0.5, 0.9531, 1.0, 1.0, 1.45], andromeda: [0.2788, 0.0, 0.4707, 0.5, 3.0, 2.6], branchy: [0.5259, 0.0, 0.7241, 0.5, 2.0, 2.7],
      pinkrose: [0.7964, 0.5, 0.9531, 1.0, 1.3, 2.1], daylily: [0.0, 0.0, 0.25, 0.2627, 1.25, 0.62], crepe: [0.2788, 0.0, 0.4707, 0.5, 4.4, 5.8], pear: [0.5259, 0.0, 0.7241, 0.5, 5.4, 7.6] };
    const plan = [["bush", 0.03], ["bush", 0.07], ["flowersA", 0.13], ["flowersB", 0.19], ["flowersA", 0.25], ["flowersA", 0.31], ["rose", 0.39],
      ["flowersB", 0.46], ["flowersA", 0.52], ["flowersB", 0.58], ["daylily", 0.65], ["daylily", 0.71], ["daylily", 0.77], ["daylily", 0.83], ["daylily", 0.88], ["rose", 0.95]];
    const items = plan.map(([k, u]) => { path.getPointAt(u, p); return [k, p.x + (rnd() - 0.5) * 0.15, GROUND + Hb - 0.05, p.z + (rnd() - 0.5) * 0.15, 0]; });
    items.push(["crepe", YARD.back + 0.9, GROUND, YARD.right + 0.9, 1], ["pear", MINT[0], GROUND, MINT[1], 0]);
    // The left border, from the back corner toward the house: a big Japanese andromeda, a smaller bush on
    // long bare branches, and a tall pink rose (the dog house is built below)
    items.push(["andromeda", -25.2, GROUND, YARD.left - 0.95, 3], ["branchy", -20.6, GROUND, YARD.left - 0.9, 0], ["pinkrose", -16.6, GROUND, YARD.left - 0.85, 4]);
    const base = [], size = [], cell = [], seed = [], pinks = [];
    for (const [k, x, y, z, pink] of items) {
      const f = FLORA[k], s = 0.9 + rnd() * 0.2;
      base.push(x, y, z); size.push(f[4] * s, f[5] * s); cell.push(f[0], f[1], f[2], f[3]); seed.push(rnd()); pinks.push(pink + (k === "rose" ? 2 : 0));
    }
    const fq = new T.InstancedBufferGeometry();
    fq.setAttribute("position", new T.Float32BufferAttribute([-0.5, 0, 0, 0.5, 0, 0, 0.5, 1, 0, -0.5, 1, 0], 3)); fq.setIndex([0, 1, 2, 0, 2, 3]);
    fq.setAttribute("aBase", new T.InstancedBufferAttribute(new Float32Array(base), 3));
    fq.setAttribute("aSize", new T.InstancedBufferAttribute(new Float32Array(size), 2));
    fq.setAttribute("aCell", new T.InstancedBufferAttribute(new Float32Array(cell), 4));
    fq.setAttribute("aSeed", new T.InstancedBufferAttribute(new Float32Array(seed), 1));
    fq.setAttribute("aPink", new T.InstancedBufferAttribute(new Float32Array(pinks), 1));
    fq.instanceCount = items.length;
    const flora = { value: null };
    loader.load("/media/white-rabbit/flora-atlas.webp", (t) => { t.colorSpace = T.SRGBColorSpace; flora.value = t; textures.push(t); });
    const fm = keep(new T.Mesh(fq, new T.ShaderMaterial({
      uniforms: { ...common, ...timed, uMap: flora }, side: T.DoubleSide,
      vertexShader: TREE_VERT.replace("attribute float aSeed;", "attribute float aSeed;\n  attribute float aPink;\n  varying float vPink;").replace("vW = w; vSeed = aSeed;", "vW = w; vSeed = aSeed; vPink = aPink;"),
      fragmentShader: `${COMMON}\n${hash}\nuniform sampler2D uMap; varying vec2 vUv; varying vec3 vW; varying float vSeed, vPink;
        void main() { vec4 c = texture2D(uMap, vUv); if (c.a < 0.45) discard;
          vec3 k = c.rgb * (0.92 + 0.16 * vSeed) * 1.2;
          // The crepe myrtle's crown in pink bloom, flecked through the green; the roses lifted from near black to deep red
          if (vPink > 0.5 && vPink < 1.5) k = mix(k, vec3(0.95, 0.42, 0.66) * (0.7 + 0.5 * hash(floor(vUv * 400.0))), 0.7 * step(0.35, hash(floor(vUv * 260.0))) * smoothstep(0.2, 0.5, (vUv.y - ${(0.0).toFixed(1)}) * 2.0));
          if (vPink > 1.5 && vPink < 2.5) k = k * vec3(2.4, 1.6, 1.6) + vec3(0.06, 0.0, 0.01);
          // The andromeda: dense dark evergreen, hung with strings of tiny white flowers
          if (vPink > 2.5 && vPink < 3.5) { k *= vec3(0.6, 0.85, 0.55); k = mix(k, vec3(0.95, 0.93, 0.88), 0.55 * step(0.62, hash(floor(vUv * 330.0))) * step(0.3, vUv.y - ${(0.0).toFixed(1)})); }
          // The tall rose in pink
          if (vPink > 3.5) { float red = smoothstep(0.02, 0.12, c.r - c.g); k = mix(k * vec3(1.1, 1.25, 1.0), vec3(0.95, 0.5, 0.65), red * 0.85); }
          gl_FragColor = vec4(outdoor(k, normalize(vec3(0.3, 0.7, 0.2)), vW), 1.0); }`,
    })));
    fm.frustumCulled = false;
  }

  // The greenhouse: an 8 by 12 foot kit (Palram-style) square in the back-right corner of the concrete,
  // its gable door facing the house: silver aluminum frame, clear twin-wall panels, two roof vents
  {
    const g = GREEN, alu = solid("#B8BCC0"), panelMat = new T.ShaderMaterial({
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
      for (const z of [g.z0, g.z1]) { const r = bar(0.04, rl, 0.04, x, Y + (g.eave + g.ridge) / 2, (z + cz) / 2); r.rotation.x = (z < cz ? -1 : 1) * (Math.PI / 2 - slope); }
      if (door) { for (const z of [cz - 0.42, cz, cz + 0.42]) bar(0.04, 1.85, 0.04, x + 0.02, Y + 0.93, z); bar(0.04, 0.04, 0.88, x + 0.02, Y + 1.85, cz); bar(0.04, 0.035, 0.84, x + 0.02, Y + 0.95, cz); }
    }
    // Two roof vents propped open on the left slope
    for (const x of [g.x0 + L * 0.3, g.x0 + L * 0.7]) { const v = bar(0.6, 0.03, 0.5, x, Y + g.ridge - 0.12, cz + 0.3); v.rotation.x = slope + 0.35; }
  }

  // The old dog house in the back-left corner: weathered boards, a shingle roof gone mossy, a dark doorway
  {
    const wood = solid("#7A6650", 1), dark = solid("#151210"), roof = solid("#3E3C34");
    const dh = new T.Group(); dh.position.set(YARD.back + 1.0, GROUND, YARD.left - 1.0); dh.rotation.y = 0.35 + Math.PI / 2; keep(dh);
    const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => { const o = new T.Mesh(geo, mat); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); dh.add(o); return o; };
    add(new T.BoxGeometry(0.9, 0.75, 1.1), wood, 0, 0.42, 0);
    add(new T.BoxGeometry(0.02, 0.45, 0.32), dark, 0.456, 0.3, 0.05);                                         // the doorway
    for (const s of [-1, 1]) add(new T.BoxGeometry(0.62, 0.03, 1.22), roof, s * 0.24, 0.98, 0, 0, 0, s * -0.72);
    const gable = new T.BufferGeometry(); gable.setAttribute("position", new T.Float32BufferAttribute([0.45, 0.8, -0.55, 0.45, 0.8, 0.55, 0.45, 1.15, 0, -0.45, 0.8, 0.55, -0.45, 0.8, -0.55, -0.45, 1.15, 0], 3));
    gable.computeVertexNormals(); add(gable, wood, 0, 0, 0).material.side = T.DoubleSide;
    add(new T.BoxGeometry(0.96, 0.08, 1.16), wood, 0, 0.04, 0);                                               // the base, sunk a little
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
    seat.rotation.z = Math.sin(phase * 0.85) * (0.04 + 0.16 * wind) + Math.sin(phase * 2.3 + 1) * 0.012 + wind * 0.05;
  }

  // Frees what the world made
  function dispose() {
    group.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
    textures.forEach((t) => t.dispose());
    scene.remove(group);
  }

  return { ready, update, dispose };
}
