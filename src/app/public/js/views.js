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

  // ---- Folds open in place ----
  // Views center their content, so a fold opening in the middle of one pushed everything above it up by
  // half its height, and the browser scrolled to make up for it, leaving the page outside the view it
  // was in; the next scroll then jumped. Before the first fold in a view opens, its content is pinned
  // where it already sits and grows downward instead. Clicks, Enter, and Space all arrive as a click
  function pin(v) {
    if (v.dataset.pinned) return;
    const first = v.firstElementChild;
    if (!first) return;
    const top = first.getBoundingClientRect().top - v.getBoundingClientRect().top - (parseFloat(getComputedStyle(first).marginTop) || 0);
    v.style.paddingTop = `${Math.max(0, top)}px`;
    v.style.justifyContent = "flex-start";
    v.style.alignContent = "start";
    v.dataset.pinned = "1";
  }
  const unpin = (v) => { v.style.paddingTop = v.style.justifyContent = v.style.alignContent = ""; delete v.dataset.pinned; delete v.dataset.top; };
  document.addEventListener("click", (e) => {
    const s = e.target instanceof Element && e.target.closest("summary");
    const v = s && s.closest(".view");
    if (v) pin(v);
  }, true);
  // A new screen size centers again any view whose folds are all closed
  addEventListener("resize", () => document.querySelectorAll(".view[data-pinned]").forEach((v) => { if (!v.querySelector("details[open]")) unpin(v); }));

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
  const THRESHOLD = 110;   // touch: finger travel (px) needed to move to the next view (55 still tipped over too easily; Pradeep asked for double)
  // Wheel and trackpad: a mouse notch is about 100px and a trackpad flick sends hundreds, so 55px tipped
  // over on a single notch. The wheel needs more travel, each event counts for at most WHEEL_STEP, and a
  // pull holds for WHEEL_HOLD ms between notches, so it takes about five deliberate notches or a long
  // swipe, never a stray notch or a flick's tail (three notches still felt too easy on desktop)
  const WHEEL_THRESHOLD = 250;
  const WHEEL_STEP = 50;
  const WHEEL_HOLD = 380;
  const GIVE = 0.7;        // how far the page moves per px of input while resisting
  const MAX_GIVE = 60;     // the most the page gives before it settles (more travel to tip over, so a bit more give to feel it)
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
  // A box that scrolls on its own (the contact message, a long answer) keeps the wheel or finger while it
  // can still move that way; at its edge the page takes over (AS-03)
  function innerScrolls(node, dy) {
    for (let n = node instanceof Element ? node : null; n && n !== document.body && n !== root; n = n.parentElement) {
      if (n.scrollHeight <= n.clientHeight + 1) continue;
      const oy = getComputedStyle(n).overflowY;
      if (n.tagName !== "TEXTAREA" && oy !== "auto" && oy !== "scroll") continue;
      if (dy > 0 ? n.scrollTop + n.clientHeight < n.scrollHeight - 1 : n.scrollTop > 0) return true;
    }
    return false;
  }

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
  let prevAbs = 0, steady = 0, lastDirect = false;

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
    if (paused() || !d || folding) return;
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
    // A wheel pull under way holds a little longer, so slow notches add up instead of springing back
    lastDirect = direct;
    idleTimer = setTimeout(function idle() {
      if (!lastDirect && pullDir && performance.now() - lastInput < WHEEL_HOLD) { idleTimer = setTimeout(idle, 40); return; }
      blockUntilIdle = false; release();
    }, IDLE);
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
    } else pull += direct ? Math.abs(d) : Math.min(WHEEL_STEP, Math.abs(d));

    // Momentum that runs into an edge is held back; a fresh push, or scrolling that keeps going, carries on
    const need = direct ? THRESHOLD : WHEEL_THRESHOLD;
    if (newGesture || pushing) gestureFromEdge = true;
    if (!gestureFromEdge) pull = Math.min(pull, need * 0.6);
    const t = Math.min(1, pull / need);
    target = pullBase + pullDir * Math.min(MAX_GIVE, pull * GIVE);
    setFade(views[pullIndex], 1 - 0.5 * t);
    setFade(views[pullIndex + pullDir], t);
    if (pull >= need) goTo(pullIndex + pullDir);
  }

  // ---- Folds: eased open and close, and the view makes room ----
  // A fold (the p.r.o.s.e groups, the questions, the contact form) opens with its height eased from the
  // label to the full content, and closes the same way back. On the first fold opened in a view, the
  // view glides from centered to its top, so its heading sits just under the bar with the usual spacing
  // and the opened content runs down from there. A view taller than the screen then scrolls inside
  // itself first, and only past its bottom edge does the pull to the next view begin. Closing the last
  // open fold glides the view back to centered. Input waits while a fold moves (folding)
  let folding = 0;
  const FOLD_TIME = 0.42;
  const TOP_GAP = 28; // the view's spacing above its heading once it sits at the top
  const viewOf = (d) => d.closest(".view");
  const centeredPad = (v) => {
    // Where the content sits when centered: measured with the pin lifted, then put straight back
    const keep = v.style.cssText;
    unpin(v);
    const first = v.firstElementChild;
    const pad = first.getBoundingClientRect().top - v.getBoundingClientRect().top - (parseFloat(getComputedStyle(first).marginTop) || 0);
    v.style.cssText = keep; v.dataset.pinned = "1";
    return Math.max(0, pad);
  };
  function toggleFold(d) {
    const v = viewOf(d), i = views.indexOf(v);
    const opening = !d.open;
    const s = d.querySelector(":scope > summary");
    folding++;
    const done = () => { folding = Math.max(0, folding - 1); y = target = scrollY; };
    const h0 = d.getBoundingClientRect().height;
    d.style.overflow = "hidden";
    if (opening) {
      d.open = true;
      const h1 = d.getBoundingClientRect().height;
      d.style.height = `${h0}px`;
      const runs = [animate(d, { height: [`${h0}px`, `${h1}px`] }, { duration: FOLD_TIME, ease: settleEase })];
      // The first fold opened in a centered view: the view glides to its top while the fold opens
      if (v && v.dataset.pinned && !v.dataset.top) {
        v.dataset.top = "1";
        const from = parseFloat(v.style.paddingTop) || 0;
        runs.push(animate(v, { paddingTop: [`${from}px`, `${TOP_GAP}px`] }, { duration: FOLD_TIME, ease: settleEase }));
        // The page lines up with the view's top in the same move, if it wasn't already there
        const top = range(i)[0];
        if (Math.abs(scrollY - top) > 2) runs.push(animate(scrollY, top, { duration: FOLD_TIME, ease: settleEase, onUpdate: (p) => scrollTo(0, p) }));
      }
      Promise.all(runs.map((r) => r.finished ?? r)).then(() => {
        d.style.height = d.style.overflow = "";
        // An opened fold's label stays in view: if it sits under the bar, the page eases to it
        const r = s.getBoundingClientRect();
        if (r.top < HEADER + 8) goTo(i, { y: scrollY + r.top - HEADER - TOP_GAP });
        done();
      }, done);
    } else {
      const h1 = s.getBoundingClientRect().height + (parseFloat(getComputedStyle(d).paddingTop) || 0) + (parseFloat(getComputedStyle(d).paddingBottom) || 0);
      const last = v && v.querySelectorAll("details[open]").length === 1;
      const runs = [animate(d, { height: [`${h0}px`, `${h1}px`] }, { duration: FOLD_TIME * 0.85, ease: settleEase })];
      Promise.all(runs.map((r) => r.finished ?? r)).then(() => {
        d.open = false;
        d.style.height = d.style.overflow = "";
        if (last && v.dataset.top) {
          // Back to centered: the page returns to the view's top while the content glides down to center
          delete v.dataset.top;
          const to = centeredPad(v), from = parseFloat(v.style.paddingTop) || 0;
          const moves = [animate(v, { paddingTop: [`${from}px`, `${to}px`] }, { duration: FOLD_TIME, ease: settleEase })];
          const top = range(i)[0];
          if (Math.abs(scrollY - top) > 2) moves.push(animate(scrollY, top, { duration: FOLD_TIME, ease: settleEase, onUpdate: (p) => scrollTo(0, p) }));
          Promise.all(moves.map((r) => r.finished ?? r)).then(() => { unpin(v); done(); }, done);
        } else done();
      }, done);
    }
  }
  // Clicks, Enter, and Space all arrive as a click on the summary; the browser's own instant toggle is
  // replaced by the eased one. The pin listener above has already fixed where the content sits
  document.addEventListener("click", (e) => {
    const s = e.target instanceof Element && e.target.closest("summary");
    const d = s && s.parentElement;
    if (!d || d.tagName !== "DETAILS" || !viewOf(d) || off || e.defaultPrevented) return;
    e.preventDefault();
    if (folding && d.style.height) return; // this fold is already moving
    toggleFold(d);
  });

  // ---- Wheel and trackpad ----
  // Line and page deltas are converted to pixels
  addEventListener("wheel", (e) => {
    if (e.ctrlKey || paused() || inChat(e.target)) return; // pinch zoom, open menu or case study, the chat
    if (rail && rail.contains(e.target) && (Math.abs(e.deltaX) > Math.abs(e.deltaY) || e.shiftKey)) return; // sideways through the cards
    if (innerScrolls(e.target, e.deltaY)) return;
    e.preventDefault();
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? vh() : 1;
    input(e.deltaY * unit);
  }, { passive: false });

  // ---- Touch ----
  // The last touch point, the locked axis, and vertical velocity in px per ms
  let tY = 0, tX = 0, axis = null, vel = 0, tLast = 0;
  let chatTouch = false, touchAt = null;
  addEventListener("touchstart", (e) => {
    chatTouch = inChat(e.target); touchAt = e.target;
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
    if (innerScrolls(touchAt, dy)) { tY = cy; tX = cx; return; } // the box scrolls itself
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
    // Keyboard focus follows the view, so the next Tab continues inside it (AS-02); the logo keeps its own
    if (!a.dataset.view) window.n1focus?.(id);
  });

  // ---- Keyboard focus: Tab and Shift+Tab ----
  // Focus moving into a section shows it at once (an entrance still waiting would leave the focused
  // control invisible) and settles the page so the control is in view below the bar, with the same
  // eased move as scrolling. Within a tall section only the smallest move that shows the control is made
  // Only focus moved by Tab counts; a click, a script (a case card's button), or Back leaves the page be
  let tabAt = -1e9;
  addEventListener("keydown", (e) => { if (e.key === "Tab") tabAt = performance.now(); }, true);
  document.addEventListener("focusin", (e) => {
    const t = e.target;
    if (off || performance.now() - tabAt > 600 || !(t instanceof Element) || t.closest("header, .menu, .n1chat, .case-panel, .skip")) return;
    const v = t.closest(".view, .hero"), i = views.indexOf(v);
    if (i < 0) return;
    if (v !== hero) {
      visited.add(v);
      v.style.opacity = "1";
      parts(v).forEach((el) => { el.style.opacity = "1"; el.style.transform = "none"; });
    }
    // Positions come from where the page is drawn right now (the browser may already have scrolled to it)
    const [top, bottom] = range(i), r = t.getBoundingClientRect();
    const elTop = scrollY + r.top, elBottom = elTop + r.height;
    let dest = indexAt(scrollY) === i ? scrollY : top;
    if (elBottom > dest + vh() - 16) dest = elBottom - vh() + 32;
    if (elTop < dest + HEADER + 8) dest = elTop - HEADER - 16;
    dest = Math.max(top, Math.min(bottom, dest));
    if (Math.abs(dest - scrollY) > 2) goTo(i, { y: dest });
  });

  // ---- Keep in step with scrolls the page didn't start (focus, find in page) ----
  function sync() {
    y = target = scrollY;
    const v = views[indexAt(y)];
    if (!visited.has(v)) enter(v);
    else v.style.opacity = "1";
  }
  addEventListener("scroll", () => {
    // Opened at a #section: the browser's own jump to it, which can come late, is put back on the view's top
    if (landing()) { land(); return; }
    if (!settling && !pullDir && Math.abs(scrollY - y) > 2) sync();
  }, { passive: true });

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
  // The first few seconds of a visit opened at a #section, until the visitor scrolls, clicks, or types
  let touched = false;
  for (const ev of ["pointerdown", "keydown", "touchstart", "popstate", "hashchange"]) addEventListener(ev, () => { touched = true; }, { capture: true, once: true });
  const landing = () => start > 0 && !lastInput && !touched && !settling && performance.now() < 4000 && Math.abs(scrollY - range(start)[0]) > 2;
  const land = () => { if (start > 0 && !lastInput && !touched && !settling) { scrollTo(0, range(start)[0]); sync(); } };
  land();
  // The browser's own jump to the #fragment can run after load and land 72px low, so land once more after it
  addEventListener("load", () => { land(); requestAnimationFrame(() => setTimeout(land, 0)); });
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
