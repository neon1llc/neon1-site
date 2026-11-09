// src/app/public/js/cases.js - Opens each case study as a full panel over the page.
//
// "Read the case study" grows the card into the panel, and closing shrinks it
// back into the card. The scroll position never changes, so you return exactly
// where you were.
//
// One overlay at a time: while a case study is open it owns the screen. Everything behind it,
// the bar and its menu button included, is inert, so pointer, keyboard, and a screen reader's
// cursor all stay in the panel; the menu (js/frame.js) and the white rabbit (js/white-rabbit.js)
// can't open over it, and the chat steps aside (shared/chat.css hides it under body.case-open).

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
  const BEHIND = ".n1-bar, .top, .awake, .rainctl, .n1chat-launch, .n1chat";
  // closed -> open -> closing -> closed; closing can be cut short by a new open
  let card = null, opener = null, state = "closed", closeId = 0, backstop = 0, saved = [];

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
  function open(id, button) {
    const next = document.getElementById("case-" + id);
    if (!next) return;
    if (state === "closing") settle(false); // a close still shrinking finishes now, leaving focus to this open
    card = next; opener = button;
    const tpl = card.querySelector("template.deep");
    body.replaceChildren(card.querySelector(".idx").cloneNode(true));
    const h = document.createElement("h3");
    h.id = "casePanelTitle"; h.textContent = card.querySelector("h3").textContent;
    body.append(h, card.querySelector(".stat").cloneNode(true), tpl.content.cloneNode(true));
    layer.hidden = false;
    document.body.classList.add("case-open");
    document.documentElement.classList.add("case-lock");
    if (state === "closed") isolate(true);
    state = "open";
    panel.scrollTop = 0;
    if (!still()) {
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

  // Card buttons open their case study; the scrim and close button close it
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-case]");
    if (b) { e.preventDefault(); open(b.dataset.case, b); return; }

    // Anywhere else on a card opens it too
    const c = state === "closed" && e.target.closest(".case");
    if (c) { const o = c.querySelector("[data-case]"); open(o.dataset.case, o); return; }
    if (e.target.closest("[data-close]")) close();
  });

  // While open, Escape closes the panel and Tab cycles inside it. Focus starts on the panel itself,
  // so Tab and Shift+Tab from there (or from anywhere outside the panel) wrap to its first or last control
  addEventListener("keydown", (e) => {
    if (state !== "open") return;
    if (e.key === "Escape") { e.preventDefault(); close(); return; }
    if (e.key !== "Tab") return;
    const f = [...panel.querySelectorAll(FOCUSABLE)].filter((el) => el.getClientRects().length);
    if (!f.length) { e.preventDefault(); panel.focus(); return; }
    const i = f.indexOf(document.activeElement);
    if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && (i < 0 || i === f.length - 1)) { e.preventDefault(); f[0].focus(); }
  });
})();
