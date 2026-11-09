// src/app/public/js/knowledge.js - The knowledge center's search: filters the shelves as you type. Without
// it the page still lists every document, and the box stays hidden.
{
  const box = document.querySelector(".kc-search");
  const input = document.getElementById("kc-q");
  const status = document.getElementById("kc-results");
  const cards = [...document.querySelectorAll(".kc-card")];
  const shelves = [...document.querySelectorAll(".kc-shelf")];
  const groups = [...document.querySelectorAll(".kc-group")];
  // A search opens the developer folds that hold a match, and clearing it closes the ones it opened
  const folds = [...document.querySelectorAll(".kc-fold")];
  const opened = new Set();

  if (box && input && cards.length) {
    box.hidden = false;
    const total = cards.length;

    function filter() {
      const words = input.value.toLowerCase().split(/\s+/).filter(Boolean);
      let shown = 0;
      for (const card of cards) {
        const hit = words.every((w) => card.dataset.words.includes(w));
        card.hidden = !hit;
        if (hit) shown++;
      }
      for (const fold of folds) {
        const hit = words.length && fold.querySelector(".kc-card:not([hidden])");
        if (hit && !fold.open) { fold.open = true; opened.add(fold); }
        if (!hit && opened.has(fold)) { fold.open = false; opened.delete(fold); }
        fold.hidden = Boolean(words.length) && !hit;
      }
      for (const shelf of shelves) shelf.hidden = !shelf.querySelector(".kc-card:not([hidden])");
      for (const group of groups) group.hidden = !group.querySelector(".kc-card:not([hidden])");
      status.textContent = words.length ? (shown ? `${shown} of ${total} documents` : "Nothing matches. Try a shorter word.") : "";
    }

    input.addEventListener("input", filter);
    // "/" jumps to the search box, as on many documentation sites
    addEventListener("keydown", (e) => {
      if (e.key === "/" && document.activeElement !== input && !e.metaKey && !e.ctrlKey && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName)) {
        e.preventDefault();
        input.focus();
      }
      if (e.key === "Escape" && document.activeElement === input && input.value) { input.value = ""; filter(); }
    });
    // A ?q= link opens with the search filled in
    const q = new URLSearchParams(location.search).get("q");
    if (q) { input.value = q; filter(); }
  }
}
