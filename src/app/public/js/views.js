// Views: the page moves one section ("view") at a time.
//
// Scrolling at the edge of a view meets resistance: the page gives a little
// and the next view, if already seen, starts to fade in. Past a threshold the
// page settles into the next view, fast at first and slowing as it arrives.
// Views taller than the screen scroll normally until their edge. The first
// arrival at a view plays its entrance once: the heading fades in, then each
// piece rises into place in order. Later visits fade the whole view.
//
// Motion (motion.dev, MIT) runs the animations. With reduced motion or without
// Motion, the page scrolls natively and everything is visible.
(() => {
  "use strict";
  const M = window.Motion;
  if (!M || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const { animate, stagger } = M;

  const HEADER = 64;
  const THRESHOLD = 70;    // input distance (px) needed to move to the next view
  const GIVE = 0.6;        // how far the page moves per px of input while resisting
  const MAX_GIVE = 48;     // the most the page gives before it settles
  const IDLE = 160;        // ms without input that ends a gesture
  const settleEase = [0.22, 1, 0.36, 1];
  const enterEase = [0.19, 1, 0.22, 1];

  const root = document.documentElement;
  root.classList.add("motion-ready", "glide");
  const hero = document.querySelector(".hero");
  const views = [hero, ...document.querySelectorAll(".view")];
  const visited = new Set([hero]);
  const menu = document.getElementById("menu");
  const paused = () => !menu.hidden || document.body.classList.contains("case-open");

  // ---- Layout: where each view starts and how far it scrolls inside ----
  const vh = () => (window.visualViewport ? visualViewport.height : innerHeight);
  const maxY = () => root.scrollHeight - vh();
  const docTop = (el) => el.getBoundingClientRect().top + scrollY;
  function range(i) {
    const top = i === 0 ? 0 : Math.round(docTop(views[i]) - HEADER);
    const next = i + 1 < views.length ? Math.round(docTop(views[i + 1]) - HEADER) : maxY() + vh();
    return [Math.min(top, maxY()), Math.min(Math.max(top, next - vh()), maxY())];
  }
  function indexAt(y) {
    let i = 0;
    for (let k = 0; k < views.length; k++) if (range(k)[0] <= y + 2) i = k;
    return i;
  }

  // ---- Entrances and fades ----
  const parts = (v) => [v.querySelector("h2"), ...v.querySelectorAll(".reveal-on")].filter(Boolean);
  function enter(v) {
    if (v === hero) return;
    if (visited.has(v)) { animate(v, { opacity: 1 }, { duration: 0.5 }); return; }
    visited.add(v);
    v.style.opacity = "1";
    const [head, ...items] = parts(v);
    animate(head, { opacity: [0, 1] }, { duration: 0.6, ease: "easeOut" });
    if (items.length) {
      animate(items, { opacity: [0, 1], y: [14, 0] },
        { duration: 0.55, ease: enterEase, delay: stagger(Math.min(0.14, 1 / items.length), { startDelay: 0.45 }) });
    }
  }
  const setFade = (v, t) => { if (v && v !== hero && visited.has(v)) v.style.opacity = t.toFixed(3); };

  // ---- State ----
  let y = scrollY, target = scrollY; // rendered and wanted scroll positions
  let pull = 0, pullDir = 0, pullIndex = 0, pullBase = 0;
  let settling = null;
  let lastInput = 0, gestureFromEdge = false, blockUntilIdle = false, idleTimer = 0;

  function render() {
    if (!settling) {
      const d = target - y;
      y = Math.abs(d) < 0.5 ? target : y + d * 0.2;
      if (Math.abs(y - scrollY) >= 1) scrollTo(0, y);
    }
    requestAnimationFrame(render);
  }

  function goTo(i, opts = {}) {
    i = Math.max(0, Math.min(views.length - 1, i));
    const from = pullDir ? pullIndex : indexAt(y);
    const [top, bottom] = range(i);
    // Coming back up lands at the end of a tall view; End goes to the very bottom.
    const dest = opts.end ? bottom : !opts.link && i < from ? bottom : top;
    if (settling) settling.stop();
    const fromView = views[from], toView = views[i];
    pull = 0; pullDir = 0;
    const distance = Math.abs(dest - y);
    const duration = Math.min(1.25, 0.7 + distance / 4000);
    if (fromView !== toView && fromView !== hero && visited.has(fromView)) animate(fromView, { opacity: 0 }, { duration: duration * 0.6 });
    let entered = false;
    blockUntilIdle = true;
    settling = animate(y, dest, {
      duration, ease: settleEase,
      onUpdate: (v) => {
        y = target = v; scrollTo(0, v);
        if (!entered && Math.abs(v - dest) < distance * 0.4) { entered = true; enter(toView); }
      },
      onComplete: () => {
        settling = null; y = target = dest;
        if (!entered) enter(toView);
        if (performance.now() - lastInput > IDLE) blockUntilIdle = false; // nothing left to swallow
      },
    });
  }

  function release() { // the gesture ended short of the threshold: spring back
    if (!pullDir) return;
    target = pullBase;
    setFade(views[pullIndex], 1);
    setFade(views[pullIndex + pullDir], 0);
    pull = 0; pullDir = 0;
  }

  // One step of input, positive is down.
  function input(d, direct) {
    if (settling || paused() || !d) return;
    const now = performance.now();
    const newGesture = now - lastInput > IDLE;
    lastInput = now;
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => { blockUntilIdle = false; release(); }, IDLE);
    if (blockUntilIdle) return; // swallow trailing momentum after a settle

    if (!pullDir) {
      const i = indexAt(target), [top, bottom] = range(i);
      if (newGesture) gestureFromEdge = (d > 0 && target >= bottom - 1) || (d < 0 && target <= top + 1);
      const next = target + d;
      if (next >= top && next <= bottom) { target = next; if (direct) { y = target; scrollTo(0, y); } return; }
      const dir = next > bottom ? 1 : -1;
      target = dir > 0 ? bottom : top;
      if ((dir > 0 && i === views.length - 1) || (dir < 0 && i === 0)) return;
      pullDir = dir; pullIndex = i; pullBase = target; pull = 0;
    }
    if (Math.sign(d) !== pullDir) { // reversing while resisting
      pull = Math.max(0, pull - Math.abs(d));
      if (!pull) { release(); return; }
    } else pull += Math.abs(d);

    // Momentum that runs into an edge is held back; a fresh push from the edge carries on.
    if (newGesture) gestureFromEdge = true;
    if (!gestureFromEdge) pull = Math.min(pull, THRESHOLD * 0.6);
    const t = Math.min(1, pull / THRESHOLD);
    target = pullBase + pullDir * Math.min(MAX_GIVE, pull * GIVE);
    setFade(views[pullIndex], 1 - 0.5 * t);
    setFade(views[pullIndex + pullDir], t);
    if (pull >= THRESHOLD) goTo(pullIndex + pullDir);
  }

  // ---- Wheel and trackpad ----
  const rail = document.getElementById("cases");
  addEventListener("wheel", (e) => {
    if (e.ctrlKey || paused()) return; // pinch zoom, open menu or case study
    if (rail && rail.contains(e.target) && (Math.abs(e.deltaX) > Math.abs(e.deltaY) || e.shiftKey)) return; // sideways through the cards
    e.preventDefault();
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? vh() : 1;
    input(e.deltaY * unit);
  }, { passive: false });

  // ---- Touch ----
  let tY = 0, tX = 0, axis = null, vel = 0, tLast = 0;
  addEventListener("touchstart", (e) => {
    if (e.touches.length !== 1) return;
    tY = e.touches[0].clientY; tX = e.touches[0].clientX; axis = null; vel = 0; tLast = performance.now();
  }, { passive: true });
  addEventListener("touchmove", (e) => {
    if (e.touches.length !== 1 || paused()) return;
    const cy = e.touches[0].clientY, cx = e.touches[0].clientX;
    const dy = tY - cy, dx = tX - cx;
    if (!axis) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
    }
    if (axis === "x") return; // sideways, e.g. the work cards
    e.preventDefault();
    const now = performance.now();
    vel = dy / Math.max(1, now - tLast);
    tLast = now; tY = cy; tX = cx;
    input(dy, true);
  }, { passive: false });
  addEventListener("touchend", () => {
    if (axis !== "y" || settling) return;
    if (pullDir) { release(); return; }
    // A flick inside a tall view keeps gliding, and stops at the view's edge.
    if (Math.abs(vel) > 0.3) {
      const [top, bottom] = range(indexAt(target));
      target = Math.max(top, Math.min(bottom, target + vel * 260));
    }
  });

  // ---- Keyboard and links ----
  addEventListener("keydown", (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey || paused() || settling) return;
    const tag = document.activeElement.tagName;
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(tag)) return;
    if (e.key === " " && /^(BUTTON|A|SUMMARY)$/.test(tag)) return;
    const i = indexAt(target), [top, bottom] = range(i);
    const down = ["ArrowDown", "PageDown"].includes(e.key) || (e.key === " " && !e.shiftKey);
    const up = ["ArrowUp", "PageUp"].includes(e.key) || (e.key === " " && e.shiftKey);
    if (down || up) {
      e.preventDefault();
      const step = e.key.startsWith("Arrow") ? 80 : vh() * 0.85;
      if (down && target < bottom - 1) target = Math.min(bottom, target + step);
      else if (up && target > top + 1) target = Math.max(top, target - step);
      else goTo(i + (down ? 1 : -1));
    } else if (e.key === "Home") { e.preventDefault(); goTo(0, { link: true }); }
    else if (e.key === "End") { e.preventDefault(); goTo(views.length - 1, { end: true }); }
  });
  document.addEventListener("click", (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const el = document.getElementById(a.getAttribute("href").slice(1));
    const v = el && (el.closest(".view") || el.closest(".hero") || (el.id === "top" ? hero : null));
    const i = views.indexOf(v);
    if (i < 0) return;
    e.preventDefault();
    if (!menu.hidden) document.getElementById("menuBtn").click();
    history.replaceState(null, "", a.getAttribute("href"));
    goTo(i, { link: true });
  });

  // ---- Cards: previous and next buttons ----
  if (rail) {
    const step = () => rail.querySelector(".case").getBoundingClientRect().width + 20;
    document.querySelectorAll("[data-rail]").forEach((b) =>
      b.addEventListener("click", () => rail.scrollBy({ left: step() * +b.dataset.rail, behavior: "smooth" })));
  }

  // ---- Keep in step with scrolls the page didn't start (focus, find in page) ----
  function sync() {
    y = target = scrollY;
    const v = views[indexAt(y)];
    if (!visited.has(v)) enter(v);
    else v.style.opacity = "1";
  }
  addEventListener("scroll", () => { if (!settling && !pullDir && Math.abs(scrollY - y) > 2) sync(); }, { passive: true });
  addEventListener("resize", () => {
    if (settling) return;
    const [top, bottom] = range(indexAt(target));
    target = y = Math.max(top, Math.min(bottom, target));
  });
  const start = views.indexOf(document.getElementById(location.hash.slice(1)));
  // Opened with a section link: land on that view once fonts and layout settle.
  history.scrollRestoration = "manual";
  // Fonts can change heights after the first paint, so land again until the visitor scrolls.
  const land = () => { if (start > 0 && !lastInput && !settling) { scrollTo(0, range(start)[0]); sync(); } };
  land();
  addEventListener("load", land);
  if (document.fonts) document.fonts.ready.then(land);
  if (window.ResizeObserver) new ResizeObserver(land).observe(document.body);
  sync();
  requestAnimationFrame(render);
})();
