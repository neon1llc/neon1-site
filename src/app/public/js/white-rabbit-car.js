// src/app/public/js/white-rabbit-car.js - A pearl black model muscle coupe on the white rabbit's window sill.
// Usage: const car = createCar({ scene, env, at, onSound }); await car.ready; car.pick(raycaster); car.update(time, light)
//
// Imported by white-rabbit-scene.js. A generic sixth-generation-style muscle coupe at
// about 1:15, with no badges or names, modeled in Blender as one subdivision-surface
// shell with its glass, trim, lamps, mirrors, splitter, wing, and one wheel (black split
// spokes) placed here four times, with big C-shaped red calipers in front and smaller ones behind. Its ambient occlusion is baked; the
// paint, glass, and metal are three.js materials, so reflections follow the camera. It
// loads after the scene starts; ready resolves when it is in. Clicking it flashes the
// headlights twice, pauses, cranks the starter, and the engine catches: the headlights and
// the white corner markers stay on and the body rumbles at idle.
// Clicking again shuts it off. onSound(kind) hears "click", "crank", "fire", and "stop".

import * as T from "/js/vendor/three-0.187.0.rabbit.min.js";


// Size in meters at model scale: length, wheel radius, wheel centers along the car, and the track
const L = 0.265, WHEEL = 0.0195, AXLES = [0.0795, -0.0765], TRACK = 0.0455; // must match blender/car.py

// The timeline after a click, in seconds: two flashes, a pause, the starter, then the engine catches
// when the slowed recording does (2.25 s into it, played at 0.85)
const FLASHES = [[0, 0.14], [0.3, 0.44]], CRANK = 0.95, FIRE = CRANK + 2.25 / 0.85;

// The model and its baked ambient occlusion, made by the planning folder's blender/car.py
const MODEL = "/media/white-rabbit/car.glb", AO = "/media/white-rabbit/car-ao.webp", WHEEL_AO = "/media/white-rabbit/wheel-ao.webp";

