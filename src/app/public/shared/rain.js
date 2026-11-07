// shared/rain.js - The neon1 rain, its glass lens, and its controls, shared by neon1.tech and 1NEON.
// Usage: import { rain, controls } from "/shared/rain.js"
//
// Columns of glyphs with long fading trails. Now and then a column spells a word
// where it is and holds it long enough to read. Glass panes act as a lens: each
// shows the rain behind it slightly magnified, like thick convex glass. With the
// rabbit option, a white rabbit now and then drops in as a one-glyph word.


// Character sets the charset control cycles through; the white rabbit only comes as its own word
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

// The rabbit: one glyph, drawn white whatever color the platform's emoji is, with a faint white glow
const RABBIT = { color: "#ffffff", alpha: 1, glow: 6, words: ["🐇"] };

// Rain timing and look
const WORD_RATE = 0.06; // chance per step that some column starts a word
const FADE = 0.07;      // lower means longer trails
const STEP_MS = 66;     // about 15 steps a second
const HALT_MS = 600;    // the step gap the rain picks up from after a halt
const HOLD = 30;        // steps a word holds once spelled

// The halt, a Matrix glitch: hard freezes, lag jumps that skip several steps at once with a
// one-frame flicker, whole-screen tears that slide bands of the frame sideways, a jolt that
// shoves and skews the frame, an inverted flash, and uneven stutters before the final freeze
// (about 1.9 s). Every move but the steps is undone before the next one
const GLITCH = [["freeze", 220], ["tear", 90], ["jump", 6], ["freeze", 240], ["flash", 55], ["run", 4], ["tear", 70],
  ["freeze", 170], ["shift", 80], ["jump", 3], ["freeze", 150], ["run", 1]];
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
 * rabbit, when given, lets a rabbit drop in: { rate, hold, ok, avoid }. rate is the chance per
 * step, hold its steps on screen, ok() allows one, and avoid() lists elements it must not sit under.
 * Without it there are no rabbits and the rain is unchanged.
 * idle() skips drawing while it returns true, such as while the rain is scrolled out of sight.
 */
