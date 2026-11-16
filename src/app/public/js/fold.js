// src/app/public/js/fold.js - Eases the Knowledge Center and blog's folds (the developer standards fold and the "On this page" index; every .n1-fold)
// open and shut, on the shared motion tokens (--t-open, --ease-open in shared/neon1.css). The arrow in each summary is timed by
// the stylesheet on the same tokens, so it finishes its turn as the panel finishes moving. A close sets .closing first, so the
// arrow starts turning back at once. A fold opened or closed by script (a search opening the standards fold, the index leaving
// its docked bar) changes at once, as before. Reduced motion changes at once too.
const reduce = matchMedia("(prefers-reduced-motion: reduce)");
const token = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const running = new WeakMap();

function ease(d, opening) {
  running.get(d)?.cancel();
  const time = (parseFloat(token("--t-open")) || 0.6) * 1000 * (opening ? 1 : 0.85);
  const curve = `cubic-bezier(${(token("--ease-open").match(/[\d.]+/g) || [0.25, 0.8, 0.25, 1]).join(",")})`;
  const s = d.querySelector(":scope > summary");
  const h0 = d.getBoundingClientRect().height;
  let h1;
  if (opening) { d.open = true; h1 = d.getBoundingClientRect().height; }
  else { d.classList.add("closing"); h1 = s.getBoundingClientRect().height + 2; } // the summary and the fold's own border
  d.style.overflow = "hidden";
  const run = d.animate({ height: [`${h0}px`, `${h1}px`] }, { duration: time, easing: curve });
  running.set(d, run);
  const done = () => {
    if (running.get(d) !== run) return;
    running.delete(d);
    if (!opening) d.open = false;
    d.classList.remove("closing");
    d.style.overflow = "";
  };
  run.finished.then(done, () => {});
}

document.addEventListener("click", (e) => {
  const s = e.target instanceof Element && e.target.closest("summary");
  const d = s?.parentElement;
  if (!d || !d.matches("details.n1-fold") || e.defaultPrevented) return;
  if (reduce.matches || document.documentElement.dataset.motion === "off" || !d.animate) return; // the browser's own toggle
  e.preventDefault();
  ease(d, !d.open || d.classList.contains("closing"));
});
