// src/app/public/js/white-rabbit-sign.js - The carved "Temet Nosce" plaque above the white rabbit's window.
// Usage: const c = paintSign(512); const outline = signOutline(0.62, 0.17)
//
// Shared by the 3D room and the still card. The plaque is aged wood with scalloped
// corners and a routed groove; the words are blackletter drawn with a broad pen
// along hand-built strokes, so no font file is needed.


// Letter strokes on a grid where the x-height is 5 and capitals reach 7, with each letter's advance
const GLYPHS = {
  T: [7.0, [[0.4, 6.4], [1.6, 7.2], [6.4, 7.0]], [[3.4, 7.1], [3.4, 0.6], [2.6, 0]]],
  e: [4.6, [[3.6, 4.0], [2.6, 5.0], [0.9, 4.2], [0.9, 0.9], [2.0, 0], [3.6, 0.8]], [[0.9, 2.6], [3.6, 3.4], [3.6, 4.0]]],
  m: [6.4, [[0, 4.4], [0.9, 5.0], [0.9, 0]], [[0.9, 4.4], [2.0, 5.0], [2.9, 4.4], [2.9, 0]], [[2.9, 4.4], [4.0, 5.0], [4.9, 4.4], [4.9, 0.4], [5.6, 0]]],
  t: [3.4, [[1.3, 6.2], [1.3, 0.6], [2.0, 0], [2.9, 0.6]], [[0.2, 4.7], [2.9, 4.7]]],
  N: [7.0, [[0.6, 6.4], [1.3, 7.0], [1.3, 0.6], [0.4, 0]], [[1.3, 7.0], [5.0, 0]], [[5.0, 0], [5.0, 6.6], [5.9, 7.2]]],
  o: [4.8, [[1.0, 4.4], [2.3, 5.0], [3.6, 4.4], [3.6, 0.7], [2.3, 0], [1.0, 0.6], [1.0, 4.4]]],
  s: [4.4, [[3.4, 4.6], [2.2, 5.0], [0.9, 4.2], [1.3, 3.0], [3.0, 2.0], [3.4, 0.8], [2.2, 0], [0.7, 0.6]]],
  c: [4.4, [[3.4, 4.4], [2.3, 5.0], [0.9, 4.2], [0.9, 0.8], [2.1, 0], [3.4, 0.6]]],
  " ": [2.8],
};

// Draws the words with a flat pen held at 40 degrees, stamped densely along each stroke
function letter(g, text, x, y, unit, pen) {
  const a = (40 * Math.PI) / 180;
  for (const ch of text) {
    const [adv, ...strokes] = GLYPHS[ch] || GLYPHS[" "];
    for (const s of strokes) {
      for (let i = 1; i < s.length; i++) {
        const [x0, y0] = s[i - 1], [x1, y1] = s[i], steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * unit);
        for (let k = 0; k <= steps; k++) {
          const t = k / steps;
          g.save();
          g.translate(x + (x0 + (x1 - x0) * t) * unit, y - (y0 + (y1 - y0) * t) * unit);
          g.rotate(-a);
          g.fillRect(-pen / 2, -pen * 0.09, pen, pen * 0.18);
          g.restore();
        }
      }
    }
    x += adv * unit;
  }
}

// Width of the words in grid units
const width = (text) => [...text].reduce((w, ch) => w + (GLYPHS[ch] || GLYPHS[" "])[0], 0);

/** The plaque's outline as [x, y] points, centered: a rectangle with scooped corners */
export function signOutline(w, h, steps = 8) {
  const r = h * 0.24, pts = [];
  // Each corner is a quarter circle cut inward, centered on the corner, walked counterclockwise
  const corner = (cx, cy, a, b) => {
    for (let i = 0; i <= steps; i++) { const t = a + ((b - a) * i) / steps; pts.push([cx + Math.cos(t) * r, cy + Math.sin(t) * r]); }
  };
  corner(w / 2, -h / 2, Math.PI, Math.PI / 2);
  corner(w / 2, h / 2, -Math.PI / 2, -Math.PI);
  corner(-w / 2, h / 2, 0, -Math.PI / 2);
  corner(-w / 2, -h / 2, Math.PI / 2, 0);
  return pts;
}

/** Paints the plaque, `size` pixels wide: aged wood, a routed groove, and the carved green words */
export function paintSign(size = 512, w = 0.62, h = 0.17) {
  const c = document.createElement("canvas");
  c.width = size; c.height = Math.round((size * h) / w);
  const g = c.getContext("2d"), s = size / w, W = c.width, H = c.height;
  const path = (inset) => {
    g.beginPath();
    signOutline(w - inset * 2, h - inset * 2).forEach(([x, y], i) => g[i ? "lineTo" : "moveTo"](W / 2 + x * s, H / 2 - y * s));
    g.closePath();
  };

  // Aged wood: a warm brown, darker toward the edges, with grain and a few scratches
  path(0); g.save(); g.clip();
  const base = g.createRadialGradient(W / 2, H / 2, H * 0.2, W / 2, H / 2, W * 0.6);
  base.addColorStop(0, "#6E4628"); base.addColorStop(1, "#3A2414");
  g.fillStyle = base; g.fillRect(0, 0, W, H);
  let n = 9;
  const rnd = () => ((n = (n * 16807) % 2147483647) - 1) / 2147483646;
  for (let i = 0; i < 60; i++) {
    const y = rnd() * H, amp = 1 + rnd() * 3;
    g.strokeStyle = `rgba(40, 20, 8, ${0.08 + rnd() * 0.15})`; g.lineWidth = 0.5 + rnd() * 1.5;
    g.beginPath();
    for (let x = 0; x <= W; x += 10) g.lineTo(x, y + Math.sin(x * 0.02 + i) * amp);
    g.stroke();
  }
  for (let i = 0; i < 14; i++) {
    const x = rnd() * W, y = rnd() * H;
    g.strokeStyle = `rgba(230, 200, 160, ${0.08 + rnd() * 0.1})`; g.lineWidth = 0.6;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rnd() - 0.5) * 40, y + (rnd() - 0.5) * 8); g.stroke();
  }
  g.restore();

  // The routed groove: a dark cut with a lit lower lip
  path(0.012); g.lineWidth = size / 160; g.strokeStyle = "rgba(25, 12, 4, .7)"; g.stroke();
  g.save(); g.translate(0, size / 400); path(0.012); g.strokeStyle = "rgba(230, 190, 140, .25)"; g.lineWidth = size / 400; g.stroke(); g.restore();

  // The words: a dark carved floor, the green paint, and a faint highlight on the upper edges
  const text = "Temet Nosce", unit = Math.min((W * 0.8) / width(text), H * 0.6 / 7), x = (W - width(text) * unit) / 2, y = H / 2 + 2.6 * unit;
  const pen = unit * 1.4;
  g.fillStyle = "rgba(20, 10, 4, .75)"; letter(g, text, x + unit * 0.12, y + unit * 0.14, unit, pen);
  g.fillStyle = "#4FA947"; letter(g, text, x, y, unit, pen);
  g.fillStyle = "rgba(190, 240, 170, .3)"; letter(g, text, x - unit * 0.06, y - unit * 0.08, unit, pen * 0.55);
  return c;
}