export function rain({ canvas, lens = null, panes = () => [], lensOff = () => false, words = WORDS, rabbit = null, idle = () => false }) {
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
  // The live rabbit, the step count, and a halt that is not saved as a pause
  const bunny = rabbit && { rate: 0.005, hold: 60, ok: () => true, avoid: () => [], ...rabbit };
  // The canvas's own size in CSS pixels, set on resize
  let W = innerWidth, H = innerHeight;
  let rab = null, steps = 0, held = false, ramp = null, gap = STEP_MS, bunnySprite = null, glitch = null;
  const listeners = new Set();
  const emit = () => listeners.forEach((f) => f(api));

  // Grid columns fall one row per step; free columns at their own speed
  const speed = () => (grid ? 1 : 0.35 + Math.random() * 0.75);
  const newCol = (y, top = true) => ({ y, top, v: speed(), word: null, wi: 0, g: null, wy: 0, hold: 0 });

  // Starts a word from a weighted group in a column that has room for it
  // Words are arrays of code points, so an emoji counts as one cell
  function startWord(g = null, hold = HOLD, fits = () => true) {
    if (!cols.length) return -1; // a window with no width yet has no columns
    if (!g) {
      let r = Math.random() * total; g = words[0];
      for (const w of words) { if ((r -= w.weight) <= 0) { g = w; break; } }
    }
    const word = [...g.words[(Math.random() * g.words.length) | 0]];
    for (let tries = 0; tries < 8; tries++) {
      const i = (Math.random() * cols.length) | 0, c = cols[i];
      const wy = Math.floor(c.y);
      // Only a drop that has fallen from the top, with a trail above it, turns into a word
      if (c.word || !c.top || wy < 3 || wy + word.length >= rows || !fits(i, wy)) continue;
      Object.assign(c, { word, wi: 0, g, wy, hold });
      return i;
    }
    return -1;
  }

  // Cells under the elements the rabbit avoids, padded by a cell, are off limits
  function clear() {
    const rects = [...bunny.avoid()].map((el) => el.getBoundingClientRect()).filter((r) => r.width);
    return (i, row) => {
      const x = (i + 0.5) * size, y = (row + 0.5) * size;
      return !rects.some((r) => x > r.left - size && x < r.right + size && y > r.top - size && y < r.bottom + size);
    };
  }

  // Drops the rabbit in as a word; it stays catchable a little while after it starts to fade
  function startRabbit() {
    const i = startWord(RABBIT, bunny.hold, clear());
    if (i < 0) return false;
    rab = { col: i, row: cols[i].wy, until: steps + 1 + bunny.hold + 12 };
    return true;
  }

  // Reduced motion: one rabbit sits still in the middle third of the frame
  function stillRabbit() {
    const fits = clear(), third = Math.ceil(cols.length / 3);
    for (let tries = 0; tries < 40; tries++) {
      const i = third + ((Math.random() * third) | 0), row = 3 + ((Math.random() * Math.max(1, rows - 5)) | 0);
      if (!cols[i] || !fits(i, row)) continue;
      ctx.shadowBlur = 0; ctx.globalAlpha = 1;
      ctx.fillStyle = VOID; ctx.fillRect(i * size, row * size, size, size);
      drawRabbit(i * size, row * size);
      rab = { col: i, row, until: Infinity };
      return;
    }
  }

  // Fits both canvases to the window and pixel ratio, then restarts every column
  function resize() {
    W = canvas.clientWidth || innerWidth; H = canvas.clientHeight || innerHeight;
    dpr = Math.min(devicePixelRatio || 1, 2);
    if (lens) { lens.width = W * dpr; lens.height = H * dpr; lctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
    size = W < 640 ? 17 : 21;
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    rows = Math.floor(H / size);
    cols = Array.from({ length: Math.ceil(W / size) }, () => newCol(Math.random() * rows, false));
    ctx.textBaseline = "middle"; ctx.textAlign = "center";
    ctx.fillStyle = VOID; ctx.fillRect(0, 0, W, H);
    if (rabbit) bunnySprite = whiteRabbit();
  }

  // The rabbit emoji turned white: each pixel keeps its alpha and some shading, minus its color.
  // Some platforms draw this emoji tan, and canvas filters aren't everywhere yet
  function whiteRabbit() {
    const px = Math.ceil(size * dpr), c = document.createElement("canvas");
    c.width = c.height = px;
    const g = c.getContext("2d", { willReadFrequently: true });
    g.textBaseline = "middle"; g.textAlign = "center";
    g.font = `${Math.round(px * 0.8)}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
    g.fillText(RABBIT.words[0], px / 2, px / 2);
    try {
      const img = g.getImageData(0, 0, px, px), d = img.data;
      for (let i = 0; i < d.length; i += 4) {
        const v = 205 + 50 * (Math.max(d[i], d[i + 1], d[i + 2]) / 255);
        d[i] = d[i + 1] = d[i + 2] = v;
      }
      g.putImageData(img, 0, 0);
    } catch { /* pixels unreadable: the emoji keeps its own colors */ }
    return c;
  }

  // The white rabbit in its cell, with a faint white glow so it reads against the rain
  function drawRabbit(x, y) {
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.shadowColor = "rgba(255, 255, 255, .6)"; ctx.shadowBlur = RABBIT.glow;
    ctx.drawImage(bunnySprite, x, y, size, size);
    ctx.restore();
  }

  // Every glyph is centered in its cell; emoji are drawn smaller to match the text
  function glyph(ch, x, y) {
    if (isEmoji(ch)) ctx.font = `${Math.round(size * 0.72)}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
    else ctx.font = `500 ${size}px ${MONO}`;
    ctx.fillText(ch, x + size / 2, y + size / 2);
  }

  // One step: fade the trails, maybe start a word or a rabbit, then advance every column
  // The prefill passes no rabbits, since the page isn't ready to ask yet
  function draw(prefill = false) {
    steps++;
    ctx.globalAlpha = 1;
    ctx.fillStyle = `rgba(13, 2, 8, ${FADE})`;
    ctx.fillRect(0, 0, W, H);
    if (Math.random() < WORD_RATE) startWord();
    if (rab && steps > rab.until) rab = null;
    if (bunny && !prefill && !rab && Math.random() < bunny.rate && bunny.ok()) startRabbit();
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
          if (c.g === RABBIT) { drawRabbit(x, wy); continue; }
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
      if (c.y > rows && !c.word && Math.random() > 0.97) {
        Object.assign(c, newCol(0));
        if (rab && rab.col === i) rab = null;
      }
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
    lctx.clearRect(0, 0, W, H);
    if (lensOff()) return;
    for (const el of panes()) {
      const r = el.getBoundingClientRect();
      if (!r.width || r.bottom < 0 || r.top > H) continue;
      lctx.save();
      lctx.fillStyle = VOID;
      lctx.filter = "blur(0.6px)";
      lensRect(r, 0, 0.9);
      lensRect(r, RIM, ZOOM);
      lctx.restore();
    }
  }

  // The gap between steps: STEP_MS, or eased along the ramp back up after a halt
  function stepGap(now) {
    if (!ramp) return gap;
    const t = Math.min(1, (now - ramp.t0) / ramp.ms), e = 1 - (1 - t) ** 3;
    gap = ramp.from + (ramp.to - ramp.from) * e;
    if (t >= 1) { const end = ramp.end; ramp = null; if (end) end(); }
    return gap;
  }

  // Plays the halt's glitch one move at a time; the last move leaves the rain held
  function glitchStep(now) {
    if (now < glitch.until) return;
    if (glitch.undo) { glitch.undo(); glitch.undo = null; }
    const move = glitch.moves.shift();
    if (!move) { const done = glitch.done; glitch = null; held = true; done(); return; }
    const [kind, n] = move;
    glitch.onMove(kind, n);
    if (kind === "freeze") { glitch.until = now + n; return; }
    if (kind === "tear") { glitch.undo = tear(); glitch.until = now + n; return; }
    if (kind === "flash" || kind === "shift") { glitch.undo = jolt(kind); glitch.until = now + n; return; }
    if (kind === "jump") {
      // Dropped frames: several steps land at once, and the canvas flickers for a frame
      for (let k = 0; k < n; k++) draw();
      refract();
      canvas.style.filter = "brightness(1.4) contrast(1.1)";
      setTimeout(() => (canvas.style.filter = ""), 50);
      glitch.until = now + 50;
      return;
    }
    draw(); refract();
    if (n > 1) glitch.moves.unshift(["run", n - 1]);
    glitch.until = now + STEP_MS;
  }

  // Slides a few bands of the whole frame sideways, one with a ghost beside it; returns the mend
  function tear() {
    const w = canvas.width, h = canvas.height, snap = document.createElement("canvas");
    snap.width = w; snap.height = h;
    snap.getContext("2d").drawImage(canvas, 0, 0);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.shadowBlur = 0;
    for (let i = 0; i < 7; i++) {
      const y = Math.random() * h, bh = (0.02 + Math.random() * 0.1) * h, dx = (Math.random() - 0.5) * w * 0.14;
      ctx.globalAlpha = 1; ctx.drawImage(snap, 0, y, w, bh, dx, y, w, bh);
      if (i === 0) { ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.4; ctx.drawImage(snap, 0, y, w, bh, dx + 7 * dpr, y, w, bh); ctx.globalCompositeOperation = "source-over"; }
    }
    ctx.restore();
    refract();
    return () => { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.drawImage(snap, 0, 0); ctx.restore(); refract(); };
  }

  // Shoves the rain and lens off center for a moment: inverted for a flash, skewed and harsh for a shift
  function jolt(kind) {
    const els = [canvas, lens].filter(Boolean), x = (Math.random() < 0.5 ? -1 : 1) * (6 + Math.random() * 10);
    for (const el of els) {
      el.style.transform = kind === "flash" ? `translate(${x}px, 0)` : `translate(${x}px, ${(Math.random() - 0.5) * 8}px) skewX(-2deg)`;
      el.style.filter = kind === "flash" ? "invert(1) hue-rotate(180deg) brightness(1.15)" : "contrast(1.5) saturate(1.6)";
    }
    return () => els.forEach((el) => { el.style.transform = ""; el.style.filter = ""; });
  }

  // Steps the rain at the current gap, and not while paused, held, idle, or the tab is hidden
  function loop() {
    const now = performance.now();
    const g = stepGap(now);
    if (glitch) { if (!document.hidden) glitchStep(now); }
    else if (running && !held && !document.hidden && !idle() && now - last >= g) { last = now; draw(); refract(); }
    raf = requestAnimationFrame(loop);
  }

  // Keeps the live rabbit drawn at full strength while the rain stops around it
  function pin() {
    if (!rab || !running) return;
    Object.assign(cols[rab.col], { word: [...RABBIT.words[0]], wi: 1, g: RABBIT, wy: rab.row, hold: Infinity });
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
    get held() { return held; },

    // True when the point (client px) is on the live rabbit, within slop cells
    // The canvas can be taller than the layout viewport (100vh on iOS), so scale first
    rabbitAt(clientX, clientY, slop = 1.3) {
      if (!rab || held) return false;
      const b = canvas.getBoundingClientRect();
      const x = ((clientX - b.left) * W) / b.width, y = ((clientY - b.top) * H) / b.height;
      return Math.abs(x - (rab.col + 0.5) * size) <= size * slop && Math.abs(y - (rab.row + 0.5) * size) <= size * slop;
    },

    // Where the live rabbit's cell is centered, in layout px, or null
    get rabbit() { return rab && { x: (rab.col + 0.5) * size, y: (rab.row + 0.5) * size }; },

    // Drops a rabbit in now if there is room; for testing
    spawnRabbit() { return !!bunny && !rab && running && !held && startRabbit(); },

    // Stops the rain with a short glitch, without saving a pause; resolves once it is still
    // A rain that isn't moving (paused, or reduced motion) just holds. onMove(kind, ms), when
    // given, hears each move as it plays, such as to sound it
    halt(onMove = () => {}) {
      pin();
      return new Promise((done) => {
        ramp = null;
        if (!running) { held = true; done(); return; }
        glitch = { moves: GLITCH.map((m) => [...m]), until: 0, done, undo: null, onMove };
      });
    },

    // Picks the rain back up over ms; the caught rabbit fades with the trails
    // A still rain (reduced motion) draws a fresh frame with a new rabbit instead
    resume(ms = 800) {
      if (rab) { const c = cols[rab.col]; if (c && c.g === RABBIT) c.hold = 0; }
      rab = null;
      if (glitch) { if (glitch.undo) glitch.undo(); glitch = null; canvas.style.filter = ""; }
      if (held && reduce.matches) { held = false; onResize(); return; }
      held = false;
      ramp = { from: HALT_MS, to: STEP_MS, t0: performance.now(), ms };
    },
    stop() { cancelAnimationFrame(raf); removeEventListener("resize", onResize); },
  };

  // Start: pre-fill so rain is already falling on first paint, which is also the
  // still frame that reduced motion keeps
  // A pinch zoom also fires resize; the rain keeps its grid until the page is back at normal scale,
  // and only restarts when the window really changed size
  let lastW = 0, lastH = 0;
  const onResize = () => {
    if (window.visualViewport && visualViewport.scale > 1.01) return;
    const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight;
    if (w === lastW && h === lastH) { refract(); return; }
    lastW = w; lastH = h;
    resize(); rab = null;
    for (let i = 0; i < 40; i++) draw(true);
    if (bunny && reduce.matches && !held) stillRabbit();
    refract();
  };
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
