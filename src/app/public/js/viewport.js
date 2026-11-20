// src/app/public/js/viewport.js - Sets the page's viewport measures before the first paint.
//
// --vh is the visible height, which some mobile browsers report differently from
// CSS vh units. --sbw is the classic scrollbar's width, which 100vw includes, so
// full-bleed rows can span the page without widening it.

(() => {
  const root = document.documentElement;
  // A phone's keyboard shrinks the visible height, which would shrink every view and shift the page under the field being typed in;
  // while a text field has focus the height holds, and it updates once focus leaves (a turned phone, which changes the width, still does)
  let width = innerWidth, timer = 0;
  const typing = () => { const a = document.activeElement; return !!a && /^(INPUT|TEXTAREA)$/.test(a.tagName) && !/^(checkbox|radio|button|submit|reset|file|range|color|image)$/.test(a.type || ""); };
  const set = () => {
    // Pinch zoom shrinks the visible height only because the page is magnified
    if (window.visualViewport && visualViewport.scale > 1.01) return;
    const turned = innerWidth !== width;
    width = innerWidth;
    if (typing() && !turned && root.style.getPropertyValue("--vh")) return;
    root.style.setProperty("--vh", (window.visualViewport ? visualViewport.height : innerHeight) + "px");
    root.style.setProperty("--sbw", Math.max(0, innerWidth - root.clientWidth) + "px");
  };
  set();
  addEventListener("resize", set);
  // The keyboard takes a moment to close after focus leaves
  addEventListener("focusout", () => { clearTimeout(timer); timer = setTimeout(set, 500); }, true);
  if (window.visualViewport) visualViewport.addEventListener("resize", set);
  // The scrollbar only appears once the body exists and overflows
  addEventListener("DOMContentLoaded", set);

  // Opened at a section (/#services, from the Knowledge Center's bar for one), the page would first paint its top, the black
  // hero and wordmark, and only then scroll to the section. Until js/views.js has landed there (it removes this class), the page
  // shows blank paper. It is hidden (opacity 0, with no transition so focus still works), not faded: the browser's page transition is the only fade on a move. A timer clears it if that script never does.
  // A remembered position (Back, Forward, reload) holds the page the same way
  // (the entry's record from js/theme.js, which runs first)
  const memo = window.n1Entry && n1Entry.get(n1Entry.id());
  if (/^#(services|projects|process|why|work|faq|contact|case-[\w-]+)$/.test(location.hash) || (memo && (memo.v || memo.dy > 2 || memo.y > 2))) {
    root.classList.add("arriving");
    setTimeout(() => root.classList.remove("arriving"), 2500);
    addEventListener("pageshow", (e) => { if (e.persisted) root.classList.remove("arriving"); });
  }
})();
