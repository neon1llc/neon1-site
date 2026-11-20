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

  // ---- Applying it: the attributes the CSS keys on, the switch's state, the browser bar's color ----
  const BAR = { providence: "#F5F8F4", "desert-of-the-real": "#121A14" };
  function apply(look) {
    const biz = look === "providence" || look === "desert-of-the-real";
    root.dataset.siteStyle = biz ? "sentinel" : "matrix";
    root.dataset.siteLook = look;
    root.dataset.siteTheme = dark(look) ? "matrix" : "awake";
    document.querySelectorAll(".theme-sw:not(.style-sw)").forEach((b) => {
      b.setAttribute("aria-checked", String(dark(look)));
      b.title = "light or dark";
    });
    document.querySelectorAll(".style-sw").forEach((b) => b.setAttribute("aria-checked", String(biz)));
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
    if (next === "providence" || next === "desert-of-the-real" || root.dataset.siteStyle === "sentinel") { apply(next); return; }
    if (root.dataset.siteTheme === "matrix") dawn(() => { if (current === revision) apply(wantedLook()); });
    else { shift(next); apply(next); }
  }

  apply(wantedLook());

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
        change();
      });
    });
  }
  if (document.readyState === "loading") addEventListener("DOMContentLoaded", wire); else wire();

  // ---- Staying in step: other tabs, and a page restored by Back ----
  // A family change re-applies in place; the landing starts its Matrix effects only when needed
  addEventListener("storage", (e) => {
    if (e.key === KEY_STYLE || e.key === KEY_MODE || e.key === null) change();
  });
  addEventListener("pageshow", (e) => {
    if (!e.persisted) return;
    if (root.dataset.siteLook !== wantedLook()) change();
  });
  // A tab brought forward may have slept through a change made elsewhere
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && root.dataset.siteLook !== wantedLook()) change();
  });
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
  // The sentinel theme has no page effects at all, so pages simply change
  if (document.documentElement.dataset.siteStyle === "sentinel") return;
  const optIn = () => {
    try {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync("@media (prefers-reduced-motion: no-preference) { @view-transition { navigation: auto; } }");
      document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
    } catch { /* no fade: pages simply change */ }
  };
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
