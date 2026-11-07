// src/app/public/js/white-rabbit-car.js - A pearl black model muscle coupe on the white rabbit's window sill.
// Usage: const car = createCar({ scene, env, at, onSound }); car.pick(raycaster); car.update(time, light)
//
// Imported by white-rabbit-scene.js. A generic long-hood, short-deck coupe at about
// 1:13, lofted from cross-sections: wide haunches, a low roof, slim headlights, and
// no badges or names. Clicking it flashes the headlights twice, pauses, cranks the
// starter, and the engine catches: the lights stay on and the body rumbles at idle.
// Clicking again shuts it off. onSound(kind) hears "crank", "fire", and "stop".

import * as T from "/js/vendor/three-0.187.0.rabbit.min.js";


// Size in meters: length, wheel radius, wheel centers along the car, and the track
const L = 0.265, WHEEL = 0.02, AXLES = [0.083, -0.079], TRACK = 0.046;

// The timeline after a click, in seconds: two flashes, a pause, the starter, then the engine catches
const FLASHES = [[0, 0.14], [0.3, 0.44]], CRANK = 0.95, FIRE = 1.75;

// Smooth step between edges a and b
const step = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// Linear interpolation through [z, value] pairs sorted by z
function through(pts, z) {
  if (z <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    if (z <= pts[i][0]) { const [z0, a] = pts[i - 1], [z1, b] = pts[i], t = (z - z0) / (z1 - z0); return a + (b - a) * t * t * (3 - 2 * t); }
  }
  return pts[pts.length - 1][1];
}

// The body's side and plan: rocker and arch line underneath, hood and deck line on top, half width
const BOTTOM_BASE = [[-0.1325, 0.021], [-0.118, 0.017], [0.11, 0.016], [0.1325, 0.021]];
const TOP = [[-0.1325, 0.047], [-0.118, 0.055], [-0.078, 0.058], [0.02, 0.057], [0.09, 0.0525], [0.118, 0.049], [0.1325, 0.038]];
const HALF = [[-0.1325, 0.044], [-0.112, 0.05], [-0.078, 0.0535], [-0.035, 0.0505], [0.035, 0.0505], [0.083, 0.0515], [0.118, 0.048], [0.1325, 0.041]];
// The greenhouse: from the rear window's base to the windshield's, roof height and half width
const ROOF = [[-0.082, 0.057], [-0.035, 0.0735], [-0.006, 0.0745], [0.034, 0.056]];
const ROOF_HALF = [[-0.082, 0.042], [-0.035, 0.036], [-0.006, 0.036], [0.034, 0.043]];

// The underside rises into a round arch over each wheel
function bottom(z) {
  let y = through(BOTTOM_BASE, z);
  for (const a of AXLES) { const d = z - a, r = WHEEL + 0.0045; if (Math.abs(d) < r) y = Math.max(y, WHEEL + Math.sqrt(r * r - d * d)); }
  return y;
}

// A lofted shell through cross-sections along z: section(z, a) gives [x, y] for the angle a around it
function loft(z0, z1, rows, cols, section) {
  const pos = [], uvs = [], idx = [];
  for (let i = 0; i <= rows; i++) {
    const z = z0 + ((z1 - z0) * i) / rows;
    for (let j = 0; j <= cols; j++) {
      const [x, y] = section(z, (j / cols) * Math.PI * 2);
      pos.push(x, y, z); uvs.push(z * 30, j / cols * 6);
    }
  }
  for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
    const a = i * (cols + 1) + j, b = a + cols + 1;
    idx.push(a, b, a + 1, a + 1, b, b + 1);
  }
  // Caps close each end with a fan from its middle
  for (const [i, flip] of [[0, true], [rows, false]]) {
    const c = pos.length / 3, base = i * (cols + 1);
    let mx = 0, my = 0;
    for (let j = 0; j < cols; j++) { mx += pos[(base + j) * 3]; my += pos[(base + j) * 3 + 1]; }
    pos.push(mx / cols, my / cols, pos[base * 3 + 2]); uvs.push(0, 0);
    for (let j = 0; j < cols; j++) idx.push(...(flip ? [c, base + j + 1, base + j] : [c, base + j, base + j + 1]));
  }
  const geo = new T.BufferGeometry();
  geo.setIndex(idx);
  geo.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
  geo.setAttribute("uv", new T.Float32BufferAttribute(uvs, 2));
  geo.computeVertexNormals();
  return geo;
}

// The body's section: a boxy superellipse that tucks in above the shoulder, with a power bulge on the hood
function body(z, a) {
  const yb = bottom(z), yt = through(TOP, z), w = through(HALF, z), mid = (yb + yt) / 2, h = (yt - yb) / 2;
  const c = Math.cos(a), s = Math.sin(a), n = 0.38;
  let x = w * Math.sign(c) * Math.abs(c) ** n, y = mid + h * Math.sign(s) * Math.abs(s) ** n;
  x *= 1 - 0.14 * Math.max(0, (y - mid) / h) ** 2;
  if (z > 0.03 && z < 0.12) y += 0.0028 * Math.exp(-((x / 0.016) ** 2)) * Math.max(0, s) * step(0.03, 0.05, z) * (1 - step(0.1, 0.12, z));
  return [x, y];
}

