// src/app/public/js/white-rabbit-world.js - The lakefront below the white rabbit's window.
// Usage: const world = createWorld({ scene, touch }); await world.ready; world.update(time, wind, phase, sun)
//
// Imported by white-rabbit-scene.js. The room is a second story, so the ground is 3 m below its floor
// (y -3). Out from the house (toward -x): a fenced back lawn with a swing set and a bed of sunflowers,
// a row of autumn trees on the verge, a sidewalk, a two-way road, another sidewalk, more trees, a
// pebble shore, and a wide lake out to a far wooded shore under the sky. Everything is cheap: the
// ground is one plane whose shader paints each strip, the trees are sprites from one atlas (rendered
// in Blender by blender/world.py) that turn to face the camera, and the water is one plane with
// moving ripples, the sky in them, and the sun's glitter. All of it is lit by the same sun, dimmed
// as clouds cover it, and fades into the haze with distance. The trees, swings, and flowers move with
// the wind the sound and the room share.

import * as T from "/js/vendor/three-0.187.0.rabbit.min.js";


// The ground's height, the sun's direction as painted in the sky, and the haze far things fade into
const GROUND = -3, LAKE = -3.25;
export const SUNDIR = new T.Vector3(-30.2, 11.3, -12.4).normalize();
const HAZE = new T.Color(0.74, 0.81, 0.9);

