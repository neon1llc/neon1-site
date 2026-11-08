// src/app/public/js/page.js - Rain, wordmark, chat, and the white rabbit; the rain itself is shared with 1NEON,
// and the menu, footer year, and 1NEON fade come from js/frame.js.

import { rain, controls, TEXT } from "/shared/rain.js";
import { whiteRabbit } from "/js/white-rabbit.js";
{
  // ---- Matrix rain, with the hero pane, header, and controls as glass ----
  // A rabbit drops in now and then, only when the egg is ready, and never under the text or controls
  let egg = null;
  const canvas = document.getElementById("rain"), lens = document.getElementById("lens");
  const header = document.querySelector("header");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");
  const r = rain({
    canvas,
    lens,
    panes: () => document.querySelectorAll(".hero-pane, header .logo, header .links a, #menuBtn, .rainctl button"),
    // The lens rests once the header turns light
    lensOff: () => header.classList.contains("light"),
    // Fully scrolled into the light page, the rain is invisible, so it stops drawing
    idle: () => document.body.classList.contains("woke"),
    rabbit: {
      ok: () => !!egg && egg.ready(),
      avoid: () => document.querySelectorAll(".hero-pane, header a, header button, .rainctl"),
    },
  });
  const ctl = document.querySelector(".rainctl");
  controls(ctl, r);
  egg = whiteRabbit({ rain: r, root: document.getElementById("whiteRabbit") });

  // Waking up: rain and its controls fade as the light content takes over
  const veil = document.querySelector(".veil");
  function onScroll() {
    const t = Math.min(1, scrollY / (innerHeight * 0.9));
    canvas.style.opacity = lens.style.opacity = String(0.6 * (1 - t));
    veil.style.opacity = String(1 - t);
    // Faded-out controls also leave the tab order, so focus never lands on something unseen
    const gone = t > 0.6;
    ctl.style.opacity = gone ? "0" : "1";
    ctl.style.pointerEvents = gone ? "none" : "auto";
    ctl.inert = gone;
    header.classList.toggle("light", t > 0.95);
    document.body.classList.toggle("woke", t >= 1);
    // A paused rain still needs the lens redrawn as panes move
    if (!r.running) r.refract();
  }
  addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // The menu (js/frame.js) made the rain controls inert while open; closing restores their own state
  document.addEventListener("n1:menu", (e) => { if (!e.detail.open) onScroll(); });

  // ---- The "ask neon1" window: optional, so it loads last and a failure leaves the page working ----
  // The contact section and its email and booking links stay the way to reach a person
  import("/shared/chat.js").then(({ chat }) => chat({ light: () => document.querySelector("header")?.classList.contains("light"), watch: [document.querySelector("header")] })).catch(() => { /* chat unavailable: contact links remain */ });

  // ---- Wordmark decode: each letter cycles glyphs, then locks in, left to right ----
  if (!reduce.matches) {
    const spans = [...document.querySelectorAll(".brand .dec")];
    const finals = spans.map((el) => el.textContent);
    const total = finals.join("").length;
    let tick = 0;
    const timer = setInterval(() => {
      let n = 0;
      spans.forEach((el, si) => {
        el.textContent = [...finals[si]].map((ch) => (n++ < tick / 4 ? ch : TEXT[(Math.random() * TEXT.length) | 0])).join("");
      });
      if (++tick > total * 4) { clearInterval(timer); spans.forEach((el, si) => (el.textContent = finals[si])); }
    }, 45);
  }
}
