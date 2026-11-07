// src/app/public/js/white-rabbit-car.js - A pearl black model muscle coupe on the white rabbit's window sill.
// Usage: const car = createCar({ scene, env, at, onSound }); car.pick(raycaster); car.update(time, light)
//
// Imported by white-rabbit-scene.js. A generic sixth-generation-style muscle coupe at
// about 1:15, with no badges or names. The body is one watertight surface lofted from
// spline sections nose to tail: a long hood with a raised center, a sharp shoulder crease
// from fender to tail, a body-colored skirt, flared haunches, arches snug over the wheels,
// and a small greenhouse with a thick C-pillar. Glass, lamps, mirrors, the splitter, the
// wing, and the wheels (black split spokes over red calipers) are seated onto it. Clicking
// it flashes the headlights twice, pauses, cranks the starter, and the engine catches: the
// headlights and the white corner markers stay on and the body rumbles at idle.
// Clicking again shuts it off. onSound(kind) hears "click", "crank", "fire", and "stop".

import * as T from "/js/vendor/three-0.187.0.rabbit.min.js";


// Size in meters at model scale: length, wheel radius, wheel centers along the car, and the track
const L = 0.265, WHEEL = 0.0195, AXLES = [0.0795, -0.0765], TRACK = 0.0455;

// The timeline after a click, in seconds: two flashes, a pause, the starter, then the engine catches
// when the slowed recording does (2.25 s into it, played at 0.85)
const FLASHES = [[0, 0.14], [0.3, 0.44]], CRANK = 0.95, FIRE = CRANK + 2.25 / 0.85;

// Smooth step between edges a and b
const step = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// Smooth interpolation through [z, value] pairs sorted by z
function through(pts, z) {
  if (z <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    if (z <= pts[i][0]) { const [z0, a] = pts[i - 1], [z1, b] = pts[i], t = (z - z0) / (z1 - z0); return a + (b - a) * t * t * (3 - 2 * t); }
  }
  return pts[pts.length - 1][1];
}

// The shell's lines along its length: rocker, shoulder crease, hood and deck, half width, and the
// greenhouse's height above the deck line with its half widths at the beltline and the roof
const ROCKER = [[-0.1325, 0.021], [-0.118, 0.012], [0.11, 0.012], [0.1325, 0.019]];
const CREASE = [[-0.1325, 0.044], [-0.105, 0.05], [-0.06, 0.0495], [0.04, 0.0455], [0.105, 0.042], [0.1325, 0.034]];
const DECK = [[-0.1325, 0.049], [-0.12, 0.0565], [-0.085, 0.0585], [0.03, 0.056], [0.09, 0.051], [0.118, 0.0465], [0.1325, 0.039]];
const HALF = [[-0.1325, 0.045], [-0.112, 0.0515], [-0.0765, 0.0555], [-0.045, 0.051], [0.035, 0.0505], [0.0795, 0.053], [0.112, 0.0495], [0.1325, 0.043]];
const CABIN = [[-0.1325, 0], [-0.092, 0], [-0.052, 0.0135], [-0.022, 0.0175], [0.002, 0.017], [0.046, 0]];
const BELT = [[-0.09, 0.046], [-0.05, 0.0445], [0.04, 0.046]], ROOF = [[-0.07, 0.03], [-0.03, 0.034], [0.01, 0.034], [0.04, 0.04]];

// The underside rises into a snug round arch over each wheel, so the shell itself has the openings
function rocker(z) {
  let y = through(ROCKER, z);
  for (const a of AXLES) { const d = z - a, r = WHEEL + 0.0028; if (Math.abs(d) < r) y = Math.max(y, WHEEL + Math.sqrt(r * r - d * d)); }
  return y;
}

// The hood's raised center, from behind the headlights to the cowl
const bulge = (z) => 0.0032 * step(0.035, 0.055, z) * (1 - step(0.105, 0.122, z));

// Catmull-Rom through 2D points, n samples per span; a point given twice makes a crisp crease
function spline(pts, n) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map((c) => 0.5 * (2 * p1[c] + (p2[c] - p0[c]) * t + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t2 + (3 * p1[c] - p0[c] - 3 * p2[c] + p3[c]) * t3)));
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

