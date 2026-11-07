// src/app/public/js/white-rabbit-room.js - The white rabbit's room: the TV, its table, two wingback chairs, and the walls.
// Usage: furnish(scene, { win, sc, sw, sh })
//
// Imported by white-rabbit-scene.js. Everything is built in code, with small textures
// painted on canvases once: wood grain, oak planks, plaster, a rug,
// tufted leather, a speaker grille, and vents. Parts that share a material are merged
// into one mesh, so the whole room draws in about twenty calls, phones included.

import * as T from "/js/vendor/three-0.187.0.rabbit.min.js";


// Palette: pale walls with the brand greens as trim, walnut and bakelite for the set, oxblood leather
const WALL = "#EEF0EC", CEILING = "#F5F6F3", WINDOW_TRIM = "#E8ECE8", BRAND = "#035704", MARK = "#327641";
const WALNUT = "#8A5A34", DARK_WOOD = "#6A4426", LEG_WOOD = "#3A2416", BAKELITE = "#3E2B1E", IVORY = "#D9CCAA";
const BRASS = "#A8834E", LEATHER = "#5C2C20";

// The room's inside faces, the height of the wainscot, and where the chairs sit (x, z, turn)
const ROOM = { x: 1.95, z: 2.45, h: 2.6 };
const RAIL = 0.8, BASE = 0.13;
const CHAIRS = [[-1.14, -1.5, 0.52], [1.26, -1.5, -0.52]];

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

// Pale oak planks running along x, with seams, staggered end joints, and grain
function planks() {
  const r = seeded(7);
  return painted(512, 512, (g, w, h) => {
    const rows = 4, ph = h / rows;
    for (let i = 0; i < rows; i++) {
      for (let x = -r() * 200, len; x < w; x += len) {
        len = 180 + r() * 220;
        const l = 78 + r() * 7;
        g.fillStyle = `hsl(34, ${22 + r() * 8}%, ${l}%)`; g.fillRect(x, i * ph, len, ph);
        for (let k = 0; k < 14; k++) {
          const y = i * ph + r() * ph;
          g.strokeStyle = `rgba(110, 80, 50, ${0.05 + r() * 0.08})`; g.lineWidth = 0.6 + r();
          g.beginPath(); g.moveTo(x, y); g.bezierCurveTo(x + len / 3, y + r() * 6 - 3, x + len * 0.66, y + r() * 6 - 3, x + len, y); g.stroke();
        }
        g.fillStyle = "rgba(70, 50, 30, .35)"; g.fillRect(x, i * ph, 1.5, ph);
      }
      g.fillStyle = "rgba(70, 50, 30, .4)"; g.fillRect(0, i * ph, w, 1.5);
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
  });
}

// A soft wool rug: warm pale grey, a quiet speckle, and two thin green borders
function rug() {
  const r = seeded(5);
  return painted(512, 320, (g, w, h) => {
    g.fillStyle = "#E3E0D6"; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 5000; i++) { g.fillStyle = `rgba(80,70,50,${r() * 0.06})`; g.fillRect(r() * w, r() * h, 1.5, 1.5); }
    g.globalAlpha = 0.55;
    g.strokeStyle = MARK; g.lineWidth = 5; g.strokeRect(22, 22, w - 44, h - 44);
    g.strokeStyle = BRAND; g.lineWidth = 1.5; g.strokeRect(36, 36, w - 72, h - 72);
  });
}

