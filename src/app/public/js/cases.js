// src/app/public/js/cases.js - Opens each case study, and each service, as a full panel over the page.
//
// "Read the case study" grows the card into the panel, and closing shrinks it
// back into the card. The scroll position never changes, so you return exactly
// where you were.
//
// An open panel is a history entry (#case-..., #service-...): Back closes it and Forward opens it again, the address can be shared or
// reloaded, and a #case-... link or address opens its panel. A panel opened from the address closes in place instead of stepping back,
// so Esc never leaves the page.
//
// One overlay at a time: while a case study is open it owns the screen. The page behind it, the chat, and the rain controls are inert,
// so pointer, keyboard, and a screen reader's cursor stay in the panel. The top bar is not: pressing anything in it closes the panel
// first and then acts, and so does a press outside the panel. The white rabbit (js/white-rabbit.js) can't open over the panel, and the
// chat steps aside (shared/chat.css hides it under body.case-open).

(() => {
  "use strict";
  // The panel, its content area and scrim, and the card it was opened from
  const layer = document.getElementById("caseLayer");
  if (!layer) return;
  const panel = layer.querySelector(".case-panel");
  const body = document.getElementById("caseBody");
  const scrim = layer.querySelector(".case-scrim");
  // Without native Web Animations or with reduced motion, the panel just appears and disappears.
  // Asked at every open and close, so turning on reduced motion mid-visit applies at once
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");
  const still = () => !panel.animate || reduce.matches;
  // Native animations on transform and opacity only, so the browser runs them off the main thread;
  // the curve overshoots slightly and settles, like a spring
  const SPRING = "cubic-bezier(.2, .9, .25, 1.06)";
  // What Tab can land on inside the panel, and what goes inert behind it
  const FOCUSABLE = 'a[href], button:not([disabled]), input, select, textarea, summary, [tabindex]:not([tabindex="-1"])';
  const BEHIND = ".awake, .rainctl, .n1chat-launch, .n1chat";
  // closed -> open -> closing -> closed; closing can be cut short by a new open
  let card = null, opener = null, state = "closed", closeId = 0, backstop = 0, saved = [];
  let pushed = false; // the open panel's history entry was added in this visit, so closing steps back out of it

  // Transform that makes the panel sit exactly over the card
  function fromCard() {
    const c = card.getBoundingClientRect(), p = panel.getBoundingClientRect();
    return `translate(${c.left - p.left}px, ${c.top - p.top}px) scale(${c.width / p.width}, ${c.height / p.height})`;
  }

  // The page behind goes inert while open; each element gets back the inert state it had, since the
  // rain controls keep their own (js/page.js makes them inert once scrolled out of sight)
  function isolate(on) {
    if (on) {
      saved = [...document.querySelectorAll(BEHIND)].map((el) => [el, el.inert]);
      saved.forEach(([el]) => (el.inert = true));
    } else {
      saved.forEach(([el, was]) => (el.inert = was));
      saved = [];
    }
  }

  // Stops whatever the panel is animating, opening or closing
  const halt = () => [panel, body, scrim].forEach((el) => el.getAnimations().forEach((a) => a.cancel()));

  // Fills the panel from the card's label, title, stat, and template, then grows it out of the card
  // Focus moves to the panel itself (so a screen reader starts at its title) and returns to the button on close
  // quiet: no grow from the card (an address, Back, or Forward opens it, and the card may be off screen). push: add the history entry
  function open(id, button, { quiet = false, push = false } = {}) {
    const next = document.getElementById("case-" + id) || document.getElementById(id); // a case, or a service card (#service-...)
    if (!next) return;
    if (state === "closing") settle(false); // a close still shrinking finishes now, leaving focus to this open
    card = next; opener = button || next.querySelector("[data-case]");
    if (push) {
      // The entry being left remembers where the page was, for Back
      history.replaceState({ ...history.state, y: scrollY }, "");
      history.pushState({ card: next.id }, "", "#" + next.id);
      pushed = true;
    }
    // A case brings its label and figures; a service brings its summary and when it fits
    const tpl = card.querySelector("template.deep");
    const idx = card.querySelector(".idx");
    body.replaceChildren(...(idx ? [idx.cloneNode(true)] : []));
    const h = document.createElement("h3");
    h.id = "casePanelTitle"; h.textContent = card.querySelector("h3").textContent;
    body.append(h, ...[...card.querySelectorAll(":scope > :is(.stat, .svc-line, .svc-when)")].map((el) => el.cloneNode(true)), tpl.content.cloneNode(true));
    layer.hidden = false;
    document.body.classList.add("case-open");
    document.documentElement.classList.add("case-lock");
    if (state === "closed") isolate(true);
    state = "open";
    panel.scrollTop = 0;
    if (!still() && !quiet) {
      const f = fromCard();
      scrim.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, easing: "ease-out" });
      panel.animate([{ transform: f }, { transform: "none" }], { duration: 460, easing: SPRING });
      body.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, delay: 120, easing: "ease-out", fill: "backwards" });
    }
    panel.focus({ preventScroll: true });
  }

  // Hides the panel, unlocks the page, and gives focus back to the card's button. Safe to call
  // again: a second call, or a late animation callback, finds it closed and does nothing
  function settle(refocus = true) {
    clearTimeout(backstop);
    if (state === "closed") return;
    state = "closed";
    pushed = false;
    halt();
    layer.hidden = true;
    document.body.classList.remove("case-open");
    document.documentElement.classList.remove("case-lock");
    isolate(false);
    panel.style.transform = ""; body.style.opacity = "";
    if (refocus && opener && opener.isConnected) opener.focus({ preventScroll: true });
  }

  // Shrinks the panel back into its card, then settles. Only an open panel closes, so repeated
  // Escapes or clicks don't restart the shrink. A cancelled animation rejects its finished promise
  // and a missing one never ends, so both paths, and a short backstop timer, settle this same close
  function close() {
    if (state !== "open") return;
    if (still()) { settle(); return; }
    state = "closing";
    const id = ++closeId;
    const finish = () => { if (state === "closing" && id === closeId) settle(); };
    halt(); // an opening still in flight
    const f = fromCard();
    body.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 120, fill: "forwards" });
    scrim.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, fill: "forwards" });
    panel.animate([{ transform: "none" }, { transform: f }], { duration: 380, easing: "cubic-bezier(.4, 0, .2, 1)", fill: "forwards" })
      .finished.then(finish, finish);
    backstop = setTimeout(finish, 700);
  }

  // A link in the panel closes it at once, whether it goes to a section of this page (contact, written "#contact" or
  // "/#contact") or to another page, so the page is never left, or come back to, with the panel still over it. Before the
  // page's own link handling (js/views.js) scrolls there and focuses it: captured, so the order doesn't depend on which
  // module registered first, and settled without the shrink or a refocus of the card (RC-C1). A link opened in a new tab
  // leaves the panel as it is
  document.addEventListener("click", (e) => {
    const a = state !== "closed" && e.target.closest(".case-panel a[href]");
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || a.target === "_blank") return;
    settle(false);
    // The entry the panel added now stands for the page without it, so Back from where the link goes never reopens the card
    if (history.state && history.state.card) history.replaceState({ ...history.state, card: undefined }, "", location.pathname + location.search);
  }, true);

  // The top bar stays in use while a panel is open. Pressing anything in it (a link, the menu button, a switch, the logo) closes the
  // panel first, at once and without refocusing the card, then does what it does; the bar's own click handling runs after this one.
  // The entry the panel added now stands for the page without it, as for a link inside the panel
  document.addEventListener("click", (e) => {
    if (state === "closed" || e.defaultPrevented || !e.target.closest(".n1-bar, .top")) return;
    settle(false);
    if (history.state && history.state.card) history.replaceState({ ...history.state, card: undefined }, "", location.pathname + location.search);
  }, true);

  // Card buttons open their case study; the scrim and close button close it
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-case]");
    if (b) { e.preventDefault(); open(b.dataset.case, b, { push: true }); return; }

    // Anywhere else on a card opens it too
    const c = state === "closed" && e.target.closest(".case, .svc");
    if (c) { const o = c.querySelector("[data-case]"); open(o.dataset.case, o, { push: true }); return; }
    if (e.target.closest("[data-close]")) dismiss();
  });

  // ---- History ----
  // The panel this entry stands for: one this page pushed (state.card), or a #case-... address or link
  const wanted = () => {
    const pushedId = history.state && history.state.card;
    if (pushedId && document.getElementById(pushedId)) return pushedId;
    const el = /^#case-[\w-]+$/.test(location.hash) && document.getElementById(location.hash.slice(1));
    return el && el.matches(".case") ? el.id : "";
  };
  // A card's id, as open() takes it: cases are named without their prefix
  const key = (cardId) => cardId.replace(/^case-/, "");
  // Opens or closes the panel to match the current entry
  function sync() {
    const id = wanted();
    if (id && (state !== "open" || !card || card.id !== id)) {
      open(key(id), null, { quiet: true });
      pushed = !!(history.state && history.state.card === id);
    } else if (!id && state !== "closed") { pushed = false; close(); }
  }
  // The close button, the scrim, and Esc: step back out of an entry this visit added, so Back and Close agree. An entry that was
  // there on arrival (an address, a reload) closes in place with the hash dropped, since stepping back would leave the page
  function dismiss() {
    if (state !== "open") return;
    if (pushed && history.state && card && history.state.card === card.id) {
      history.back();
      setTimeout(() => { if (state === "open") close(); }, 400); // a browser that never answers
      return;
    }
    if (location.hash) history.replaceState({ ...history.state, card: undefined }, "", location.pathname + location.search);
    close();
  }
  addEventListener("popstate", sync);
  // js/views.js adds the entry for a #case-... link and brings the card into view; the panel follows
  document.addEventListener("n1:case", (e) => { open(key(e.detail.id), null, { quiet: !e.detail.grow }); pushed = true; });
  sync(); // an address that names a case
  // The browser's own jump to the fragment clears focus as the page finishes loading, so the panel takes it back then
  if (state === "open" && document.readyState !== "complete") addEventListener("load", () => { if (state === "open") panel.focus({ preventScroll: true }); }, { once: true });

  // While open, Escape closes the panel and Tab cycles inside it. Focus starts on the panel itself,
  // so Tab and Shift+Tab from there (or from anywhere outside the panel) wrap to its first or last control
  addEventListener("keydown", (e) => {
    if (state !== "open") return;
    if (e.key === "Escape") { e.preventDefault(); dismiss(); return; }
    if (e.key !== "Tab") return;
    const f = [...panel.querySelectorAll(FOCUSABLE)].filter((el) => el.getClientRects().length);
    if (!f.length) { e.preventDefault(); panel.focus(); return; }
    const i = f.indexOf(document.activeElement);
    if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && (i < 0 || i === f.length - 1)) { e.preventDefault(); f[0].focus(); }
  });
})();
