// src/app/public/js/white-rabbit-sky.js - The sky behind the white rabbit's window: clouds, the sun, and its light.
// Usage: const sky = createSky({ scene, win }); sky.update(dt, level); sky.sun
//
// Imported by white-rabbit-scene.js. The sky is painted on a far wall outside the
// window: a blue gradient, a sun, and puffy clouds that drift across it on their
// own clock. The clouds are a few dozen soft circles, so the same shapes can be
// measured here in JS: sun tells the room how much of the sun is showing, and the
// window's panes of sunlight on the floor follow it.

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
const CLOUDS = [[2, 11.4, 1.0], [16, 15.2, 1.1], [30, 10.8, 1.25], [43, 5.0, 1.3], [57, 11.9, 0.85], [-8, 17.5, 1.3],
  [-24, 3.4, 1.5], [70, 6.6, 1.1]];
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
    vec3 sky = mix(vec3(0.36, 0.62, 1.0), vec3(0.03, 0.17, 0.72), pow(h, 0.75)) * 1.1;

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


/** Paints the sky outside the window `win`; update(dt, level) drifts the clouds and lights the floor; sun is 0 (hidden) to 1 (out) */
export function createSky({ scene, win }) {
  // The circles, laid out once and moved each frame; w is the cloud's base
  const circ = Array.from({ length: N }, () => new T.Vector4());
  const uniforms = { uCirc: { value: circ }, uSun: { value: new T.Vector3(SUN.z, SUN.y, SUN.r) }, uDrift: { value: 0 } };
  const mesh = new T.Mesh(new T.PlaneGeometry(90, 50), new T.ShaderMaterial({ uniforms, vertexShader: VERT, fragmentShader: FRAG }));
  mesh.rotation.y = Math.PI / 2;
  mesh.position.set(FAR, 12, -6);
  scene.add(mesh);
  const floor = patch(win);
  scene.add(floor);

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
  function update(dt, level = 0) {
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
  }
  update(0);

  return { update, get sun() { return sun; } };
}
