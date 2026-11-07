// src/app/public/js/white-rabbit-sky.js - The sky behind the white rabbit's window: clouds, the sun, and its light.
// Usage: const sky = createSky({ scene, win, touch }); sky.update(dt, level, ratio); sky.aim(camera, shafts, amount); sky.block(min, max)
//
// Imported by white-rabbit-scene.js. The sky is painted on a far wall outside the
// window: a blue gradient, a sun, wispy cirrus, and soft cumulus that drift on their
// own clock above autumn treetops, as seen from a second story. The cumulus are soft
// circles, so the same shapes are measured here in JS: sun tells the room how much of
// the sun is showing. Light shafts are a screen pass that smears only the brightest
// pixels away from the sun, so they stream from the window, break at the sash rails,
// and fade by themselves when a cloud covers it. Beams from the panes to the floor,
// and dust glinting in them, follow the sun too.

import * as T from "/js/vendor/three-0.187.0.rabbit.min.js";


// Where the sky is painted, and the sun on it (meters, in the plane's z and y)
const FAR = -30;
const SUN = { z: -11.4, y: 12.4, r: 1.3 };

// Sunlight comes in steeper than the painted sun sits, so its patch lands on the floor
export const LIGHT = new T.Vector3(-1.6, 1.5, -0.7).normalize();

// Clouds drift toward the right of the window and wrap off screen
const DRIFT = 0.9;            // meters a second
const SPAN = 80, ZMIN = -46;  // the wrap, wider than any view through the window
const PUFF = [[0, 1.0, 1.35], [1.5, 0.75, 1.05], [-1.5, 0.65, 1.0], [0.6, 1.85, 1.0], [-0.7, 1.6, 0.9], [2.5, 0.45, 0.6]];

// Each cloud: where it starts, the height of its flat base, and its size
// The first three cross the sun's height; the rest keep above it, clear of the treetops below
const CLOUDS = [[2, 11.4, 1.0], [30, 10.8, 1.25], [57, 11.9, 0.85], [16, 15.2, 1.1], [-8, 17.5, 1.4],
  [43, 7.4, 0.7], [70, 7.8, 0.6], [24, 14.4, 0.8], [64, 16.0, 1.2]];
const N = CLOUDS.length * PUFF.length;

// Smooth union, so the circles merge into one puffy outline
function smin(a, b, k) { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; }
const wobble = (z, y) => 0.3 * Math.sin(z * 0.9 + y * 0.4) * Math.sin(y * 1.3 - z * 0.5);