// One half of the shell's section at z, from the bottom center up and over to the roof's center:
// flat floor, a body-colored skirt with a crisp lower edge, the door, a sharp shoulder crease, the
// tucked upper side, then the deck or hood, or where the cabin stands, the glass and the roof
function section(z, n) {
  const yb = rocker(z), ys = Math.min(through(CREASE, z), through(DECK, z) - 0.004), yt = through(DECK, z), w = through(HALF, z);
  const h = through(CABIN, z), k = Math.min(1, h / 0.004), hb = bulge(z);
  const belt = w * 0.84 + (through(BELT, z) - w * 0.84) * k, roof = w * 0.35 + (through(ROOF, z) - w * 0.35) * k;
  const pts = [[0, yb], [w * 0.6, yb], [w * 0.92, yb + 0.0008], [w * 0.97, yb + 0.004], [w * 0.97, yb + 0.004], [w * 0.955, yb + 0.0075],
    [w * 0.99, (yb + ys) / 2 + 0.002], [w, ys], [w, ys], [w * 0.955, ys + 0.0032], [belt, yt + 0.0004],
    [(belt + roof) / 2, yt + h * 0.62 + hb * 0.4], [roof, yt + h * 0.97 + hb * 0.8], [0, yt + h + hb]];
  return spline(pts, n);
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


/** Builds the car at `at` ({ p, turn, scale, detail }) on the sill; env gives the paint its reflections */
export function createCar({ scene, env, at, onSound = () => {} }) {
  const car = new T.Group(), shell = new T.Group();
  car.position.set(...at.p); car.rotation.y = at.turn; car.scale.setScalar(at.scale || 1);
  car.add(shell); scene.add(car);
  const lit = (m) => { m.castShadow = m.receiveShadow = true; return m; };
  const fine = at.detail !== false; // phones get a lighter shell and wheels

  // Pearl black: a near-black base with fine flakes under a hard, glassy clear coat. The base is
  // rough and barely metallic, so grazing light doesn't haze it grey; the coat gives the reflections
  const paint = new T.MeshPhysicalMaterial({
    color: "#030304", metalness: 0.25, roughness: 0.55, normalMap: flakes(), normalScale: new T.Vector2(0.4, 0.4),
    clearcoat: 1, clearcoatRoughness: 0.025, envMap: env, envMapIntensity: 0,
  });
  // Tinted glass, black trim and wheels, clear lamps that light up, red taillights and calipers
  const glass = new T.MeshPhysicalMaterial({ color: "#020304", metalness: 0, roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.02, envMap: env, envMapIntensity: 0 });
  const trim = new T.MeshStandardMaterial({ color: "#050506", roughness: 0.6 });
  const rubber = new T.MeshStandardMaterial({ color: "#080808", roughness: 0.9, side: T.DoubleSide });
  const rims = new T.MeshStandardMaterial({ color: "#0C0D0F", metalness: 0.5, roughness: 0.32, envMap: env, envMapIntensity: 0, side: T.DoubleSide });
  const rotor = new T.MeshStandardMaterial({ color: "#4A4A4C", metalness: 0.8, roughness: 0.45, side: T.DoubleSide });
  const caliper = new T.MeshStandardMaterial({ color: "#D0170D", roughness: 0.38, emissive: "#3A0300" });
  const lamps = new T.MeshStandardMaterial({ color: "#3C424A", metalness: 0.6, roughness: 0.08, emissive: "#FFF4E2", emissiveIntensity: 0, envMap: env, envMapIntensity: 0 });
  const tails = new T.MeshStandardMaterial({ color: "#7A0A06", emissive: "#FF1A0A", emissiveIntensity: 0.25, roughness: 0.25 });
  const glossy = [[paint, 0.22], [glass, 0.5], [rims, 0.22], [lamps, 0.8]];

  // ---- The shell: one watertight lofted surface from nose to tail ----
  // Rows of sections along z share their vertices; each end is closed by a cap on its own ring,
  // so the edge stays crisp while the surface has no gaps
  const rows = fine ? 72 : 40, per = fine ? 3 : 2, ring = [];
  for (let i = 0; i <= rows; i++) {
    const z = -L / 2 + (L * i) / rows, half = section(z, per);
    ring.push([...half.map(([x, y]) => [x, y, z]), ...half.slice(1, -1).reverse().map(([x, y]) => [-x, y, z])]);
  }
  const cols = ring[0].length, pos = [], idx = [];
  ring.forEach((r) => r.forEach((p) => pos.push(...p)));
  for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
    const a = i * cols + j, b = a + cols, a2 = i * cols + ((j + 1) % cols), b2 = a2 + cols;
    idx.push(a, a2, b, a2, b2, b);
  }
  for (const [i, back] of [[0, true], [rows, false]]) {
    const base = pos.length / 3, r = ring[i];
    let cx = 0, cy = 0;
    r.forEach(([x, y]) => { cx += x; cy += y; });
    r.forEach((p) => pos.push(...p));
    pos.push(0, cy / cols, r[0][2]);
    for (let j = 0; j < cols; j++) idx.push(...(back ? [base + cols, base + (j + 1) % cols, base + j] : [base + cols, base + j, base + (j + 1) % cols]));
  }
  const body = new T.BufferGeometry();
  body.setIndex(idx);
  body.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
  // Flake coordinates run along the car and around the section, so the sparkle doesn't streak
  const uv = [];
  for (let q = 0; q < pos.length; q += 3) uv.push(pos[q + 2] * 140, (pos[q + 1] + Math.abs(pos[q])) * 140);
  body.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
  body.computeVertexNormals();
  shell.add(lit(new T.Mesh(body, paint)));

  // ---- Glass: the window areas of the same surface, lifted a hair along its normals ----
  // Side windows stop short of a thick C-pillar; the windshield and rear window wrap the cabin
  const nrm = body.attributes.normal, isGlass = [];
  for (let i = 0; i <= rows; i++) for (let j = 0; j < cols; j++) {
    const q = i * cols + j, x = pos[q * 3], y = pos[q * 3 + 1], z = pos[q * 3 + 2], yt = through(DECK, z), h = through(CABIN, z);
    const up = y > yt + 0.0026 && y < yt + h - 0.0022 && h > 0.006, nx = Math.abs(nrm.getX(q)), nz = nrm.getZ(q);
    isGlass[q] = up && ((z > -0.046 && z < 0.036 && nx > 0.45) || (z > 0.004 && nz > 0.25) || (z < -0.054 && nz < -0.25));
  }
  const gpos = [], gidx = [], remap = new Map();
  const gv = (q) => {
    if (!remap.has(q)) { remap.set(q, gpos.length / 3); gpos.push(pos[q * 3] + nrm.getX(q) * 0.0004, pos[q * 3 + 1] + nrm.getY(q) * 0.0004, pos[q * 3 + 2] + nrm.getZ(q) * 0.0004); }
    return remap.get(q);
  };
  for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
    const a = i * cols + j, b = a + cols, a2 = i * cols + ((j + 1) % cols), b2 = a2 + cols;
    if (isGlass[a] && isGlass[b] && isGlass[a2] && isGlass[b2]) gidx.push(gv(a), gv(a2), gv(b), gv(a2), gv(b2), gv(b));
  }
  const panes = new T.BufferGeometry();
  panes.setIndex(gidx);
  panes.setAttribute("position", new T.Float32BufferAttribute(gpos, 3));
  panes.computeVertexNormals();
  shell.add(new T.Mesh(panes, glass));

  // ---- Seated parts, merged by material ----
  // Boxes given as [w, h, d, position, rotation]
  const boxes = (list) => list.map(([w, h, d, p, r = [0, 0, 0]]) => {
    const g = new T.BoxGeometry(w, h, d).toNonIndexed();
    g.rotateX(r[0]); g.rotateY(r[1]); g.rotateZ(r[2]); g.translate(...p);
    return g;
  });
  const mesh = (geos, material, into = shell) => { const m = new T.Mesh(T.mergeGeometries(geos), material); geos.forEach((g) => g.dispose()); into.add(lit(m)); return m; };
  const nose = L / 2, tail = -L / 2, sideAt = (z) => through(HALF, z) * 0.99;

  // Black: the grille band and lower intake on the fascia, the splitter tucked under the bumper with
  // its canards, the hood extractor, door handles, and the low decklid wing
  mesh(boxes([
    [0.066, 0.005, 0.0005, [0, 0.0352, nose + 0.0002]], [0.064, 0.0105, 0.0005, [0, 0.0248, nose + 0.0002]],
    [0.088, 0.0016, 0.012, [0, 0.0183, nose - 0.0045]], [0.084, 0.0012, 0.003, [0, 0.0179, nose + 0.0028], [0.15, 0, 0]],
    [0.005, 0.001, 0.005, [-0.04, 0.0215, nose - 0.0015], [0, 0, 0.3]], [0.005, 0.001, 0.005, [0.04, 0.0215, nose - 0.0015], [0, 0, -0.3]],
    [0.028, 0.0018, 0.013, [0, through(DECK, 0.072) + bulge(0.072) - 0.0004, 0.072], [-0.07, 0, 0]],
    [0.0007, 0.0013, 0.0075, [-sideAt(-0.012) - 0.0002, 0.0452, -0.012]], [0.0007, 0.0013, 0.0075, [sideAt(-0.012) + 0.0002, 0.0452, -0.012]],
    [0.086, 0.0016, 0.01, [0, through(DECK, -0.1245) + 0.0034, -0.1245], [0.12, 0, 0]],
    [0.0016, 0.0034, 0.007, [-0.04, through(DECK, -0.1245) + 0.0016, -0.1245]], [0.0016, 0.0034, 0.007, [0.04, through(DECK, -0.1245) + 0.0016, -0.1245]],
  ]), trim);
  // Mirrors in body color, seated at the base of the windshield
  mesh(boxes([[0.0066, 0.0044, 0.0055, [-0.0515, 0.0592, 0.029], [0, 0.15, 0]], [0.0066, 0.0044, 0.0055, [0.0515, 0.0592, 0.029], [0, -0.15, 0]]]), paint);
  // Clear lamps: slit headlights swept back along the fender corners, each with a light bar, and a
  // marker on every corner, front and rear, that lights with them
  const markers = [];
  for (const k of [-1, 1]) {
    markers.push([0.02, 0.0026, 0.0006, [k * 0.03, 0.0383, nose - 0.0004], [0, k * 0.5, k * 0.05]], [0.014, 0.0006, 0.0006, [k * 0.029, 0.0371, nose - 0.0002], [0, k * 0.5, 0]],
      [0.0005, 0.0016, 0.0045, [k * (sideAt(nose - 0.01) + 0.0002), 0.029, nose - 0.01]], [0.0005, 0.0016, 0.0045, [k * (sideAt(tail + 0.012) + 0.0002), 0.043, tail + 0.012]]);
  }
  mesh(boxes(markers), lamps);
  mesh(boxes([[0.026, 0.0048, 0.0006, [-0.025, 0.0455, tail - 0.0002]], [0.026, 0.0048, 0.0006, [0.025, 0.0455, tail - 0.0002]]]), tails);

  // ---- Wheels: thin tires, black five split-spoke rims, rotors, and red calipers behind the spokes ----
  // They stay put while the body rumbles above them
  const seg = fine ? 28 : 16, parts = { rubber: [], rims: [], rotor: [], caliper: [], well: [] };
  const atWheel = (g, k, z, inset) => { g.rotateZ(Math.PI / 2); if (k < 0) g.rotateY(Math.PI); g.translate(k * (TRACK + inset), WHEEL, z); return g; };
  const lathe = (pts, n) => new T.LatheGeometry(pts.map(([r, y]) => new T.Vector2(r, y)), n).toNonIndexed();
  for (const z of AXLES) for (const k of [-1, 1]) {
    parts.rubber.push(atWheel(lathe([[0.0156, 0.0068], [0.0182, 0.0072], [0.0195, 0.0052], [0.0195, -0.0052], [0.0182, -0.0072], [0.0156, -0.0068]], seg), k, z, 0));
    // In the wheel's own frame its axis is y, with -y facing out of the car
    parts.rims.push(atWheel(lathe([[0.0154, 0.0066], [0.0154, -0.0066]], seg), k, z, 0), atWheel(lathe([[0, 0.006], [0.0154, 0.006]], seg), k, z, 0));
    parts.rotor.push(atWheel(lathe([[0.004, 0.001], [0.0128, 0.001], [0.0128, -0.001], [0.004, -0.001]], seg), k, z, 0));
    // The spokes, as pairs, on the outer face, and the hub
    for (let s = 0; s < 5; s++) for (const d of [-0.13, 0.13]) {
      const ang = (s / 5) * Math.PI * 2 + d, g = new T.BoxGeometry(0.0118, 0.0016, 0.0013).toNonIndexed();
      g.translate(0.0094, -0.0052, 0); g.rotateY(ang); parts.rims.push(atWheel(g, k, z, 0));
    }
    parts.rims.push(atWheel(lathe([[0, -0.0064], [0.0034, -0.0064], [0.0036, -0.0048], [0.0036, 0]], 12), k, z, 0));
    // The caliper clamps the rotor's top rear edge
    // A well liner inboard of the wheel, so nothing shows through the arch
    const well = new T.CylinderGeometry(WHEEL + 0.003, WHEEL + 0.003, 0.0012, 24, 1, false, 0, Math.PI).toNonIndexed();
    well.rotateZ(Math.PI / 2); well.translate(k * (TRACK - 0.0095), WHEEL, z); parts.well.push(well);
    const c = new T.BoxGeometry(0.0036, 0.0075, 0.0105).toNonIndexed();
    c.translate(0, 0.0098, 0); c.rotateX(-0.6); c.translate(k * (TRACK - 0.0006), WHEEL, z); parts.caliper.push(c);
  }
  mesh([...parts.rubber, ...parts.well], rubber, car); mesh(parts.rims, rims, car); mesh(parts.rotor, rotor, car); mesh(parts.caliper, caliper, car);

  // Headlight glows and the light they throw on the sill and the window trim
  const glowU = { uSize: { value: 0.02 }, uOn: { value: 0 } };
  const glowMat = new T.ShaderMaterial({ uniforms: glowU, vertexShader: GLOW_VERT, fragmentShader: GLOW_FRAG, transparent: true, blending: T.AdditiveBlending, depthWrite: false });
  for (const k of [-1, 1]) {
    const g = new T.Mesh(new T.PlaneGeometry(1, 1), glowMat);
    g.position.set(k * 0.031, 0.0395, L / 2 + 0.002); g.frustumCulled = false; shell.add(g);
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
    if (started < 0) { started = performance.now() / 1000; onSound("click"); }
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
    lamps.emissiveIntensity = on * 3.2; tails.emissiveIntensity = running ? 1.4 : 0.25;
    glowU.uOn.value = on * 0.9; beam.intensity = on * 0.05;
    // Idle: uneven firing pulses rock the body a fraction of a millimeter
    const pulse = Math.sin(time * 2 * Math.PI * 9.5) * 0.6 + Math.sin(time * 2 * Math.PI * 4.75 + 1.3) * 0.4;
    shell.position.set(Math.sin(time * 83) * 0.00012 * shake, 0.00035 * shake * (0.5 + 0.5 * pulse), 0);
    shell.rotation.z = 0.004 * shake * pulse;
  }

  // The car's box in the room as [min, max], for whatever needs to know where it stands
  car.updateMatrixWorld();
  const box = [new T.Vector3(Infinity, Infinity, Infinity), new T.Vector3(-Infinity, -Infinity, -Infinity)], c = new T.Vector3();
  for (const x of [-0.055, 0.055]) for (const y of [0, 0.076]) for (const z of [-L / 2, L / 2]) {
    c.set(x, y, z).applyMatrix4(car.matrixWorld); box[0].min(c); box[1].max(c);
  }

  return { pick, update, box, get running() { return running; } };
}