// The greenhouse's section: a narrow trapezoid with a rounded roof, from the beltline up
function cabin(z, a) {
  const base = through(TOP, z) - 0.004, top = through(ROOF, z), w = through(ROOF_HALF, z);
  const c = Math.cos(a), s = Math.sin(a), y = base + (top - base) * (0.5 + 0.5 * Math.sign(s) * Math.abs(s) ** 0.4);
  const t = (y - base) / Math.max(0.001, top - base);
  return [Math.sign(c) * Math.abs(c) ** 0.45 * (w + 0.008 * (1 - t)) * (1 - 0.28 * t * t), y];
}

// Metallic flakes under the clear coat: a normal map of tiny tilted facets, so the paint sparkles as the view moves
function flakes() {
  const c = document.createElement("canvas"), n = 128;
  c.width = c.height = n;
  const g = c.getContext("2d"), img = g.createImageData(n, n);
  let seed = 29;
  const r = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  for (let i = 0; i < n * n; i++) {
    const tilt = r() < 0.25 ? 0.5 : 0.08, x = (r() - 0.5) * tilt, y = (r() - 0.5) * tilt;
    img.data.set([(x + 0.5) * 255, (y + 0.5) * 255, 255, 255], i * 4);
  }
  g.putImageData(img, 0, 0);
  const tex = new T.CanvasTexture(c);
  tex.wrapS = tex.wrapT = T.RepeatWrapping;
  return tex;
}

// A soft round glow that always faces the camera, for the headlights
const GLOW_VERT = /* glsl */`
  uniform float uSize;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec4 c = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    c.xy += position.xy * uSize;
    gl_Position = projectionMatrix * c;
  }`;
const GLOW_FRAG = /* glsl */`
  uniform float uOn;
  varying vec2 vUv;
  void main() {
    float d = length(vUv - 0.5) * 2.0;
    gl_FragColor = vec4(vec3(1.0, 0.95, 0.85) * uOn * pow(max(0.0, 1.0 - d), 2.2), 1.0);
  }`;


