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
// Testing: ?rabbit=now keeps a rabbit on the landing and notes its cell center on root
// as data-spot; ?rabbit=p0.5 catches one and jumps to that progress. Both only add
// rabbits, so they are harmless in production.


// Feel: scroll length for one pass, spring, rubber band, and gesture idle time
const PASS = 16;           // viewport heights of input for the whole walk
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

  // Progress: wanted and rendered, with the spring's velocity
  let state = "idle", mode = "scene", target = 0, p = 0, v = 0;
  let scene = null, loading = null, halted = false, prepared = false, handed = false;
  let raf = 0, last = 0, lastInput = 0, idleTimer = 0, disposeTimer = 0, escape = null, announced = false;
  let audio = null, sound = null;

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

  // A catch stops the rain and starts loading the scene, usually done before the first scroll
  function catchIt() {
    clearTimeout(disposeTimer);
    set("caught"); lock(true);
    body.classList.remove("white-rabbit-hover");
    target = p = v = 0; halted = prepared = handed = false; escape = null; cardP = 0;
    mode = reduce.matches ? "card" : "scene";
    root.dataset.mode = mode;
    openAudio();
    rain.halt((kind, ms) => sound && sound.glitch(kind, ms)).then(() => { halted = true; prepare(); });
    if (mode === "scene") load();
  }

  // Imports the scene once per page and builds it once per catch; any failure means the card
  function load() {
    if (scene) { prepare(); return; }
    loading = loading || import(SCENE);
    loading.then((m) => {
      if (state === "idle" || mode !== "scene") return;
      scene = m.createScene({ onLost: fallback, onSound: (kind) => sound && sound.car(kind) });
      prepare();
    }).catch(() => { loading = null; fallback(); });
  }

  // Draws the landing into the TV picture once the rain is still and the scene exists
  function prepare() {
    if (!halted || !scene || state === "idle" || mode !== "scene") return;
    scene.compose().then(() => { prepared = true; }).catch(fallback);
  }

  // No WebGL, a failed import, or a lost context mid-scene: the still card takes over
  function fallback() {
    if (state === "idle" || mode === "card") return;
    mode = "card";
    closeAudio();
    drop();
    if (state === "caught") return;
    handed = false;
    cover(true, "card"); card(Math.max(0.001, p) - cardP);
  }

  // Frees the scene's GPU memory; the imported modules stay cached for the next catch
  function drop() { if (scene) { scene.dispose(); scene = null; } prepared = false; }

  // ---- Leaving ----
  // Back to the landing without playing: the rain resumes and the rabbit is spent
  function leave() {
    set("idle"); lock(false); cover(false);
    rain.resume(); closeAudio();
    stop();
    disposeTimer = setTimeout(drop, 1000);
  }

  // After playing back to the start: the landing returns, then input settles before the page takes over
  function exit() {
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
      set("idle"); lock(false);
      disposeTimer = setTimeout(drop, 1000);
    }, IDLE);
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
    band();
  }

  // Input past the end springs back once the gesture stops
  function band() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => { target = Math.min(target, 1); }, IDLE);
  }

  // Pixels of scroll to progress
  const px = (d) => step(d / (PASS * innerHeight));
  const active = () => state !== "idle";

  // Wheel: lines and pages become pixels, as in views.js
  addEventListener("wheel", (e) => {
    if (!active() || e.ctrlKey) return;
    e.preventDefault(); e.stopPropagation();
    px(e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? innerHeight : 1));
  }, { capture: true, passive: false });

  // Touch: the first 6px pick the axis, and a flick keeps going for 260ms of its speed
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
    px(dy);
  }, { capture: true, passive: false });
  addEventListener("touchend", () => {
    if (!active() || axis !== "y") return;
    if (Math.abs(vel) > 0.3 && performance.now() - tLast < 100) px(vel * 260);
  }, { capture: true });

  // Keys: arrows nudge, paging and Space step, Home and End go to the ends, Esc always leaves
  addEventListener("keydown", (e) => {
    if (!active() || e.altKey || e.ctrlKey || e.metaKey) return;
    const k = e.key, space = k === " ";
    if (k === "Escape") { e.preventDefault(); e.stopPropagation(); bail(); return; }
    if (k === "Tab" && state !== "caught") { e.preventDefault(); return; }
    if (!space && !DOWN.includes(k) && !UP.includes(k)) return;
    e.preventDefault(); e.stopPropagation();
    if (state === "caught" && (UP.includes(k) || (space && e.shiftKey))) return;
    if (k === "Home") { step(-2); return; }
    if (k === "End") { step(Math.max(0.001, 1 - target)); return; }
    const size = k.startsWith("Arrow") ? 0.04 : 0.2;
    step((DOWN.includes(k) || (space && !e.shiftKey)) ? size : -size);
  }, { capture: true });

  // Esc: straight out when caught; otherwise the scene plays back to the start
  function bail() {
    if (state === "caught") { leave(); return; }
    if (state === "exiting") return;
    if (mode === "card") { card(-cardP); return; }
    set("reversing");
    escape = { from: Math.min(target, 1), t0: performance.now() };
  }

  // Clicks: on the rabbit, a catch; while caught, the pause button leaves and other controls leave and carry on
  addEventListener("click", (e) => {
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
    cover(false); announce(false);
    ["--card-dark", "--card-window", "--card-rise"].forEach((k) => root.style.removeProperty(k));
    set("exiting"); rain.resume(); closeAudio(); settle();
  }

  // ---- The scene loop ----
  // Runs only while the scene plays; the clouds keep moving at the end
  function start() { if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } }
  function stop() { cancelAnimationFrame(raf); raf = 0; }

  // Follows the target with a critically damped spring and renders the frame
  function frame(now) {
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
