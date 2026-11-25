// src/app/public/js/theme.js - Matrix or sentinel, with one independent light/dark preference across the site.
// A blocking head script sets the look before paint. data-site-theme retains the CSS compatibility values
// awake/matrix; data-site-look names awake, plugged, providence, or desert-of-the-real.

(() => {
  const KEY_MODE = "neon1.mode";
  const KEY_STYLE = "neon1.style";
  const KEY_SHARED = "neon1.theme.shared";
  const root = document.documentElement;
  const still = matchMedia("(prefers-reduced-motion: reduce)");

  // Keep the selected family and mode independent; old preferences migrate without losing their mode
  const memory = new Map();
  const read = (key) => { if (memory.has(key)) return memory.get(key); try { return localStorage.getItem(key); } catch { return null; } };
  const write = (key, value) => { try { localStorage.setItem(key, value); memory.delete(key); return true; } catch { memory.set(key, value); return false; } };
  const style = () => ["matrix", "stylized"].includes(read(KEY_STYLE)) ? "matrix" : "sentinel";
  const dark = (look) => ["plugged", "desert-of-the-real", "matrix", "lamp"].includes(look);
  const mode = () => {
    const saved = read(KEY_MODE);
    if (saved === "light" || saved === "dark") return saved;
    const legacy = read(style() === "sentinel" ? "neon1.theme.business" : "neon1.theme");
    return dark(legacy) ? "dark" : "light";
  };
  const lookFor = (family, mode) => family === "sentinel" ? (mode === "dark" ? "desert-of-the-real" : "providence") : (mode === "dark" ? "plugged" : "awake");
  const wantedLook = () => lookFor(style(), mode());
  write(KEY_MODE, mode());

  // ---- One choice across neon1's hosts ----
  // An explicit choice also travels in the n1_look cookie on neon1.tech, so the owner's portal on its own host follows it and a
  // choice made there comes back. KEY_SYNC remembers the last value both sides held: a cookie that differs was changed elsewhere
  // and wins; otherwise a local choice that differs (made here or in 1NEON) is the newer one
  const KEY_SYNC = "neon1.theme.cookie";
  const cookieLook = () => /(?:^|;\s*)n1_look=(sentinel|matrix)\.(light|dark)(?:;|$)/.exec(document.cookie || "");
  function publish() {
    if (read(KEY_SHARED) !== "1" || typeof location === "undefined") return;
    const value = `${style()}.${mode()}`;
    const host = location.hostname || "";
    const parent = host === "neon1.tech" || host.endsWith(".neon1.tech") ? "; Domain=neon1.tech; Secure" : "";
    document.cookie = `n1_look=${value}; Path=/; Max-Age=34560000; SameSite=Lax${parent}`;
    write(KEY_SYNC, value);
  }
  function reconcile() {
    const found = cookieLook();
    const value = found ? `${found[1]}.${found[2]}` : "";
    if (found && value !== read(KEY_SYNC)) {
      write(KEY_STYLE, found[1]);
      write(KEY_MODE, found[2]);
      write(KEY_SHARED, "1");
      write(KEY_SYNC, value);
    } else if (value !== `${style()}.${mode()}`) publish();
  }
  reconcile();

  // ---- Applying it: the attributes the CSS keys on, the switch's state, the browser bar's color ----
  const BAR = { providence: "#F5F8F4", "desert-of-the-real": "#121A14" };
  // The tab icon follows the site's mode, not only the browser's: one drawing, colored here. favicon.svg covers the first paint
  const TAB = "M6 6a24 24 0 0 1 24 24v30M6 18a12 12 0 0 1 12 12v30M34 6a24 24 0 0 1 24 24v30M34 18a12 12 0 0 1 12 12v30";
  function tabIcon() {
    const link = document.querySelector('link[rel="icon"][type="image/svg+xml"]');
    if (!link) return;
    const color = dark(root.dataset.siteLook) ? "#6CFFA8" : "#327641";
    link.href = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="1 2 62 62"><path d="${TAB}" fill="none" stroke="${color}" stroke-width="5.5" stroke-linecap="round"/></svg>`)}`;
  }
  function apply(look) {
    const biz = look === "providence" || look === "desert-of-the-real";
    root.dataset.siteStyle = biz ? "sentinel" : "matrix";
    root.dataset.siteLook = look;
    root.dataset.siteTheme = dark(look) ? "matrix" : "awake";
    tabIcon();
    document.querySelectorAll(".theme-sw:not(.style-sw)").forEach((b) => {
      b.setAttribute("aria-checked", String(dark(look)));
      b.title = "light or dark";
    });
    document.querySelectorAll(".style-sw").forEach((b) => b.setAttribute("aria-checked", String(biz)));
    document.querySelectorAll("[data-look]").forEach((b) => b.setAttribute("aria-pressed", String((b.dataset.look === "sentinel") === biz)));
    // Light pages (the Knowledge Center, the blog) tint the browser's bar paper; in plugged it takes the dark ground; sentinel takes its own
    // plain grounds on every page, the landing included (its black belongs to the rain). The home page's bar color is otherwise left alone
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.dataset.awake ||= meta.content;
      if (biz) meta.content = BAR[look];
      else if (meta.dataset.awake.toUpperCase() === "#F2F4F2") meta.content = dark(look) ? "#0F0A0D" : meta.dataset.awake;
      else meta.content = meta.dataset.awake;
    }
    document.dispatchEvent(new CustomEvent("n1:theme", { detail: { theme: root.dataset.siteTheme, look, style: root.dataset.siteStyle } }));
  }

  // ---- A change eases, on the shared motion length; reduced motion makes it a plain change ----
  // css/frame.css gives every element a color transition only while html.theme-shift is set, so scrolling and hover
  // keep their own timing the rest of the time
  // The neon parts flicker instead of easing: going dark is one quick flick, and lighting up is a run of on, off, on, off, then a slow
  // on (css/frame.css, "Neon"). The class for it stays on for the longest of those runs
  let easing = 0, flicker = 0;
  function shift(next) {
    if (still.matches || root.dataset.motion === "off") return;
    const ms = parseFloat(getComputedStyle(root).getPropertyValue("--t-slow")) * 1000 || 450;
    root.classList.add("theme-shift");
    clearTimeout(easing);
    easing = setTimeout(() => root.classList.remove("theme-shift"), ms + 80);
    root.classList.remove("flick-on", "flick-off");
    void root.offsetWidth; // restart the animation if it was still running
    root.classList.add(dark(next) ? "flick-on" : "flick-off");
    clearTimeout(flicker);
    flicker = setTimeout(() => root.classList.remove("flick-on", "flick-off"), 2400);
  }

  // ---- Dark to awake is slow, as the eyes take the light after the dark (css/frame.css, "Dark to awake") ----
  // The change runs inside a view transition (the light page comes up over the dark one); a browser without one eases the colors
  // instead. Reduced motion or motion off: a plain change
  function dawn(change) {
    if (still.matches || root.dataset.motion === "off") { change(); return; }
    root.classList.remove("flick-on", "flick-off", "theme-shift");
    const done = () => root.classList.remove("dawn-vt", "theme-dawn");
    if (typeof document.startViewTransition === "function") {
      root.classList.add("dawn-vt");
      try { document.startViewTransition(change).finished.then(done, done); } catch { done(); change(); }
    } else {
      const ms = parseFloat(getComputedStyle(root).getPropertyValue("--dawn")) * 1000 || 2200;
      root.classList.add("theme-dawn");
      change();
      setTimeout(done, ms + 100);
    }
  }
  // Every change of theme after the first load goes through here. Matrix: leaving matrix is slow, entering it is the quick flick.
  // Sentinel: always one plain, instant change, with no flicker, fade, or easing at all (the effects belong to the matrix look)
  // Painting always reads the saved choice (storage) when it runs, never a value captured earlier: a dawn paints a frame or more
  // after it starts, and the choice may have moved on (another switch, another tab). `revision` also retires a dawn that a newer
  // change has replaced, so the page can only end on the newest saved choice, however quickly the switches are pressed
  let revision = 0;
  function change() {
    const current = ++revision;
    const next = wantedLook();
    if (root.dataset.siteLook === next) return;
    // Sentinel to Matrix: the light page goes down to the dark and the rain page comes up out of it. The browser's own fade between the two
    // let the light page show through the dark one as a grey haze, with the rain's glass area darker than the rest
    if (root.dataset.siteStyle === "sentinel" && (next === "awake" || next === "plugged") && !still.matches && root.dataset.motion !== "off" && typeof document.startViewTransition === "function") {
      root.classList.add("dusk-vt");
      const done = () => root.classList.remove("dusk-vt");
      try { document.startViewTransition(() => { if (current === revision) apply(wantedLook()); }).finished.then(done, done); } catch { done(); apply(next); }
      return;
    }
    if (next === "providence" || next === "desert-of-the-real" || root.dataset.siteStyle === "sentinel") { apply(next); return; }
    if (root.dataset.siteTheme === "matrix") dawn(() => { if (current === revision) apply(wantedLook()); });
    else { shift(next); apply(next); }
  }

  apply(wantedLook());
  // The script runs in the head, where the icon link may not be parsed yet
  addEventListener("DOMContentLoaded", tabIcon, { once: true });

  // Sentinel's bar is plain and light from the first paint. js/page.js sets the same classes, but as a module it runs after the
  // page has shown, so the landing's bar used to start as Matrix glass and fade to light on every visit. The observer catches the
  // header as the parser adds it; its callback runs before the browser can paint that header
  if (root.dataset.siteStyle === "sentinel") {
    const settle = () => {
      const bar = document.querySelector("header.n1-bar");
      if (!bar) return false;
      bar.classList.add("light");
      document.body?.classList.add("woke");
      return true;
    };
    if (!settle()) {
      const watch = new MutationObserver(() => { if (settle()) watch.disconnect(); });
      watch.observe(root, { childList: true, subtree: true });
      addEventListener("DOMContentLoaded", () => watch.disconnect(), { once: true });
    }
  }

  // The landing names the modules and the font its Matrix look uses. Only a Matrix visitor preloads them, so Sentinel downloads none
  if (root.dataset.siteStyle === "matrix" && document.head) {
    const hint = (rel, href, extra = {}) => {
      const link = document.createElement("link");
      Object.assign(link, { rel, href }, extra);
      document.head.appendChild(link);
    };
    for (const href of (root.dataset.matrixPreload || "").split(" ").filter(Boolean)) hint("modulepreload", href);
    if (root.dataset.matrixFont) hint("preload", root.dataset.matrixFont, { as: "font", type: "font/woff2", crossOrigin: "anonymous" });
  }

  // ---- The switches in the bar ----
  // Mode: off is light (sun, left), on is dark (moon, right), independent of family.
  // Style: on the landing's first screen only; its pick is kept under KEY_STYLE and wins everywhere
  function wire() {
    document.querySelectorAll(".theme-sw:not(.style-sw)").forEach((b) => {
      b.setAttribute("aria-checked", String(dark(wantedLook())));
      b.title = "light or dark";
      b.addEventListener("click", () => {
        write(KEY_MODE, mode() === "dark" ? "light" : "dark");
        write(KEY_SHARED, "1");
        publish();
        change();
      });
    });
    document.querySelectorAll(".style-sw").forEach((b) => {
      b.setAttribute("aria-checked", String(style() === "sentinel"));
      b.addEventListener("click", () => {
        // From the saved family, not from what is painted (a dawn may still be waiting to paint)
        const next = style() === "sentinel" ? "matrix" : "sentinel";
        write(KEY_MODE, mode());
        write(KEY_STYLE, next);
        write(KEY_SHARED, "1");
        publish();
        change();
      });
    });
  }
  // The footer's two buttons set the same family from any page, without moving the mode
  function wireLook() {
    document.querySelectorAll("[data-look]").forEach((b) => {
      b.setAttribute("aria-pressed", String((b.dataset.look === "sentinel") === (style() === "sentinel")));
      b.addEventListener("click", () => {
        if (style() === b.dataset.look) return;
        // The two looks differ in height above the footer (Sentinel's first screen is taller than Matrix's), so the page would jump:
        // the choice stays where it is on screen while the layout changes, for the moment the change takes to settle
        const row = (b.closest && b.closest(".look-pick")) || b, can = typeof row.getBoundingClientRect === "function" && typeof scrollBy === "function";
        const from = can ? row.getBoundingClientRect().top : 0;
        const hold = () => { if (!can) return; const d = row.getBoundingClientRect().top - from; if (Math.abs(d) > 0.5) scrollBy({ top: d, behavior: "instant" }); };
        const watch = can && window.ResizeObserver ? new ResizeObserver(hold) : null;
        watch?.observe(document.documentElement);
        const stop = () => { watch?.disconnect(); for (const ev of ["wheel", "touchstart", "keydown"]) removeEventListener(ev, stop, true); };
        for (const ev of ["wheel", "touchstart", "keydown"]) addEventListener(ev, stop, { capture: true, passive: true });
        setTimeout(stop, 1200);
        write(KEY_MODE, mode());
        write(KEY_STYLE, b.dataset.look);
        write(KEY_SHARED, "1");
        publish();
        change();
        hold();
        if (can) requestAnimationFrame(() => requestAnimationFrame(hold));
      });
    });
  }
  const start = () => { wire(); wireLook(); };
  if (document.readyState === "loading") addEventListener("DOMContentLoaded", start); else start();

  // ---- Staying in step: other tabs, and a page restored by Back ----
  // A family change re-applies in place; the landing starts its Matrix effects only when needed
  addEventListener("storage", (e) => {
    if (e.key === KEY_STYLE || e.key === KEY_MODE || e.key === null) change();
  });
  addEventListener("pageshow", (e) => {
    if (!e.persisted) return;
    reconcile();
    if (root.dataset.siteLook !== wantedLook()) change();
  });
  // A tab brought forward may have slept through a change made elsewhere
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;
    reconcile();
    if (root.dataset.siteLook !== wantedLook()) change();
  });
})();

