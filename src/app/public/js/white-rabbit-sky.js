// src/app/public/js/white-rabbit-sky.js - The sky behind the white rabbit's window: clouds, the sun, and its light.
// Usage: const sky = createSky({ scene, win, touch }); await sky.ready; sky.update(dt, level, ratio); sky.aim(camera, shafts, amount)
//
// Imported by white-rabbit-scene.js. The sky outside is two images rendered in Blender (see the
// planning folder's blender/outside.py): a sky and a layer of volumetric cumulus, each on a plane at
// its own depth, drawn behind the lakefront (white-rabbit-world.js), so the view shifts a little as
// the camera moves; the clouds drift and wrap, and the wind gusts now and then. The sun disc
// is drawn here, brighter than an image can hold, and the cloud layer's alpha at the sun is
// read on the CPU, so sun tells the room how much of it is showing. Light shafts are a screen
// pass that smears only the brightest pixels away from the sun, so they stream from the
// window, break at the sash rails, and fade by themselves when a cloud covers it. Beams from
// the panes to the floor, and dust glinting in them, follow the sun too.

import * as T from "/js/vendor/three-0.187.0.rabbit.min.js";


// The viewpoint the layers were rendered from, the reference plane their rects are given on,
// and the sun as a point and radius on it (meters; these match blender/outside.py)
const VIEW = new T.Vector3(0.2, 1.1, 1.0), REF = -30;
const SUN = { z: -11.4, y: 12.4, r: 1.3 };
const FAR = REF;

// Each layer: its image, rect on the reference plane (z0, z1, y0, y1), and the depth of its plane, far
// past the lakefront (white-rabbit-world.js), which stands in front of them
const LAYERS = {
  sky: ["/media/white-rabbit/sky.webp", [-90, 70, -3, 37], -4000],
  clouds: ["/media/white-rabbit/clouds.webp", [-70, 60, 4, 24], -3500],
};

// Sunlight comes in steeper than the painted sun sits, so its patch lands on the floor
export const LIGHT = new T.Vector3(-1.6, 1.5, -0.7).normalize();

// Clouds drift toward the right of the window, in widths of their layer a second
const DRIFT = 0.006;

// A point on the reference plane, carried out along the view to a plane at depth x
function along(x, z, y) { const k = (VIEW.x - x) / (VIEW.x - REF); return [VIEW.z + (z - VIEW.z) * k, VIEW.y + (y - VIEW.y) * k]; }

