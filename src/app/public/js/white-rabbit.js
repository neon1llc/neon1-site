// src/app/public/js/white-rabbit.js - The white rabbit: catch it in the rain, then scroll out of the screen.
// Usage: const egg = whiteRabbit({ rain, root: document.getElementById("whiteRabbit") })
//
// A caught rabbit stops the rain. Scrolling down then scrubs the scene in
// white-rabbit-scene.js, imported only after a catch: the landing turns out to be
// the picture on an old TV, and the camera pulls back into a light room and up to
// a window, ending on "go touch grass". Scrolling up plays it back into the screen
// and the rain picks up again. Reduced motion, no WebGL, or a failed import get a
// still card instead. Sound, synthesized in white-rabbit-sound.js, is readied by the
// catch and heard once the scroll out of the TV begins, quietly, and it stops when the
// scroll returns to the landing. The card is always silent.
//
// States, kept on root as data-state: idle, caught, playing, reversing, done, exiting.
// Each catch is an entry with its own generation number; anything asynchronous (the scene's import,
// its composing, the rain's halt) checks that its entry is still the current one before it acts, so a
// rabbit caught, left, and caught again before the scene loads builds one scene, not two.
// Keyboard: "follow the white rabbit" (#whiteRabbitIn, hidden until focused, like the skip link)
// catches one and focuses a line, read only by screen readers, that says how to move and leave; nothing on
// screen explains the scene, Tab stays on that line while the page is covered, Esc always leaves, and focus
// returns where it was when the entry ends. The car on the sill starts when clicked, inside the scene itself.
// Testing: ?rabbit=now keeps a rabbit on the landing and notes its cell center on root
// as data-spot; ?rabbit=p0.5 catches one and jumps to that progress. Both only add
// rabbits, so they are harmless in production.


// Feel: how much input the whole walk takes on each kind of device, spring, top speed, rubber band, and gesture idle
// time. The scene spends that input evenly on how much the view changes (see PACE there), so fewer scrolls never
// means a fast turn rushes by. A finger drags about seven screen heights (ten or so quick swipes); a touchpad or
// any smooth pixel wheel scrolls nine; a notched mouse wheel takes about 45 clicks; arrows 25 presses
const PASS_TOUCH = 7;      // viewport heights of finger travel for the whole walk
const PASS_WHEEL = 9;      // viewport heights of touchpad or smooth wheel scrolling
const NOTCH = 1 / 45;      // one click of a notched mouse wheel
const FLICK = 320;         // ms of a flick's speed carried on after the finger lifts
const TOP = 0.45;          // the most of the walk shown per second, so a burst of input can't spin the view
const STIFF = 90;          // spring stiffness, per second squared
const DAMP = 2 * Math.sqrt(STIFF);
const BAND = 0.02;         // the most input can pull past the end
const IDLE = 160;          // ms without input that ends a gesture
const DOWN = ["ArrowDown", "PageDown", "End"], UP = ["ArrowUp", "PageUp", "Home"];
const SCENE = "/js/white-rabbit-scene.js", SOUND = "/js/white-rabbit-sound.js";

// An earlier version saved a sound choice; there is no choice now, so the old key goes
try { localStorage.removeItem("neon1.rabbit.sound"); } catch { /* storage blocked: nothing to clear */ }

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };


/** Wires the egg to the rain; returns ready(), which the rain asks before dropping a rabbit */
export function whiteRabbit({ rain, root }) {
  const body = document.body, html = document.documentElement;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");
  const grass = root.querySelector(".white-rabbit-grass");
  const menu = document.getElementById("menu");
  const pauseBtn = document.querySelector('[data-rain="pause"]');
  const page = () => document.querySelectorAll("header, .top, .awake, .rainctl");
  // The keyboard way in, and the line that says how to move (screen readers only); the way in shows only with this script
  const inBtn = document.getElementById("whiteRabbitIn");
  const how = root.querySelector(".white-rabbit-how");
  if (inBtn) inBtn.hidden = false;

  // Progress: wanted and rendered, with the spring's velocity
  let state = "idle", mode = "scene", target = 0, p = 0, v = 0;
  let scene = null, loading = null, halted = false, prepared = false, handed = false;
  let raf = 0, last = 0, lastInput = 0, idleTimer = 0, disposeTimer = 0, escape = null, announced = false;
  let audio = null, sound = null;
  // The current entry's generation, and where focus was when it began
  let gen = 0, before = null;

  // ---- State and page ----
  // The state shows on root, so CSS and tests can follow it
  function set(s) { state = s; root.dataset.state = s; }

  // Locks the page while caught: views.js stands down and touch can't scroll or bounce
  function lock(on) {
    body.classList.toggle("white-rabbit-on", on);
    html.classList.toggle("white-rabbit-lock", on);
  }

  // Covers the page with the scene or the card; the page behind can't take focus
  function cover(on, how = mode) {
    root.dataset.mode = how;
    body.classList.toggle("white-rabbit-scene", on && how === "scene");
    grass.parentElement.style.opacity = "";
    body.classList.toggle("white-rabbit-cover", on);
    page().forEach((el) => (el.inert = on));
    if (on && how === "card") paintSign();
    if (!on) repaintEdges();
  }

  // Leaving the cover: some phone browsers (DuckDuckGo on iPhone) keep the scene's last frame in the
  // strip under their floating toolbar, outside the page's own viewport, until something repaints the
  // whole window. Changing the root's background for two frames (same color) asks for that repaint
  function repaintEdges() {
    html.style.backgroundColor = getComputedStyle(body).backgroundColor;
    requestAnimationFrame(() => requestAnimationFrame(() => { html.style.backgroundColor = ""; }));
  }

  // The card's carved sign, painted once by the same module the room uses
  function paintSign() {
    const sign = root.querySelector(".white-rabbit-sign");
    if (!sign || sign.dataset.painted) return;
    sign.dataset.painted = "";
    import("/js/white-rabbit-sign.js").then(({ paintSign: paint }) => {
      const c = paint(512);
      sign.width = c.width; sign.height = c.height;
      sign.getContext("2d").drawImage(c, 0, 0);
    }).catch(() => sign.remove());
  }

  // Shown once, so the status line announces the end a single time
  function announce(on) {
    if (on && !announced) { announced = true; grass.textContent = "go touch grass"; }
    if (!on) { announced = false; grass.textContent = ""; }
  }

  // ---- Sound ----
  // Sound belongs to the scene; the card is always silent
  const wanted = () => mode === "scene";

  // Opens the audio device inside a click or tap, then builds the sounds once their module loads;
  // idling picks the car's engine back up, for a device rebuilt while it runs
  function openAudio(idling = false) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (audio || !AC || !wanted()) return;
    const ctx = (audio = new AC());
    ctx.resume();
    // Phones unlock output only for sound started inside the gesture: a silent sample does it at once
    try { const b = ctx.createBufferSource(); b.buffer = ctx.createBuffer(1, 1, 22050); b.connect(ctx.destination); b.start(0); } catch { /* nothing to unlock */ }
    // The device interrupted while the page is still showing (a call, another app's audio): try again
    ctx.onstatechange = () => { if (ctx === audio && ctx.state !== "running") setTimeout(wake, 300); };
    import(SOUND).then((m) => {
      if (audio !== ctx) return;
      sound = m.createSound(ctx);
      sound.start(mode);
      if (idling) sound.car("idle");
    }).catch(() => {});
  }

  // Closes the audio device, so nothing keeps playing or holds it after the egg
  function closeAudio() {
    body.classList.remove("white-rabbit-hover");
    if (sound) sound.close(); else if (audio) audio.close().catch(() => {});
    audio = sound = null;
  }

  // A hidden tab goes quiet, and the sound comes back with it. Phones may refuse to resume until the
  // next touch, or come back from the background with a device that claims to run but stays silent,
  // so on a touch screen the first touch, click, or key after returning builds the sound afresh
  // (inside that gesture, which phones require), picking the car's idle back up if it was running
  const coarse = matchMedia("(pointer: coarse)");
  let stale = false;
  const away = () => { if (audio) stale = true; };
  document.addEventListener("visibilitychange", () => {
    if (!audio) return;
    if (document.hidden) { stale = true; audio.suspend().catch(() => {}); } else wake();
  });
  addEventListener("blur", away);
  addEventListener("pagehide", away);
  function wake(e) {
    if (!audio || document.hidden) return;
    const gesture = e && e.isTrusted && /^(pointerup|touchend|click|keydown)$/.test(e.type);
    if (gesture && ((stale && coarse.matches) || audio.state !== "running")) {
      stale = false;
      const idling = !!(scene && scene.carRunning), old = audio, oldSound = sound;
      // The old device goes at once, without its fade, so the new one isn't held behind it
      audio = sound = null;
      if (oldSound) oldSound.close(true); else old.close().catch(() => {});
      openAudio(idling);
      return;
    }
    if (audio.state !== "running" && audio.state !== "closed") audio.resume().catch(() => {});
  }
  for (const type of ["pointerup", "touchend", "click", "keydown"]) addEventListener(type, wake, { capture: true, passive: true });
  addEventListener("pageshow", wake);
  addEventListener("focus", wake);

  // ---- Catching ----
  // The rabbit only drops in on the landing, with nothing open and the egg at rest
  const ready = () => state === "idle" && scrollY < 8 && menu.hidden && !body.classList.contains("case-open");

  // A catch stops the rain and starts loading the scene, usually done before the first scroll.
  // It opens a new entry: completions still pending from an earlier one are ignored from here on
  function catchIt() {
    clearTimeout(disposeTimer);
    const g = ++gen;
    before = document.activeElement;
    set("caught"); lock(true);
    body.classList.remove("white-rabbit-hover");
    target = p = v = 0; halted = prepared = handed = false; escape = null; cardP = 0;
    mode = reduce.matches ? "card" : "scene";
    root.dataset.mode = mode;
    openAudio();
    rain.halt((kind, ms) => sound && sound.glitch(kind, ms)).then(() => { if (g !== gen) return; halted = true; prepare(); });
    if (mode === "scene") load(); else drop(); // a scene kept from the last entry isn't needed by the card
  }

  // The keyboard way in: back to the landing if the page has moved, catch, and focus the way out
  function enter() {
    if (state !== "idle" || !menu.hidden || body.classList.contains("case-open")) return;
    if (scrollY >= 8) scrollTo({ top: 0, behavior: "instant" });
    catchIt();
    if (how) how.focus();
  }

  // The one construction owner: the module is imported once per page and the scene built at most
  // once per entry. A completion whose entry has ended, or that finds a scene already built, builds
  // nothing; a failure in the current entry means the card
  function load() {
    if (scene) { prepare(); return; }
    const g = gen;
    loading = loading || import(SCENE);
    loading.then((m) => {
      if (g !== gen || scene || state === "idle" || mode !== "scene") return;
      const made = m.createScene({ onLost: () => { if (made === scene) fallback(); }, onSound: (kind) => sound && sound.car(kind) });
      scene = made;
      prepare();
    }).catch(() => { loading = null; if (g === gen) fallback(); });
  }

  // Draws the landing into the TV picture once the rain is still and the scene exists; the result
  // only counts for the scene and entry that asked
  function prepare() {
    if (!halted || !scene || state === "idle" || mode !== "scene") return;
    const s = scene, g = gen;
    const current = () => s === scene && g === gen;
    s.compose().then(() => { if (current()) prepared = true; }).catch(() => { if (current()) fallback(); });
  }

  // No WebGL, a failed import, a lost context, or reduced motion turned on mid-scene: the still card
  // takes over from the same point. The scene loop stops at once and the scene is freed; a leave
  // already under way (Esc, or the back button) carries on in the card
  function fallback() {
    if (state === "idle" || mode === "card") return;
    if (state === "exiting") { drop(); return; } // the landing is already back; nothing to hand over
    mode = "card";
    stop(); closeAudio(); drop();
    root.dataset.mode = mode;
    if (state === "caught") return;
    const leaving = !!escape;
    handed = false; escape = null;
    cover(true, "card"); card(Math.max(0.001, p) - cardP);
    if (leaving) card(-cardP);
  }

  // Frees the scene's GPU memory; the imported modules stay cached for the next catch. Safe to call
  // more than once, and the scene's own dispose is too
  function drop() { if (scene) { scene.dispose(); scene = null; } prepared = false; }

  // ---- Leaving ----
  // Back to the landing without playing: the rain resumes and the rabbit is spent
  function leave() {
    gen++;
    cover(false);
    rain.resume(); closeAudio();
    stop();
    rest();
  }

  // After playing back to the start: the landing returns, then input settles before the page takes over
  function exit() {
    gen++;
    if (handed && scene) scene.render(0, { still: true });
    handed = false; escape = null;
    cover(false); announce(false);
    set("exiting");
    rain.resume(); closeAudio();
    stop();
    settle();
  }

  // Trailing momentum is swallowed until input has been idle, then the egg is disarmed
  function settle() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      if (state !== "exiting") return;
      if (performance.now() - lastInput < IDLE) { settle(); return; }
      rest();
    }, IDLE);
  }

  // The entry's end: idle and unlocked, the scene freed shortly after (a quick second catch reuses
  // it), and focus back where it was if it was left on the line that says how to move, or nowhere
  function rest() {
    set("idle"); lock(false);
    disposeTimer = setTimeout(drop, 1000);
    const a = document.activeElement;
    if (before && before !== body && before.isConnected && (!a || a === body || root.contains(a))) before.focus({ preventScroll: true });
    before = null;
  }

  // ---- Input ----
  // One step of input in progress units, positive is down
  function step(d) {
    lastInput = performance.now();
    if (state === "exiting" || !d || escape) return;
    if (state === "caught") {
      if (d < 0) return;
      set("playing");
      if (mode === "card") cover(true, "card");
      else start();
    }
    if (mode === "card") { card(d); return; }
    if (state === "done" && d > 0) { target = Math.min(1 + BAND, target + d * 0.3); band(); return; }
    set(d > 0 ? "playing" : "reversing");
    target = target + d > 1 ? Math.min(1 + BAND, 1 + (target + d - 1) * 0.3) : Math.max(0, target + d);
    // Until the scene is ready nothing moves, so input then is not banked: otherwise the first frames would
    // spring through everything scrolled while it loaded, and the start would rush by
    if (!prepared) target = Math.min(target, 0.004);
    band();
  }

  // Input past the end springs back once the gesture stops
  function band() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => { target = Math.min(target, 1); }, IDLE);
  }

  // Pixels of scroll to progress, for a finger and for a touchpad or smooth wheel
  const touchPx = (d) => step(d / (PASS_TOUCH * innerHeight));
  const wheelPx = (d) => step(d / (PASS_WHEEL * innerHeight));
  const active = () => state !== "idle";

  // Wheel: a notched mouse wheel (lines, or the legacy wheelDelta in steps of 120) moves a fixed step per click; a
  // touchpad or smooth wheel, in pixels, moves with its distance; pages step a tenth of the walk
  addEventListener("wheel", (e) => {
    if (!active() || e.ctrlKey) return;
    e.preventDefault(); e.stopPropagation();
    const legacy = e.wheelDeltaY, notched = e.deltaMode === 1 || (legacy && legacy % 120 === 0 && Math.abs(e.deltaY) >= 50);
    if (e.deltaMode === 2) step(Math.sign(e.deltaY) * 0.1);
    else if (notched) step(Math.sign(e.deltaY) * NOTCH * Math.max(1, Math.round(Math.abs(legacy || 120) / 120)));
    else wheelPx(e.deltaY);
  }, { capture: true, passive: false });

  // Touch: the first 6px pick the axis, and a flick keeps going for FLICK ms of its speed
  let tY = 0, tX = 0, axis = null, vel = 0, tLast = 0;
  addEventListener("touchstart", (e) => {
    if (!active() || e.touches.length !== 1) return;
    tY = e.touches[0].clientY; tX = e.touches[0].clientX; axis = null; vel = 0; tLast = performance.now();
  }, { capture: true, passive: true });
  addEventListener("touchmove", (e) => {
    if (!active()) return;
    e.preventDefault(); e.stopPropagation();
    if (e.touches.length !== 1) return;
    const cy = e.touches[0].clientY, cx = e.touches[0].clientX, dy = tY - cy, dx = tX - cx;
    if (!axis) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
    }
    if (axis === "x") return;
    const now = performance.now();
    vel = dy / Math.max(1, now - tLast); tLast = now; tY = cy; tX = cx;
    touchPx(dy);
  }, { capture: true, passive: false });
  addEventListener("touchend", () => {
    if (!active() || axis !== "y") return;
    if (Math.abs(vel) > 0.3 && performance.now() - tLast < 100) touchPx(vel * FLICK);
  }, { capture: true });

  // Keys: arrows nudge, paging and Space step, Home and End go to the ends, Esc always leaves.
  // Once the page is covered there is nothing to Tab to, so Tab keeps focus on the line that says how to move
  addEventListener("keydown", (e) => {
    if (!active() || e.altKey || e.ctrlKey || e.metaKey) return;
    const k = e.key, space = k === " ";
    if (k === "Escape") { e.preventDefault(); e.stopPropagation(); bail(); return; }
    if (k === "Tab" && state !== "caught") {
      e.preventDefault();
      if (how) how.focus();
      return;
    }
    if (!space && !DOWN.includes(k) && !UP.includes(k)) return;
    e.preventDefault(); e.stopPropagation();
    if (state === "caught" && (UP.includes(k) || (space && e.shiftKey))) return;
    if (k === "Home") { step(-2); return; }
    if (k === "End") { step(Math.max(0.001, 1 - target)); return; }
    const size = k.startsWith("Arrow") ? 0.04 : 0.15;
    step((DOWN.includes(k) || (space && !e.shiftKey)) ? size : -size);
  }, { capture: true });

  // Esc: straight out when caught; otherwise the scene plays back to the start
  function bail() {
    if (state === "idle") return;
    if (state === "caught") { leave(); return; }
    if (state === "exiting") return;
    if (mode === "card") { card(-cardP); return; }
    set("reversing");
    escape = { from: Math.min(target, 1), t0: performance.now() };
  }

  // Clicks: on the rabbit (or the keyboard way in), a catch; on the car in the scene, its engine;
  // while caught, the pause button leaves and other controls leave and carry on
  addEventListener("click", (e) => {
    if (inBtn && inBtn.contains(e.target)) { e.preventDefault(); e.stopPropagation(); enter(); return; }
    if (state === "idle") {
      if (!ready() || !rain.rabbitAt(e.clientX, e.clientY)) return;
      e.preventDefault(); e.stopPropagation();
      catchIt();
      return;
    }
    if (state !== "caught") {
      if (scene && handed && mode === "scene" && state !== "exiting" && scene.pick(e.clientX, e.clientY)) { e.preventDefault(); e.stopPropagation(); }
      return;
    }
    if (pauseBtn && pauseBtn.contains(e.target)) { e.preventDefault(); e.stopPropagation(); leave(); return; }
    if (e.target.closest("a, button, summary")) leave();
  }, { capture: true });

  // A pointer over the rabbit, or over the car on the sill, shows it can be clicked
  addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse") return;
    const car = scene && handed && mode === "scene" && scene.over(e.clientX, e.clientY);
    body.classList.toggle("white-rabbit-hover", car || (state === "idle" && ready() && rain.rabbitAt(e.clientX, e.clientY)));
  }, { passive: true });

  // A new size redraws the TV picture and the framing; progress is kept
  let resizeTimer = 0;
  addEventListener("resize", () => {
    if (!scene || state === "idle") return;
    scene.resize();
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { if (scene && halted) scene.compose(); }, 150);
  });

  // Reduced motion turned on during an entry: the still card takes over at once, silently. Turned off,
  // the card stays until the entry ends; the next catch reads the preference again
  reduce.addEventListener("change", (e) => { if (e.matches) fallback(); });

  // ---- The card (reduced motion and fallbacks) ----
  // Scroll-linked and reversible, with nothing moving on its own: the page goes dark, the window and
  // its view come up out of the dark, then "go touch grass" rises from behind the trees. Scrolling
  // back reverses it, and back at the start the egg is disarmed
  let cardP = 0;
  function card(d) {
    cardP = clamp(cardP + d, 0, 1);
    root.style.setProperty("--card-dark", smooth(0, 0.15, cardP).toFixed(3));
    root.style.setProperty("--card-window", smooth(0.12, 0.55, cardP).toFixed(3));
    root.style.setProperty("--card-rise", smooth(0.55, 1, cardP).toFixed(3));
    if (cardP >= 1) { if (state !== "done") { set("done"); announce(true); } return; }
    set(d < 0 ? "reversing" : "playing");
    if (cardP > 0) return;
    ["--card-dark", "--card-window", "--card-rise"].forEach((k) => root.style.removeProperty(k));
    exit();
  }

  // ---- The scene loop ----
  // Runs only while the scene plays; the clouds keep moving at the end. stop() is called on every
  // way out (leave, exit, fallback), and a frame that finds the entry over or in the card doesn't
  // schedule another, so the loop can't outlive the scene
  function start() { if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } }
  function stop() { cancelAnimationFrame(raf); raf = 0; }

  // Follows the target with a critically damped spring and renders the frame
  function frame(now) {
    if (state === "idle" || state === "exiting" || mode !== "scene") { raf = 0; return; }
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (escape) {
      const t = clamp((now - escape.t0) / 1200, 0, 1);
      target = escape.from * (1 - smooth(0, 1, t));
    }
    // Hold at the landing until the scene is ready; going back up before then just leaves
    if (!prepared || !scene) { if ((state === "reversing" || escape) && target <= 0) exit(); return; }
    if (!handed) { scene.render(0, { still: true }); cover(true, "scene"); handed = true; }
    for (let t = dt; t > 0; t -= 1 / 120) {
      const h = Math.min(t, 1 / 120);
      v += (STIFF * (target - p) - DAMP * v) * h;
      if (!escape) v = clamp(v, -TOP, TOP);
      p += v * h;
    }
    const q = clamp(p, 0, 1);
    scene.render(q, { speed: Math.abs(v) });
    if (sound) sound.update(scene.beat, scene.facing, scene.wind, scene.open);
    root.dataset.progress = q.toFixed(3);
    grass.parentElement.style.opacity = smooth(0.993, 1, q).toFixed(3);
    if (q > 0.995) announce(true);
    if (state !== "done" && target >= 1 && p > 0.999 && Math.abs(v) < 0.01) set("done");
    if ((state === "reversing" || escape) && target <= 0 && p < 0.002 && Math.abs(v) < 0.02) { p = v = 0; exit(); }
  }

  // ---- Testing: ?rabbit=now keeps a rabbit on the landing, or ?rabbit=p0.5 catches one and jumps ahead ----
  const flag = new URLSearchParams(location.search).get("rabbit");
  if (flag) {
    const jump = /^p(\d*\.?\d+)$/.exec(flag);
    const tries = setInterval(() => {
      if (!ready() || !(rain.rabbit || rain.spawnRabbit())) return; // a still rain already has one
      root.dataset.spot = `${rain.rabbit.x} ${rain.rabbit.y}`; // where to click
      if (!jump) return;
      clearInterval(tries);
      setTimeout(() => {
        catchIt();
        step(Math.max(0.001, clamp(+jump[1], 0, 1)));
        target = p = clamp(+jump[1], 0, 1);
      }, 300);
    }, 300);
  }

  set("idle");
  return { ready };
}
