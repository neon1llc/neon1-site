// src/app/public/js/knowledge-shelves.js - Left and right buttons for the Knowledge Center's shelf bar. The bar
// scrolls sideways, and a mouse user may not know that Shift plus the wheel moves it, so a button sits at each
// end for a mouse or trackpad, and shows only on the side that has more to scroll to. One click moves the bar by
// nearly a full view, keeping the last two shelf buttons in view so the reader never loses their place. A touch
// screen swipes instead, so the buttons stay hidden there. Keyboard users have the links themselves: focusing one
// scrolls it into view, so the buttons are left out of the Tab order and the reading order.

const nav = document.querySelector(".kc-shelves");
const track = nav && nav.querySelector("ul");
// Only where there is a pointer that hovers; the bar still works without these buttons
if (track && matchMedia("(hover: hover) and (pointer: fine)").matches) {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");
  const arrow = (side) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = `kc-shelves-btn kc-shelves-${side}`;
    b.tabIndex = -1;
    b.setAttribute("aria-hidden", "true");
    b.hidden = true;
    // A chevron drawn like the site's other line icons
    b.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${side === "prev" ? "m15 5-7 7 7 7" : "m9 5 7 7-7 7"}"/></svg>`;
    return b;
  };
  const prev = arrow("prev"), next = arrow("next");
  nav.append(prev, next);

  // Which sides still have something to scroll to (a pixel of slack for fractional widths)
  const update = () => {
    const max = track.scrollWidth - track.clientWidth;
    prev.hidden = track.scrollLeft <= 1;
    next.hidden = track.scrollLeft >= max - 1;
  };

  // Moves by the visible width, less two shelf buttons' worth (about 160px) kept in view as overlap
  const page = (dir) => {
    const step = Math.max(160, track.clientWidth - 160);
    track.scrollBy({ left: dir * step, behavior: reduce.matches ? "auto" : "smooth" });
  };
  prev.addEventListener("click", () => page(-1));
  next.addEventListener("click", () => page(1));

  track.addEventListener("scroll", update, { passive: true });
  new ResizeObserver(update).observe(track);
  update();
}
