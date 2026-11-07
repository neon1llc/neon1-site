// src/app/public/js/white-rabbit-car.js - A pearl black model muscle coupe on the white rabbit's window sill.
// Usage: const car = createCar({ scene, env, at, onSound }); await car.ready; car.pick(raycaster); car.update(time, light)
//
// Imported by white-rabbit-scene.js. The model is based on "2019 Chevrolet Camaro" by
// IsaacOldton (CC BY 4.0, credited on the site), unbranded, stripped of hidden parts, and
// collapsed to a few materials by the planning folder's blender/car_import.py; phones get a
// lighter cut. Paint, glass, and metal are three.js materials, so reflections follow the
// camera. It loads after the scene starts; ready resolves when it is in. Clicking it flashes
// the headlights twice, pauses, cranks the starter, and the engine catches: the headlights
// and the smoked side markers light white, the taillights glow, and the body rumbles at idle.
// Clicking again shuts it off. onSound(kind) hears "click", "crank", "fire", and "stop".

import * as T from "/js/vendor/three-0.187.0.rabbit.min.js";


// The model's length in meters (blender/car_import.py scales it to this), and where its headlights are
const L = 0.265, HEADLIGHTS = [0.04, 0.037, 0.121];

// The timeline after a click, in seconds: two flashes, a pause, the starter, then the engine catches
// when the slowed recording does (2.25 s into it, played at 0.85)
const FLASHES = [[0, 0.14], [0.3, 0.44]], CRANK = 0.95, FIRE = CRANK + 2.25 / 0.85;

// The models: full detail, and a lighter cut for phones
const MODEL = "/media/white-rabbit/car.glb", LITE = "/media/white-rabbit/car-lite.glb";


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


// A geometry's attributes as plain floats, so a quantized model can be moved into place
export function unpacked(geo) {
  const out = new T.BufferGeometry();
  for (const [name, a] of Object.entries(geo.attributes)) {
    const arr = new Float32Array(a.count * a.itemSize), get = ["getX", "getY", "getZ", "getW"];
    for (let i = 0; i < a.count; i++) for (let c = 0; c < a.itemSize; c++) arr[i * a.itemSize + c] = a[get[c]](i);
    out.setAttribute(name, new T.Float32BufferAttribute(arr, a.itemSize));
  }
  if (geo.index) out.setIndex(geo.index.clone());
  return out;
}