// Strips out from the house, as x where each ends (meters; the house wall is at x -2.05)
const STRIP = { fence: -20, sidewalk1: [-21.6, -23.4], road: [-23.4, -30.6], sidewalk2: [-30.6, -32.4], shore: -36.2, lake: -37.2 };
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
    return mix(lit, uHaze, 1.0 - exp(-d / 420.0));
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
  uniform vec3 uTrees[40];
  uniform vec4 uBed;
  varying vec3 vW;
  void main() {
    float x = vW.x, z = vW.z;
    // Grass: two scales of mottling, mown stripes on the lawn, and fine blades
    float blades = hash(floor(vW.xz * 60.0)) * 0.18;
    float mott = noise(vW.xz * 0.35) * 0.5 + noise(vW.xz * 2.1) * 0.3;
    vec3 grass = mix(vec3(0.16, 0.32, 0.08), vec3(0.32, 0.5, 0.14), mott) * (0.9 + blades);
    if (x > ${STRIP.fence.toFixed(1)}) grass *= 0.94 + 0.08 * step(0.5, fract(z / 1.6));
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
    // The shore: sand and pebbles
    if (x < ${STRIP.shore.toFixed(1)}) col = vec3(0.6, 0.55, 0.45) * (0.8 + 0.35 * hash(floor(vW.xz * 22.0)));
    // The flower bed: dark turned soil
    if (x > uBed.x && x < uBed.y && z > uBed.z && z < uBed.w) col = vec3(0.2, 0.13, 0.08) * (0.8 + 0.4 * noise(vW.xz * 12.0));
    // Soft shade under every tree, offset away from the sun
    float shade = 0.0;
    for (int i = 0; i < 40; i++) {
      vec2 c = uTrees[i].xy - uSunDir.xz / uSunDir.y * uTrees[i].z * 0.45;
      shade = max(shade, smoothstep(uTrees[i].z * 0.42, uTrees[i].z * 0.12, distance(vW.xz, c)));
    }
    col *= 1.0 - 0.45 * shade * (0.3 + 0.7 * uSun);
    gl_FragColor = vec4(outdoor(col, vec3(0.0, 1.0, 0.0), vW), 1.0);
  }`;

// ---- Water ----
const WATER_FRAG = /* glsl */`
  ${COMMON}
  uniform float uTime, uWind;
  varying vec3 vW;
  void main() {
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
    col += vec3(1.0, 0.9, 0.7) * pow(max(dot(r, uSunDir), 0.0), 700.0) * 30.0 * uSun;
    gl_FragColor = vec4(mix(col, uHaze, 1.0 - exp(-d / 520.0)), 1.0);
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
  varying vec3 vW, vN;
  void main() {
    mat4 m = modelMatrix;
    #ifdef USE_INSTANCING
      m = modelMatrix * instanceMatrix;
    #endif
    vec4 w = m * vec4(position, 1.0);
    vW = w.xyz; vN = normalize(mat3(m) * normal);
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;
const SOLID_FRAG = /* glsl */`
  ${COMMON}
  uniform vec3 uColor;
  varying vec3 vW, vN;
  void main() { gl_FragColor = vec4(outdoor(uColor, normalize(vN), vW), 1.0); }`;

// ---- Sunflowers: crossed cards with a painted plant, nodding in the wind ----
const FLOWER_VERT = /* glsl */`
  uniform float uPhase, uWind;
  varying vec2 vUv;
  varying vec3 vW;
  void main() {
    vUv = uv;
    vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
    float seed = instanceMatrix[3].x * 3.1 + instanceMatrix[3].z * 1.7;
    w.x += (sin(uPhase * 1.3 + seed) * 0.03 + uWind * 0.06) * uv.y * uv.y;
    vW = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;
const FLOWER_FRAG = /* glsl */`
  ${COMMON}
  uniform sampler2D uMap;
  varying vec2 vUv;
  varying vec3 vW;
  void main() {
    vec4 c = texture2D(uMap, vUv);
    if (c.a < 0.5) discard;
    gl_FragColor = vec4(outdoor(c.rgb, vec3(0.2, 0.8, 0.3), vW), 1.0);
  }`;

// A sunflower plant painted once: a stem with leaves and a head of petals around a dark disc
function sunflower() {
  const c = document.createElement("canvas"); c.width = 128; c.height = 256;
  const g = c.getContext("2d");
  g.strokeStyle = "#3f6a1f"; g.lineWidth = 6; g.beginPath(); g.moveTo(64, 256); g.quadraticCurveTo(58, 150, 66, 60); g.stroke();
  g.fillStyle = "#4b7a26";
  for (const [y, s] of [[200, 1], [160, -1], [120, 1]]) { g.beginPath(); g.ellipse(64 + s * 22, y, 22, 9, s * 0.5, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = "#f2b81c";
  for (let i = 0; i < 18; i++) { const a = (i / 18) * Math.PI * 2; g.beginPath(); g.ellipse(66 + Math.cos(a) * 22, 46 + Math.sin(a) * 22, 13, 5, a, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = "#4a2a10"; g.beginPath(); g.arc(66, 46, 17, 0, Math.PI * 2); g.fill();
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace;
  return t;
}

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
  for (let z = -60; z < 60 && trees.length < 40; z += 5 + rnd() * 5) if (Math.abs(z - 0.6) > 6 || rnd() < 0.35) trees.push([-34.2 - rnd() * 1.4, z, rnd(), 0.62]);
  const base = [], size = [], cell = [], seed = [], shade = [];
  for (const [x, z, r, scale] of trees) {
    const k = Math.floor(r * 6) % 6, h = TALL[k] * scale * (0.85 + rnd() * 0.3), c = CELLS[k];
    base.push(x, GROUND, z); size.push(h * c[4], h); cell.push(c[0], c[1], c[2], c[3]); seed.push(rnd());
    shade.push(new T.Vector3(x, z, h * c[4]));
  }
  while (shade.length < 40) shade.push(new T.Vector3(999, 999, 0));
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

  // The ground, from the house out past the shore
  const ground = keep(new T.Mesh(new T.PlaneGeometry(36, 140), new T.ShaderMaterial({
    uniforms: { ...common, uTrees: { value: shade }, uBed: { value: new T.Vector4(...BED) } }, vertexShader: GROUND_VERT, fragmentShader: GROUND_FRAG,
  })));
  ground.rotation.x = -Math.PI / 2; ground.position.set(-2.0 - 18, GROUND, 0);

  // The lake, out to the far shore
  const water = keep(new T.Mesh(new T.PlaneGeometry(800, 900), new T.ShaderMaterial({ uniforms: { ...common, ...timed }, vertexShader: GROUND_VERT, fragmentShader: WATER_FRAG })));
  water.rotation.x = -Math.PI / 2; water.position.set(STRIP.lake + 0.4 - 400, LAKE, 0);

  // The far shore: the old far tree row, repeated along a low wooded bank, with hazy hills behind
  const shoreTex = loader.load("/media/white-rabbit/trees-far.webp", (t) => { t.colorSpace = T.SRGBColorSpace; });
  shoreTex.wrapS = T.RepeatWrapping; textures.push(shoreTex);
  const bank = keep(new T.Mesh(new T.PlaneGeometry(900, 40), new T.ShaderMaterial({
    uniforms: { ...common, uMap: { value: shoreTex } }, vertexShader: GROUND_VERT,
    fragmentShader: `${COMMON}\nuniform sampler2D uMap; varying vec3 vW; varying vec2 vUv;
      void main() { vec4 c = texture2D(uMap, vUv * vec2(6.0, 1.0)); if (c.a < 0.4) discard; gl_FragColor = vec4(outdoor(c.rgb, vec3(0.3, 0.8, 0.2), vW), 1.0); }`,
  })));
  bank.rotation.y = Math.PI / 2; bank.position.set(-760, LAKE + 14, 0);
  const hills = keep(new T.Mesh(new T.PlaneGeometry(2400, 160), new T.ShaderMaterial({
    uniforms: { ...common }, vertexShader: GROUND_VERT,
    fragmentShader: `${COMMON}\n${hash}\nvarying vec3 vW; varying vec2 vUv;
      void main() { float h = 0.25 + 0.18 * noise(vec2(vUv.x * 9.0, 0.0)) + 0.1 * noise(vec2(vUv.x * 31.0, 0.0)); if (vUv.y > h) discard;
        gl_FragColor = vec4(mix(vec3(0.36, 0.42, 0.4), uHaze, 0.72), 1.0); }`,
  })));
  hills.rotation.y = Math.PI / 2; hills.position.set(-1500, LAKE + 60, 0);

  // The fence: white pickets on two rails across the yard's end
  const solid = (color) => new T.ShaderMaterial({ uniforms: { ...common, uColor: { value: new T.Color(color) } }, vertexShader: SOLID_VERT, fragmentShader: SOLID_FRAG });
  const n = Math.floor(120 / 0.16), pickets = keep(new T.InstancedMesh(new T.BoxGeometry(0.02, 1.1, 0.09), solid("#ECEAE2"), n));
  const m = new T.Matrix4();
  for (let i = 0; i < n; i++) pickets.setMatrixAt(i, m.makeTranslation(STRIP.fence, GROUND + 0.55, -60 + i * 0.16));
  for (const y of [0.3, 0.85]) { const rail = keep(new T.Mesh(new T.BoxGeometry(0.04, 0.08, 120), solid("#E2DFD6"))); rail.position.set(STRIP.fence + 0.03, GROUND + y, 0); }

  // The swing set: two A-frames of faded red tube, a top bar, and two swings hanging from it
  const swing = new T.Group(), tube = solid("#A8463A"), seatMat = solid("#2E4E7A"), chainMat = solid("#9A9A9A");
  for (const z of [-1.3, 1.3]) for (const s of [-1, 1]) {
    const leg = new T.Mesh(new T.CylinderGeometry(0.04, 0.04, 2.5, 8), tube);
    leg.position.set(s * 0.3, 1.2, z); leg.rotation.x = 0; leg.rotation.z = s * 0.24; swing.add(leg);
  }
  const bar = new T.Mesh(new T.CylinderGeometry(0.045, 0.045, 2.8, 8), tube); bar.rotation.x = Math.PI / 2; bar.position.y = 2.42; swing.add(bar);
  const seats = [];
  for (const z of [-0.6, 0.6]) {
    const pivot = new T.Group(); pivot.position.set(0, 2.4, z);
    for (const dz of [-0.2, 0.2]) { const chain = new T.Mesh(new T.CylinderGeometry(0.008, 0.008, 1.9, 4), chainMat); chain.position.set(0, -0.95, dz); pivot.add(chain); }
    const seat = new T.Mesh(new T.BoxGeometry(0.2, 0.03, 0.46), seatMat); seat.position.y = -1.9; pivot.add(seat);
    swing.add(pivot); seats.push(pivot);
  }
  swing.position.set(-11, GROUND, -4); swing.rotation.y = 0.3;
  keep(swing);

  // Sunflowers in their bed
  const card = new T.PlaneGeometry(0.7, 1.9); card.translate(0, 0.95, 0);
  const cross = T.mergeGeometries([card, card.clone().rotateY(Math.PI / 2)]);
  card.dispose();
  const flowerTex = sunflower(); textures.push(flowerTex);
  const count = touch ? 22 : 34, flowers = keep(new T.InstancedMesh(cross, new T.ShaderMaterial({
    uniforms: { ...common, ...timed, uMap: { value: flowerTex } }, vertexShader: FLOWER_VERT, fragmentShader: FLOWER_FRAG, side: T.DoubleSide,
  }), count));
  const q = new T.Quaternion(), sc = new T.Vector3(), at = new T.Vector3(), up = new T.Vector3(0, 1, 0);
  for (let i = 0; i < count; i++) {
    at.set(BED[0] + 0.2 + rnd() * (BED[1] - BED[0] - 0.4), GROUND, BED[2] + 0.3 + rnd() * (BED[3] - BED[2] - 0.6));
    q.setFromAxisAngle(up, rnd() * Math.PI); const k = 0.85 + rnd() * 0.35; sc.set(k, k, k);
    flowers.setMatrixAt(i, m.compose(at, q, sc));
  }

  // Each frame: the clock and the wind for the moving things, and the sun's share by the clouds
  function update(time, wind, phase, sunShare) {
    common.uSun.value = sunShare;
    timed.uTime.value = time; timed.uPhase.value = phase; timed.uWind.value = wind;
    seats.forEach((p, i) => { p.rotation.z = Math.sin(phase * 0.9 + i * 1.7) * (0.04 + 0.22 * wind) + wind * 0.06; });
  }

  // Frees what the world made
  function dispose() {
    group.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
    textures.forEach((t) => t.dispose());
    scene.remove(group);
  }

  return { ready, update, dispose };
}
