// src/app/public/js/white-rabbit-room.js - The white rabbit's room: the TV, its table, two wingback chairs, and the walls.
// Usage: furnish(scene, { win, sc, sw, sh })
//
// Imported by white-rabbit-scene.js. Everything is built in code, with small textures
// painted on canvases once: wood grain, oak planks, plaster, a rug,
// tufted leather, a speaker grille, and vents. Parts that share a material are merged
// into one mesh, so the whole room draws in about twenty calls, phones included.

import * as T from "/js/vendor/three-0.187.0.rabbit.min.js";
import { paintSign, signOutline } from "/js/white-rabbit-sign.js";


// Palette: pale walls with the brand greens as trim, walnut and bakelite for the set, oxblood leather
const WALL = "#F7F8F5", CEILING = "#F5F6F3", WINDOW_TRIM = "#E8ECE8", BRAND = "#035704", MARK = "#327641";
const WALNUT = "#8A5A34", DARK_WOOD = "#6A4426", LEG_WOOD = "#4A2D1A", BAKELITE = "#3E2B1E", IVORY = "#D9CCAA";
const BRASS = "#A8834E", LEATHER = "#62291D";

// The room's inside faces, the height of the wainscot, and where the chairs sit (x, z, turn)
const ROOM = { x: 1.95, z: 2.45, h: 2.6 };
const RAIL = 0.66, BASE = 0.13; // low enough that the window and its sill sit clear above the rail
const CHAIRS = [[-1.12, -1.46, 0.48], [1.29, -1.54, -0.57]]; // set down by hand, not mirrored
const CHAIR_LEGS = [[-0.39, 0.38], [0.39, 0.38], [-0.405, -0.385], [0.405, -0.385]]; // front pair under the carved posts

// A small seeded random, so the textures look the same on every visit
function seeded(n) { return () => ((n = (n * 16807) % 2147483647) - 1) / 2147483646; }


// ---- Canvas textures ----
// Paints a canvas once and wraps it as a repeating texture; colors are sRGB unless it holds normals
function painted(w, h, paint, srgb = true) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  paint(c.getContext("2d"), w, h);
  const tex = new T.CanvasTexture(c);
  if (srgb) tex.colorSpace = T.SRGBColorSpace;
  tex.wrapS = tex.wrapT = T.RepeatWrapping;
  return tex;
}

// Wood grain, light on white so each material's color tints it
function grain(seed) {
  const r = seeded(seed);
  return painted(256, 256, (g, w, h) => {
    g.fillStyle = "#fff"; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 70; i++) {
      const y = r() * h, amp = 1 + r() * 4, f = 0.01 + r() * 0.03, ph = r() * 6;
      g.strokeStyle = `rgba(60, 30, 10, ${0.04 + r() * 0.12})`; g.lineWidth = 0.6 + r() * 2.2;
      g.beginPath();
      for (let x = 0; x <= w; x += 8) g.lineTo(x, y + Math.sin(x * f + ph) * amp);
      g.stroke();
    }
  });
}

// Plaster: a faint speckle that keeps the walls from looking like flat paint
function plaster() {
  const r = seeded(11);
  return painted(128, 128, (g, w, h) => {
    g.fillStyle = "#fff"; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 1400; i++) {
      g.fillStyle = `rgba(${r() < 0.5 ? "0,0,0" : "255,255,255"}, ${r() * 0.022})`;
      g.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2);
    }
    for (let i = 0; i < 6; i++) {
      const x = r() * w, y = r() * h, rad = 14 + r() * 30, grad = g.createRadialGradient(x, y, 0, x, y, rad);
      grad.addColorStop(0, "rgba(90, 80, 60, .035)"); grad.addColorStop(1, "rgba(90, 80, 60, 0)");
      g.fillStyle = grad; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
  });
}

// A soft wool rug: warm greige heathered from short fibres in near tones, gently mottled, with a
// tone-on-tone border a shade darker than the field
function rug() {
  const r = seeded(5);
  return painted(512, 320, (g, w, h) => {
    g.fillStyle = "#E0DBCF"; g.fillRect(0, 0, w, h);
    g.fillStyle = "rgba(120, 100, 75, .07)"; g.fillRect(16, 16, w - 32, h - 32);
    g.fillStyle = "#E0DBCF"; g.fillRect(40, 40, w - 80, h - 80);
    for (let i = 0; i < 14; i++) {
      const x = r() * w, y = r() * h, rad = 30 + r() * 70, grad = g.createRadialGradient(x, y, 0, x, y, rad), light = r() < 0.5;
      grad.addColorStop(0, light ? "rgba(255, 252, 240, .1)" : "rgba(110, 90, 60, .05)"); grad.addColorStop(1, "rgba(0, 0, 0, 0)");
      g.fillStyle = grad; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    g.lineCap = "round";
    for (let i = 0; i < 14000; i++) {
      const x = r() * w, y = r() * h, a = r() * Math.PI * 2, l = 1.5 + r() * 3.5, light = r() < 0.5;
      g.strokeStyle = light ? `rgba(255, 250, 238, ${0.1 + r() * 0.18})` : `rgba(105, 88, 64, ${0.06 + r() * 0.12})`;
      g.lineWidth = 0.6 + r() * 0.6;
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a + 0.6) * l * 0.6, y + Math.sin(a + 0.6) * l * 0.6, x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
    }
  });
}

// The speaker cloth behind the brass slats: a dark, fine weave
function grille() {
  const r = seeded(9);
  return painted(128, 128, (g, w, h) => {
    g.fillStyle = "#241A13"; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 2) for (let x = (y / 2) % 2; x < w; x += 2) { g.fillStyle = `rgba(90, 70, 45, ${0.15 + r() * 0.2})`; g.fillRect(x, y, 1, 1); }
  });
}

// Vent slots for the back of the set
function vents() {
  return painted(128, 64, (g, w, h) => {
    g.fillStyle = BAKELITE; g.fillRect(0, 0, w, h);
    for (let x = 10; x < w - 6; x += 12) { g.fillStyle = "#120c08"; g.beginPath(); g.roundRect(x, 10, 6, h - 20, 3); g.fill(); }
  });
}

