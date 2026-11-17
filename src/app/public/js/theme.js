// src/app/public/js/theme.js - The light ("awake") or dark ("matrix") look of every part of neon1.tech outside the
// landing's rain: the home page's sections, the Knowledge Center, and the blog. The rain itself always stays dark.
//
// A plain blocking script in <head>, before the stylesheets, so the first paint already has the right theme and a
// dark page never flashes white. It sets html[data-site-theme] (not data-theme, which 1NEON uses for its own setting
// and which the shared stylesheets must never confuse with this). A visitor's pick is kept in localStorage under
// "neon1.theme"; until they pick, the site is awake (light), whatever the device's own setting (Pradeep, 2026-11-15).
// A second choice sits above that one: the style, stylized (rain, glows, neon) or plain business, picked on the landing's first screen
// and kept under "neon1.style" (Pradeep, 2026-11-17). It sets html[data-site-style]; css/business.css does the rest.

(() => {
  const KEY = "neon1.theme";            // stylized: "awake" or "matrix"
  const KEY_BIZ = "neon1.theme.business"; // business: "alert" (light) or "lamp" (dark)
  const KEY_STYLE = "neon1.style";      // "stylized" (default) or "business": the landing's choice, which wins everywhere
  const root = document.documentElement;
  const still = matchMedia("(prefers-reduced-motion: reduce)");

  // ---- The style, and the theme inside it ----
  // Two styles, two themes each. Stylized is the matrix rain, the glows, and the neon: awake (light) and matrix (dark).
  // Business is the plain look with none of that: alert (light) and lamp (dark). Everything else (CSS, scripts, 1NEON) keeps
  // reading html[data-site-theme] as "awake" (light) or "matrix" (dark), so a business theme is that same light or dark with
  // html[data-site-style="business"] over it (css/business.css); html[data-site-look] is the theme's own name for anyone who needs it.
  // Storage can be blocked (private windows, strict settings); then each page starts stylized and awake
  const read = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
  const style = () => (read(KEY_STYLE) === "business" ? "business" : "stylized");
  const savedTheme = () => {
    if (style() === "business") { const v = read(KEY_BIZ); return v === "lamp" || v === "alert" ? v : null; }
    const v = read(KEY); return v === "matrix" || v === "awake" ? v : null;
  };
  // The first visit to the business style follows the device's light or dark setting (the only place the device is asked);
  // stylized is awake until a pick (Pradeep, 2026-11-15)
  const wantedLook = () => savedTheme() || (style() === "business" ? (matchMedia("(prefers-color-scheme: dark)").matches ? "lamp" : "alert") : "awake");
  const dark = (look) => look === "matrix" || look === "lamp";

  // ---- Applying it: the attributes the CSS keys on, the switch's state, the browser bar's color ----
  const BAR = { alert: "#F7F8FA", lamp: "#14171C" };
  function apply(look) {
    const biz = look === "alert" || look === "lamp";
    root.dataset.siteStyle = biz ? "business" : "stylized";
    root.dataset.siteLook = look;
    root.dataset.siteTheme = dark(look) ? "matrix" : "awake";
    document.querySelectorAll(".theme-sw:not(.style-sw)").forEach((b) => {
      b.setAttribute("aria-checked", String(dark(look)));
      b.title = biz ? "alert or lamp" : "awake or matrix";
    });
    document.querySelectorAll(".style-sw").forEach((b) => b.setAttribute("aria-checked", String(biz)));
    // Light pages (the Knowledge Center, the blog) tint the browser's bar paper; in matrix it takes the dark ground; business takes its own
    // plain grounds on every page, the landing included (its black belongs to the rain). The home page's bar color is otherwise left alone
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.dataset.awake ||= meta.content;
      if (biz) meta.content = BAR[look];
      else if (meta.dataset.awake.toUpperCase() === "#F2F4F2") meta.content = look === "matrix" ? "#0F0A0D" : meta.dataset.awake;
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
    root.classList.add(next === "matrix" ? "flick-on" : "flick-off");
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
  // Every change of theme after the first load goes through here. Stylized: leaving matrix is slow, entering it is the quick flick.
  // Business: always one plain, instant change, with no flicker, fade, or easing at all (the effects belong to the stylized look)
  function change(next) {
    if (root.dataset.siteLook === next) return;
    if (next === "alert" || next === "lamp" || root.dataset.siteStyle === "business") { apply(next); return; }
    if (root.dataset.siteTheme === "matrix") dawn(() => apply(next));
    else { shift(next); apply(next); }
  }

  apply(wantedLook());

  // ---- The switches in the bar ----
  // Theme: off is the light theme (sun, left), on is the dark one (moon, right), of whichever style is chosen.
  // Style: on the landing's first screen only; its pick is kept under KEY_STYLE and wins everywhere. The landing runs the rain and the
  // white rabbit only for the stylized look and starts them once, at load, so it reloads to change style (the choice is already stored,
  // so the new page paints in the new look from its first frame)
  function wire() {
    document.querySelectorAll(".theme-sw:not(.style-sw)").forEach((b) => {
      b.setAttribute("aria-checked", String(root.dataset.siteTheme === "matrix"));
      b.title = root.dataset.siteStyle === "business" ? "alert or lamp" : "awake or matrix";
      b.addEventListener("click", () => {
        const biz = root.dataset.siteStyle === "business";
        const next = root.dataset.siteTheme === "matrix" ? (biz ? "alert" : "awake") : (biz ? "lamp" : "matrix");
        try { localStorage.setItem(biz ? KEY_BIZ : KEY, next); } catch { /* not kept: this page still switches */ }
        change(next);
      });
    });
    document.querySelectorAll(".style-sw").forEach((b) => {
      b.setAttribute("aria-checked", String(root.dataset.siteStyle === "business"));
      b.addEventListener("click", () => {
        try { localStorage.setItem(KEY_STYLE, root.dataset.siteStyle === "business" ? "stylized" : "business"); } catch { /* not kept */ }
        if (document.getElementById("rain")) location.reload();
        else apply(wantedLook());
      });
    });
  }
  if (document.readyState === "loading") addEventListener("DOMContentLoaded", wire); else wire();

  // ---- Staying in step: other tabs, and a page restored by Back ----
  // A style change in another tab reloads the landing (its rain) and just re-applies elsewhere
  addEventListener("storage", (e) => {
    if (e.key === KEY_STYLE) { if (document.getElementById("rain")) location.reload(); else apply(wantedLook()); }
    else if (e.key === KEY || e.key === KEY_BIZ) change(wantedLook());
  });
  addEventListener("pageshow", (e) => {
    if (!e.persisted) return;
    if (root.dataset.siteStyle !== style() && document.getElementById("rain")) { location.reload(); return; }
    if (root.dataset.siteLook !== wantedLook()) apply(wantedLook());
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
  // The business style has no page effects at all, so pages simply change
  if (document.documentElement.dataset.siteStyle === "business") return;
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
