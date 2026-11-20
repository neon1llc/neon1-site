// src/app/public/js/scroll-memory.js - Back, Forward, and reload put a page back at the exact spot it was left, on every generated page
// (Knowledge Center, blog, forms) and on the home page when it runs without Motion. The home page's steered scrolling keeps its own
// memory by view in js/views.js, through the same record.
//
// Each history entry has an id, and where it was scrolled is kept under that id (window.n1Entry, js/theme.js). A new link has no
// record, so it opens at its top or at its #fragment. The browser's own restoration is off: a #fragment URL made it jump to the
// fragment, smoothly on this site, and that jump could win over the restored spot. Absolute pixels are kept with the page's width
// and the fraction of the way down; a different width (a turned phone) uses the fraction.

(() => {
  if (!("scrollRestoration" in history) || !window.n1Entry || window.__n1ScrollMemory) return;
  window.__n1ScrollMemory = true;
  history.scrollRestoration = "manual";

  const root = document.documentElement;
  const room = () => Math.max(1, root.scrollHeight - innerHeight);
  const valid = (m) => (m && typeof m.y === "number" ? m : null);
  // The entry in hand. Kept here, not read from history.state when saving, because Safari already points history.state at the
  // page being returned to when the page being left gets its pagehide
  let here = n1Entry.id();

  // ---- Landing: hold the remembered spot until the reader takes over ----
  // spec is the spot being held (null: nothing remembered, so the top or the browser's own #fragment jump stands). It is held for
  // the first seconds of a visit, or of a Back/Forward within the page, until the reader scrolls, taps, or types. Content that
  // arrives late (fonts, images, folds) moves the spot, so it is put right again until then
  let spec = valid(n1Entry.get(here)), since = 0, moved = false;
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
  addEventListener("scroll", land, { passive: true });
  if (window.ResizeObserver) new ResizeObserver(land).observe(root);

  // ---- Remembering: once the page rests, when it is hidden or left, and just before a link is followed ----
  // A page being left can change shape under the same scroll (a phone's toolbar shifts as the next page starts to load), so
  // leaving saves the last scroll seen rather than reading it then
  let seenY = scrollY;
  function save(y = scrollY) {
    if (landing()) return; // until the reader has moved, the page is still landing: keep the older memory
    y = Math.round(y);
    n1Entry.set(here, { y, f: y / room(), w: innerWidth });
  }
  let timer = 0;
  addEventListener("scroll", () => { seenY = scrollY; clearTimeout(timer); timer = setTimeout(save, 200); }, { passive: true });
  addEventListener("pagehide", () => save(seenY));
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") save(seenY); });
  // Pressed, before the next page starts to load: the page still stands as the reader saw it
  for (const ev of ["pointerdown", "click"]) document.addEventListener(ev, (e) => { if (e.target instanceof Element && e.target.closest("a[href]")) { moved = true; save(); } }, true);

  // ---- Coming back: from the browser's cache, or between entries of this same page (#fragment links) ----
  // An entry never scrolled takes its fragment, else the top
  const fragmentY = () => {
    const id = decodeURIComponent(location.hash.slice(1)).split("?")[0], el = id && document.getElementById(id);
    if (!el) return 0;
    return Math.round(el.getBoundingClientRect().top + scrollY - (parseFloat(getComputedStyle(root).scrollPaddingTop) || 0));
  };
  const arrive = (m) => { spec = m; since = performance.now(); moved = false; land(); };
  addEventListener("pageshow", (e) => {
    if (!e.persisted) return;
    here = n1Entry.id();
    const m = valid(n1Entry.get(here));
    if (m) arrive(m);
  });
  const step = () => {
    clearTimeout(timer);
    const next = n1Entry.id();
    if (next === here) return; // popstate and hashchange both arrive for one move
    here = next;
    // A case card's entry belongs to the home page's case links (js/views.js), which put the card on screen
    if (history.state && history.state.card) { spec = null; return; }
    arrive(valid(n1Entry.get(here)) || { y: fragmentY(), f: 0, w: innerWidth });
  };
  addEventListener("popstate", step);
  // A script that pushed an entry (a Knowledge Center group link) has already put the page where it wants it
  addEventListener("n1:entry", () => { clearTimeout(timer); here = n1Entry.id(); spec = null; });
  addEventListener("hashchange", step);
})();