// Tufted leather: pillows between buttons on a diamond grid, as a color map and a normal map
function tufting() {
  const n = 256, s = 64, hgt = new Float32Array(n * n), r = seeded(3);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const u = (x + y) / s, v = (x - y + n) / s;
      hgt[y * n + x] = Math.pow(Math.sin(Math.PI * (u % 1)) * Math.sin(Math.PI * (v % 1)), 0.55);
    }
  }
  const at = (x, y) => hgt[((y + n) % n) * n + ((x + n) % n)];
  const color = painted(n, n, (g) => {
    const img = g.createImageData(n, n);
    for (let i = 0; i < n * n; i++) {
      const l = 120 + 135 * hgt[i] + (r() - 0.5) * 14;
      img.data.set([l, l, l, 255], i * 4);
    }
    g.putImageData(img, 0, 0);
    // Wear: paler, rubbed patches where people lean, and darker grime in the creases
    for (let i = 0; i < 9; i++) {
      const x = r() * n, y = r() * n, rad = 18 + r() * 40, grad = g.createRadialGradient(x, y, 0, x, y, rad);
      grad.addColorStop(0, `rgba(255, 235, 215, ${0.12 + r() * 0.12})`); grad.addColorStop(1, "rgba(255, 235, 215, 0)");
      g.fillStyle = grad; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    // Buttons where the creases meet
    g.fillStyle = "rgba(20, 5, 3, .75)";
    for (let k = -1; k <= n / s * 2 + 1; k++) for (let j = -1; j <= n / s * 2 + 1; j++) {
      if ((k + j) % 2) continue;
      g.beginPath(); g.arc(k * s / 2, j * s / 2, 3.5, 0, 6.3); g.fill();
    }
  });
  const normal = painted(n, n, (g) => {
    const img = g.createImageData(n, n);
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const dx = (at(x + 1, y) - at(x - 1, y)) * 3, dy = (at(x, y + 1) - at(x, y - 1)) * 3, l = Math.hypot(dx, dy, 1);
        img.data.set([(-dx / l * 0.5 + 0.5) * 255, (dy / l * 0.5 + 0.5) * 255, (1 / l * 0.5 + 0.5) * 255, 255], (y * n + x) * 4);
      }
    }
    g.putImageData(img, 0, 0);
  }, false);
  return { color, normal };
}

// A soft round or square shadow, dark at the middle and clear at the edge
function shadow(square = false) {
  return painted(128, 128, (g, w, h) => {
    if (square) {
      for (let i = 0; i < 24; i++) { g.fillStyle = "rgba(30, 24, 18, .028)"; g.beginPath(); g.roundRect(i * 2, i * 2, w - i * 4, h - i * 4, 40 - i); g.fill(); }
      return;
    }
    const grad = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    grad.addColorStop(0, "rgba(30, 24, 18, .55)"); grad.addColorStop(1, "rgba(30, 24, 18, 0)");
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
  });
}

// A shadow that fades away from one edge: where floor meets wall
function edge() {
  return painted(4, 64, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, "rgba(30, 30, 24, .32)"); grad.addColorStop(1, "rgba(30, 30, 24, 0)");
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
  });
}


// ---- Geometry: parts are placed, then merged by material ----
const holder = new T.Mesh();

// Places a part: position, rotation (applied in `order`), scale, and how many times its texture repeats
function place(geo, { p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1], uv = [1, 1], order = "XYZ" } = {}) {
  holder.position.set(...p); holder.rotation.set(r[0], r[1], r[2], order); holder.scale.set(...s);
  holder.updateMatrix();
  const out = geo.index ? geo.toNonIndexed() : geo;
  if (out !== geo) geo.dispose();
  out.applyMatrix4(holder.matrix);
  const a = out.attributes.uv;
  if (a && (uv[0] !== 1 || uv[1] !== 1)) for (let i = 0; i < a.count; i++) a.setXY(i, a.getX(i) * uv[0], a.getY(i) * uv[1]);
  return out;
}

// One mesh from many placed parts
function merged(parts, material) {
  const mesh = new T.Mesh(T.mergeGeometries(parts), material);
  parts.forEach((g) => g.dispose());
  return mesh;
}

// Moves already placed parts again, as one piece of furniture into the room
function moved(parts, opts) { return parts.map((g) => place(g, opts)); }

// A turned profile spun around its axis: [radius, height] pairs from the bottom up
const turned = (pts, seg = 14) => new T.LatheGeometry(pts.map(([x, y]) => new T.Vector2(x, y)), seg);

// A knob body along +y: fluted sides and a domed face
function knob() {
  const geo = turned([[0, 0], [0.023, 0], [0.024, 0.004], [0.024, 0.022], [0.022, 0.027], [0.016, 0.031], [0, 0.0325]], 32), pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), r = Math.hypot(x, z);
    if (r > 0.02 && pos.getY(i) > 0.002 && pos.getY(i) < 0.024) { const k = 1 + 0.05 * Math.cos(Math.atan2(z, x) * 16); pos.setXYZ(i, x * k, pos.getY(i), z * k); }
  }
  geo.computeVertexNormals();
  return geo;
}

// A rounded rectangle path, centered
function rounded(shape, w, h, r) {
  const x = -w / 2, y = -h / 2;
  shape.moveTo(x + r, y); shape.lineTo(x + w - r, y); shape.quadraticCurveTo(x + w, y, x + w, y + r);
  shape.lineTo(x + w, y + h - r); shape.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  shape.lineTo(x + r, y + h); shape.quadraticCurveTo(x, y + h, x, y + h - r);
  shape.lineTo(x, y + r); shape.quadraticCurveTo(x, y, x + r, y);
  return shape;
}