/** Builds the car at `at` ({ p, turn, scale, detail }) on the sill; env gives the paint its reflections */
export function createCar({ scene, env, at, onSound = () => {} }) {
  const car = new T.Group(), shell = new T.Group();
  car.position.set(...at.p); car.rotation.y = at.turn; car.scale.setScalar(at.scale || 1);
  car.add(shell); scene.add(car);
  const lit = (m) => { m.castShadow = m.receiveShadow = true; return m; };

  // Pearl black with sheen: dark metallic flake under a hard clear coat, so the sunlit room shows in it
  const paint = new T.MeshPhysicalMaterial({
    color: "#0D0E10", metalness: 0.5, roughness: 0.3, normalMap: flakes(), normalScale: new T.Vector2(0.25, 0.25),
    clearcoat: 1, clearcoatRoughness: 0.03, envMap: env, envMapIntensity: 0,
  });
  paint.normalMap.repeat.set(30, 30);
  // Tinted windows, black gloss and matte trim, dark chrome, clear lenses, lamps and markers that light,
  // red taillights, black gloss rims, red calipers, and grey rotors
  const glass = new T.MeshPhysicalMaterial({ color: "#05070A", roughness: 0.03, clearcoat: 1, clearcoatRoughness: 0.02, envMap: env, envMapIntensity: 0 });
  const trim = new T.MeshPhysicalMaterial({ color: "#060607", roughness: 0.25, clearcoat: 0.6, envMap: env, envMapIntensity: 0 });
  const matte = new T.MeshStandardMaterial({ color: "#0A0A0B", roughness: 0.8 });
  const chrome = new T.MeshStandardMaterial({ color: "#16171A", metalness: 1, roughness: 0.28, envMap: env, envMapIntensity: 0 });
  const lens = new T.MeshPhysicalMaterial({ color: "#DDE3EA", roughness: 0.05, transparent: true, opacity: 0.3, depthWrite: false, envMap: env, envMapIntensity: 0 });
  const lamps = new T.MeshStandardMaterial({ color: "#C8CED6", metalness: 0.2, roughness: 0.15, emissive: "#FFF6EA", emissiveIntensity: 0, envMap: env, envMapIntensity: 0 });
  // Side markers: smoked glass, near black and glossy when off, a white LED glow when lit
  const markers = new T.MeshPhysicalMaterial({ color: "#060708", roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.02, emissive: "#FFF6EA", emissiveIntensity: 0, envMap: env, envMapIntensity: 0 });
  const tails = new T.MeshStandardMaterial({ color: "#5E0806", emissive: "#FF1A0A", emissiveIntensity: 0.15, roughness: 0.2 });
  const rubber = new T.MeshStandardMaterial({ color: "#0B0B0B", roughness: 0.88 });
  const rims = new T.MeshPhysicalMaterial({ color: "#08080A", metalness: 0.4, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.05, envMap: env, envMapIntensity: 0 });
  const rotor = new T.MeshStandardMaterial({ color: "#55575B", metalness: 0.85, roughness: 0.35 });
  const caliper = new T.MeshStandardMaterial({ color: "#C8150C", roughness: 0.35, emissive: "#2A0200" });
  const glossy = [[paint, 1.0], [glass, 1.4], [trim, 0.6], [chrome, 0.6], [lens, 1], [lamps, 0.6], [markers, 1.2], [rims, 0.4]];

  // ---- The model: the body rides the rumble, the wheels stay put ----
  // Each piece takes the material named for it in Blender
  const mats = { paint, window: glass, trim, matte, chrome, lens, lamp: lamps, marker: markers, tail: tails, tire: rubber, rim: rims, rotor, caliper };
  const ready = new Promise((done) => {
    const loader = new T.GLTFLoader();
    const use = (gltf) => {
      for (const o of [...gltf.scene.children]) {
        const wheel = o.name.startsWith("wheel-");
        o.traverse((m) => {
          if (!m.isMesh) return;
          const name = m.material.name;
          m.material.dispose();
          m.material = mats[name] || trim;
          if (name !== "lens") lit(m);
        });
        (wheel ? car : shell).add(o);
      }
      done();
    };
    // Phones try the lighter cut first and fall back to the full one
    loader.load(at.lite ? LITE : MODEL, use, undefined, () => (at.lite ? loader.load(MODEL, use, undefined, () => done()) : done()));
  });

  // Headlight glows and the light they throw on the sill and the window trim
  const glowU = { uSize: { value: 0.02 }, uOn: { value: 0 } };
  const glowMat = new T.ShaderMaterial({ uniforms: glowU, vertexShader: GLOW_VERT, fragmentShader: GLOW_FRAG, transparent: true, blending: T.AdditiveBlending, depthWrite: false });
  for (const k of [-1, 1]) {
    const g = new T.Mesh(new T.PlaneGeometry(1, 1), glowMat);
    g.position.set(k * HEADLIGHTS[0], HEADLIGHTS[1], HEADLIGHTS[2]); g.frustumCulled = false; shell.add(g);
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
    lamps.emissiveIntensity = on * 3.2; markers.emissiveIntensity = on * 3.6; tails.emissiveIntensity = running ? 1.4 : 0.15;
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

  // Frees what the scene's traversal doesn't reach; the meshes and materials go with the scene
  function dispose() { paint.normalMap.dispose(); }

  return { pick, update, box, ready, dispose, get running() { return running; } };
}