// The sky: gradient, sun, and clouds, with the sun glowing through thin cloud
const VERT = /* glsl */`
  varying vec2 vQ;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vQ = w.zy;
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;
const FRAG = /* glsl */`
  uniform vec4 uCirc[${N}];
  uniform vec3 uSun;
  uniform float uDrift, uTime;
  varying vec2 vQ;
  float smin(float a, float b, float k) { float h = max(k - abs(a - b), 0.0) / k; return min(a, b) - h * h * k * 0.25; }
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
  }
  float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; } return v; }
  void main() {
    vec2 q = vQ;
    // Deeper blue up high, lighter toward the horizon
    float h = clamp((q.y + 2.0) / 24.0, 0.0, 1.0);
    vec3 sky = mix(vec3(0.3, 0.58, 1.0), vec3(0.015, 0.11, 0.62), pow(h, 0.7)) * 1.2;

    // Clouds: a smooth union of circles, flat along each cloud's base, with wobbly edges that travel with them
    float sd = 1e3, base = 0.0;
    for (int i = 0; i < ${N}; i++) {
      vec4 c = uCirc[i];
      float d = length(q - c.xy) - c.z;
      if (d < sd) base = c.w;
      sd = smin(sd, d, 0.9);
    }
    // Edges eroded by noise that travels with the clouds, so no two look alike
    float zd = q.x + uDrift;
    sd += 0.3 * sin(zd * 0.9 + q.y * 0.4) * sin(q.y * 1.3 - zd * 0.5);
    sd += (fbm(vec2(zd, q.y) * 0.55) - 0.5) * 1.4;
    float a = smoothstep(0.6, -0.6, sd) * smoothstep(base - 0.4, base + 0.9, q.y);

    // Sunlit tops, blue-grey bellies, and a silver edge on clouds near the sun
    float ds = length(q - uSun.xy);
    float near = exp(-ds / 5.0);
    vec3 cloud = mix(vec3(0.5, 0.56, 0.7), vec3(1.25, 1.22, 1.18), clamp((q.y - base) / 3.5, 0.0, 1.0));
    cloud += vec3(1.8, 1.45, 1.0) * near * (1.0 - a) * 3.0;

    // The sun shows through thin cloud and hides behind thick
    float disc = smoothstep(uSun.z, uSun.z * 0.8, ds);
    float halo = exp(-ds / (uSun.z * 2.2));
    vec3 col = mix(sky, cloud, a);

    // Cirrus: thin streaks high up, drifting slower than the cumulus
    float ci = fbm(vec2((q.x + uDrift * 0.4) * 0.07, q.y * 0.45)) * fbm(vec2((q.x + uDrift * 0.4) * 0.3, q.y * 1.6));
    col = mix(col, vec3(1.1, 1.1, 1.12), smoothstep(0.2, 0.42, ci) * smoothstep(9.0, 15.0, q.y) * 0.55 * (1.0 - a));
    col += vec3(1.0, 0.86, 0.62) * halo * 1.4 * exp(-2.5 * a);
    col += vec3(16.0, 13.5, 9.5) * disc * exp(-5.0 * a);

    // Autumn treetops along the bottom, swaying a little more toward their tips
    float z = q.x + sin(uTime * 0.7 + q.x * 0.35) * 0.12 * clamp(q.y / 4.0, 0.0, 1.0);
    float top = 2.2 + 0.9 * sin(z * 0.33) + 0.5 * sin(z * 0.81 + 1.3) + 1.1 * fbm(vec2(z * 0.4, 0.0)) + 0.5 * fbm(vec2(z * 2.2, 3.0));
    float leaf = fbm(vec2(z, q.y) * 3.2), clump = fbm(vec2(z, q.y) * 0.9);
    if (q.y < top - (1.0 - leaf) * 0.7 && !(q.y > top - 0.9 && leaf < 0.38)) {
      // Each crown leans to its own color, mixed at the edges, and darker inside and lower down
      float t = fract(clump * 2.7 + hash(vec2(floor(z / 3.5), 3.0)) * 0.6);
      vec3 tint = t < 0.3 ? vec3(0.78, 0.26, 0.05) : t < 0.55 ? vec3(0.8, 0.52, 0.08) : t < 0.8 ? vec3(0.52, 0.09, 0.04) : vec3(0.2, 0.33, 0.09);
      float lit = 0.3 + 0.95 * leaf * leaf + 0.35 * clamp((q.y - top + 1.5) / 1.5, 0.0, 1.0);
      col = tint * lit * (0.5 + 0.5 * clamp(q.y / 2.5, 0.0, 1.0));
    }
    gl_FragColor = vec4(col, 1.0);
  }`;


// A point on the window opening, by its across (u, from the left as seen inside) and up (v) fractions
function onWindow(win, u, v) { return new T.Vector3(-1.95, win.y - win.h / 2 + v * win.h, win.z + win.w / 2 - u * win.w); }

// How far a point travels along the light before it reaches the floor
const toFloor = (p) => p.y / LIGHT.y;

// Beams: thin sheets of light from the panes down to the floor, fading in away from the glass and along their length,
// with a gap at the mullion and slow streaks that drift through them
const BEAM_VERT = /* glsl */`
  attribute vec3 aBeam;
  varying vec3 vB, vW;
  void main() { vB = aBeam; vW = (modelMatrix * vec4(position, 1.0)).xyz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const BEAM_FRAG = /* glsl */`
  uniform float uLevel, uTime;
  uniform vec3 uLight, uBlockMin, uBlockMax;
  varying vec3 vB, vW;
  // True when the way back toward the sun from here crosses the box: the beam is in its shadow
  float blocked(vec3 p) {
    vec3 t0 = (uBlockMin - p) / uLight, t1 = (uBlockMax - p) / uLight;
    vec3 lo = min(t0, t1), hi = max(t0, t1);
    float a = max(max(lo.x, lo.y), lo.z), b = min(min(hi.x, hi.y), hi.z);
    return step(max(a, 0.0), b);
  }
  void main() {
    float edge = smoothstep(0.0, 0.12, vB.x) * smoothstep(1.0, 0.88, vB.x);
    float gap = vB.z < 0.0 ? 1.0 : smoothstep(0.02, 0.07, abs(vB.x - vB.z));
    float streak = 0.6 + 0.4 * sin(vB.x * 37.0 + uTime * 0.4) * sin(vB.x * 13.0 - uTime * 0.25 + vB.y * 3.0);
    float a = uLevel * edge * gap * streak * (1.0 - vB.y) * smoothstep(0.0, 0.3, vB.y) * (1.0 - 0.92 * blocked(vW)) * smoothstep(0.05, 0.4, vW.x + 1.95);
    gl_FragColor = vec4(vec3(1.0, 0.8, 0.5) * a, 1.0);
  }`;

// Sheets across the window at a few heights, and up it at a few widths, all in one draw
function beams(win) {
  const pos = [], uv = [], index = [];
  const sheet = (a, b, bar = -1) => {
    const k = pos.length / 3, a2 = a.clone().addScaledVector(LIGHT, -toFloor(a)), b2 = b.clone().addScaledVector(LIGHT, -toFloor(b));
    for (const [p, x, y] of [[a, 0, 0], [b, 1, 0], [b2, 1, 1], [a2, 0, 1]]) { pos.push(p.x, Math.max(p.y, 0.005), p.z); uv.push(x, y, bar); }
    index.push(k, k + 1, k + 2, k, k + 2, k + 3);
  };
  // Across the sashes at a few heights, and up them at a few widths, broken where the meeting rails cross
  for (const v of [0.2, 0.36, 0.72, 0.86]) sheet(onWindow(win, 0.05, v), onWindow(win, 0.95, v));
  for (const u of [0.22, 0.4, 0.6, 0.78]) sheet(onWindow(win, u, 0.05), onWindow(win, u, 0.95), 0.6);
  const geo = new T.BufferGeometry();
  geo.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
  geo.setAttribute("aBeam", new T.Float32BufferAttribute(uv, 3));
  geo.setIndex(index);
  return new T.Mesh(geo, new T.ShaderMaterial({
    uniforms: { uLevel: { value: 0 }, uTime: { value: 0 }, uLight: { value: LIGHT.clone() },
      uBlockMin: { value: new T.Vector3(99, 99, 99) }, uBlockMax: { value: new T.Vector3(99, 99, 99) } },
    vertexShader: BEAM_VERT, fragmentShader: BEAM_FRAG,
    transparent: true, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide,
  }));
}

// Dust: motes that drift slowly in the beams and glint only when the light comes toward the viewer
const DUST_VERT = /* glsl */`
  uniform float uLevel, uTime, uSize;
  uniform vec3 uLight;
  attribute vec3 aSeed;
  varying float vA;
  void main() {
    vec3 p = position + vec3(sin(uTime * 0.13 + aSeed.x * 6.28) * 0.05, sin(uTime * 0.09 + aSeed.y * 6.28) * 0.06,
      sin(uTime * 0.11 + aSeed.z * 6.28) * 0.05);
    vec4 w = modelMatrix * vec4(p, 1.0);
    float glint = pow(0.5 + 0.5 * sin(uTime * (0.5 + aSeed.z * 1.5) + aSeed.x * 40.0), 6.0);
    float toward = pow(max(dot(normalize(w.xyz - cameraPosition), uLight), 0.0), 2.0);
    vA = uLevel * toward * (0.2 + 0.8 * glint);
    vec4 mv = viewMatrix * w;
    gl_PointSize = uSize * (0.6 + aSeed.y) / -mv.z;
    gl_Position = projectionMatrix * mv;
  }`;
const DUST_FRAG = /* glsl */`
  varying float vA;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d);
    gl_FragColor = vec4(vec3(1.0, 0.92, 0.75) * a * a * vA * 2.0, 1.0);
  }`;

// Motes spread through the beams, fewer on phones
function dust(win, count) {
  const pos = [], seed = [];
  for (let i = 0; i < count; i++) {
    const a = onWindow(win, 0.08 + Math.random() * 0.84, 0.08 + Math.random() * 0.84);
    a.addScaledVector(LIGHT, -toFloor(a) * (0.1 + Math.random() * 0.75));
    pos.push(a.x, a.y, a.z); seed.push(Math.random(), Math.random(), Math.random());
  }
  const geo = new T.BufferGeometry();
  geo.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
  geo.setAttribute("aSeed", new T.Float32BufferAttribute(seed, 3));
  return new T.Points(geo, new T.ShaderMaterial({
    uniforms: { uLevel: { value: 0 }, uTime: { value: 0 }, uSize: { value: 4 }, uLight: { value: LIGHT } },
    vertexShader: DUST_VERT, fragmentShader: DUST_FRAG, transparent: true, blending: T.AdditiveBlending, depthWrite: false,
  }));
}


// Shafts: march from each pixel toward the sun, adding up only what is brighter than the room
const SHAFT_FRAG = (n) => /* glsl */`
  uniform sampler2D tDiffuse;
  uniform vec2 uSun;
  uniform float uAmount;
  varying vec2 vUv;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  void main() {
    vec4 base = texture2D(tDiffuse, vUv);
    vec2 d = (vUv - uSun) * (0.85 / ${n}.0);
    vec2 uv = vUv - d * hash(vUv * 913.0);
    vec3 sum = vec3(0.0);
    float w = 1.0;
    for (int i = 0; i < ${n}; i++) {
      uv -= d;
      vec3 c = texture2D(tDiffuse, clamp(uv, 0.0, 1.0)).rgb;
      sum += min(c, vec3(3.0)) * min(max(dot(c, vec3(0.3, 0.5, 0.2)) - 1.2, 0.0), 1.0) * w;
      w *= 0.97;
    }
    // Light falls into the room, so shafts below the sun count more than those climbing the wall
    float down = 0.35 + 0.65 * smoothstep(0.2, -0.4, normalize(vUv - uSun + 1e-5).y);
    gl_FragColor = vec4(base.rgb + sum * vec3(1.0, 0.8, 0.52) * (uAmount * down / ${n}.0), base.a);
  }`;

/** A postprocessing pass for light shafts; fewer samples on phones */
export function createShafts({ touch }) {
  const pass = new T.ShaderPass({
    uniforms: { tDiffuse: { value: null }, uSun: { value: new T.Vector2(0.5, 0.5) }, uAmount: { value: 0 } },
    vertexShader: "varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: SHAFT_FRAG(touch ? 16 : 24),
  });
  pass.enabled = false;
  return pass;
}


/** Paints the sky outside the window `win`; update(dt, level) drifts the clouds and lights the floor; sun is 0 (hidden) to 1 (out) */
export function createSky({ scene, win, touch }) {
  // The circles, laid out once and moved each frame; w is the cloud's base
  const circ = Array.from({ length: N }, () => new T.Vector4());
  const uniforms = { uCirc: { value: circ }, uSun: { value: new T.Vector3(SUN.z, SUN.y, SUN.r) }, uDrift: { value: 0 }, uTime: { value: 0 } };
  const mesh = new T.Mesh(new T.PlaneGeometry(90, 50), new T.ShaderMaterial({ uniforms, vertexShader: VERT, fragmentShader: FRAG }));
  mesh.rotation.y = Math.PI / 2;
  mesh.position.set(FAR, 12, -6);
  scene.add(mesh);
  const beam = beams(win), motes = dust(win, touch ? 140 : 280);
  scene.add(beam, motes);

  // Cloud cover at a point of the sky, the same sum the shader draws
  function cover(z, y) {
    let sd = 1e3, base = 0;
    for (const c of circ) {
      const d = Math.hypot(z - c.x, y - c.y) - c.z;
      if (d < sd) base = c.w;
      sd = smin(sd, d, 0.9);
    }
    sd += wobble(z + uniforms.uDrift.value, y);
    const s = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
    return s(0.45, -0.45, sd) * s(base - 0.3, base + 0.7, y);
  }

  // Moves the clouds along on their own clock, measures the sun through them, and lights the floor to match
  let time = 0, sun = 1;
  function update(dt, level = 0, ratio = 1) {
    time += Math.min(dt, 0.1);
    const shift = DRIFT * time;
    uniforms.uDrift.value = shift % 1000;
    uniforms.uTime.value = time;
    let k = 0;
    for (const [z0, base, s] of CLOUDS) {
      const z = ZMIN + ((((z0 - ZMIN - shift) % SPAN) + SPAN) % SPAN);
      for (const [dz, dy, r] of PUFF) circ[k++].set(z + dz * s * 1.6, base + dy * s * 1.4, r * s * 1.5, base);
    }
    // The disc's center and four points around it, through the same cloud
    let seen = 0;
    for (const [oz, oy] of [[0, 0], [0.6, 0], [-0.6, 0], [0, 0.6], [0, -0.6]]) seen += Math.exp(-5 * cover(SUN.z + oz * SUN.r, SUN.y + oy * SUN.r));
    sun = seen / 5;
    beam.material.uniforms.uLevel.value = level * sun * 0.09;
    beam.material.uniforms.uTime.value = time;
    const m = motes.material.uniforms;
    m.uLevel.value = level * sun; m.uTime.value = time; m.uSize.value = 9 * ratio;
  }
  update(0);

  // Points the shafts at the sun on screen; none while it is behind the camera
  const at = new T.Vector3();
  function aim(camera, shafts, amount) {
    at.set(FAR, SUN.y, SUN.z).project(camera);
    shafts.uniforms.uSun.value.set((at.x + 1) / 2, (at.y + 1) / 2);
    shafts.uniforms.uAmount.value = at.z < 1 ? amount : 0;
    shafts.enabled = shafts.uniforms.uAmount.value > 0.001;
  }

  // Something standing in the window's light, as a world box [min, max]: the beams behind it go dark
  function block(min, max) { beam.material.uniforms.uBlockMin.value.copy(min); beam.material.uniforms.uBlockMax.value.copy(max); }

  return { update, aim, block, get sun() { return sun; } };
}
