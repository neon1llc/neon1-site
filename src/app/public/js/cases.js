// src/app/public/js/cases.js - Opens each case study as a full panel over the page.
//
// "Read the case study" grows the card into the panel, and closing shrinks it
// back into the card. The scroll position never changes, so you return exactly
// where you were.

(() => {
  "use strict";
  // The panel, its content area and scrim, and the card it was opened from
  // Without Motion or with reduced motion, the panel just appears and disappears
  const layer = document.getElementById("caseLayer");
  if (!layer) return;
  const panel = layer.querySelector(".case-panel");
  const body = document.getElementById("caseBody");
  const scrim = layer.querySelector(".case-scrim");
  const M = window.Motion;
  const still = !M || matchMedia("(prefers-reduced-motion: reduce)").matches;
  const spring = { type: "spring", stiffness: 260, damping: 30 };
  let card = null, opener = null;

  // Transform that makes the panel sit exactly over the card
  function fromCard() {
    const c = card.getBoundingClientRect(), p = panel.getBoundingClientRect();
    return { x: c.left - p.left, y: c.top - p.top, scaleX: c.width / p.width, scaleY: c.height / p.height };
  }

  // Fills the panel from the card's label, title, stat, and template, then grows it out of the card
  // Focus moves into the panel and returns to the button on close
  function open(id, button) {
    card = document.getElementById("case-" + id);
    opener = button;
    const tpl = card.querySelector("template.deep");
    body.innerHTML = "";
    body.append(card.querySelector(".idx").cloneNode(true));
    const h = document.createElement("h3");
    h.id = "casePanelTitle"; h.textContent = card.querySelector("h3").textContent;
    body.append(h, card.querySelector(".stat").cloneNode(true), tpl.content.cloneNode(true));
    layer.hidden = false;
    document.body.classList.add("case-open");
    document.documentElement.classList.add("case-lock");
    panel.scrollTop = 0;
    if (!still) {
      const f = fromCard();
      M.animate(scrim, { opacity: [0, 1] }, { duration: 0.3 });
      M.animate(panel, { x: [f.x, 0], y: [f.y, 0], scaleX: [f.scaleX, 1], scaleY: [f.scaleY, 1] }, spring);
      M.animate(body, { opacity: [0, 1] }, { duration: 0.35, delay: 0.12 });
    }
    panel.focus({ preventScroll: true });
  }

  // Shrinks the panel back into its card, then hides it and unlocks the page
  function close() {
    if (layer.hidden) return;
    const done = () => {
      layer.hidden = true;
      document.body.classList.remove("case-open");
      document.documentElement.classList.remove("case-lock");
      panel.style.transform = ""; body.style.opacity = "";
      if (opener) opener.focus({ preventScroll: true });
    };
    if (still) return done();
    const f = fromCard();
    M.animate(body, { opacity: 0 }, { duration: 0.12 });
    M.animate(scrim, { opacity: 0 }, { duration: 0.3 });
    M.animate(panel, { x: f.x, y: f.y, scaleX: f.scaleX, scaleY: f.scaleY }, spring).then(done);
  }

  // Card buttons open their case study; the scrim and close button close it
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-case]");
    if (b) { e.preventDefault(); open(b.dataset.case, b); return; }
    if (e.target.closest("[data-close]")) close();
  });

  // While open, Escape closes the panel and Tab cycles inside it
  addEventListener("keydown", (e) => {
    if (layer.hidden) return;
    if (e.key === "Escape") { e.preventDefault(); close(); }
    if (e.key === "Tab") { // keep focus inside the panel
      const f = [...panel.querySelectorAll("button, a[href]")];
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
})();