// A big cat's head carved from one piece of wood, facing +z, about 11 cm across: a sphere pushed
// and pulled by smooth bumps and hollows into a broad skull, heavy brow over eyes set in sockets,
// cheeks, a muzzle with whisker pads, a nose, a mouth line, a chin, and pointed ears; the back
// flattens into the arm it grows from, and faint chisel facets keep it from looking cast
function panther(seg = 44) {
  const geo = new T.SphereGeometry(1, seg, Math.round(seg * 0.75));
  geo.rotateY(-Math.PI / 2); // the seam goes to the back
  const pos = geo.attributes.position;
  // A smooth bump around direction c, wx wide and wy tall, of height amp
  const bump = (x, y, z, cx, cy, cz, wx, wy, amp) => {
    const d = ((x - cx) / wx) ** 2 + ((y - cy) / wy) ** 2 + ((z - cz) / ((wx + wy) / 2)) ** 2;
    return amp * Math.exp(-d);
  };
  // Carved hollows stay darker, as oil and dust settle in them over the years
  const shade = [];
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), ax = Math.abs(x);
    let up = 0, down = 0;
    up += bump(x, y, z, 0, -0.32, 0.95, 0.4, 0.33, 0.5);                 // muzzle
    up += bump(x, y, z, 0, -0.06, 1, 0.13, 0.2, 0.14);                   // bridge of the nose
    up += bump(x, y, z, 0, -0.21, 1, 0.12, 0.06, 0.22);                  // nose pad
    up += bump(ax, y, z, 0.19, -0.44, 0.88, 0.14, 0.12, 0.22);           // whisker pads
    down += bump(ax, y, z, 0.13, -0.62, 0.78, 0.24, 0.03, 0.2);         // mouth line
    down += bump(x, y, z, 0, -0.43, 0.92, 0.025, 0.12, 0.12);             // groove below the nose
    up += bump(x, y, z, 0, -0.78, 0.62, 0.18, 0.11, 0.1);                // chin
    down += bump(ax, y, z, 0.31, 0.16, 0.94, 0.12, 0.085, 0.3);          // eye sockets
    up += bump(ax, y, z, 0.31, 0.14, 0.94, 0.08, 0.038, 0.14);           // almond eyes in them
    up += bump(ax, y + 0.1 * ax, z, 0.3, 0.33, 0.9, 0.2, 0.055, 0.22);    // brow, drawn down toward the middle
    down += bump(x, y, z, 0, 0.38, 0.93, 0.04, 0.14, 0.07);              // frown line
    up += bump(ax, y, z, 0.62, -0.22, 0.72, 0.28, 0.26, 0.2);            // cheeks
    down += bump(ax, y, z, 0.48, -0.05, 0.86, 0.1, 0.25, 0.05);          // between cheek and muzzle
    const ear = Math.max(0, 1 - Math.hypot((ax - 0.52) / 0.22, (y - 0.8) / 0.28, (z - 0.25) / 0.3));
    up += 0.65 * ear * ear;                                              // pointed ears
    down += 0.2 * Math.max(0, 1 - Math.hypot((ax - 0.52) / 0.12, (y - 0.85) / 0.18, (z - 0.42) / 0.12)); // their hollows
    const r = 1 + up - down + 0.012 * Math.sin(x * 23 + y * 7) * Math.sin(y * 19 - z * 11); // chisel facets
    const back = z < 0 ? 1 + z * 0.45 : 1;                               // flat behind, into the arm
    pos.setXYZ(i, x * r, y * r * 0.92, z * r * 0.9 * back);
    const v = Math.max(0.3, 1 - 3.6 * down);
    shade.push(v, v, v);
  }
  geo.setAttribute("color", new T.Float32BufferAttribute(shade, 3));
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 3, uv.getY(i) * 2); // finer grain
  geo.computeVertexNormals();
  geo.scale(0.05, 0.05, 0.05);
  return geo;
}

// A squared shaft swept along a curve through pts, w wide (x) and d deep at its start, tapering
// to w1 by d1 at its end, with softly rounded corners
function swept(pts, [w, d], [w1, d1], rows = 14, cols = 20) {
  const curve = new T.CatmullRomCurve3(pts.map((p) => new T.Vector3(...p)));
  const pos = [], uvs = [], idx = [], p = new T.Vector3(), t = new T.Vector3();
  for (let i = 0; i <= rows; i++) {
    const k = i / rows, a = (w + (w1 - w) * k) / 2, b = (d + (d1 - d) * k) / 2;
    curve.getPoint(k, p); curve.getTangent(k, t);
    const ny = t.z, nz = -t.y; // across the shaft's depth, toward the front
    for (let j = 0; j <= cols; j++) {
      const ang = (j / cols) * Math.PI * 2, c = Math.cos(ang), s = Math.sin(ang);
      const sx = a * Math.sign(c) * Math.abs(c) ** 0.3, sn = b * Math.sign(s) * Math.abs(s) ** 0.3;
      pos.push(p.x + sx, p.y + ny * sn, p.z + nz * sn); uvs.push(j / cols, k * 2);
    }
  }
  for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
    const q = i * (cols + 1) + j, r = q + cols + 1;
    idx.push(q, q + 1, r, q + 1, r + 1, r);
  }
  const geo = new T.BufferGeometry();
  geo.setIndex(idx);
  geo.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
  geo.setAttribute("uv", new T.Float32BufferAttribute(uvs, 2));
  geo.computeVertexNormals();
  return geo;
}

// A raised panel field facing +z from the wall at z 0: a w by h rectangle at the wall, a smaller
// one inset by `bevel` and `depth` out in front, and four trapezoids joining them corner to corner
function raised(w, h, bevel, depth) {
  const x = w / 2, y = h / 2, X = x - bevel, Y = y - bevel;
  const back = [[-x, -y, 0], [x, -y, 0], [x, y, 0], [-x, y, 0]], front = [[-X, -Y, depth], [X, -Y, depth], [X, Y, depth], [-X, Y, depth]];
  // Flat-shaded triangles from quads given counterclockwise as seen from outside
  const build = (quads) => {
    const pos = [], nor = [], uvs = [];
    for (const q of quads) {
      const [a, b, c] = q, e1 = b.map((v, k) => v - a[k]), e2 = c.map((v, k) => v - a[k]);
      const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]], l = Math.hypot(...n);
      for (const v of [q[0], q[1], q[2], q[0], q[2], q[3]]) { pos.push(...v); nor.push(...n.map((m) => m / l)); uvs.push(v[0] + x, v[1] + y); }
    }
    const geo = new T.BufferGeometry();
    geo.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
    geo.setAttribute("normal", new T.Float32BufferAttribute(nor, 3));
    geo.setAttribute("uv", new T.Float32BufferAttribute(uvs, 2));
    return geo;
  };
  const sides = [0, 1, 2, 3].map((i) => { const j = (i + 1) % 4; return [back[i], back[j], front[j], front[i]]; });
  return { face: build([front]), sides: build(sides) };
}