/** Builds the car at `at` ({ p, turn, scale }) on the sill; env gives the paint its reflections */
export function createCar({ scene, env, at, onSound = () => {} }) {
  const car = new T.Group(), shell = new T.Group();
  car.position.set(...at.p); car.rotation.y = at.turn; car.scale.setScalar(at.scale || 1);
  car.add(shell); scene.add(car);
  const lit = (m) => { m.castShadow = m.receiveShadow = true; return m; };

  // Pearl black: dark base with metal flakes, a smooth clear coat, and a faint pearl shift at an angle
  const paint = new T.MeshPhysicalMaterial({
    color: "#040507", metalness: 0.15, roughness: 0.5, normalMap: flakes(), normalScale: new T.Vector2(0.7, 0.7),
    clearcoat: 1, clearcoatRoughness: 0.04, iridescence: 0.18, iridescenceIOR: 1.5, envMap: env, envMapIntensity: 0,
  });
  const glass = new T.MeshStandardMaterial({ color: "#07080A", metalness: 0.2, roughness: 0.06, envMap: env, envMapIntensity: 0 });
  const trim = new T.MeshStandardMaterial({ color: "#111214", roughness: 0.5 });
  const rubber = new T.MeshStandardMaterial({ color: "#151515", roughness: 0.85 });
  const rims = new T.MeshStandardMaterial({ color: "#2A2C30", metalness: 0.8, roughness: 0.3, envMap: env, envMapIntensity: 0 });
  const lamps = new T.MeshStandardMaterial({ color: "#20242A", emissive: "#FFF4E2", emissiveIntensity: 0, roughness: 0.2 });
  const tails = new T.MeshStandardMaterial({ color: "#3A0806", emissive: "#FF2010", emissiveIntensity: 0, roughness: 0.3 });
  const glossy = [[paint, 0.55], [glass, 0.7], [rims, 0.8]];

  // Body and greenhouse
  shell.add(lit(new T.Mesh(loft(-L / 2, L / 2, 44, 28, body), paint)));
  shell.add(lit(new T.Mesh(loft(-0.082, 0.034, 14, 20, cabin), glass)));

  // Small parts, merged by material: grille and intake, mirrors, slim headlights, and taillights
  const parts = (list, material) => {
    const geos = list.map(([w, h, d, p, r = [0, 0, 0]]) => {
      const g = new T.BoxGeometry(w, h, d).toNonIndexed();
      g.rotateX(r[0]); g.rotateY(r[1]); g.rotateZ(r[2]); g.translate(...p);
      return g;
    });
    const m = new T.Mesh(T.mergeGeometries(geos), material);
    geos.forEach((g) => g.dispose());
    shell.add(lit(m));
    return m;
  };
  parts([[0.052, 0.011, 0.004, [0, 0.033, 0.1328]], [0.07, 0.008, 0.004, [0, 0.021, 0.1312]],
    [0.008, 0.006, 0.012, [-0.047, 0.061, 0.03]], [0.008, 0.006, 0.012, [0.047, 0.061, 0.03]]], trim);
  parts([[0.021, 0.0045, 0.004, [-0.03, 0.0425, 0.1305], [0, -0.35, -0.06]], [0.021, 0.0045, 0.004, [0.03, 0.0425, 0.1305], [0, 0.35, 0.06]]], lamps);
  parts([[0.026, 0.006, 0.003, [-0.027, 0.0455, -0.1325]], [0.026, 0.006, 0.003, [0.027, 0.0455, -0.1325]]], tails);

  // Wheels stay put while the body rumbles above them
  const tire = [], rim = [];
  for (const z of AXLES) for (const k of [-1, 1]) {
    const t = new T.CylinderGeometry(WHEEL, WHEEL, 0.015, 20).toNonIndexed(); t.rotateZ(Math.PI / 2); t.translate(k * TRACK, WHEEL, z); tire.push(t);
    const d = new T.CylinderGeometry(0.0135, 0.0135, 0.016, 10).toNonIndexed(); d.rotateZ(Math.PI / 2); d.translate(k * (TRACK + 0.0006), WHEEL, z); rim.push(d);
  }
  car.add(lit(new T.Mesh(T.mergeGeometries(tire), rubber)), lit(new T.Mesh(T.mergeGeometries(rim), rims)));
  [...tire, ...rim].forEach((g) => g.dispose());

  // Headlight glows and the light they throw on the sill and the window trim
  const glowU = { uSize: { value: 0.024 }, uOn: { value: 0 } };
  const glowMat = new T.ShaderMaterial({ uniforms: glowU, vertexShader: GLOW_VERT, fragmentShader: GLOW_FRAG, transparent: true, blending: T.AdditiveBlending, depthWrite: false });
  for (const k of [-1, 1]) {
    const g = new T.Mesh(new T.PlaneGeometry(1, 1), glowMat);
    g.position.set(k * 0.03, 0.0425, 0.136); g.frustumCulled = false; shell.add(g);
  }
  const beam = new T.PointLight("#FFF1DC", 0, 0.9, 2);
  beam.position.set(0, 0.05, 0.19); shell.add(beam);

  // A generous invisible box to click, so a fingertip finds it
  const hit = new T.Mesh(new T.BoxGeometry(0.16, 0.12, 0.36), new T.MeshBasicMaterial({ visible: false }));
  hit.position.y = 0.04; car.add(hit);

  let started = -1, running = false;

  // True when the ray hits the car; unless only looking, a hit starts the sequence or shuts the engine off
  function pick(ray, look = false) {
    car.updateMatrixWorld();
    if (!ray.intersectObject(hit, false).length) return false;
    if (look) return true;
    if (started < 0) started = performance.now() / 1000;
    else { started = -1; running = false; onSound("stop"); }
    return true;
  }

  // One frame: lights by the timeline, and the body shakes while cranking and rumbles at idle
  let cranked = false, fired = false;
  function update(time, light) {
    for (const [m, k] of glossy) m.envMapIntensity = k * Math.max(0.15, light);
    let on = 0, shake = 0;
    if (started >= 0) {
      const t = time - started;
      if (t < CRANK) on = FLASHES.some(([a, b]) => t >= a && t < b) ? 1 : 0;
      else if (t < FIRE) {
        if (!cranked) { cranked = true; onSound("crank"); }
        on = 0.35 + 0.1 * Math.sin(t * 60); shake = 0.25 * (0.5 + 0.5 * Math.sin(t * 2 * Math.PI * 11));
      } else {
        if (!fired) { fired = true; running = true; onSound("fire"); }
        on = 1; shake = 0.35 + 1.4 * Math.exp(-(t - FIRE) * 3.5);
      }
    } else cranked = fired = false;
    lamps.emissiveIntensity = on * 3.2; tails.emissiveIntensity = running ? 1.4 : 0;
    glowU.uOn.value = on * 0.9; beam.intensity = on * 0.05;
    // Idle: uneven firing pulses rock the body a fraction of a millimeter
    const pulse = Math.sin(time * 2 * Math.PI * 9.5) * 0.6 + Math.sin(time * 2 * Math.PI * 4.75 + 1.3) * 0.4;
    shell.position.set(Math.sin(time * 83) * 0.00012 * shake, 0.00035 * shake * (0.5 + 0.5 * pulse), 0);
    shell.rotation.z = 0.004 * shake * pulse;
  }

  return { pick, update, get running() { return running; } };
}
