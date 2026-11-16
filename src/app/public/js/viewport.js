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

  // Opened at a section (/#services, from the Knowledge Center's bar for one), the page would first paint its top, the black
  // hero and wordmark, and only then scroll to the section. Until js/views.js has landed there (it removes this class), the page
  // shows blank paper. It is hidden (opacity 0, with no transition so focus still works), not faded: the browser's page transition is the only fade on a move. A timer clears it if that script never does.
  // A remembered position (Back, Forward, reload) holds the page the same way
  const memo = history.state && history.state.pos;
  if (/^#(services|projects|process|why|work|faq|contact|case-[\w-]+)$/.test(location.hash) || (memo && (memo.v || memo.dy > 2))) {
    root.classList.add("arriving");
    setTimeout(() => root.classList.remove("arriving"), 2500);
    addEventListener("pageshow", (e) => { if (e.persisted) root.classList.remove("arriving"); });
  }
})();