// The sill's profile as [projection, height] in meters from the opening's bottom, bottom up:
// a neck, a ring, the echinus flaring out on a convex curve, and the square abacus slab on top
const DORIC = (() => {
  const pts = [[0, -0.062], [0.066, -0.062], [0.066, -0.048], [0.072, -0.046], [0.077, -0.042], [0.078, -0.038], [0.075, -0.034], [0.07, -0.032]];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8, a = (1 - t) * (1 - t), b = 2 * t * (1 - t), c = t * t;
    pts.push([0.072 * a + 0.125 * b + 0.142 * c, -0.031 * a - 0.027 * b - 0.006 * c]);
  }
  return [...pts, [0.16, -0.006], [0.16, 0.028]];
})();
const NECK = 0.07; // how far past the opening the neck runs at each end

// A capital half sunk in a wall that faces +x: the profile is swept around a plan that grows with
// it, so the front and both ends flare alike. Creases sharper than about 35 degrees stay hard
function capital(profile, { x, za, zb, y, back = 0 }) {
  const pos = [], nor = [], uvs = [];
  const seg = profile.slice(1).map(([r1, h1], i) => {
    const [r0, h0] = profile[i], l = Math.hypot(r1 - r0, h1 - h0);
    return [(h1 - h0) / l, -(r1 - r0) / l];
  });
  // A vertex's normal in the profile, (out, up): smoothed with its neighbor unless the crease is hard
  const bend = (s, o) => {
    const a = seg[s], b = seg[o];
    if (!b || a[0] * b[0] + a[1] * b[1] < 0.82) return a;
    const l = Math.hypot(a[0] + b[0], a[1] + b[1]);
    return [(a[0] + b[0]) / l, (a[1] + b[1]) / l];
  };
  // The front and the two ends, each as a point for (projection, 0..1 across) and its plan normal
  const faces = [
    [(r, t) => [x + r, za - r + t * (zb - za + 2 * r)], [1, 0]],
    [(r, t) => [x + t * r, za - r], [0, -1]],
    [(r, t) => [x + t * r, zb + r], [0, 1]],
  ];
  // Adds a triangle, turned to face the way its normals point
  const tri = (a, b, c) => {
    const e1 = [b.p[0] - a.p[0], b.p[1] - a.p[1], b.p[2] - a.p[2]], e2 = [c.p[0] - a.p[0], c.p[1] - a.p[1], c.p[2] - a.p[2]];
    const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    const m = a.n.map((v, k) => v + b.n[k] + c.n[k]);
    for (const v of n[0] * m[0] + n[1] * m[1] + n[2] * m[2] < 0 ? [a, c, b] : [a, b, c]) { pos.push(...v.p); nor.push(...v.n); uvs.push(...v.uv); }
  };
  let arc = 0;
  for (let s = 0; s < seg.length; s++) {
    const [r0, h0] = profile[s], [r1, h1] = profile[s + 1], n0 = bend(s, s - 1), n1 = bend(s, s + 1);
    const len = Math.hypot(r1 - r0, h1 - h0);
    for (const [at, [nx, nz]] of faces) {
      const v = (r, h, t, [o, u], a) => { const [px, pz] = at(r, t); return { p: [px, y + h, pz], n: [nx * o, u, nz * o], uv: [pz, a] }; };
      const a = v(r0, h0, 0, n0, arc), b = v(r0, h0, 1, n0, arc), c = v(r1, h1, 1, n1, arc + len), d = v(r1, h1, 0, n1, arc + len);
      tri(a, b, c); tri(a, c, d);
    }
    arc += len;
  }
  // The flat top, running back into the opening
  const [rt, ht] = profile[profile.length - 1], up = [0, 1, 0];
  const top = (px, pz) => ({ p: [px, y + ht, pz], n: up, uv: [pz, px] });
  const q = [top(x - back, za - rt), top(x + rt, za - rt), top(x + rt, zb + rt), top(x - back, zb + rt)];
  tri(q[0], q[1], q[2]); tri(q[0], q[2], q[3]);
  const geo = new T.BufferGeometry();
  geo.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
  geo.setAttribute("normal", new T.Float32BufferAttribute(nor, 3));
  geo.setAttribute("uv", new T.Float32BufferAttribute(uvs, 2));
  return geo;
}


/**
 * Builds the room around the window `win` and the TV whose screen (sw by sh) is centered at `sc`.
 * env is a small environment map for the furniture's reflections; returns { glossy }, the
 * materials that reflect it as [material, full strength], so the scene can dim them with the room,
 * and ready, which resolves once the photographed maps are in
 */
