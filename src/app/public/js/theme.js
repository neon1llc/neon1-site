// src/app/public/js/theme.js - The light ("awake") or dark ("matrix") look of every part of neon1.tech outside the
// landing's rain: the home page's sections, the Knowledge Center, and the blog. The rain itself always stays dark.
//
// A plain blocking script in <head>, before the stylesheets, so the first paint already has the right theme and a
// dark page never flashes white. It sets html[data-site-theme] (not data-theme, which 1NEON uses for its own setting
// and which the shared stylesheets must never confuse with this). A visitor's pick is kept in localStorage under
// "neon1.theme"; until they pick, the site is awake (light), whatever the device's own setting (Pradeep, 2026-11-15).

(() => {
  const KEY = "neon1.theme";
  const root = document.documentElement;
  const still = matchMedia("(prefers-reduced-motion: reduce)");

  // ---- The theme: the visitor's pick, else awake ----
  // Storage can be blocked (private windows, strict settings); then each page starts awake
  const saved = () => {
    try { const v = localStorage.getItem(KEY); return v === "matrix" || v === "awake" ? v : null; } catch { return null; }
  };
  const wanted = () => saved() || "awake";

  // ---- Applying it: the attribute the CSS keys on, the switch's state, the browser bar's color ----
  function apply(theme) {
    root.dataset.siteTheme = theme;
    document.querySelectorAll(".theme-sw").forEach((b) => b.setAttribute("aria-checked", String(theme === "matrix")));
    // Light pages (the Knowledge Center, the blog) tint the browser's bar paper; in matrix it takes the dark ground.
    // The home page's bar color is the landing's black in both themes, so it is left alone
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.dataset.awake ||= meta.content;
      if (meta.dataset.awake.toUpperCase() === "#F2F4F2") meta.content = theme === "matrix" ? "#0F0A0D" : meta.dataset.awake;
    }
    document.dispatchEvent(new CustomEvent("n1:theme", { detail: { theme } }));
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

  apply(wanted());

  // ---- The switch in the bar: off is awake (sun, left), on is matrix (moon, right) ----
  function wire() {
    document.querySelectorAll(".theme-sw").forEach((b) => {
      b.setAttribute("aria-checked", String(root.dataset.siteTheme === "matrix"));
      b.addEventListener("click", () => {
        const next = root.dataset.siteTheme === "matrix" ? "awake" : "matrix";
        try { localStorage.setItem(KEY, next); } catch { /* not kept: this page still switches */ }
        shift(next);
        apply(next);
      });
    });
  }
  if (document.readyState === "loading") addEventListener("DOMContentLoaded", wire); else wire();

  // ---- Staying in step: other tabs, and a page restored by Back ----
  addEventListener("storage", (e) => { if (e.key === KEY) { shift(wanted()); apply(wanted()); } });
  addEventListener("pageshow", (e) => { if (e.persisted && root.dataset.siteTheme !== wanted()) apply(wanted()); });
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