// The honeycomb mesh in the lower intake, painted once as a color map and a normal map, so the
// cells catch light without any geometry
function honeycomb() {
  const w = 256, h = 64, cells = [];
  for (let y = 0, row = 0; y < h + 6; y += 5.2, row++) for (let x = row % 2 ? 4.5 : 0; x < w + 9; x += 9) cells.push([x, y]);
  const paint = (fill, stroke, width) => {
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    const g = c.getContext("2d");
    g.fillStyle = fill; g.fillRect(0, 0, w, h);
    for (const [x, y] of cells) {
      g.beginPath();
      for (let k = 0; k < 6; k++) { const a = Math.PI / 6 + (k * Math.PI) / 3; g.lineTo(x + Math.cos(a) * 3.6, y + Math.sin(a) * 3.6); }
      g.closePath();
      if (stroke) { g.strokeStyle = stroke; g.lineWidth = width; g.stroke(); } else { g.fillStyle = "#000"; g.fill(); }
    }
    return c;
  };
  const color = new T.CanvasTexture(paint("#010101", "#1d1e22", 1.4));
  color.colorSpace = T.SRGBColorSpace;
  // The normal map: the web between cells bulges toward the viewer, its sides lit from the edges
  const c = paint("#8080ff", null), g = c.getContext("2d");
  for (const [x, y] of cells) {
    for (let k = 0; k < 6; k++) {
      const a = Math.PI / 6 + (k * Math.PI) / 3, nx = Math.cos(a + Math.PI / 6), ny = Math.sin(a + Math.PI / 6);
      g.strokeStyle = `rgb(${Math.round(128 + nx * 90)}, ${Math.round(128 - ny * 90)}, 200)`; g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(x + Math.cos(a) * 3.6, y + Math.sin(a) * 3.6);
      const a2 = a + Math.PI / 3; g.lineTo(x + Math.cos(a2) * 3.6, y + Math.sin(a2) * 3.6); g.stroke();
    }
  }
  return { color, normal: new T.CanvasTexture(c) };
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

  // Pearl black: a deep black base with fine flakes under a hard, glassy clear coat that mirrors the
  // outdoor light (env is a bright sky over dark ground, so the shoulder line catches a highlight)
  const paint = new T.MeshPhysicalMaterial({
    color: "#0A0A0C", metalness: 0.05, roughness: 0.25, normalMap: flakes(), normalScale: new T.Vector2(0.35, 0.35),
    clearcoat: 1, clearcoatRoughness: 0.03, envMap: env, envMapIntensity: 0,
  });
  // Tinted glass, black trim and wheels, clear lamps that light up, red taillights and calipers
  const glass = new T.MeshPhysicalMaterial({ color: "#04060A", metalness: 0, roughness: 0.03, clearcoat: 1, clearcoatRoughness: 0.02, envMap: env, envMapIntensity: 0 });
  const trim = new T.MeshStandardMaterial({ color: "#050506", roughness: 0.6 });
  const rubber = new T.MeshStandardMaterial({ color: "#080808", roughness: 0.9, side: T.DoubleSide });
  const rims = new T.MeshStandardMaterial({ color: "#0B0B0D", metalness: 0.6, roughness: 0.12, envMap: env, envMapIntensity: 0, side: T.DoubleSide });
  const inner = new T.MeshStandardMaterial({ color: "#030303", roughness: 0.8, side: T.DoubleSide });
  const lip = new T.MeshStandardMaterial({ color: "#8E9094", metalness: 1, roughness: 0.28, envMap: env, envMapIntensity: 0 }); // machined rim edge
  const rotor = new T.MeshStandardMaterial({ color: "#3A3B3E", metalness: 0.85, roughness: 0.3, side: T.DoubleSide });
  const caliper = new T.MeshStandardMaterial({ color: "#D0170D", roughness: 0.38, emissive: "#3A0300", side: T.DoubleSide });
  const lamps = new T.MeshStandardMaterial({ color: "#3C424A", metalness: 0.6, roughness: 0.08, emissive: "#FFF4E2", emissiveIntensity: 0, envMap: env, envMapIntensity: 0 });
  const tails = new T.MeshStandardMaterial({ color: "#7A0A06", emissive: "#FF1A0A", emissiveIntensity: 0.25, roughness: 0.25 });
  const glossy = [[paint, 0.7], [glass, 1.5], [rims, 0.7], [lip, 0.9], [lamps, 0.8]];

  // ---- The model: shell pieces ride the rumble, the four wheels stay put ----
  // Each piece takes its material by the name it was given in Blender
  const tex = new T.TextureLoader(), textures = [];
  const ao = (url) => { const t = tex.load(url); t.flipY = false; textures.push(t); return t; };
  const comb = honeycomb();
  const intake = new T.MeshStandardMaterial({ map: comb.color, normalMap: comb.normal, roughness: 0.55, metalness: 0.2 });
  const trimPaint = paint.clone();
  const ready = new Promise((done) => new T.GLTFLoader().load(MODEL, (gltf) => {
    paint.aoMap = ao(AO); paint.aoMapIntensity = 0.6; // AO only darkens the ambient and reflections, gently
    paint.normalMap.repeat.set(36, 36); // fine flakes over the model's UV islands
    const wheelAO = ao(WHEEL_AO);
    for (const m of [rubber, rims, inner, lip, rotor]) { m.aoMap = wheelAO; m.aoMapIntensity = 0.9; }
    const pick = { paint, glass, trim, intake, lamp: lamps, tail: tails, tire: rubber, rim: rims, inner, lip, rotor, caliper };
    const extras = [];
    gltf.scene.traverse((o) => {
      if (!o.isMesh) return;
      const name = o.material && o.material.name;
      o.material.dispose();
      o.material = o.parent.name === "mirrors" || o.name === "mirrors" ? trimPaint : pick[name] || trim;
    });
    for (const o of [...gltf.scene.children]) {
      if (o.name === "wheel" || o.name.startsWith("caliper")) { extras.push(o); continue; }
      o.traverse((m) => { if (m.isMesh) lit(m); });
      shell.add(o);
    }
    // The four wheels, one draw per material: each part copied to every corner, mirrored on the left.
    // Calipers go only to their own axle: the big front ones behind the disc, the rear ones ahead of it
    const at = new T.Group(), byMaterial = new Map();
    const corners = (part, axles) => {
      for (const z of axles) for (const k of [-1, 1]) {
        at.position.set(k * TRACK, WHEEL, z); at.scale.set(k, 1, 1); at.updateMatrix();
        const list = byMaterial.get(part.material) || [];
        list.push(part.geometry.clone().applyMatrix4(at.matrix));
        byMaterial.set(part.material, list);
      }
    };
    for (const o of extras) o.traverse((part) => {
      if (!part.isMesh) return;
      corners(part, o.name === "wheel" ? AXLES : o.name === "caliper-front" ? [AXLES[0]] : [AXLES[1]]);
      part.geometry.dispose();
    });
    for (const [material, list] of byMaterial) {
      car.add(lit(new T.Mesh(T.mergeGeometries(list), material)));
      list.forEach((g) => g.dispose());
    }
    done();
  }, undefined, () => done()));

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

  // Frees the baked textures; the meshes and materials go with the scene
  function dispose() { textures.forEach((t) => t.dispose()); comb.color.dispose(); comb.normal.dispose(); }

  return { pick, update, box, ready, dispose, get running() { return running; } };
}