export function furnish(scene, { win, sc, sw, sh, env, touch = false }) {
  const wood = grain(1), lambert = (o) => new T.MeshLambertMaterial(o), standard = (o) => new T.MeshStandardMaterial(o);
  // Varnish, plastic, brass, and leather reflect the room, so highlights slide as the camera moves
  const glossy = [];
  // Photographed maps from Poly Haven (CC0), prepared by blender/textures.py; ready resolves when all are in
  const loads = [], loader = new T.TextureLoader();
  const photo = (name, repeat, color = false) => {
    let t;
    loads.push(new Promise((done) => { t = loader.load(`/media/white-rabbit/tex/${name}.webp`, done, undefined, done); }));
    t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(...repeat);
    if (color) t.colorSpace = T.SRGBColorSpace;
    return t;
  };
  const shiny = (k, o, Kind = T.MeshStandardMaterial) => { const m = new Kind({ ...o, envMap: env, envMapIntensity: 0 }); glossy.push([m, k]); return m; };
  // Lit meshes cast and take the window light's shadows; glass and the painted shadows don't
  // Each mesh gets a stable name in build order, which the baked lighting is keyed to (blender/room.py);
  // lit ones are marked for baking, and painted contact shadows as stand-ins that baking replaces
  let count = 0;
  const add = (mesh) => {
    const lit = !mesh.material.isMeshBasicMaterial && !mesh.material.transparent;
    mesh.castShadow = mesh.receiveShadow = lit;
    mesh.name = `room-${count++}`;
    mesh.userData.bake = lit;
    mesh.userData.standIn = mesh.material.isMeshBasicMaterial && mesh.material.transparent;
    scene.add(mesh);
    return mesh;
  };

  // ---- Walls, ceiling, and floor ----
  // The left wall is four pieces around the window opening
  const z0 = win.z - win.w / 2, z1 = win.z + win.w / 2, y0 = win.y - win.h / 2, y1 = win.y + win.h / 2;
  const box = (w, h, d, p, uv = [1, 1]) => place(new T.BoxGeometry(w, h, d), { p, uv });
  add(merged([
    box(4, 2.6, 0.1, [0, 1.3, -2.5], [4, 2.6]), box(0.1, 2.6, 5, [2.0, 1.3, 0], [5, 2.6]), box(4, 2.6, 0.1, [0, 1.3, 2.5], [4, 2.6]),
    box(0.1, y0, 5, [-2.0, y0 / 2, 0], [5, y0]), box(0.1, 2.6 - y1, 5, [-2.0, (2.6 + y1) / 2, 0], [5, 2.6 - y1]),
    box(0.1, win.h, z0 + 2.5, [-2.0, win.y, (z0 - 2.5) / 2], [z0 + 2.5, win.h]), box(0.1, win.h, 2.5 - z1, [-2.0, win.y, (z1 + 2.5) / 2], [2.5 - z1, win.h]),
  ], lambert({ color: WALL, map: plaster(), normalMap: photo("plaster-normal", [1, 1]), normalScale: new T.Vector2(0.35, 0.35) })));
  add(merged([box(4, 0.02, 5, [0, 2.61, 0])], lambert({ color: CEILING })));
  add(merged([place(new T.PlaneGeometry(4, 5), { r: [-Math.PI / 2, 0, 0], uv: [4 / 2.4, 5 / 0.6] })], lambert({ map: photo("floor-color", [1.2, 0.3], true), normalMap: photo("floor-normal", [1.2, 0.3]) })));

  // ---- The window: an inset double-hung sash, its casing, and a sill shaped like a Doric capital ----
  // Jamb liners line the opening; the casing frames it on the room side with a capped head
  const trim = [
    box(0.1, win.h, 0.012, [-2.0, win.y, z0 + 0.006]), box(0.1, win.h, 0.012, [-2.0, win.y, z1 - 0.006]),
    box(0.1, 0.012, win.w, [-2.0, y1 - 0.006, win.z]),
    box(0.022, win.h + 0.1, 0.09, [-1.94, (y0 + y1 + 0.1) / 2, z0 - 0.045]), box(0.022, win.h + 0.1, 0.09, [-1.94, (y0 + y1 + 0.1) / 2, z1 + 0.045]),
    box(0.026, 0.11, win.w + 0.22, [-1.938, y1 + 0.055, win.z]), box(0.04, 0.025, win.w + 0.27, [-1.93, y1 + 0.122, win.z]),
  ];

  // The sill: a squat Doric capital half sunk in the wall, its slab running back to the sash
  trim.push(place(capital(DORIC, { x: -1.95, za: z0 - NECK, zb: z1 + NECK, y: y0, back: 0.1 })));

  // Two sashes on their tracks; the lower one is raised a little, so the window is open at the bottom
  const lift = 0.13, mid = y0 + win.h / 2, sw2 = 0.045, sashes = [], panes = [];
  const sash = (x, bottom, top, meet) => {
    const h = top - bottom, cy = (bottom + top) / 2;
    sashes.push(box(0.03, sw2, win.w - 0.02, [x, top - sw2 / 2, win.z]), box(0.03, meet ? 0.05 : sw2, win.w - 0.02, [x, bottom + (meet ? 0.025 : sw2 / 2), win.z]),
      box(0.03, h, sw2, [x, cy, z0 + 0.01 + sw2 / 2]), box(0.03, h, sw2, [x, cy, z1 - 0.01 - sw2 / 2]));
    panes.push(place(new T.PlaneGeometry(win.w - 0.02 - 2 * sw2, h - 2 * sw2), { p: [x, cy, win.z], r: [0, Math.PI / 2, 0] }));
  };
  sash(-2.028, mid - 0.025, y1, true);
  sash(-1.992, y0 + lift, mid + 0.025 + lift, false);
  add(merged([...trim, ...sashes], shiny(0.35, { color: WINDOW_TRIM, roughness: 0.5 })));
  add(merged(panes, standard({ color: "#DCEBF2", roughness: 0.05, transparent: true, opacity: 0.08, depthWrite: false })));
  add(merged([box(0.012, 0.012, 0.05, [-1.975, mid + lift + 0.03, win.z]), box(0.014, 0.01, 0.06, [-1.973, y0 + lift + 0.02, win.z - 0.3]),
    box(0.014, 0.01, 0.06, [-1.973, y0 + lift + 0.02, win.z + 0.3])], shiny(1, { color: BRASS, metalness: 0.7, roughness: 0.3 })));

  // ---- The carved sign above the window, hung a hair off level ----
  const sw3 = 0.78, sh3 = 0.2, plaque = new T.Shape();
  signOutline(sw3, sh3).forEach(([x, y], i) => plaque[i ? "lineTo" : "moveTo"](x, y));
  const signAt = { p: [-1.95, y1 + 0.255, win.z + 0.01], r: [0.012, Math.PI / 2, 0], order: "YXZ" };
  add(merged([place(new T.ExtrudeGeometry(plaque, { depth: 0.016, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 1 }), signAt)],
    standard({ color: "#5E3D24", map: grain(13), roughness: 0.6 })));
  const face = new T.CanvasTexture(paintSign(512, sw3, sh3));
  face.colorSpace = T.SRGBColorSpace;
  const signFace = place(new T.PlaneGeometry(sw3, sh3), { p: [0, 0, 0.0225] });
  add(merged([place(signFace, signAt)], standard({ map: face, roughness: 0.55, alphaTest: 0.5 })));

  // ---- Wainscot, and the green trim: baseboards, chair rail, and crown moulding ----
  // Each run is [length, center x, center z, turn]; the panels face into the room. Every wall
  // gets a whole number of equal panels, so each starts and ends with a full one, and the
  // raised fields are real geometry, so each wall shades from the light it actually gets
  const runs = [[3.9, 0, -ROOM.z, 0], [4.9, ROOM.x, 0, -Math.PI / 2], [4.9, -ROOM.x, 0, Math.PI / 2], [3.9, 0, ROOM.z, Math.PI]];
  const inward = (x, z, t, d) => [x + Math.sin(t) * d, z + Math.cos(t) * d];
  const panels = [], dark = [], light = [];
  for (const [len, x, z, t] of runs) {
    const [px, pz] = inward(x, z, t, 0.004);
    panels.push(place(new T.PlaneGeometry(len, RAIL - BASE), { p: [px, (RAIL + BASE) / 2, pz], r: [0, t, 0], uv: [len, RAIL - BASE] }));
    const n = Math.max(1, Math.round(len / 0.62)), pw = len / n, ph = RAIL - BASE - 0.13;
    for (let i = 0; i < n; i++) {
      // A raised field: a white face on four green bevels that slope back to the wall
      const along = -len / 2 + pw * (i + 0.5), [fx, fz] = inward(x, z, t, 0.004);
      const at = { p: [fx + Math.cos(t) * along, (RAIL + BASE) / 2, fz - Math.sin(t) * along], r: [0, t, 0] };
      const { face, sides } = raised(pw - 0.08, ph + 0.02, 0.04, 0.026);
      panels.push(place(face, at)); dark.push(place(sides, at));
    }
    const strip = (h, d, y, list) => { const [sx, sz] = inward(x, z, t, d / 2); list.push(place(new T.BoxGeometry(len, h, d), { p: [sx, y, sz], r: [0, t, 0] })); };
    strip(BASE, 0.02, BASE / 2, dark); strip(0.014, 0.03, BASE + 0.007, dark);
    strip(0.035, 0.026, RAIL, light); strip(0.012, 0.034, RAIL + 0.02, light);
    strip(0.1, 0.022, ROOM.h - 0.05, light); strip(0.035, 0.05, ROOM.h - 0.0175, light); strip(0.012, 0.03, ROOM.h - 0.106, dark);
  }
  add(merged(panels, standard({ color: WALL, map: plaster(), normalMap: photo("plaster-normal", [1, 1]), normalScale: new T.Vector2(0.3, 0.3), roughness: 0.75 })));
  add(merged(dark, standard({ color: BRAND, roughness: 0.55 })));
  add(merged(light, standard({ color: MARK, roughness: 0.55 })));

  // ---- The rug, and soft shadows where things meet ----
  // The rug: one thick slab whose top carries a fibre normal map over the heathered wool, so the
  // pile reads as soft carpet without layers of geometry; each foot leaves a soft contact shadow
  const RUG = { x: 0.06, z: -1.35, w: 3.0, d: 1.9 }, SLAB = 0.024, feet = [];
  for (const [lx, lz] of [[-0.43, -0.22], [0.43, -0.22], [-0.43, 0.22], [0.43, 0.22]]) feet.push([sc.x + 0.06 + lx, -1.98 + lz, 0.016]);
  for (const [x, z, t] of CHAIRS) for (const [lx, lz] of CHAIR_LEGS) {
    feet.push([x + lx * Math.cos(t) + lz * Math.sin(t), z - lx * Math.sin(t) + lz * Math.cos(t), 0.022]);
  }
  const onRug = feet.filter(([fx, fz]) => Math.abs(fx - RUG.x) < RUG.w / 2 - 0.05 && Math.abs(fz - RUG.z) < RUG.d / 2 - 0.05);
  const pile = photo("carpet-normal", [7, 4.5]);
  add(merged([place(new T.RoundedBoxGeometry(RUG.w, SLAB, RUG.d, 2, 0.01), { p: [RUG.x, SLAB / 2, RUG.z] })],
    standard({ map: rug(), normalMap: pile, normalScale: new T.Vector2(0.9, 0.9), roughness: 0.95 })));
  add(merged(onRug.map(([fx, fz, f]) => place(new T.PlaneGeometry(f * 4.5, f * 4.5), { p: [fx, SLAB + 0.002, fz], r: [-Math.PI / 2, 0, 0] })),
    new T.MeshBasicMaterial({ map: shadow(), transparent: true, depthWrite: false })));
  const ao = [];
  for (const [len, x, z, t] of runs) {
    const [px, pz] = inward(x, z, t, 0.17);
    ao.push(place(new T.PlaneGeometry(len, 0.34), { p: [px, 0.002, pz], r: [-Math.PI / 2, t, 0], order: "YXZ" }));
  }
  // The wall darkens a little under the sill's neck
  ao.push(place(new T.PlaneGeometry(win.w + 2 * NECK + 0.06, 0.06), { p: [-1.948, y0 - 0.092, win.z], r: [0, Math.PI / 2, 0] }));
  add(merged(ao, new T.MeshBasicMaterial({ map: edge(), transparent: true, depthWrite: false })));
  const blobs = [place(new T.PlaneGeometry(1.25, 0.82), { p: [0.06, 0.026, -1.98], r: [-Math.PI / 2, 0, 0] })];
  for (const [x, z, t] of CHAIRS) blobs.push(place(new T.PlaneGeometry(1.05, 1.0), { p: [x, 0.026, z], r: [-Math.PI / 2, t, 0], order: "YXZ" }));
  add(merged(blobs, new T.MeshBasicMaterial({ map: shadow(true), transparent: true, depthWrite: false })));

  // ---- The table: a low walnut side table with turned legs ----
  const tx = sc.x + 0.06, tz = -1.98, top = 0.22;
  const table = [place(new T.RoundedBoxGeometry(0.98, 0.035, 0.56, 2, 0.012), { p: [tx, top - 0.0175, tz] })];
  for (const [lx, lz] of [[-0.43, -0.22], [0.43, -0.22], [-0.43, 0.22], [0.43, 0.22]]) {
    table.push(place(turned([[0.014, 0], [0.017, 0.02], [0.013, 0.05], [0.022, 0.11], [0.02, 0.15], [0.025, 0.16], [0.025, top - 0.035], [0, top - 0.035]]), { p: [tx + lx, 0, tz + lz] }));
  }
  table.push(box(0.84, 0.05, 0.02, [tx, top - 0.06, tz - 0.22]), box(0.84, 0.05, 0.02, [tx, top - 0.06, tz + 0.22]),
    box(0.02, 0.05, 0.42, [tx - 0.43, top - 0.06, tz]), box(0.02, 0.05, 0.42, [tx + 0.43, top - 0.06, tz]));
  add(merged(table, shiny(0.6, { color: DARK_WOOD, map: wood, roughness: 0.4 })));
  add(merged([place(new T.PlaneGeometry(0.92, 0.42), { p: [tx, top + 0.001, tz - 0.02], r: [-Math.PI / 2, 0, 0] })],
    new T.MeshBasicMaterial({ map: shadow(true), transparent: true, depthWrite: false })));

  // ---- The TV: a deep walnut cabinet, a tapered bakelite back with vents, and an ivory bezel ----
  // The screen itself belongs to the scene; this builds everything around it
  const front = sc.z - 0.01, cx = sc.x + 0.06, cy = sc.y - 0.005, cw = 0.8, ch = 0.52, cd = 0.3;
  add(merged([place(new T.RoundedBoxGeometry(cw, ch, cd, 4, 0.05), { p: [cx, cy, front - cd / 2] })],
    shiny(0.9, { color: WALNUT, map: wood, roughness: 0.42, clearcoat: 0.7, clearcoatRoughness: 0.22 }, T.MeshPhysicalMaterial)));

  // The tube's housing narrows toward the back: a four-sided frustum, wide side forward
  const back = new T.CylinderGeometry(0.57 / Math.SQRT2, 1 / Math.SQRT2, 0.22, 4, 1);
  back.rotateY(Math.PI / 4); back.rotateX(-Math.PI / 2);
  const bakelite = [place(back, { p: [cx, cy, front - cd - 0.11], s: [0.72, 0.44, 1] })];
  add(merged([place(new T.PlaneGeometry(0.32, 0.16), { p: [cx, cy, front - cd - 0.221], r: [0, Math.PI, 0] })], standard({ map: vents(), roughness: 0.6 })));

  // Bezel with a rounded opening a touch larger than the screen, since its bevel leans inward
  const bev = 0.006, outline = rounded(new T.Shape(), 0.56, 0.44, 0.07);
  outline.holes.push(rounded(new T.Shape(), sw + 2 * bev, sh + 2 * bev, 0.035 + bev));
  const bezel = new T.ExtrudeGeometry(outline, { depth: 0.01, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 2, curveSegments: 10 });
  const ivory = [place(bezel, { p: [sc.x, sc.y, front + bev] })];
  // Two deep knobs: a dark skirt, a fluted ivory body with a rounded face and a pointer ridge, and a brass cap
  const brass = [];
  for (const [ky, turn] of [[0.125, 0.6], [0.025, -0.9]]) {
    const at = { p: [cx + 0.3, cy + ky, front], r: [Math.PI / 2, turn, 0] };
    bakelite.push(place(turned([[0, 0], [0.034, 0], [0.034, 0.004], [0.03, 0.007], [0, 0.007]], 24), at));
    ivory.push(place(knob(), at), place(new T.BoxGeometry(0.004, 0.012, 0.004), { p: [cx + 0.3 + Math.sin(turn) * 0.013, cy + ky + Math.cos(turn) * 0.013, front + 0.0295], r: [0, 0, -turn] }));
    brass.push(place(turned([[0, 0], [0.009, 0], [0.009, 0.002], [0.006, 0.004], [0, 0.0045]], 16), { ...at, p: [cx + 0.3, cy + ky, front + 0.031] }));
  }
  add(merged(ivory, shiny(0.8, { color: IVORY, roughness: 0.26 })));
  add(merged(bakelite, shiny(0.6, { color: BAKELITE, roughness: 0.4 })));

  // A dark gap behind the screen's edge, seen at a slant
  add(merged([place(new T.PlaneGeometry(sw + 0.02, sh + 0.02), { p: [sc.x, sc.y, sc.z - 0.004] })], new T.MeshBasicMaterial({ color: "#050403" })));

  // Speaker grille, brass trim, and bun feet
  add(merged([place(new T.PlaneGeometry(0.15, 0.13), { p: [cx + 0.3, cy - 0.12, front + 0.001] })], standard({ map: grille(), roughness: 0.6 })));
  for (let k = 0; k < 9; k++) brass.push(place(new T.CylinderGeometry(0.0025, 0.0025, 0.15, 6), { p: [cx + 0.3, cy - 0.064 - k * 0.0139, front + 0.004], r: [0, 0, Math.PI / 2] }));
  brass.push(box(0.162, 0.006, 0.006, [cx + 0.3, cy - 0.052, front + 0.002]), box(0.162, 0.006, 0.006, [cx + 0.3, cy - 0.188, front + 0.002]),
    box(0.006, 0.142, 0.006, [cx + 0.219, cy - 0.12, front + 0.002]), box(0.006, 0.142, 0.006, [cx + 0.381, cy - 0.12, front + 0.002]),
    box(0.62, 0.005, 0.004, [cx - 0.06, cy - ch / 2 + 0.03, front + 0.001]));
  for (const [fx, fz] of [[-0.34, -0.04], [0.34, -0.04], [-0.34, -0.26], [0.34, -0.26]]) {
    brass.push(place(turned([[0.016, 0], [0.02, 0.01], [0.016, cy - ch / 2 - top], [0, cy - ch / 2 - top]]), { p: [cx + fx, top, front + fz] }));
  }
  add(merged(brass, shiny(1, { color: BRASS, metalness: 0.75, roughness: 0.3 })));

  // A seat cushion that has been sat in: its top dips toward the middle
  const sag = (geo) => {
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) / 0.28, z = (pos.getZ(i) - 0.07) / 0.3;
      if (pos.getY(i) > 0.46) pos.setY(i, pos.getY(i) - 0.018 * Math.max(0, 1 - x * x) * Math.max(0, 1 - z * z));
    }
    geo.computeVertexNormals();
    return geo;
  };

  // ---- Two wingback armchairs, built facing +z, then turned toward the space in front of the set ----
  // Inside, the seat, a deck under it, and a block behind it close every gap, so each chair is one
  // upholstered piece; carved posts under the arms run down into the front legs
  const tuft = tufting(), rb = (w, h, d, seg, rad, o) => place(new T.RoundedBoxGeometry(w, h, d, seg, rad), o);
  const chair = { tufted: [], plain: [], wood: [] };
  chair.tufted.push(
    rb(0.66, 0.72, 0.16, 3, 0.06, { p: [0, 0.78, -0.3], r: [-0.12, 0, 0], uv: [0.9, 1.0] }),
    rb(0.15, 0.48, 0.36, 3, 0.06, { p: [-0.37, 0.9, -0.17], r: [0, 0.22, 0], uv: [0.5, 0.7] }),
    rb(0.15, 0.48, 0.36, 3, 0.06, { p: [0.37, 0.9, -0.17], r: [0, -0.22, 0], uv: [0.5, 0.7] }));
  chair.plain.push(
    rb(0.84, 0.22, 0.78, 2, 0.04, { p: [0, 0.28, 0] }),
    rb(0.64, 0.1, 0.72, 2, 0.03, { p: [0, 0.4, 0.0] }),
    rb(0.64, 0.14, 0.16, 2, 0.04, { p: [0, 0.44, -0.27] }),
    sag(rb(0.6, 0.12, 0.6, 3, 0.05, { p: [0, 0.45, 0.07] })),
    rb(0.13, 0.2, 0.66, 3, 0.05, { p: [-0.36, 0.48, -0.01] }), rb(0.13, 0.2, 0.66, 3, 0.05, { p: [0.36, 0.48, -0.01] }),
    place(new T.CylinderGeometry(0.075, 0.075, 0.64, 14), { p: [-0.37, 0.6, -0.01], r: [Math.PI / 2, 0, 0] }),
    place(new T.CylinderGeometry(0.075, 0.075, 0.64, 14), { p: [0.37, 0.6, -0.01], r: [Math.PI / 2, 0, 0] }));
  // Wood below each arm, as on the real chair: the panther's head at the front of the armrest,
  // its neck curving down and out into the front post and on into a bulbous turned leg, a carved
  // side panel, and a squared back leg that kicks back a little
  const leg = [[0.022, 0], [0.026, 0.014], [0.02, 0.034], [0.037, 0.074], [0.031, 0.11], [0.037, 0.14], [0.034, 0.17], [0, 0.17]];
  for (const k of [-1, 1]) {
    const [fx, fz] = CHAIR_LEGS[k < 0 ? 0 : 1], [bx, bz] = CHAIR_LEGS[k < 0 ? 2 : 3];
    chair.wood.push(place(turned(leg, 14), { p: [fx, 0, fz] }),
      swept([[bx, 0.17, bz + 0.035], [bx, 0.09, bz + 0.012], [bx, 0, bz]], [0.044, 0.044], [0.032, 0.032], 8, 16),
      swept([[k * 0.372, 0.58, 0.38], [k * 0.384, 0.53, 0.405], [k * 0.39, 0.42, 0.412], [k * 0.39, 0.28, 0.4], [fx, 0.165, fz]], [0.074, 0.07], [0.068, 0.062]),
      rb(0.082, 0.03, 0.078, 1, 0.006, { p: [fx, 0.185, fz] }),
      rb(0.024, 0.39, 0.74, 1, 0.006, { p: [k * 0.432, 0.34, -0.01] }),
      place(turned([[0, 0], [0.081, 0], [0.084, 0.02], [0.08, 0.05], [0.066, 0.075], [0, 0.078]], 20), { p: [k * 0.37, 0.6, 0.3], r: [Math.PI / 2, 0, 0] }),
      place(panther(touch ? 36 : 56), { p: [k * 0.37, 0.6, 0.4] }));
    const { face, sides } = raised(0.58, 0.24, 0.022, 0.01);
    for (const g of [face, sides]) chair.wood.push(place(g, { p: [k * 0.444, 0.34, -0.01], r: [0, k * Math.PI / 2, 0] }));
  }
  // Each chair takes its own leather: the left one redder, the right darker and duller toward the top,
  // both mottled where years of hands and sun have worked at them
  const tone = (geo, k) => {
    const pos = geo.attributes.position, col = [];
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const mottle = 0.86 + 0.14 * Math.sin(x * 23 + z * 7) * Math.sin(y * 19 - x * 11) + 0.08 * Math.sin(z * 41 + y * 29);
      const age = k ? 1 - 0.42 * Math.min(1, Math.max(0, (y - 0.45) / 0.65)) : 1;
      const [r, g, b] = k ? [0.86, 0.8, 0.76] : [1.22, 0.86, 0.8];
      col.push(r * mottle * age, g * mottle * age * (k ? 0.96 + 0.04 * age : 1), b * mottle * age);
    }
    geo.setAttribute("color", new T.Float32BufferAttribute(col, 3));
    return geo;
  };
  const both = (parts, tinted = false) => CHAIRS.flatMap(([x, z, t], k) => moved(parts.map((g) => (tinted ? tone(g.clone(), k) : g.clone())), { p: [x, 0, z], r: [0, t, 0] }));
  const leather = { color: LEATHER, vertexColors: true, roughness: 0.62 };
  add(merged(both(chair.tufted, true), shiny(0.3, { ...leather, map: tuft.color, normalMap: tuft.normal, normalScale: new T.Vector2(0.9, 0.9) })));
  add(merged(both(chair.plain, true), shiny(0.3, { ...leather, map: photo("leather-detail", [2.5, 2.5], true), normalMap: photo("leather-normal", [2.5, 2.5]), normalScale: new T.Vector2(0.8, 0.8) })));
  chair.wood.forEach((g) => { if (!g.attributes.color) g.setAttribute("color", new T.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 3).fill(1), 3)); });
  add(merged(both(chair.wood), shiny(0.7, { color: "#7A563C", map: photo("walnut-color", [2, 2], true), normalMap: photo("walnut-normal", [2, 2]), roughness: 0.38, vertexColors: true })));
  Object.values(chair).flat().forEach((g) => g.dispose());
  return { glossy, ready: Promise.all(loads) };
}
