// src/app/public/js/viewport.js - Sets the page's viewport measures before the first paint.
//
// --vh is the visible height, which some mobile browsers report differently from
// CSS vh units. --sbw is the classic scrollbar's width, which 100vw includes, so
// full-bleed rows can span the page without widening it.

(() => {
  const root = document.documentElement;
  const set = () => {
    // Pinch zoom shrinks the visible height only because the page is magnified
    if (window.visualViewport && visualViewport.scale > 1.01) return;
    root.style.setProperty("--vh", (window.visualViewport ? visualViewport.height : innerHeight) + "px");
    root.style.setProperty("--sbw", Math.max(0, innerWidth - root.clientWidth) + "px");
  };
  set();
  addEventListener("resize", set);
  if (window.visualViewport) visualViewport.addEventListener("resize", set);
  // The scrollbar only appears once the body exists and overflows
  addEventListener("DOMContentLoaded", set);
})();
