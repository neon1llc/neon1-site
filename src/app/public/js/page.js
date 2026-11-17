// src/app/public/js/page.js - Rain, wordmark, chat, and the white rabbit; the rain itself is shared with 1NEON,
// and the menu, footer year, and 1NEON fade come from js/frame.js.

// The rain, the white rabbit, and the wordmark's decode are the matrix look's; in the sentinel style (html[data-site-style], js/theme.js)
// none of them is loaded or started, the landing is a plain page, and Neo still loads. Changing style reloads the landing, so each load
// runs one look from its first frame.
const sentinel = document.documentElement.dataset.siteStyle === "sentinel";
const header = document.querySelector("header");
{
  // ---- Sentinel: a still page; the bar is the light bar from the first frame, and Neo follows the light or dark theme ----
  if (sentinel) {
    document.body.classList.add("woke");
    header.classList.add("light");
    // The style switch shows on the first screen only (css/sentinel.css, [data-top])
    const top = () => header.toggleAttribute("data-top", scrollY < innerHeight * 0.6);
    addEventListener("scroll", top, { passive: true }); top();
  }
}
const matrix = sentinel ? null : await Promise.all([import("/shared/rain.js"), import("/js/white-rabbit.js")]);
const TEXT = matrix ? matrix[0].TEXT : "";
{
  // ---- Matrix rain, with the hero pane, header, and controls as glass ----
  // A rabbit drops in now and then, only when the egg is ready, and never under the text or controls
  let egg = null;
  const canvas = document.getElementById("rain"), lens = document.getElementById("lens");
  header.dataset.lensRadius = "0";
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");
  const { rain, controls } = matrix ? matrix[0] : {};
  const { whiteRabbit } = matrix ? matrix[1] : {};
  const r = sentinel ? null : rain({
    canvas,
    lens,
    // The top bar is one pane edge to edge, the size of the light bar it becomes, rather than a pane per item
    panes: () => document.querySelectorAll(".hero-pane, header.n1-bar, .rainctl button"),
    // The lens rests once the header turns light
    lensOff: () => header.classList.contains("light"),
    // Fully scrolled into the light page, the rain is invisible, so it stops drawing
    idle: () => document.body.classList.contains("woke"),
    rabbit: {
      every: [7000, 10000], // one rabbit at a time; the next comes 7 to 10 seconds (random each time) after the last is gone (Pradeep, 2026-11-16)
      ok: () => !!egg && egg.ready(),
      avoid: () => document.querySelectorAll(".hero-pane, header a, header button, .rainctl"),
    },
  });
  const ctl = document.querySelector(".rainctl");
  if (!sentinel) {
    controls(ctl, r);
    egg = whiteRabbit({ rain: r, root: document.getElementById("whiteRabbit") });
  }

  // Waking up: rain and its controls fade as the light content takes over
  const veil = document.querySelector(".veil");
  function onScroll() {
    if (sentinel) return;
    const t = Math.min(1, scrollY / (innerHeight * 0.9));
    canvas.style.opacity = lens.style.opacity = String(0.6 * (1 - t));
    veil.style.opacity = String(1 - t);
    // Faded-out controls also leave the tab order, so focus never lands on something unseen
    const gone = t > 0.6;
    ctl.style.opacity = gone ? "0" : "1";
    ctl.style.pointerEvents = gone ? "none" : "auto";
    ctl.inert = gone;
    header.classList.toggle("light", t > 0.95);
    // The style switch (and not the theme switch) shows on the first screen (css/frame.css, [data-top])
    header.toggleAttribute("data-top", t < 0.95);
    document.body.classList.toggle("woke", t >= 1);
    // A paused rain still needs the lens redrawn as panes move
    if (!r.running) r.refract();
  }
  if (!sentinel) { addEventListener("scroll", onScroll, { passive: true }); onScroll(); }

  // The menu (js/frame.js) made the rain controls inert while open; closing restores their own state
  document.addEventListener("n1:menu", (e) => { if (!e.detail.open) onScroll(); });

  // ---- The "ask neon1" window: optional, so it loads last and a failure leaves the page working ----
  // The contact section and its email and booking links stay the way to reach a person
  // In the matrix (dark) theme the page below the rain is dark too, so the chat keeps its dark look there
  const lightPage = () => document.querySelector("header")?.classList.contains("light") && document.documentElement.dataset.siteTheme !== "matrix";
  import("/shared/chat.js").then(({ chat }) => {
    chat({ light: lightPage, watch: [document.querySelector("header")] });
    // The chat re-checks its look on scroll; a theme switch (js/theme.js) asks for the same check
    document.addEventListener("n1:theme", () => dispatchEvent(new Event("scroll")));
  }).catch(() => { /* chat unavailable: contact links remain */ });

  // ---- Wordmark decode: each letter cycles glyphs, then locks in, left to right ----
  if (!reduce.matches && !sentinel) {
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
