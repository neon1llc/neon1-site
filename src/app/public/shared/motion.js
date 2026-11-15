// src/app/public/shared/motion.js - Shared easing, timing, and show/hide helpers for neon1.tech and 1NEON, so a state
// change moves the same way everywhere. Motion is on by default. It is off when the visitor asks for reduced motion,
// when a page sets data-motion="off" on <html> (1NEON's own switch), or when the browser can't animate; every helper
// then makes the change at once, with the same end state.

// The one curve and the three lengths (ms); shared/neon1.css holds the same values as --ease and --t-fast/--t-base/--t-slow/--t-open
export const EASE = "cubic-bezier(.28,.11,.32,1)";
export const T = { fast: 160, base: 300, slow: 450, open: 600 };

// Whether to skip animation: reduced motion, the page's own off switch, or no Web Animations support
export const still = () =>
  matchMedia("(prefers-reduced-motion: reduce)").matches ||
  document.documentElement.dataset.motion === "off" ||
  typeof Element.prototype.animate !== "function";

// The space a grid or flex parent puts between its children, so a block growing from nothing doesn't make that gap jump
const gapOf = (el) => {
  const p = el.parentElement && getComputedStyle(el.parentElement);
  return p && (p.display.includes("grid") || p.display.includes("flex")) ? parseFloat(p.rowGap) || 0 : 0;
};

// Shows or hides `el` (the hidden attribute) by growing it open or shrinking it shut, fading as it goes.
// Calling it again mid-move reverses from where it is. Resolves when the move ends.
export async function reveal(el, show) {
  if (!el) return;
  el.getAnimations().forEach((a) => a.cancel());
  if (still()) { el.hidden = !show; return; }
  if (show === !el.hidden) return;
  const gap = gapOf(el);
  if (show) el.hidden = false;
  const h = el.offsetHeight;
  const closed = { height: "0px", opacity: 0, marginTop: `${-gap}px`, paddingTop: "0px", paddingBottom: "0px" };
  const open = { height: `${h}px`, opacity: 1, marginTop: "0px" };
  const keep = el.style.overflow;
  el.style.overflow = "hidden";
  const run = el.animate(show ? [closed, open] : [open, closed], { duration: T.base, easing: EASE, fill: "both" });
  try { await run.finished; } catch { return; } // cancelled by a newer call
  run.cancel();
  el.style.overflow = keep;
  if (!show) el.hidden = true;
}

// Fades `out` away, then fades `inn` in where it was; both are toggled with the hidden attribute
export async function swap(out, inn) {
  if (still()) { out.hidden = true; inn.hidden = false; return; }
  try { await out.animate([{ opacity: 1 }, { opacity: 0 }], { duration: T.fast, easing: EASE, fill: "both" }).finished; } catch {}
  out.hidden = true;
  out.getAnimations().forEach((a) => a.cancel());
  inn.hidden = false;
  inn.animate([{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "none" }], { duration: T.base, easing: EASE });
}

// A dropdown's arrow needs to know which way the list will open. The browser picks the direction itself and doesn't say,
// so the page decides: just before the list opens (a press on the select, or Space, Enter, or Alt+Down on it), it measures
// the room below and above and sets data-dir to "down" or "up" on the select; the stylesheet opens the list that way and
// turns the arrow with it (down: counterclockwise a quarter turn; up: clockwise). `rows` and `rowPx` estimate the list's
// height, `maxPx` is the cap the stylesheet puts on it. Selects whose browser draws its own list still open natively.
export function watchDirection(select, { rowPx = 38, maxPx = 320, pad = 10 } = {}) {
  const decide = () => {
    const r = select.getBoundingClientRect();
    const need = Math.min(maxPx, select.options.length * rowPx + pad, innerHeight * 0.6);
    const below = innerHeight - r.bottom - 8, above = r.top - 8;
    select.dataset.dir = below < need && above > below ? "up" : "down";
  };
  select.addEventListener("pointerdown", decide);
  select.addEventListener("keydown", (e) => { if (e.key === " " || e.key === "Enter" || (e.altKey && e.key === "ArrowDown")) decide(); });
  decide();
}
