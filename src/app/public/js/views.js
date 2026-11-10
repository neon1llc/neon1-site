// src/app/public/js/views.js - Moves the page one section ("view") at a time.
//
// Scrolling at the edge of a view meets resistance: the page gives a little
// and the next view, if already seen, starts to fade in. Past a threshold the
// page settles into the next view, fast at first and slowing as it arrives.
// Views taller than the screen scroll normally until their edge. The first
// arrival at a view plays its entrance once: the heading fades in, then each
// piece rises into place in order. Later visits fade the whole view.
//
// Motion (motion.dev, MIT) runs the animations. With reduced motion or without
// Motion, the page scrolls natively and everything is visible. Turning on reduced
// motion while the page is open hands scrolling back to the browser at once, and
// a setup error shows everything rather than leaving views hidden.

(() => {
  "use strict";
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");

  // ---- Cards: previous and next buttons ----
  // Wired before the Motion check, so they work with reduced motion or without Motion too.
  // Each press moves one card width plus the gap; reduced motion jumps instead of gliding
  const rail = document.getElementById("cases");
  if (rail) {
    const step = () => rail.querySelector(".case").getBoundingClientRect().width + 20;
    document.querySelectorAll("[data-rail]").forEach((b) =>
      b.addEventListener("click", () => rail.scrollBy({ left: step() * +b.dataset.rail, behavior: reduce.matches ? "auto" : "smooth" })));
  }

  // ---- Case links: a link to one card lands on that card ----
  // Case links, such as the contact form's "a similar project", point at single cards (#case-home). Its
  // section comes into view, the row slides sideways to the card, the card is marked, and focus goes
  // to its open button, so keyboard and screen reader users arrive where the link said. Each case link
  // is a history entry: Back returns to where the link was, and Forward comes back to the card. Opening
  // the page at #case-... takes the same route. Wired before the Motion check, like the arrows; when
  // Motion steers the page it swaps in its own eased moves for toView and toY below
  const native = () => (reduce.matches ? "auto" : "smooth");
  let toView = (view) => view.scrollIntoView({ block: "start", behavior: native() });
  let toY = (y) => scrollTo({ top: y, behavior: native() });
  const caseCard = (hash) => {
    const el = /^#case-[\w-]+$/.test(hash) && document.getElementById(hash.slice(1));
    return el && el.matches(".case") ? el : null;
  };

  // Sideways to the card, to the same place a snap would put it, then mark and focus it
  function slide(card) {
    const pad = parseFloat(getComputedStyle(rail).scrollPaddingInlineStart) || 0;
    const left = rail.scrollLeft + card.getBoundingClientRect().left - rail.getBoundingClientRect().left - pad;
    rail.scrollTo({ left, behavior: native() });
    rail.querySelectorAll(".case.is-target").forEach((c) => c.classList.remove("is-target"));
    card.classList.add("is-target");
    card.querySelector("[data-case]").focus({ preventScroll: true });
  }
  const reveal = (card) => { toView(card.closest(".view")); slide(card); };

  if (rail) {
    document.addEventListener("click", (e) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      const a = e.target.closest('a[href^="#case-"]'), card = a && caseCard(a.getAttribute("href"));
      if (!card) return;
      e.preventDefault();
      // The entry being left remembers where the page was, for Back
      history.replaceState({ ...history.state, y: scrollY }, "");
      history.pushState({ card: card.id }, "", "#" + card.id);
      reveal(card);
    });
    // A frame later, so the browser's own scroll restoration for the entry has already run
    addEventListener("popstate", (e) => requestAnimationFrame(() => {
      const card = caseCard(location.hash);
      if (card) reveal(card);
      else if (e.state && typeof e.state.y === "number") toY(e.state.y);
    }));
  }

  // Opened at #case-...: the slide and focus wait for load, because the browser's own jump to the
  // fragment, which also scrolls the row, clears focus as the page finishes loading
  const first = rail && caseCard(location.hash);
  const arrive = () => slide(first);
  if (first) { if (document.readyState === "complete") arrive(); else addEventListener("load", arrive, { once: true }); }

  // Native scrolling stays in charge without Motion or with reduced motion
  const M = window.Motion;
  if (!M || reduce.matches) return;
  const { animate, stagger } = M;

  // Gesture feel and easing curves
  const HEADER = 64;
  const THRESHOLD = 40;    // input distance (px) needed to move to the next view
  const GIVE = 0.7;        // how far the page moves per px of input while resisting
  const MAX_GIVE = 32;     // the most the page gives before it settles
  const IDLE = 160;        // ms without input that ends a gesture
  const settleEase = [0.22, 1, 0.36, 1];
  const enterEase = [0.19, 1, 0.22, 1];

  // The hero counts as seen, so it never plays an entrance
  // Input pauses while the menu, a case study, or the white rabbit is open
  const root = document.documentElement;
  root.classList.add("motion-ready", "glide");
  try {
  const hero = document.querySelector(".hero");
  const views = [hero, ...document.querySelectorAll(".view")];
  const visited = new Set([hero]);
  const menu = document.getElementById("menu");
  let off = false; // reduced motion turned on mid-visit
  const paused = () => off || !menu.hidden || document.body.classList.contains("case-open") || document.body.classList.contains("white-rabbit-on");
  // The ask neon1 window scrolls on its own; page steering never takes its wheel, touch, or keys
  const inChat = (node) => node instanceof Element && !!node.closest(".n1chat");

  // ---- Layout: where each view starts and how far it scrolls inside ----
  const vh = () => (window.visualViewport ? visualViewport.height : innerHeight);
  const maxY = () => root.scrollHeight - vh();
  const docTop = (el) => el.getBoundingClientRect().top + scrollY;

  // First and last scroll positions of view i, clamped to the page
  function range(i) {
    const top = i === 0 ? 0 : Math.round(docTop(views[i]) - HEADER);
    const next = i + 1 < views.length ? Math.round(docTop(views[i + 1])) : maxY() + vh(); // the bottom of a view ends where the next one begins, under no header
    return [Math.min(top, maxY()), Math.min(Math.max(top, next - vh()), maxY())];
  }

  // The last view that starts at or above y
  function indexAt(y) {
    let i = 0;
    for (let k = 0; k < views.length; k++) if (range(k)[0] <= y + 2) i = k;
    return i;
  }

  // ---- Entrances and fades ----
  // The heading first, then each piece that rises in order
  const parts = (v) => [v.querySelector("h2"), ...v.querySelectorAll(".reveal-on")].filter(Boolean);

  // A first visit plays the entrance once; later visits only fade the view in
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

  // Only views already seen fade with a pull, so unseen ones keep their entrance
  const setFade = (v, t) => { if (v && v !== hero && visited.has(v)) v.style.opacity = t.toFixed(3); };

  // ---- State ----
  // Resistance tracks input so far, its direction, the view, and where it started
  // Trailing momentum after a settle is swallowed until input goes idle
  let y = scrollY, target = scrollY; // rendered and wanted scroll positions
  let pull = 0, pullDir = 0, pullIndex = 0, pullBase = 0;
  let settling = null;
  let lastInput = 0, gestureFromEdge = false, blockUntilIdle = false, idleTimer = 0;
  // Momentum fades, a person scrolling doesn't: two steps in a row that don't shrink count as a push
  let prevAbs = 0, steady = 0;

  // Eases the page toward the target every frame, except while a settle runs
  // The loop stops once the page is at rest, and input wakes it, so a still page costs nothing
  let looping = false;
  function render() {
    if (!settling) {
      const d = target - y;
      y = Math.abs(d) < 0.5 ? target : y + d * 0.2;
      if (Math.abs(y - scrollY) >= 1) scrollTo(0, y);
      if (y === target) { looping = false; return; }
    }
    requestAnimationFrame(render);
  }
  const wake = () => { if (!looping) { looping = true; requestAnimationFrame(render); } };

  // Settles into view i with one eased scroll, fading the old view out
  // The new view enters once most of the distance is covered
  function goTo(i, opts = {}) {
    i = Math.max(0, Math.min(views.length - 1, i));
    const from = pullDir ? pullIndex : indexAt(y);
    const [top, bottom] = range(i);
    // Coming back up lands at the end of a tall view; End goes to the very bottom; Back to a remembered
    // spot (opts.y) lands there, kept inside the view
    const dest = opts.y !== undefined ? Math.max(top, Math.min(bottom, opts.y)) : opts.end ? bottom : !opts.link && i < from ? bottom : top;
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

  // A gesture that ends short of the threshold springs back
  function release() {
    if (!pullDir) return;
    wake();
    target = pullBase;
    setFade(views[pullIndex], 1);
    setFade(views[pullIndex + pullDir], 0);
    pull = 0; pullDir = 0;
  }

  // One step of input, positive is down
  // Direct input, from touch, moves the page at once instead of easing
  function input(d, direct) {
    if (paused() || !d) return;
    const now = performance.now();
    const newGesture = now - lastInput > IDLE;
    lastInput = now;
    const abs = Math.abs(d);
    // A sudden jump in speed is a new flick starting before the last one has faded
    const jump = abs > prevAbs * 1.5 + 4;
    steady = newGesture || direct || jump ? 2 : abs >= 2 && abs >= prevAbs ? steady + 1 : 0;
    prevAbs = abs;
    const pushing = steady >= 2;
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => { blockUntilIdle = false; release(); }, IDLE);
    if (settling) return; // a settle runs to the end, and its input still counts toward idle
    wake();
    // Fading momentum after a settle is swallowed, but someone still scrolling carries on at once
    if (blockUntilIdle && !pushing) return;
    blockUntilIdle = false;

    // Inside a view the input scrolls; past its edge, resistance begins
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

    // Momentum that runs into an edge is held back; a fresh push, or scrolling that keeps going, carries on
    if (newGesture || pushing) gestureFromEdge = true;
    if (!gestureFromEdge) pull = Math.min(pull, THRESHOLD * 0.6);
    const t = Math.min(1, pull / THRESHOLD);
    target = pullBase + pullDir * Math.min(MAX_GIVE, pull * GIVE);
    setFade(views[pullIndex], 1 - 0.5 * t);
    setFade(views[pullIndex + pullDir], t);
    if (pull >= THRESHOLD) goTo(pullIndex + pullDir);
  }

  // ---- Wheel and trackpad ----
  // Line and page deltas are converted to pixels
  addEventListener("wheel", (e) => {
    if (e.ctrlKey || paused() || inChat(e.target)) return; // pinch zoom, open menu or case study, the chat
    if (rail && rail.contains(e.target) && (Math.abs(e.deltaX) > Math.abs(e.deltaY) || e.shiftKey)) return; // sideways through the cards
    e.preventDefault();
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? vh() : 1;
    input(e.deltaY * unit);
  }, { passive: false });

  // ---- Touch ----
  // The last touch point, the locked axis, and vertical velocity in px per ms
  let tY = 0, tX = 0, axis = null, vel = 0, tLast = 0;
  let chatTouch = false;
  addEventListener("touchstart", (e) => {
    chatTouch = inChat(e.target);
    if (e.touches.length !== 1) return;
    tY = e.touches[0].clientY; tX = e.touches[0].clientX; axis = null; vel = 0; tLast = performance.now();
  }, { passive: true });

  // The first 6px pick the axis; vertical drags drive the views
  addEventListener("touchmove", (e) => {
    if (e.touches.length !== 1 || paused() || chatTouch) return;
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

  // Lifting the finger springs back a pull, or lets a flick glide
  addEventListener("touchend", () => {
    if (axis !== "y" || settling || chatTouch) return;
    if (pullDir) { release(); return; }
    // A flick inside a tall view keeps gliding, and stops at the view's edge
    if (Math.abs(vel) > 0.3) {
      wake();
      const [top, bottom] = range(indexAt(target));
      target = Math.max(top, Math.min(bottom, target + vel * 260));
    }
  });

  // ---- Keyboard and links ----
  // Arrows and paging scroll inside a tall view, then move on at its edge
  // Form fields keep their keys, and Space still presses buttons and links
  addEventListener("keydown", (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey || paused() || settling || inChat(document.activeElement)) return;
    const tag = document.activeElement.tagName;
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(tag)) return;
    if (e.key === " " && /^(BUTTON|A|SUMMARY)$/.test(tag)) return;
    const i = indexAt(target), [top, bottom] = range(i);
    const down = ["ArrowDown", "PageDown"].includes(e.key) || (e.key === " " && !e.shiftKey);
    const up = ["ArrowUp", "PageUp"].includes(e.key) || (e.key === " " && e.shiftKey);
    if (down || up) {
      e.preventDefault();
      wake();
      const step = e.key.startsWith("Arrow") ? 80 : vh() * 0.85;
      if (down && target < bottom - 1) target = Math.min(bottom, target + step);
      else if (up && target > top + 1) target = Math.max(top, target - step);
      else goTo(i + (down ? 1 : -1));
    } else if (e.key === "Home") { e.preventDefault(); goTo(0, { link: true }); }
    else if (e.key === "End") { e.preventDefault(); goTo(views.length - 1, { end: true }); }
  });

  // In-page links settle at the top of their view, closing the menu first. A link with data-view
  // (the logo, a real link to neon1.tech) springs to that view instead of reloading
  document.addEventListener("click", (e) => {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return; // case links route above
    const a = e.target.closest('a[href^="#"], a[data-view]');
    if (!a || off) return;
    const id = a.dataset.view || a.getAttribute("href").slice(1);
    const el = document.getElementById(id);
    const v = el && (el.closest(".view") || el.closest(".hero") || (el.id === "top" ? hero : null));
    const i = views.indexOf(v);
    if (i < 0) return;
    e.preventDefault();
    if (!menu.hidden) document.getElementById("menuBtn").click();
    history.replaceState(null, "", a.dataset.view ? "/" : a.getAttribute("href"));
    goTo(i, { link: true });
  });

  // ---- Keep in step with scrolls the page didn't start (focus, find in page) ----
  function sync() {
    y = target = scrollY;
    const v = views[indexAt(y)];
    if (!visited.has(v)) enter(v);
    else v.style.opacity = "1";
  }
  addEventListener("scroll", () => { if (!settling && !pullDir && Math.abs(scrollY - y) > 2) sync(); }, { passive: true });

  // A resize keeps the position inside the current view
  addEventListener("resize", () => {
    if (settling) return;
    const [top, bottom] = range(indexAt(target));
    target = y = Math.max(top, Math.min(bottom, target));
  });

  // Case links settle like section links, and Back eases to the remembered spot; once reduced motion
  // takes over mid-visit (off), the native moves above come back
  const nativeView = toView, nativeY = toY;
  toView = (view) => (off ? nativeView(view) : goTo(views.indexOf(view), { link: true }));
  toY = (y) => (off ? nativeY(y) : goTo(indexAt(y), { y }));

  // Opened with a section link, or a case link's card: land on that view once fonts and layout settle
  const start = views.indexOf(first ? first.closest(".view") : document.getElementById(location.hash.slice(1)));
  history.scrollRestoration = "manual";
  // Fonts can change heights after the first paint, so land again until the visitor scrolls
  const land = () => { if (start > 0 && !lastInput && !settling) { scrollTo(0, range(start)[0]); sync(); } };
  land();
  addEventListener("load", land);
  if (document.fonts) document.fonts.ready.then(land);
  if (window.ResizeObserver) new ResizeObserver(land).observe(document.body);

  // Reduced motion turned on mid-visit: stop steering, show every view, and scroll natively
  reduce.addEventListener("change", (e) => {
    if (!e.matches || off) return;
    off = true;
    if (settling) settling.stop();
    root.classList.remove("motion-ready", "glide");
    views.forEach((v) => { v.style.opacity = ""; parts(v).forEach((el) => { el.style.opacity = ""; el.style.transform = ""; }); });
  });

  // Start in step with the current position; the render loop runs only while the page moves
  sync();
  } catch (err) {
    // Fail open: native scrolling, every view visible
    root.classList.remove("motion-ready", "glide");
    throw err;
  }
})();
