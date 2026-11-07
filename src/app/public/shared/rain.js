// shared/rain.js - The neon1 rain, its glass lens, and its controls, shared by neon1.tech and 1NEON.
// Usage: import { rain, controls } from "/shared/rain.js"
//
// Columns of glyphs with long fading trails. Now and then a column spells a word
// where it is and holds it long enough to read. Glass panes act as a lens: each
// shows the rain behind it slightly magnified, like thick convex glass.


// Character sets the charset control cycles through; the white rabbit is kept out of them on purpose
const EMOJI = ["💻", "🔒", "📡", "🛰️", "🔌", "⚙️", "🧅", "💊", "🕶️", "☁️", "🔑", "📷", "🛡️", "🤖", "💾", "📶", "🧠"];
const FACES = ["😀", "😃", "😄", "😁", "😆", "😅", "😂", "🙂", "😉", "😊", "😇", "🥰", "😍", "🤩", "😎", "🤓", "🧐", "🤔", "😴", "🤯", "🥳", "😏", "😌", "🙃"];

// "text" mixes many writing systems, weighted like the original neon1 rain;
// combining marks are skipped because they can't stand alone in a cell
const RANGES = [[0x30, 0x39, 10], [0x41, 0x5a, 20], [0x61, 0x7a, 30], [0xa1, 0xff, 5], [0x370, 0x3ff, 2], [0x400, 0x4ff, 2],
  [0x5d0, 0x5ea, 1], [0x621, 0x64a, 1], [0x905, 0x939, 1], [0xe01, 0xe2e, 1], [0x3041, 0x3096, 3], [0x30a1, 0x30fa, 3],
  [0xac00, 0xd7a3, 3], [0x4e00, 0x9fff, 18]];
export const TEXT = [];
for (const [lo, hi, w] of RANGES) {
  for (let n = 0; n < w * 12; n++) {
    const ch = String.fromCodePoint(lo + ((Math.random() * (hi - lo + 1)) | 0));
    if (/^[\p{L}\p{N}\p{S}\p{P}]$/u.test(ch)) TEXT.push(ch);
  }
}
const KATAKANA = [..."ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ0123456789neon1"];
const NUMBERS = [..."0123456789"];
const SYMBOLS = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz$#%&*+=<>/\\{}[]()∆∑∏√∞≈≠λΩπμΣΦΨ"];
// Mixed keeps emoji rare so the text still reads as rain
const SETS = [
  { name: "text", chars: TEXT },
  { name: "katakana", chars: KATAKANA },
  { name: "numbers", chars: NUMBERS },
  { name: "symbols", chars: SYMBOLS },
  { name: "emoji", chars: EMOJI },
  { name: "faces", chars: FACES },
  { name: "mixed", chars: [...TEXT, ...KATAKANA, ...NUMBERS, ...SYMBOLS, ...EMOJI.slice(0, 6), ...FACES.slice(0, 4)] },
];
const isEmoji = (ch) => /\p{Extended_Pictographic}/u.test(ch);

// Word groups by how often they appear. Values share one gold, set apart from the
// rain by staying put; neon1's own names glow in its green
const GOLD = "#ffd77a", NEON = "#6CFFA8";
export const WORDS = [
  { weight: 3, color: GOLD, alpha: 0.95, words: ["listen", "simplicity", "ownership", "transparency", "recovery", "service", "automation", "networks", "cameras", "pipelines", "migration", "security", "cloud"] },
  { weight: 2, color: NEON, alpha: 1, glow: 6, words: ["neon1", "1withtechnology", "1isgladtobeofservice", "1NEON", "onion"] },
];

// Rain timing and look
const WORD_RATE = 0.06; // chance per step that some column starts a word
const FADE = 0.07;      // lower means longer trails
const STEP_MS = 66;     // about 15 steps a second
const ZOOM = 1.15, RIM = 5;
const VOID = "#0D0208";
const MONO = `"JetBrains Mono", ui-monospace, monospace`;

// Settings persist per browser, so neon1.tech and 1NEON keep the same rain
const KEY = "neon1.rain";
function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
}
function save(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage blocked: settings last for this page only */ }
}


