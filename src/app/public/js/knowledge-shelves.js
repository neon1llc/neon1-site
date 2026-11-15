// src/app/public/js/knowledge-shelves.js - Left and right buttons for the Knowledge Center's shelf bar. The bar
// scrolls sideways, and a reader may not know it does: a mouse user may not know Shift plus the wheel moves it, and
// on a phone the only sign is a label cut off at the edge. So a button sits at each end, shown only on the side that
// has more to scroll to, and shelf buttons passing under one are covered at its edge. One tap or click moves the bar by nearly a
// full view, keeping the last two shelf buttons in view so the reader never loses their place. On a touch screen
// the buttons are smaller and the bar still swipes. Keyboard users have the links themselves: focusing one scrolls
// it into view, so the buttons are left out of the Tab order and the reading order.

const nav = document.querySelector(".kc-shelves");
const track = nav && nav.querySelector("ul");
if (track) {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");
  const arrow = (side) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = `kc-shelves-btn kc-shelves-${side}`;
    b.tabIndex = -1;
    b.setAttribute("aria-hidden", "true");
    b.hidden = true;
    // The site's one arrow (shared/neon1.css .arr), turned around for the right button
    b.innerHTML = `<span class="arr${side === "next" ? " arr-next" : ""}" aria-hidden="true"></span>`;
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
