// src/app/public/js/white-rabbit-sky.js - The sky behind the white rabbit's window: clouds, the sun, and its light.
// Usage: const sky = createSky({ scene, win, touch }); sky.update(dt, level, ratio); sky.aim(camera, shafts, amount)
//
// Imported by white-rabbit-scene.js. The sky is painted on a far wall outside the
// window: a blue gradient, a sun, and puffy clouds that drift across it on their
// own clock. The clouds are a few dozen soft circles, so the same shapes can be
// measured here in JS: sun tells the room how much of the sun is showing, and the
// window's panes of sunlight on the floor follow it. Light shafts are a screen pass
// that smears only the brightest pixels away from the sun, so they stream from the
// window, break at the mullions, and fade by themselves when a cloud covers it.
// Beams from the panes to the floor, and dust glinting in them, follow the sun too.

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
// The first three cross the sun's height; the rest keep above or below it
const CLOUDS = [[2, 11.4, 1.0], [30, 10.8, 1.25], [57, 11.9, 0.85], [16, 15.2, 1.1], [-8, 17.5, 1.3],
  [43, 5.0, 1.3], [-24, 3.4, 1.5], [70, 6.6, 1.1], [10, 1.0, 0.9], [24, 14.4, 0.9], [38, 4.6, 0.8], [64, 16.0, 1.0],
  [-15, 0.2, 1.1]];
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
  uniform float uDrift;
  varying vec2 vQ;
  float smin(float a, float b, float k) { float h = max(k - abs(a - b), 0.0) / k; return min(a, b) - h * h * k * 0.25; }
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
    float zd = q.x + uDrift;
    sd += 0.3 * sin(zd * 0.9 + q.y * 0.4) * sin(q.y * 1.3 - zd * 0.5);
    float a = smoothstep(0.45, -0.45, sd) * smoothstep(base - 0.3, base + 0.7, q.y);

    // Sunlit tops, blue-grey bellies, and a silver edge on clouds near the sun
    float ds = length(q - uSun.xy);
    float near = exp(-ds / 5.0);
    vec3 cloud = mix(vec3(0.5, 0.56, 0.7), vec3(1.25, 1.22, 1.18), clamp((q.y - base) / 3.5, 0.0, 1.0));
    cloud += vec3(1.8, 1.45, 1.0) * near * (1.0 - a) * 3.0;

    // The sun shows through thin cloud and hides behind thick
    float disc = smoothstep(uSun.z, uSun.z * 0.8, ds);
    float halo = exp(-ds / (uSun.z * 2.2));
    vec3 col = mix(sky, cloud, a);
    col += vec3(1.0, 0.86, 0.62) * halo * 1.4 * exp(-2.5 * a);
    col += vec3(16.0, 13.5, 9.5) * disc * exp(-5.0 * a);
    gl_FragColor = vec4(col, 1.0);
  }`;


// The window's four panes as a soft light texture, the mullion and frame left dark
function panes() {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d");
  g.filter = "blur(7px)"; g.fillStyle = "#fff";
  for (const [x, y] of [[14, 14], [134, 14], [14, 134], [134, 134]]) g.fillRect(x, y, 108, 108);
  const tex = new T.CanvasTexture(c);
  tex.colorSpace = T.SRGBColorSpace;
  return tex;
}

// Sunlight through the window onto the floor: each corner of the opening carried along the light to y 0
function patch(win) {
  const pts = [], uv = [];
  for (const [u, v] of [[0, 0], [1, 0], [1, 1], [0, 1]]) {
    const c = new T.Vector3(-1.95, win.y - win.h / 2 + v * win.h, win.z + win.w / 2 - u * win.w);
    c.addScaledVector(LIGHT, -c.y / LIGHT.y).setY(0.004);
    pts.push(c.x, c.y, c.z); uv.push(u, v);
  }
  const geo = new T.BufferGeometry();
  geo.setAttribute("position", new T.Float32BufferAttribute(pts, 3));
  geo.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
  geo.setIndex([0, 1, 2, 0, 2, 3]);
  return new T.Mesh(geo, new T.MeshBasicMaterial({
    map: panes(), color: "#FFD9A0", transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false,
  }));
}


// A point on the window opening, by its across (u, from the left as seen inside) and up (v) fractions
function onWindow(win, u, v) { return new T.Vector3(-1.95, win.y - win.h / 2 + v * win.h, win.z + win.w / 2 - u * win.w); }

// How far a point travels along the light before it reaches the floor
const toFloor = (p) => p.y / LIGHT.y;

// Beams: thin sheets of light from the panes down to the floor, fading along their length,
// with a gap at the mullion and slow streaks that drift through them
const BEAM_VERT = /* glsl */`
  attribute vec2 aBeam;
  varying vec2 vB;
  void main() { vB = aBeam; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const BEAM_FRAG = /* glsl */`
  uniform float uLevel, uTime;
  varying vec2 vB;
  void main() {
    float edge = smoothstep(0.0, 0.12, vB.x) * smoothstep(1.0, 0.88, vB.x);
    float gap = smoothstep(0.02, 0.07, abs(vB.x - 0.5));
    float streak = 0.6 + 0.4 * sin(vB.x * 37.0 + uTime * 0.4) * sin(vB.x * 13.0 - uTime * 0.25 + vB.y * 3.0);
    float a = uLevel * edge * gap * streak * (1.0 - vB.y) * smoothstep(0.0, 0.3, vB.y);
    gl_FragColor = vec4(vec3(1.0, 0.8, 0.5) * a, 1.0);
  }`;

// Sheets across the window at a few heights, and up it at a few widths, all in one draw
function beams(win) {
  const pos = [], uv = [], index = [];
  const sheet = (a, b) => {
    const k = pos.length / 3, a2 = a.clone().addScaledVector(LIGHT, -toFloor(a)), b2 = b.clone().addScaledVector(LIGHT, -toFloor(b));
    for (const [p, x, y] of [[a, 0, 0], [b, 1, 0], [b2, 1, 1], [a2, 0, 1]]) { pos.push(p.x, Math.max(p.y, 0.005), p.z); uv.push(x, y); }
    index.push(k, k + 1, k + 2, k, k + 2, k + 3);
  };
  for (const v of [0.2, 0.36, 0.64, 0.8]) sheet(onWindow(win, 0.05, v), onWindow(win, 0.95, v));
  for (const u of [0.22, 0.38, 0.62, 0.78]) sheet(onWindow(win, u, 0.05), onWindow(win, u, 0.95));
  const geo = new T.BufferGeometry();
  geo.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
  geo.setAttribute("aBeam", new T.Float32BufferAttribute(uv, 2));
  geo.setIndex(index);
  return new T.Mesh(geo, new T.ShaderMaterial({
    uniforms: { uLevel: { value: 0 }, uTime: { value: 0 } }, vertexShader: BEAM_VERT, fragmentShader: BEAM_FRAG,
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
  const uniforms = { uCirc: { value: circ }, uSun: { value: new T.Vector3(SUN.z, SUN.y, SUN.r) }, uDrift: { value: 0 } };
  const mesh = new T.Mesh(new T.PlaneGeometry(90, 50), new T.ShaderMaterial({ uniforms, vertexShader: VERT, fragmentShader: FRAG }));
  mesh.rotation.y = Math.PI / 2;
  mesh.position.set(FAR, 12, -6);
  scene.add(mesh);
  const floor = patch(win), beam = beams(win), motes = dust(win, touch ? 140 : 280);
  scene.add(floor, beam, motes);

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
    let k = 0;
    for (const [z0, base, s] of CLOUDS) {
      const z = ZMIN + ((((z0 - ZMIN - shift) % SPAN) + SPAN) % SPAN);
      for (const [dz, dy, r] of PUFF) circ[k++].set(z + dz * s * 1.6, base + dy * s * 1.4, r * s * 1.5, base);
    }
    // The disc's center and four points around it, through the same cloud
    let seen = 0;
    for (const [oz, oy] of [[0, 0], [0.6, 0], [-0.6, 0], [0, 0.6], [0, -0.6]]) seen += Math.exp(-5 * cover(SUN.z + oz * SUN.r, SUN.y + oy * SUN.r));
    sun = seen / 5;
    floor.material.opacity = level * sun * 0.9;
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

  return { update, aim, get sun() { return sun; } };
}
