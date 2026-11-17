// src/app/public/js/scroll-memory.js - Back, Forward, and reload put a page back at the exact spot it was left, on every generated page
// (Knowledge Center, blog, forms) and on the home page when it runs without Motion. The home page's steered scrolling keeps its own
// memory by view in js/views.js.
//
// The browser's own restoration is not enough here: a URL with a #fragment makes it jump to the fragment, smoothly on this site, and that
// jump can win over the restored spot. So each history entry keeps where it was last scrolled in history.state ("sm"), and this puts the
// page there, again after fonts and layout settle, until the reader moves. Absolute pixels are kept with the page's width and the
// fraction of the way down; a different width (a turned phone) uses the fraction.

(() => {
  if (!("scrollRestoration" in history) || window.__n1ScrollMemory) return;
  window.__n1ScrollMemory = true;
  history.scrollRestoration = "manual";

  const root = document.documentElement;
  const room = () => Math.max(1, root.scrollHeight - innerHeight);
  const read = (s) => (s && typeof s === "object" && s.sm && typeof s.sm.y === "number" ? s.sm : null);

  // ---- Landing: hold the remembered spot until the reader takes over ----
  // spec is the spot being held (null: nothing remembered, the browser's own #fragment jump stands). It is held for the first
  // seconds of a visit, or of a Back/Forward within the page, until the reader scrolls, taps, or types
  let spec = read(history.state), since = 0, moved = false;
  const wants = () => (spec.w === innerWidth ? spec.y : Math.round(spec.f * room()));
  const landing = () => spec !== null && !moved && performance.now() - since < (since ? 1500 : 4000);
  // Instantly, whatever the page's smooth scrolling says, so a fragment jump already under way is cut short
  const put = (y) => {
    const b = root.style.scrollBehavior;
    root.style.scrollBehavior = "auto";
    scrollTo(0, Math.max(0, Math.min(y, room())));
    root.style.scrollBehavior = b;
  };
  const land = () => { if (landing() && Math.abs(scrollY - wants()) > 2) put(wants()); };
  for (const ev of ["wheel", "touchstart", "pointerdown", "keydown"]) addEventListener(ev, () => { moved = true; }, { capture: true, passive: true });

  // The home page holds itself blank (js/viewport.js, "arriving") while it waits to land; show it once it has
  const show = () => root.classList.remove("arriving");
  land();
  requestAnimationFrame(() => requestAnimationFrame(show));
  addEventListener("load", () => { land(); requestAnimationFrame(() => setTimeout(() => { land(); show(); }, 0)); });
  if (document.fonts) document.fonts.ready.then(land);
  // The browser's own jump to a fragment can come after load; a late layout change moves the spot; both are put right
  addEventListener("scroll", land, { passive: true });
  if (window.ResizeObserver) new ResizeObserver(land).observe(root);

  // ---- Remembering: once the page rests, when it is hidden or left, and just before a link is followed ----
  // Every save carries this visit's token. Safari already points history.state at the page being returned to when the page being left
  // gets its pagehide, so a save made while leaving only counts when the entry in hand still carries this token; otherwise the page
  // would write its own position over the one it is going back to
  const token = Math.random().toString(36).slice(2);
  let saved = "";
  function save(leaving) {
    // Until the reader has moved, the page is still landing: keep the older memory
    if (landing()) return;
    if (leaving && !(history.state && history.state.sm && history.state.sm.t === token)) return;
    const y = Math.round(scrollY), key = y + "|" + innerWidth;
    if (key === saved) return;
    try { history.replaceState({ ...history.state, sm: { y, f: y / room(), w: innerWidth, t: token } }, ""); saved = key; } catch { /* Safari limits how often an entry may change */ }
  }
  let timer = 0;
  addEventListener("scroll", () => { clearTimeout(timer); timer = setTimeout(save, 200); }, { passive: true });
  addEventListener("pagehide", () => save(true));
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") save(true); });
  // The entry being left keeps its spot before a link moves on (a #fragment link starts a new entry)
  document.addEventListener("click", (e) => { if (e.target instanceof Element && e.target.closest("a[href]")) { moved = true; saved = ""; save(); } }, true);

  // ---- Back and Forward between entries of this same page (#fragment links) ----
  // Manual restoration leaves the page where it was, so the entry's own spot is put back; an entry never scrolled takes its fragment, else the top
  const fragmentY = () => {
    const id = decodeURIComponent(location.hash.slice(1)), el = id && document.getElementById(id);
    if (!el) return 0;
    return Math.round(el.getBoundingClientRect().top + scrollY - (parseFloat(getComputedStyle(root).scrollPaddingTop) || 0));
  };
  addEventListener("popstate", () => {
    saved = "";
    // A case card's entry belongs to the home page's case links (js/views.js), which put the card on screen
    if (history.state && history.state.card) { spec = null; return; }
    const m = read(history.state);
    spec = m || { y: fragmentY(), f: 0, w: innerWidth };
    since = performance.now();
    moved = false;
    land();
  });
})();
