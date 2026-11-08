// src/app/public/js/white-rabbit-world.js - The lakefront below the white rabbit's window.
// Usage: const world = createWorld({ scene, touch }); await world.ready; world.update(time, wind, phase, sun)
//
// Imported by white-rabbit-scene.js. The room is a second story, so the ground is 3 m below its floor
// (y -3). Out from the house (toward -x): a fenced back lawn with a swing set and a bed of sunflowers,
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
const GROUND = -3, LAKE = -3.3;
export const SUNDIR = new T.Vector3(-30.2, 11.3, -12.4).normalize();
const HAZE = new T.Color(0.74, 0.81, 0.9);

// Strips out from the house, as x where each ends (meters; the house wall is at x -2.05)
const STRIP = { fence: -20, sidewalk1: [-21.6, -23.4], road: [-23.4, -30.6], sidewalk2: [-30.6, -32.4] };
// The pond: its center, its half-widths across (x) and along (z), and the outline as a radius that
// wanders with the angle, so it is a skewed loop, not a circle (the same in JS and GLSL). It is a big
// old quarry: about 0.9 by 1.3 km, so the walkway around it is near 3 km (1.85 miles), with its near
// bank 50 m out, past the road and a strip of park
const POND = { x: -504, z: 3, ax: 380, az: 560 };
const SHAPE = (a) => 1 + 0.16 * Math.sin(2 * a + 0.7) + 0.09 * Math.sin(3 * a + 2.1) + 0.05 * Math.sin(5 * a + 0.3);
const SHAPE_GLSL = /* glsl */`
  float shape(float a) { return 1.0 + 0.16 * sin(2.0 * a + 0.7) + 0.09 * sin(3.0 * a + 2.1) + 0.05 * sin(5.0 * a + 0.3); }
  // Meters outside the pond's edge (negative inside), roughly
  float pondEdge(vec2 xz) {
    vec2 q = (xz - vec2(${POND.x.toFixed(1)}, ${POND.z.toFixed(1)})) / vec2(${POND.ax.toFixed(1)}, ${POND.az.toFixed(1)});
    return (length(q) - shape(atan(q.y, q.x))) * ${((POND.ax + POND.az) / 2).toFixed(1)};
  }`;
