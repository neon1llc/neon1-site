// Views: scroll choreography for each section, built on Motion (motion.dev, MIT).
// First visit: the heading slides in from the direction you scrolled from, then
// the section's main pieces follow one by one. After that, each view simply
// fades with scroll position, so a paused scroll holds its fade.
(() => {
  "use strict";
  const M = window.Motion;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!M || reduce) return; // everything stays visible
  const { animate, inView, stagger } = M;
  const ease = [0.19, 1, 0.22, 1];
  const dist = 18;

  let lastY = scrollY, dir = 1;
  addEventListener("scroll", () => { const y = scrollY; if (y !== lastY) dir = y > lastY ? 1 : -1; lastY = y; }, { passive: true });

  document.documentElement.classList.add("motion-ready");
  document.querySelectorAll(".view").forEach((view) => {
    const head = view.querySelector("h2");
    const items = [...view.querySelectorAll(".reveal-on")];
    let played = false;

    inView(view, () => {
      if (played) return;
      played = true;
      // Scrolling down, things drop in from slightly above; scrolling up, they rise from below.
      const from = -dir * dist;
      animate(head, { opacity: [0, 1], y: [from, 0] }, { duration: 0.7, ease });
      if (items.length) {
        animate(items, { opacity: [0, 1], y: [from, 0] },
          { duration: 0.6, ease, delay: stagger(Math.min(0.12, 0.9 / items.length), { startDelay: 0.25 }) });
      }
    }, { amount: 0.2 });

  });

  // Revisits: each view fades with its distance from the screen and holds
  // wherever you stop. Measured in screen heights, so tall views stay solid.
  const views = [...document.querySelectorAll(".view")];
  const clamp = (v) => Math.max(0, Math.min(1, v));
  let ticking = false;
  function fade() {
    ticking = false;
    const vh = innerHeight, edge = vh * 0.35;
    for (const v of views) {
      const r = v.getBoundingClientRect();
      const t = Math.min(clamp((vh - r.top) / edge), clamp(r.bottom / edge));
      v.style.opacity = (0.12 + 0.88 * t).toFixed(3);
    }
  }
  const req = () => { if (!ticking) { ticking = true; requestAnimationFrame(fade); } };
  addEventListener("scroll", req, { passive: true });
  addEventListener("resize", req);
  fade();
})();