/**
 * Starts the rain on `canvas`, and the lens on `lens` when given.
 * panes() lists the glass elements to magnify; lensOff() pauses the lens while it returns true.
 * words replaces the word groups. Returns the controls and a stop() for cleanup.
 */
export function rain({ canvas, lens = null, panes = () => [], lensOff = () => false, words = WORDS }) {
  const ctx = canvas.getContext("2d");
  const lctx = lens && lens.getContext("2d");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");
  const saved = load();
  const total = words.reduce((a, g) => a + g.weight, 0);

  // Cell size, grid, columns, and the current settings
  let size = 20, rows = 0, cols = [], dpr = 1, last = 0, raf = 0;
  let grid = saved.grid !== false;
  let set = Math.max(0, SETS.findIndex((s) => s.name === saved.set));
  let running = !saved.paused && !reduce.matches;
  const listeners = new Set();
  const emit = () => listeners.forEach((f) => f(api));

  // Grid columns fall one row per step; free columns at their own speed
  const speed = () => (grid ? 1 : 0.35 + Math.random() * 0.75);
  const newCol = (y, top = true) => ({ y, top, v: speed(), word: null, wi: 0, g: null, wy: 0, hold: 0 });

  // Starts a word from a weighted group in a column that has room for it
  function startWord() {
    if (!cols.length) return; // a window with no width yet has no columns
    let r = Math.random() * total, g = words[0];
    for (const w of words) { if ((r -= w.weight) <= 0) { g = w; break; } }
    const word = g.words[(Math.random() * g.words.length) | 0];
    for (let tries = 0; tries < 8; tries++) {
      const c = cols[(Math.random() * cols.length) | 0];
      const wy = Math.floor(c.y);
      // Only a drop that has fallen from the top, with a trail above it, turns into a word
      if (c.word || !c.top || wy < 3 || wy + word.length >= rows) continue;
      Object.assign(c, { word, wi: 0, g, wy, hold: 30 });
      return;
    }
  }

  // Fits both canvases to the window and pixel ratio, then restarts every column
  function resize() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    if (lens) { lens.width = innerWidth * dpr; lens.height = innerHeight * dpr; lctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
    size = innerWidth < 640 ? 17 : 21;
    canvas.width = innerWidth * dpr; canvas.height = innerHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    rows = Math.floor(innerHeight / size);
    cols = Array.from({ length: Math.ceil(innerWidth / size) }, () => newCol(Math.random() * rows, false));
    ctx.textBaseline = "middle"; ctx.textAlign = "center";
    ctx.fillStyle = VOID; ctx.fillRect(0, 0, innerWidth, innerHeight);
  }

  // Every glyph is centered in its cell; emoji are drawn smaller to match the text
  function glyph(ch, x, y) {
    if (isEmoji(ch)) ctx.font = `${Math.round(size * 0.72)}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
    else ctx.font = `500 ${size}px ${MONO}`;
    ctx.fillText(ch, x + size / 2, y + size / 2);
  }

  // One step: fade the trails, maybe start a word, then advance every column
  function draw() {
    ctx.globalAlpha = 1;
    ctx.fillStyle = `rgba(13, 2, 8, ${FADE})`;
    ctx.fillRect(0, 0, innerWidth, innerHeight);
    if (Math.random() < WORD_RATE) startWord();
    const chars = SETS[set].chars;
    cols.forEach((c, i) => {
      const x = i * size;
      if (c.word) {
        // Spell one letter per step, then hold. Each letter sits on a cleared cell,
        // in the same weight as the rain, so it stays sharp. Once the word is
        // spelled, the drop carries on falling below it
        if (c.wi < c.word.length) { c.wi++; if (c.wi === c.word.length) c.y = c.wy + c.wi; } else c.hold--;
        for (let k = 0; k < c.wi; k++) {
          const ch = c.word[k], wy = (c.wy + k) * size;
          ctx.shadowBlur = 0; ctx.globalAlpha = 1;
          ctx.fillStyle = VOID; ctx.fillRect(x, wy, size, size);
          if (ch === " ") continue;
          ctx.globalAlpha = c.g.alpha;
          ctx.shadowColor = c.g.color; ctx.shadowBlur = c.g.glow || 0;
          ctx.fillStyle = c.g.color; glyph(ch, x, wy);
        }
        ctx.shadowBlur = 0; ctx.globalAlpha = 1;
        if (c.hold <= 0) c.word = null;
        if (c.word && c.wi < c.word.length) return;
      }
      // A random glyph at the head, mostly green with the odd bright one
      const y = (grid ? Math.floor(c.y) : c.y) * size;
      const r = Math.random();
      ctx.fillStyle = r > 0.96 ? "#e9ffee" : r > 0.45 ? "#22ff7a" : "#00b84f";
      glyph(chars[(Math.random() * chars.length) | 0], x, y);
      c.y += c.v;
      if (c.y > rows && !c.word && Math.random() > 0.97) Object.assign(c, newCol(0));
    });
  }

  // Draws the rain behind rect r, inset by `inset` px, scaled by `zoom` around its center
  function lensRect(r, inset, zoom) {
    const x = r.left + inset, y = r.top + inset, w = r.width - inset * 2, h = r.height - inset * 2;
    const sw = w / zoom, sh = h / zoom, sx = x + (w - sw) / 2, sy = y + (h - sh) / 2;
    lctx.save();
    lctx.beginPath(); lctx.roundRect(x, y, w, h, Math.max(2, 8 - inset)); lctx.clip();
    lctx.fillRect(x, y, w, h);
    lctx.drawImage(canvas, sx * dpr, sy * dpr, sw * dpr, sh * dpr, x, y, w, h);
    lctx.restore();
  }

  // Redraws every visible pane: a rim that bends the rain inward, then a magnified body
  function refract() {
    if (!lens) return;
    lctx.clearRect(0, 0, innerWidth, innerHeight);
    if (lensOff()) return;
    for (const el of panes()) {
      const r = el.getBoundingClientRect();
      if (!r.width || r.bottom < 0 || r.top > innerHeight) continue;
      lctx.save();
      lctx.fillStyle = VOID;
      lctx.filter = "blur(0.6px)";
      lensRect(r, 0, 0.9);
      lensRect(r, RIM, ZOOM);
      lctx.restore();
    }
  }

  // Steps the rain at STEP_MS, and not while paused or the tab is hidden
  function loop() {
    const now = performance.now();
    if (running && !document.hidden && now - last >= STEP_MS) { last = now; draw(); refract(); }
    raf = requestAnimationFrame(loop);
  }

  // The controls: each change is saved and reported to subscribers
  const persist = () => save({ grid, set: SETS[set].name, paused: !running });
  const api = {
    get running() { return running; },
    get mode() { return grid ? "grid" : "free"; },
    get charset() { return SETS[set].name; },
    setRunning(on) { running = on; persist(); emit(); },
    toggleMode() {
      grid = !grid;
      cols.forEach((c) => { c.v = speed(); if (grid) c.y = Math.floor(c.y); });
      persist(); emit();
    },
    nextCharset() { set = (set + 1) % SETS.length; persist(); emit(); },
    subscribe(f) { listeners.add(f); f(api); return () => listeners.delete(f); },
    refract,
    stop() { cancelAnimationFrame(raf); removeEventListener("resize", onResize); },
  };

  // Start: pre-fill so rain is already falling on first paint, which is also the
  // still frame that reduced motion keeps
  const onResize = () => { resize(); for (let i = 0; i < 40; i++) draw(); refract(); };
  addEventListener("resize", onResize);
  onResize();
  loop();
  return api;
}


/** Wires the mode, charset, and pause buttons inside `root` (data-rain="mode|charset|pause") to the rain */
export function controls(root, r) {
  const mode = root.querySelector('[data-rain="mode"]');
  const charset = root.querySelector('[data-rain="charset"]');
  const pause = root.querySelector('[data-rain="pause"]');
  // The buttons show the current setting; a click moves to the next one
  mode.addEventListener("click", () => r.toggleMode());
  charset.addEventListener("click", () => r.nextCharset());
  pause.addEventListener("click", () => r.setRunning(!r.running));
  return r.subscribe(() => {
    mode.textContent = r.mode;
    charset.textContent = r.charset;
    pause.textContent = r.running ? "pause" : "play";
    pause.setAttribute("aria-pressed", String(!r.running));
  });
}