const BED = [-19.7, -18.3, 2.5, 12.5];    // the sunflower bed: x0, x1, z0, z1

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
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }`;


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
  varying vec3 vW;
  void main() {
    float x = vW.x, z = vW.z;
    float e = pondEdge(vW.xz);
    if (e < -0.2) discard;                       // the water shows through here
    // Grass: never one green. Patches of lusher and drier turf, clover in darker clumps, yellowing where it
    // is thin, mowing stripes that wander and fade, longer darker grass where the mower can't reach along
    // the fence, the odd dandelion, bare earth worn under the swing and along the way from the back door to
    // the garden, and autumn leaves scattered under and downwind of the trees
    float blades = hash(floor(vW.xz * 60.0)) * 0.16;
    float mott = noise(vW.xz * 0.21) * 0.45 + noise(vW.xz * 0.9) * 0.3 + noise(vW.xz * 3.7) * 0.25;
    float dry = smoothstep(0.55, 0.85, noise(vW.xz * 0.12 + 7.0));
    vec3 grass = mix(vec3(0.15, 0.3, 0.07), vec3(0.3, 0.46, 0.13), mott);
    grass = mix(grass, vec3(0.45, 0.45, 0.2), dry * 0.55);
    grass = mix(grass, vec3(0.1, 0.24, 0.07), smoothstep(0.62, 0.75, noise(vW.xz * 1.6 + 3.0)) * 0.6);
    grass *= 0.9 + blades;
    if (x > ${STRIP.fence.toFixed(1)}) {
      float wander = z + sin(x * 0.4) * 0.5 + noise(vec2(x * 0.3, 0.0)) * 0.8;
      grass *= 0.95 + 0.07 * step(0.5, fract(wander / 1.6)) * (0.4 + 0.6 * noise(vW.xz * 0.15));
      grass = mix(grass, vec3(0.12, 0.25, 0.08), smoothstep(-19.0, -19.9, x) * 0.6);
      float wear = smoothstep(1.7, 0.4, distance(vW.xz, vec2(-11.0, -4.0)) + noise(vW.xz * 3.0) * 0.6);
      vec2 a = vec2(-2.2, 1.0), b = vec2(-18.0, 6.0), ab = b - a;
      float t = clamp(dot(vW.xz - a, ab) / dot(ab, ab), 0.0, 1.0);
      float path = smoothstep(0.55, 0.15, distance(vW.xz, a + ab * t) + (noise(vW.xz * 2.0) - 0.5) * 0.5) * 0.55;
      grass = mix(grass, vec3(0.36, 0.3, 0.2) * (0.8 + 0.4 * hash(floor(vW.xz * 25.0))), max(wear * 0.85, path));
    }
    float dande = step(0.9965, hash(floor(vW.xz * 7.0))) * step(0.4, noise(vW.xz * 0.5));
    grass = mix(grass, vec3(0.92, 0.75, 0.12), dande);
    float leaves = 0.0;
    for (int i = 0; i < 48; i++) leaves = max(leaves, smoothstep(uTrees[i].z * 1.1, uTrees[i].z * 0.2, distance(vW.xz, uTrees[i].xy + vec2(2.0, 1.0))));
    float leaf = step(1.0 - leaves * 0.35, hash(floor(vW.xz * 18.0)));
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
    gl_FragColor = vec4(outdoor(col, vec3(0.0, 1.0, 0.0), vW), 1.0);
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
  uniform vec3 uColor;
  varying vec3 vW, vN, vTint;
  void main() {
    // Weathering: paint greys and greens toward the ground, where rain splashes and mower clippings land
    vec3 c = uColor * vTint * mix(vec3(0.72, 0.76, 0.66), vec3(1.0), smoothstep(-3.0, -2.55, vW.y));
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
  for (let z = -46; z < 46; z += 6 + rnd() * 4) if (Math.abs(z - 0.6) > 9 || rnd() < 0.2) trees.push([-20.9 - rnd() * 0.5, z, rnd(), 1]);
  trees.push([-15.5, -13.5, rnd(), 1], [-5.5, 15, rnd(), 1], [-17, 16.5, rnd(), 1]);
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

  // The ground, from the house out past the pond
  const ground = keep(new T.Mesh(new T.PlaneGeometry(1100, 1800), new T.ShaderMaterial({
    uniforms: { ...common, uTrees: { value: shade }, uBed: { value: new T.Vector4(...BED) } }, vertexShader: GROUND_VERT, fragmentShader: GROUND_FRAG,
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

  // The fence: white pickets on two rails between posts every 2.4 m, years old. Pickets differ a little in
  // height and lean, some sections sag, the paint has weathered unevenly and gone grey and green near the
  // ground, a few pickets lean hard, and here and there one is missing
  const solid = (color) => new T.ShaderMaterial({ uniforms: { ...common, uColor: { value: new T.Color(color) } }, vertexShader: SOLID_VERT, fragmentShader: SOLID_FRAG });
  const n = Math.floor(120 / 0.16), pickets = keep(new T.InstancedMesh(new T.BoxGeometry(0.02, 1.1, 0.09), solid("#FFFFFF"), n));
  const m = new T.Matrix4(), qq = new T.Quaternion(), e = new T.Euler(), at0 = new T.Vector3(), sc0 = new T.Vector3(), tint = new T.Color();
  const sag = (z) => 0.035 * Math.sin(((z + 60) / 2.4) * Math.PI) ** 2 * (0.4 + 0.6 * Math.abs(Math.sin(z * 0.37)));
  for (let i = 0; i < n; i++) {
    const z = -60 + i * 0.16 + (rnd() - 0.5) * 0.015, hard = rnd() < 0.015, gone = rnd() < 0.008;
    const h = 1 + (rnd() - 0.5) * 0.06;
    e.set((rnd() - 0.5) * 0.04 + (hard ? (rnd() - 0.5) * 0.5 : 0), 0, (rnd() - 0.5) * 0.05 + (hard ? 0.18 : 0));
    at0.set(STRIP.fence + (rnd() - 0.5) * 0.01, GROUND + 0.55 * h - sag(z), z); sc0.set(1, gone ? 0.0001 : h, 1);
    pickets.setMatrixAt(i, m.compose(at0, qq.setFromEuler(e), sc0));
    const w = 0.82 + rnd() * 0.18;
    pickets.setColorAt(i, tint.setRGB(0.93 * w, 0.92 * w, 0.88 * w - rnd() * 0.04));
  }
  const posts = keep(new T.InstancedMesh(new T.BoxGeometry(0.09, 1.25, 0.09), solid("#D8D4C8"), 50));
  for (let i = 0; i < 50; i++) {
    e.set((rnd() - 0.5) * 0.05, 0, (rnd() - 0.5) * 0.06);
    posts.setMatrixAt(i, m.compose(at0.set(STRIP.fence + 0.06, GROUND + 0.6, -60 + i * 2.4), qq.setFromEuler(e), sc0.set(1, 1, 1)));
  }
  for (const y of [0.3, 0.85]) {
    const rail = keep(new T.Mesh(new T.BoxGeometry(0.04, 0.08, 120, 1, 1, 300), solid("#DAD6CA")));
    const pos = rail.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setY(i, pos.getY(i) - sag(pos.getZ(i)));
    rail.geometry.computeVertexNormals();
    rail.position.set(STRIP.fence + 0.03, GROUND + y, 0);
  }

  // The swing set and the sunflower bed: rendered in Blender (planning folder, blender/yard.blend) from
  // the way the window looks at them, with their own shadows, so each stands as one card facing the house.
  // The swing set is an old rusted one (Sketchfab, by main1896, CC BY 4.0); the sunflowers (Sketchfab, by
  // zvanstone, CC BY 4.0) lean, nod, and turn every which way, late in the season, among weeds and grass
  // clumps (Poly Haven, CC0)
  const sprite = (url, w, h, at, toward) => {
    const map = { value: null };
    loader.load(url, (t) => { t.colorSpace = T.SRGBColorSpace; map.value = t; textures.push(t); });
    const card = new T.PlaneGeometry(w, h); card.translate(0, h / 2, 0);
    const mesh = keep(new T.Mesh(card, new T.ShaderMaterial({
      uniforms: { ...common, uMap: map }, vertexShader: GROUND_VERT, transparent: true, depthWrite: false,
      fragmentShader: `${COMMON}\nuniform sampler2D uMap; varying vec3 vW; varying vec2 vUv;
        void main() { vec4 c = texture2D(uMap, vUv); if (c.a < 0.02) discard;
          float d = distance(vW, cameraPosition);
          gl_FragColor = vec4(mix(c.rgb * (0.78 + 0.22 * uSun), uHaze, 1.0 - exp(-d / 1100.0)), c.a); }`,
    })));
    mesh.position.set(at[0], GROUND, at[2]);
    mesh.rotation.y = Math.atan2(toward[0], toward[2]);
    return mesh;
  };
  sprite("/media/white-rabbit/yard-swing.webp", 2.9, 3.97, [-11, 0, -4], [9.05, 0, 4.6]);
  sprite("/media/white-rabbit/yard-bed.webp", 10.74, 4.0, [(BED[0] + BED[1]) / 2, 0, (BED[2] + BED[3]) / 2], [17.05, 0, -6.9]);

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
  }

  // Frees what the world made
  function dispose() {
    group.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
    textures.forEach((t) => t.dispose());
    scene.remove(group);
  }

  return { ready, update, dispose };
}