// ---- Where each page was left: one record per history entry ----
// Every history entry carries its own id in history.state ("eid"): a page opened by a link, a #fragment entry, and a page that
// appears twice in the tab's history each get their own. Where an entry was scrolled is kept under its id in sessionStorage, which
// belongs to this tab only and starts empty in a new tab. js/scroll-memory.js and the home page's js/views.js save and restore
// through window.n1Entry; a new link has no record, so it opens at its top or its #fragment, and Back, Forward, and reload find theirs.
// Scripts that replace or push a state keep or get an id without knowing about it: both calls are wrapped here, before any other
// script runs
(() => {
  if (typeof history === "undefined" || !history.pushState) return; // not a browser page (the preference tests)
  const KEY = "n1.entries";
  const fresh = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const withId = (state, id) => (state && typeof state === "object" ? (state.eid ? state : { ...state, eid: id }) : { eid: id });
  const push = history.pushState.bind(history), replace = history.replaceState.bind(history);
  // A pushed entry is announced, so the scripts keeping its spot follow it (popstate and hashchange don't fire for a push)
  history.pushState = (state, title, url) => { push(withId(state, fresh()), title, url); dispatchEvent(new Event("n1:entry")); };
  history.replaceState = (state, title, url) => replace(withId(state, (history.state && history.state.eid) || fresh()), title, url);
  // A #fragment link followed natively makes an entry with no state; it gets its id the moment it arrives
  const id = () => {
    if (!(history.state && history.state.eid)) { try { replace(withId(history.state, fresh()), ""); } catch { return null; } }
    return history.state.eid;
  };
  id();
  addEventListener("hashchange", id);
  addEventListener("popstate", id);
  const all = () => { try { return JSON.parse(sessionStorage.getItem(KEY) || "{}"); } catch { return {}; } };
  try { sessionStorage.removeItem("n1.spots"); } catch { /* the old record, kept by page address */ }
  window.n1Entry = {
    id,
    get: (eid) => (eid && all()[eid]) || null,
    set: (eid, spot) => {
      if (!eid) return;
      try {
        const m = all();
        delete m[eid]; // the newest goes last, so the oldest is the one let go
        m[eid] = spot;
        const keys = Object.keys(m);
        if (keys.length > 100) delete m[keys[0]];
        sessionStorage.setItem(KEY, JSON.stringify(m));
      } catch { /* storage off: pages open at their top */ }
    },
  };
})();