// The speaker grille: dark cloth behind thin brass slats
function grille() {
  return painted(128, 128, (g, w, h) => {
    g.fillStyle = "#2A2018"; g.fillRect(0, 0, w, h);
    for (let y = 6; y < h; y += 12) { g.fillStyle = "#B8935A"; g.fillRect(0, y, w, 4); g.fillStyle = "rgba(0,0,0,.4)"; g.fillRect(0, y + 4, w, 2); }
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

// A rounded rectangle path, centered
function rounded(shape, w, h, r) {
  const x = -w / 2, y = -h / 2;
  shape.moveTo(x + r, y); shape.lineTo(x + w - r, y); shape.quadraticCurveTo(x + w, y, x + w, y + r);
  shape.lineTo(x + w, y + h - r); shape.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  shape.lineTo(x + r, y + h); shape.quadraticCurveTo(x, y + h, x, y + h - r);
  shape.lineTo(x, y + r); shape.quadraticCurveTo(x, y, x + r, y);
  return shape;
}


/** Builds the room around the window `win` and the TV whose screen (sw by sh) is centered at `sc` */
export function furnish(scene, { win, sc, sw, sh }) {
  const wood = grain(1), lambert = (o) => new T.MeshLambertMaterial(o), standard = (o) => new T.MeshStandardMaterial(o);
  // Lit meshes cast and take the window light's shadows; glass and the painted shadows don't
  const add = (mesh) => {
    const lit = !mesh.material.isMeshBasicMaterial && !mesh.material.transparent;
    mesh.castShadow = mesh.receiveShadow = lit;
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
  ], lambert({ color: WALL, map: plaster() })));
  add(merged([box(4, 0.02, 5, [0, 2.61, 0])], lambert({ color: CEILING })));
  add(merged([place(new T.PlaneGeometry(4, 5), { r: [-Math.PI / 2, 0, 0], uv: [4 / 2.4, 5 / 0.6] })], lambert({ map: planks() })));

  // ---- The window: an inset double-hung sash, its casing, and a sill shaped like a squat capital ----
  // Jamb liners line the opening; the casing frames it on the room side with a capped head
  const trim = [
    box(0.1, win.h, 0.012, [-2.0, win.y, z0 + 0.006]), box(0.1, win.h, 0.012, [-2.0, win.y, z1 - 0.006]),
    box(0.1, 0.012, win.w, [-2.0, y1 - 0.006, win.z]),
    box(0.022, win.h + 0.1, 0.09, [-1.94, (y0 + y1 + 0.1) / 2, z0 - 0.045]), box(0.022, win.h + 0.1, 0.09, [-1.94, (y0 + y1 + 0.1) / 2, z1 + 0.045]),
    box(0.026, 0.11, win.w + 0.22, [-1.938, y1 + 0.055, win.z]), box(0.04, 0.025, win.w + 0.27, [-1.93, y1 + 0.122, win.z]),
    box(0.02, 0.07, win.w + 0.16, [-1.94, y0 - 0.095, win.z]),
  ];

  // The sill: a flat top that rolls over into a curve, then steps down twice toward the wall
  const sill = new T.Shape();
  sill.moveTo(-0.1, 0); sill.lineTo(0.07, 0); sill.quadraticCurveTo(0.09, -0.012, 0.045, -0.034);
  sill.lineTo(0.045, -0.044); sill.lineTo(0.028, -0.044); sill.lineTo(0.028, -0.06); sill.lineTo(-0.1, -0.06); sill.closePath();
  trim.push(place(new T.ExtrudeGeometry(sill, { depth: win.w + 0.26, bevelEnabled: false, curveSegments: 8 }), { p: [-1.95, y0, z0 - 0.13] }));

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
  add(merged([...trim, ...sashes], standard({ color: WINDOW_TRIM, roughness: 0.5 })));
  add(merged(panes, standard({ color: "#DCEBF2", roughness: 0.05, transparent: true, opacity: 0.08, depthWrite: false })));
  add(merged([box(0.012, 0.012, 0.05, [-1.975, mid + lift + 0.03, win.z]), box(0.014, 0.01, 0.06, [-1.973, y0 + lift + 0.02, win.z - 0.3]),
    box(0.014, 0.01, 0.06, [-1.973, y0 + lift + 0.02, win.z + 0.3])], standard({ color: BRASS, metalness: 0.7, roughness: 0.3 })));

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
      const along = -len / 2 + pw * (i + 0.5), [fx, fz] = inward(x, z, t, 0.013);
      panels.push(place(new T.RoundedBoxGeometry(pw - 0.13, ph, 0.022, 2, 0.008), {
        p: [fx + Math.cos(t) * along, (RAIL + BASE) / 2, fz - Math.sin(t) * along], r: [0, t, 0], uv: [pw, ph] }));
    }
    const strip = (h, d, y, list) => { const [sx, sz] = inward(x, z, t, d / 2); list.push(place(new T.BoxGeometry(len, h, d), { p: [sx, y, sz], r: [0, t, 0] })); };
    strip(BASE, 0.02, BASE / 2, dark); strip(0.014, 0.03, BASE + 0.007, dark);
    strip(0.035, 0.026, RAIL, light); strip(0.012, 0.034, RAIL + 0.02, light);
    strip(0.1, 0.022, ROOM.h - 0.05, light); strip(0.035, 0.05, ROOM.h - 0.0175, light); strip(0.012, 0.03, ROOM.h - 0.106, dark);
  }
  add(merged(panels, standard({ color: WALL, map: plaster(), roughness: 0.75 })));
  add(merged(dark, standard({ color: BRAND, roughness: 0.55 })));
  add(merged(light, standard({ color: MARK, roughness: 0.55 })));

  // ---- The rug, and soft shadows where things meet ----
  add(merged([place(new T.PlaneGeometry(3.0, 1.9), { p: [0.06, 0.004, -1.35], r: [-Math.PI / 2, 0, 0] })], lambert({ map: rug() })));
  const ao = [];
  for (const [len, x, z, t] of runs) {
    const [px, pz] = inward(x, z, t, 0.17);
    ao.push(place(new T.PlaneGeometry(len, 0.34), { p: [px, 0.002, pz], r: [-Math.PI / 2, t, 0], order: "YXZ" }));
  }
  add(merged(ao, new T.MeshBasicMaterial({ map: edge(), transparent: true, depthWrite: false })));
  const blobs = [place(new T.PlaneGeometry(1.25, 0.82), { p: [0.06, 0.006, -1.98], r: [-Math.PI / 2, 0, 0] })];
  for (const [x, z, t] of CHAIRS) blobs.push(place(new T.PlaneGeometry(1.05, 1.0), { p: [x, 0.006, z], r: [-Math.PI / 2, t, 0], order: "YXZ" }));
  add(merged(blobs, new T.MeshBasicMaterial({ map: shadow(true), transparent: true, depthWrite: false })));

  // ---- The table: a low walnut side table with turned legs ----
  const tx = sc.x + 0.06, tz = -1.98, top = 0.22;
  const table = [place(new T.RoundedBoxGeometry(0.98, 0.035, 0.56, 2, 0.012), { p: [tx, top - 0.0175, tz] })];
  for (const [lx, lz] of [[-0.43, -0.22], [0.43, -0.22], [-0.43, 0.22], [0.43, 0.22]]) {
    table.push(place(turned([[0.014, 0], [0.017, 0.02], [0.013, 0.05], [0.022, 0.11], [0.02, 0.15], [0.025, 0.16], [0.025, top - 0.035], [0, top - 0.035]]), { p: [tx + lx, 0, tz + lz] }));
  }
  table.push(box(0.84, 0.05, 0.02, [tx, top - 0.06, tz - 0.22]), box(0.84, 0.05, 0.02, [tx, top - 0.06, tz + 0.22]),
    box(0.02, 0.05, 0.42, [tx - 0.43, top - 0.06, tz]), box(0.02, 0.05, 0.42, [tx + 0.43, top - 0.06, tz]));
  add(merged(table, standard({ color: DARK_WOOD, map: wood, roughness: 0.45 })));
  add(merged([place(new T.PlaneGeometry(0.92, 0.42), { p: [tx, top + 0.001, tz - 0.02], r: [-Math.PI / 2, 0, 0] })],
    new T.MeshBasicMaterial({ map: shadow(true), transparent: true, depthWrite: false })));

  // ---- The TV: a deep walnut cabinet, a tapered bakelite back with vents, and an ivory bezel ----
  // The screen itself belongs to the scene; this builds everything around it
  const front = sc.z - 0.01, cx = sc.x + 0.06, cy = sc.y - 0.005, cw = 0.8, ch = 0.52, cd = 0.3;
  add(merged([place(new T.RoundedBoxGeometry(cw, ch, cd, 4, 0.05), { p: [cx, cy, front - cd / 2] })],
    standard({ color: WALNUT, map: wood, roughness: 0.38 })));

  // The tube's housing narrows toward the back: a four-sided frustum, wide side forward
  const back = new T.CylinderGeometry(0.57 / Math.SQRT2, 1 / Math.SQRT2, 0.22, 4, 1);
  back.rotateY(Math.PI / 4); back.rotateX(-Math.PI / 2);
  add(merged([place(back, { p: [cx, cy, front - cd - 0.11], s: [0.72, 0.44, 1] })], standard({ color: BAKELITE, roughness: 0.55 })));
  add(merged([place(new T.PlaneGeometry(0.32, 0.16), { p: [cx, cy, front - cd - 0.221], r: [0, Math.PI, 0] })], standard({ map: vents(), roughness: 0.6 })));

  // Bezel with a rounded opening a touch larger than the screen, since its bevel leans inward
  const bev = 0.006, outline = rounded(new T.Shape(), 0.56, 0.44, 0.07);
  outline.holes.push(rounded(new T.Shape(), sw + 2 * bev, sh + 2 * bev, 0.035 + bev));
  const bezel = new T.ExtrudeGeometry(outline, { depth: 0.01, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 2, curveSegments: 10 });
  const ivory = [place(bezel, { p: [sc.x, sc.y, front + bev] })];
  for (const ky of [0.125, 0.025]) {
    ivory.push(place(turned([[0, 0], [0.027, 0], [0.029, 0.006], [0.027, 0.018], [0.019, 0.027], [0, 0.029]], 18), { p: [cx + 0.3, cy + ky, front], r: [Math.PI / 2, 0, 0] }));
  }
  add(merged(ivory, standard({ color: IVORY, roughness: 0.32 })));

  // A dark gap behind the screen's edge, seen at a slant
  add(merged([place(new T.PlaneGeometry(sw + 0.02, sh + 0.02), { p: [sc.x, sc.y, sc.z - 0.004] })], new T.MeshBasicMaterial({ color: "#050403" })));

  // Speaker grille, brass trim, and bun feet
  add(merged([place(new T.PlaneGeometry(0.15, 0.13), { p: [cx + 0.3, cy - 0.12, front + 0.001] })], standard({ map: grille(), roughness: 0.6 })));
  const brass = [box(0.162, 0.006, 0.006, [cx + 0.3, cy - 0.052, front + 0.002]), box(0.162, 0.006, 0.006, [cx + 0.3, cy - 0.188, front + 0.002]),
    box(0.006, 0.142, 0.006, [cx + 0.219, cy - 0.12, front + 0.002]), box(0.006, 0.142, 0.006, [cx + 0.381, cy - 0.12, front + 0.002]),
    box(0.62, 0.005, 0.004, [cx - 0.06, cy - ch / 2 + 0.03, front + 0.001])];
  for (const [fx, fz] of [[-0.34, -0.04], [0.34, -0.04], [-0.34, -0.26], [0.34, -0.26]]) {
    brass.push(place(turned([[0.016, 0], [0.02, 0.01], [0.016, cy - ch / 2 - top], [0, cy - ch / 2 - top]]), { p: [cx + fx, top, front + fz] }));
  }
  add(merged(brass, standard({ color: BRASS, metalness: 0.6, roughness: 0.35 })));

  // ---- Two wingback armchairs, built facing +z, then turned toward the space in front of the set ----
  const tuft = tufting(), rb = (w, h, d, seg, rad, o) => place(new T.RoundedBoxGeometry(w, h, d, seg, rad), o);
  const chair = { tufted: [], plain: [], wood: [] };
  chair.tufted.push(
    rb(0.66, 0.72, 0.16, 3, 0.06, { p: [0, 0.78, -0.3], r: [-0.12, 0, 0], uv: [0.9, 1.0] }),
    rb(0.15, 0.48, 0.36, 3, 0.06, { p: [-0.37, 0.9, -0.17], r: [0, 0.22, 0], uv: [0.5, 0.7] }),
    rb(0.15, 0.48, 0.36, 3, 0.06, { p: [0.37, 0.9, -0.17], r: [0, -0.22, 0], uv: [0.5, 0.7] }));
  chair.plain.push(
    rb(0.84, 0.22, 0.78, 2, 0.04, { p: [0, 0.28, 0] }),
    rb(0.56, 0.12, 0.6, 3, 0.05, { p: [0, 0.45, 0.07] }),
    rb(0.13, 0.2, 0.72, 3, 0.05, { p: [-0.36, 0.48, 0.02] }), rb(0.13, 0.2, 0.72, 3, 0.05, { p: [0.36, 0.48, 0.02] }),
    place(new T.CylinderGeometry(0.075, 0.075, 0.7, 14), { p: [-0.37, 0.6, 0.02], r: [Math.PI / 2, 0, 0] }),
    place(new T.CylinderGeometry(0.075, 0.075, 0.7, 14), { p: [0.37, 0.6, 0.02], r: [Math.PI / 2, 0, 0] }));
  const leg = [[0.02, 0], [0.024, 0.015], [0.018, 0.04], [0.03, 0.08], [0.026, 0.12], [0.032, 0.15], [0.032, 0.17], [0, 0.17]];
  for (const [lx, lz] of [[-0.34, 0.31], [0.34, 0.31], [-0.34, -0.33], [0.34, -0.33]]) chair.wood.push(place(turned(leg, 12), { p: [lx, 0, lz] }));
  for (const ax of [-0.37, 0.37]) {
    chair.wood.push(rb(0.1, 0.2, 0.03, 2, 0.012, { p: [ax, 0.47, 0.385] }));
    chair.wood.push(place(turned([[0, 0], [0.05, 0], [0.06, 0.02], [0.05, 0.045], [0, 0.055]], 14), { p: [ax, 0.6, 0.39], r: [Math.PI / 2, 0, 0] }));
  }
  const both = (parts) => CHAIRS.flatMap(([x, z, t]) => moved(parts.map((g) => g.clone()), { p: [x, 0, z], r: [0, t, 0] }));
  const leather = { color: LEATHER, map: tuft.color, roughness: 0.48 };
  add(merged(both(chair.tufted), standard({ ...leather, normalMap: tuft.normal, normalScale: new T.Vector2(0.9, 0.9) })));
  add(merged(both(chair.plain), standard({ color: LEATHER, map: grain(9), roughness: 0.42 })));
  add(merged(both(chair.wood), standard({ color: LEG_WOOD, map: wood, roughness: 0.4 })));
  Object.values(chair).flat().forEach((g) => g.dispose());
}