// The layers share one vertex shader; each fragment shader adds its own touch
const LAYER_VERT = /* glsl */`
  varying vec2 vUv, vQ;
  void main() {
    vUv = uv;
    vec4 w = modelMatrix * vec4(position, 1.0);
    vQ = w.zy;
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;
// The sky, and the sun disc and halo over it, far brighter than the image so the shafts and bloom catch it
const SKY_FRAG = /* glsl */`
  uniform sampler2D uMap;
  uniform vec3 uSun;
  varying vec2 vUv, vQ;
  void main() {
    vec3 col = texture2D(uMap, vUv).rgb;
    float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
    col = mix(vec3(l), col, 1.9) * vec3(0.7, 0.88, 1.18);  // a deeper, clearer blue than the hazy render
    // Down to the horizon (the plane is 4 km out), the sky pales into the same haze the lakefront fades to
    col = mix(vec3(0.74, 0.81, 0.9), col, smoothstep(0.0, 0.09, (vQ.y - 1.3) / 4000.0));
    float ds = length(vQ - uSun.xy);
    col += vec3(1.0, 0.86, 0.62) * exp(-ds / (uSun.z * 2.2)) * 1.1;
    col += vec3(16.0, 13.5, 9.5) * smoothstep(uSun.z, uSun.z * 0.8, ds);
    gl_FragColor = vec4(col, 1.0);
  }`;
// The clouds, drifting and wrapping
const CLOUD_FRAG = /* glsl */`
  uniform sampler2D uMap;
  uniform float uDrift;
  varying vec2 vUv, vQ;
  void main() {
    // The layer is drawn 3.25 times its rendered width (it tiles), and fades out at its edges
    vec4 c = texture2D(uMap, vec2(vUv.x * 3.25 + uDrift, vUv.y));
    float edge = smoothstep(0.0, 0.08, vUv.x) * smoothstep(1.0, 0.92, vUv.x) * smoothstep(0.0, 0.12, vUv.y) * smoothstep(1.0, 0.88, vUv.y);
    gl_FragColor = vec4(mix(c.rgb, vec3(1.0, 0.99, 0.97), 0.25) * 1.18, c.a * edge);  // fair-weather white, not storm grey
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

// Dust: motes through the room, seen mostly where they cross the sunbeams. Each point is lit only if the
// way back toward the sun from it passes through the window opening, and glints more when the light comes
// toward the viewer. Motes drift together in slow eddies of the room's air (nearby motes share a phase),
// each with a little wander of its own; the wind through the open sash stirs them, hardest near the
// window and later and softer across the room. Close ones are bigger, softer, and sparkle more; a share
// are tiny fibres, straight or bent, that turn as they float
const DUST_VERT = /* glsl */`
  uniform float uLevel, uTime, uSize, uGust, uGustLate, uOpen;
  uniform vec3 uLight;
  attribute vec4 aSeed;
  varying float vA, vShape, vTurn, vSoft;
  void main() {
    vec3 home = position, s = aSeed.xyz;
    // The room's slow eddies, shared by neighbours, and each mote's own wander
    vec3 p = home + vec3(sin(uTime * 0.07 + home.z * 1.3 + home.y * 0.6), sin(uTime * 0.05 + home.x * 0.9) * 0.5, cos(uTime * 0.06 + home.x * 1.1 - home.y * 0.4)) * 0.16;
    p += vec3(sin(uTime * 0.31 + s.x * 40.0), sin(uTime * 0.23 + s.y * 40.0), sin(uTime * 0.27 + s.z * 40.0)) * 0.012;
    // The wind: in through the window (+x), gusty and erratic near it, arriving later and gentler farther in
    float near = smoothstep(2.4, 0.2, distance(home, vec3(-1.95, 1.4, 0.6)));
    float g = mix(uGustLate, uGust, near) * (0.25 + 0.75 * uOpen);
    p += vec3(0.35 * near + 0.12, sin(uTime * 2.7 + s.x * 30.0) * 0.08, sin(uTime * 3.3 + s.z * 30.0) * 0.14 * near) * g;
    vec4 w = modelMatrix * vec4(p, 1.0);
    // In a beam? Trace toward the sun to the window wall and check the opening
    float t = (-1.95 - w.x) / min(uLight.x, -1e-3);
    vec3 hit = w.xyz + uLight * max(t, 0.0);
    float lit = step(0.0, t) * smoothstep(0.62, 0.55, abs(hit.z - 0.6)) * smoothstep(0.68, 0.6, abs(hit.y - 1.45));
    vec3 view = normalize(w.xyz - cameraPosition);
    float toward = pow(max(dot(view, uLight), 0.0), 2.0);
    vec4 mv = viewMatrix * w;
    float depth = -mv.z;
    float glint = pow(0.5 + 0.5 * sin(uTime * (0.6 + s.z * 2.2) + s.x * 40.0), 8.0);
    float close = smoothstep(0.9, 0.25, depth);
    vA = uLevel * (0.04 + lit * (0.25 + 1.4 * toward)) * (0.35 + 0.65 * glint * (1.0 + 2.0 * close));
    vShape = floor(aSeed.w * 4.0); vTurn = s.y * 6.28 + uTime * (s.x - 0.5) * 0.6; vSoft = close;
    gl_PointSize = uSize * (0.5 + s.y) * (vShape > 1.5 ? 1.6 : 1.0) * (1.0 + close * 1.5) / depth;
    gl_Position = projectionMatrix * mv;
  }`;
const DUST_FRAG = /* glsl */`
  varying float vA, vShape, vTurn, vSoft;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    c = mat2(cos(vTurn), -sin(vTurn), sin(vTurn), cos(vTurn)) * c;
    float a;
    if (vShape < 0.5) a = exp(-dot(c, c) * 40.0);                                                   // a speck
    else if (vShape < 1.5) a = smoothstep(0.5, 0.1, length(c * vec2(1.0, 1.3))) * 0.8;              // a soft flake
    else if (vShape < 2.5) a = smoothstep(0.06, 0.0, abs(c.y)) * smoothstep(0.42, 0.3, abs(c.x));    // a straight fibre
    else { float bend = c.y - 0.6 * c.x * c.x; a = smoothstep(0.05, 0.0, abs(bend)) * smoothstep(0.4, 0.28, abs(c.x)); } // a bent one
    a = mix(a, smoothstep(0.5, 0.0, length(c)) * 0.5, vSoft * 0.6);                                 // close ones blur
    gl_FragColor = vec4(vec3(1.0, 0.93, 0.78) * a * vA * 2.0, 1.0);
  }`;

// Motes: half strung along the beams from the window toward the floor, half anywhere in the room
function dust(win, count) {
  const pos = [], seed = [];
  for (let i = 0; i < count; i++) {
    let a;
    if (i % 2) {
      a = onWindow(win, 0.05 + Math.random() * 0.9, 0.05 + Math.random() * 0.9);
      a.addScaledVector(LIGHT, -toFloor(a) * (0.05 + Math.random() * 0.85));
    } else a = new T.Vector3(-1.9 + Math.random() * 3.8, 0.15 + Math.random() * 2.3, -2.3 + Math.random() * 4.6);
    pos.push(a.x, a.y, a.z); seed.push(Math.random(), Math.random(), Math.random(), Math.random() < 0.7 ? Math.random() * 0.5 : 0.5 + Math.random() * 0.5);
  }
  const geo = new T.BufferGeometry();
  geo.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
  geo.setAttribute("aSeed", new T.Float32BufferAttribute(seed, 4));
  const mat = new T.ShaderMaterial({
    uniforms: { uLevel: { value: 0 }, uTime: { value: 0 }, uSize: { value: 4 }, uLight: { value: LIGHT }, uGust: { value: 0 }, uGustLate: { value: 0 }, uOpen: { value: 0 } },
    vertexShader: DUST_VERT, fragmentShader: DUST_FRAG, transparent: true, blending: T.AdditiveBlending, depthWrite: false,
  });
  const points = new T.Points(geo, mat);
  points.frustumCulled = false;
  return points;
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


/**
 * Puts the outside layers behind the window `win`; ready resolves once their images are in.
 * update(dt, level) drifts the clouds, blows the wind, and lights the floor; sun is 0 (hidden) to 1 (out), and wind is the gust level (0 to 1) the trees and the sound share
 */
export function createSky({ scene, win, touch }) {
  const loader = new T.TextureLoader(), textures = [], uniforms = {};
  let cover = null; // the cloud layer's alpha, small, for measuring the sun

  // One plane per layer, sized to its rect carried out to its depth; drawn back to front
  const loads = Object.entries(LAYERS).map(([name, [url, [z0, z1, y0, y1], x]], order) => {
    const [za, ya] = along(x, z0, y0), [zb, yb] = along(x, z1, y1);
    const u = { uMap: { value: null }, uSun: { value: new T.Vector3() }, uDrift: { value: 0 }, uTime: { value: 0 }, uGust: { value: 0 }, uPhase: { value: 0 } };
    uniforms[name] = u;
    if (name === "sky") { const [sz, sy] = along(x, SUN.z, SUN.y), [rz] = along(x, SUN.z + SUN.r, SUN.y); u.uSun.value.set(sz, sy, rz - sz); }
    const mesh = new T.Mesh(new T.PlaneGeometry(zb - za, yb - ya), new T.ShaderMaterial({
      uniforms: u, vertexShader: LAYER_VERT, fragmentShader: name === "sky" ? SKY_FRAG : CLOUD_FRAG,
      transparent: name === "clouds", depthWrite: name !== "clouds",
    }));
    mesh.rotation.y = Math.PI / 2;
    mesh.position.set(x, (ya + yb) / 2, (za + zb) / 2);
    mesh.renderOrder = order - 10;
    scene.add(mesh);
    return new Promise((done) => loader.load(url, (tex) => {
      tex.colorSpace = T.SRGBColorSpace;
      if (name === "clouds") {
        tex.wrapS = T.RepeatWrapping;
        const c = document.createElement("canvas"); c.width = 256; c.height = 128;
        const g = c.getContext("2d", { willReadFrequently: true });
        g.drawImage(tex.image, 0, 0, 256, 128);
        const d = g.getImageData(0, 0, 256, 128).data;
        cover = { d, rect: [za, zb, ya, yb] };
      }
      u.uMap.value = tex; textures.push(tex); done();
    }, undefined, () => done()));
  });
  const ready = Promise.all(loads);
  // Past the layers' edges, at the steepest views up through the glass, the sky stays blue
  scene.background = new T.Color(0.2, 0.36, 0.72);
  const beam = beams(win), motes = dust(win, touch ? 700 : 1600);
  scene.add(beam, motes);

  // How much cloud covers a point on the reference plane, from the cloud layer's alpha as it has drifted
  function cloudAt(z, y) {
    if (!cover) return 0;
    const [za, zb, ya, yb] = cover.rect, [cz, cy] = along(LAYERS.clouds[2], z, y);
    const u = (((zb - cz) / (zb - za)) * 3.25 + uniforms.clouds.uDrift.value) % 1, v = (cy - ya) / (yb - ya);
    if (v < 0 || v > 1) return 0;
    return cover.d[(Math.floor((1 - v) * 127) * 256 + Math.floor(((u + 1) % 1) * 255)) * 4 + 3] / 255;
  }

  // The wind: a gust every so often, rising, holding, and dying away; its level drives the trees and swings outside
  // and the rustle in the sound
  let gust = { start: 4 + Math.random() * 6, rise: 2, hold: 1, fall: 2.5 }, wind = 0, phase = 0;
  function blow(t) {
    const g = gust, x = t - g.start;
    if (x > g.rise + g.hold + g.fall) gust = { start: t + 6 + Math.random() * 14, rise: 1 + Math.random() * 2, hold: Math.random() * 1.5, fall: 1.5 + Math.random() * 2 };
    if (x < 0) return 0;
    if (x < g.rise) return Math.sin((x / g.rise) * Math.PI / 2) ** 2;
    if (x < g.rise + g.hold) return 1;
    return Math.max(0, 1 - (x - g.rise - g.hold) / g.fall) ** 2;
  }

  // Drifts the clouds and sways the leaves on their own clock, measures the sun through the clouds,
  // and lights the floor to match
  let time = 0, sun = 1;
  function update(dt, level = 0, ratio = 1) {
    const step = Math.min(dt, 0.1);
    time += step;
    wind = blow(time);
    phase += step * (1 + 1.3 * wind);
    uniforms.clouds.uDrift.value = (time * DRIFT) % 1;
    let seen = 0;
    for (const [oz, oy] of [[0, 0], [0.6, 0], [-0.6, 0], [0, 0.6], [0, -0.6]]) seen += 1 - 0.9 * cloudAt(SUN.z + oz * SUN.r, SUN.y + oy * SUN.r);
    sun = seen / 5;
    beam.material.uniforms.uLevel.value = level * sun * 0.09;
    beam.material.uniforms.uTime.value = time;
    const m = motes.material.uniforms;
    m.uLevel.value = level * sun; m.uTime.value = time; m.uSize.value = 7 * ratio;
    // The gust as it reaches the far side of the room, about a second and a half late
    late.push([time, wind]); while (late.length > 2 && late[1][0] < time - 1.5) late.shift();
    m.uGust.value = wind; m.uGustLate.value = late[0][1] * 0.7; m.uOpen.value = open;
  }
  const late = [];
  let open = 0;
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

  // Frees the layers' images; the meshes go with the scene
  function dispose() { textures.forEach((t) => t.dispose()); }

  return { update, aim, block, dispose, ready, get sun() { return sun; }, get wind() { return wind; }, get phase() { return phase; }, set open(v) { open = v; } };
}