// ---- The cross-fade between pages: only for a move from one neon1 page to the next ----
// The browser's own page transition (@view-transition) runs only when both pages opt in. Opting in from the stylesheet
// left a page blank on first open in some iPhone browsers built on WebKit (DuckDuckGo: a link from Gmail, or a typed
// address, showed a black page until the address was entered again), so a page opts in from here instead:
// - at once, before the first paint, when the visitor came from another neon1 page (a same-site referrer), so that move fades;
// - otherwise only once the page is showing, so an arrival from outside never waits on a transition, and the next move
//   inside the site still fades.
// Script-built stylesheets are not inline styles, so the strict CSP allows them. Reduced motion never fades.
(() => {
  if (!("adoptedStyleSheets" in document) || typeof CSSStyleSheet !== "function") return;
  // The opt-in is one stylesheet, added or removed as the look changes in this page: a visitor who switches to Matrix here gets the
  // fade on the next move, and one who switches to Sentinel loses it, though the page loaded the other way
  let sheet = null;
  const optIn = () => {
    if (sheet || document.documentElement.dataset.siteStyle === "sentinel") return;
    try {
      const next = new CSSStyleSheet();
      next.replaceSync("@media (prefers-reduced-motion: no-preference) { @view-transition { navigation: auto; } }");
      document.adoptedStyleSheets = [...document.adoptedStyleSheets, next];
      sheet = next;
    } catch { /* no fade: pages simply change */ }
  };
  const optOut = () => {
    if (!sheet) return;
    document.adoptedStyleSheets = document.adoptedStyleSheets.filter((s) => s !== sheet);
    sheet = null;
  };
  document.addEventListener("n1:theme", (e) => { if (e.detail.style === "sentinel") optOut(); else optIn(); });
  // The sentinel theme has no page effects at all, so pages simply change
  if (document.documentElement.dataset.siteStyle === "sentinel") return;
  let inside = false;
  try { inside = !!document.referrer && new URL(document.referrer).origin === location.origin; } catch { /* treat as outside */ }
  if (inside) optIn();
  // A browser with page transitions also has pagereveal, which fires just before the first paint; a frame after it the
  // page is showing, and opting in then only affects the next move
  else if ("onpagereveal" in window) addEventListener("pagereveal", () => requestAnimationFrame(() => setTimeout(optIn)), { once: true });
})();

// ---- A stylesheet that failed to load: one reload ----
// A page whose own stylesheet failed (a request cut short by a release switch or a dropped connection) shows as plain
// unstyled text. A failed stylesheet leaves link.sheet null or empty (an error page parses to no rules), so after load the
// page asks once more, and only once per tab and address, so a stylesheet that stays down can never loop
addEventListener("load", () => {
  try {
    const failed = [...document.querySelectorAll('link[rel="stylesheet"]')].some((l) => !l.sheet || l.sheet.cssRules.length === 0);
    const key = "neon1.reload:" + location.pathname;
    if (!failed) { sessionStorage.removeItem(key); return; }
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    location.reload();
  } catch { /* storage blocked: leave the page as it is */ }
});
