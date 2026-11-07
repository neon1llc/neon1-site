// src/app/public/js/white-rabbit-sky.js - The sky behind the white rabbit's window: clouds, the sun, and its light.
// Usage: const sky = createSky({ scene, win, touch }); await sky.ready; sky.update(dt, level, ratio); sky.aim(camera, shafts, amount)
//
// Imported by white-rabbit-scene.js. Outside is four images rendered in Blender (see the
// planning folder's blender/outside.py) from one viewpoint in the room: a sky, a layer of
// volumetric cumulus, and two rows of real autumn trees (Poly Haven models, recolored) seen
// from a second story. Each sits on a plane at its own depth, so the view shifts a little as
// the camera moves; the clouds drift and wrap, and the trees sway in slow gusts. The sun disc
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

// Each layer: its image, rect on the reference plane (z0, z1, y0, y1), and the depth of its plane
const LAYERS = {
  sky: ["/media/white-rabbit/sky.webp", [-25, 15, -3, 37], -60],
  clouds: ["/media/white-rabbit/clouds.webp", [-25, 15, 4, 24], -45],
  treesFar: ["/media/white-rabbit/trees-far.webp", [-25, 15, -3, 7], -30],
  treesNear: ["/media/white-rabbit/trees-near.webp", [-25, 15, -3, 7], -16],
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
    vec4 c = texture2D(uMap, vec2(vUv.x + uDrift, vUv.y));
    gl_FragColor = vec4(mix(c.rgb, vec3(1.0, 0.99, 0.97), 0.25) * 1.18, c.a);  // fair-weather white, not storm grey
  }`;
// The treetops in the wind: slow gusts roll across the row, crowns lean and breathe more toward their
// tops, and leaves flutter faster in small patches; uDrift sets each row's phase and strength
const TREE_FRAG = /* glsl */`
  uniform sampler2D uMap;
  uniform float uTime, uDrift;
  varying vec2 vUv, vQ;
  void main() {
    vec2 uv = vUv;
    float gust = 0.55 + 0.45 * sin(uTime * 0.21 - uv.x * 3.0 + uDrift * 7.0) * sin(uTime * 0.13 + uv.x * 1.7);
    float top = smoothstep(0.1, 0.95, uv.y);
    uv.x += (sin(uTime * 0.7 + uv.x * 9.0 + uDrift * 3.0) * 0.0022 + sin(uTime * 1.6 + uv.x * 31.0 + uv.y * 7.0) * 0.0007) * gust * top * uDrift;
    uv.y += sin(uTime * 0.9 + uv.x * 13.0 + uDrift) * 0.0012 * gust * top * uDrift;
    uv += vec2(sin(uTime * 4.1 + uv.y * 220.0), cos(uTime * 3.7 + uv.x * 260.0)) * 0.00018 * gust * top;
    // Below the picture (only the near row reaches there), the lower foliage again, mirrored and in deeper shade
    if (uv.y < 0.03) {
      vec4 m = texture2D(uMap, vec2(uv.x, 0.06 + mod(0.03 - uv.y, 0.4)));
      gl_FragColor = vec4(mix(vec3(0.16, 0.1, 0.05), m.rgb, m.a) * 0.7, 1.0);
      return;
    }
    vec4 c = texture2D(uMap, uv);
    if (c.a < 0.35) discard;
    gl_FragColor = vec4(c.rgb, 1.0);
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


/**
 * Puts the outside layers behind the window `win`; ready resolves once their images are in.
 * update(dt, level) drifts the clouds, sways the trees, and lights the floor; sun is 0 (hidden) to 1 (out)
 */
export function createSky({ scene, win, touch }) {
  const loader = new T.TextureLoader(), textures = [], uniforms = {};
  let cover = null; // the cloud layer's alpha, small, for measuring the sun

  // One plane per layer, sized to its rect carried out to its depth; drawn back to front
  const loads = Object.entries(LAYERS).map(([name, [url, [z0, z1, y0, y1], x]], order) => {
    const [za, ya] = along(x, z0, y0), [zb, yb] = along(x, z1, y1);
    const u = { uMap: { value: null }, uSun: { value: new T.Vector3() }, uDrift: { value: 0 }, uTime: { value: 0 } };
    uniforms[name] = u;
    if (name === "treesFar") u.uDrift.value = 0.6;
    if (name === "treesNear") u.uDrift.value = 1;
    if (name === "sky") { const [sz, sy] = along(x, SUN.z, SUN.y), [rz] = along(x, SUN.z + SUN.r, SUN.y); u.uSun.value.set(sz, sy, rz - sz); }
    const mesh = new T.Mesh(new T.PlaneGeometry(zb - za, yb - ya), new T.ShaderMaterial({
      uniforms: u, vertexShader: LAYER_VERT, fragmentShader: name === "sky" ? SKY_FRAG : name === "clouds" ? CLOUD_FRAG : TREE_FRAG,
      transparent: name === "clouds", depthWrite: name !== "clouds",
    }));
    mesh.rotation.y = Math.PI / 2;
    mesh.position.set(x, (ya + yb) / 2, (za + zb) / 2);
    // The near row reaches further down, its bottom edge of foliage stretched, so no steep look down
    // through the lower sash finds the edge of the picture
    if (name === "treesNear") {
      const pos = mesh.geometry.attributes.position, uv = mesh.geometry.attributes.uv, k = 2.2, h = yb - ya;
      for (let i = 0; i < pos.count; i++) if (pos.getY(i) < 0) { pos.setY(i, h / 2 - h * k); uv.setY(i, 1 - k); }
      mesh.geometry.computeBoundingSphere();
    }
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
  const beam = beams(win), motes = dust(win, touch ? 140 : 280);
  scene.add(beam, motes);

  // How much cloud covers a point on the reference plane, from the cloud layer's alpha as it has drifted
  function cloudAt(z, y) {
    if (!cover) return 0;
    const [za, zb, ya, yb] = cover.rect, [cz, cy] = along(LAYERS.clouds[2], z, y);
    const u = ((zb - cz) / (zb - za) + uniforms.clouds.uDrift.value) % 1, v = (cy - ya) / (yb - ya);
    if (v < 0 || v > 1) return 0;
    return cover.d[(Math.floor((1 - v) * 127) * 256 + Math.floor(((u + 1) % 1) * 255)) * 4 + 3] / 255;
  }

  // Drifts the clouds and sways the leaves on their own clock, measures the sun through the clouds,
  // and lights the floor to match
  let time = 0, sun = 1;
  function update(dt, level = 0, ratio = 1) {
    time += Math.min(dt, 0.1);
    uniforms.clouds.uDrift.value = (time * DRIFT) % 1;
    uniforms.treesFar.uTime.value = uniforms.treesNear.uTime.value = time;
    let seen = 0;
    for (const [oz, oy] of [[0, 0], [0.6, 0], [-0.6, 0], [0, 0.6], [0, -0.6]]) seen += 1 - 0.9 * cloudAt(SUN.z + oz * SUN.r, SUN.y + oy * SUN.r);
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

  // Frees the layers' images; the meshes go with the scene
  function dispose() { textures.forEach((t) => t.dispose()); }

  return { update, aim, block, dispose, ready, get sun() { return sun; } };
}
