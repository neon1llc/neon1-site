// src/app/public/js/matrix-effects.js - Start the landing's Matrix effects when that family is chosen.

let started = false;

// One instance owns the rain controls and rabbit for the lifetime of this page
export async function start() {
  if (started) return;
  const [{ rain, controls, TEXT }, { whiteRabbit }] = await Promise.all([import("/shared/rain.js"), import("/js/white-rabbit.js")]);
  started = true;
  const header = document.querySelector("header");
  const canvas = document.getElementById("rain"), lens = document.getElementById("lens"), ctl = document.querySelector(".rainctl");
  const menu = document.getElementById("menu");
  const veil = document.querySelector(".veil"), reduce = matchMedia("(prefers-reduced-motion: reduce)");
  let egg = null;
  header.dataset.lensRadius = "0";
  const r = rain({
    canvas,
    lens,
    panes: () => document.querySelectorAll(".hero-pane, header.n1-bar, .rainctl button"),
    lensOff: () => header.classList.contains("light"),
    // Still while the phone menu is up, from its entrance to the end of its fade out, so drawing doesn't compete with either
    idle: () => document.documentElement.dataset.siteStyle === "sentinel" || document.body.classList.contains("woke") || menu?.hidden === false,
    rabbit: {
      every: [7000, 10000],
      ok: () => !!egg && egg.ready(),
      avoid: () => document.querySelectorAll(".hero-pane, header a, header button, .rainctl"),
    },
  });
  controls(ctl, r);
  egg = whiteRabbit({ rain: r, root: document.getElementById("whiteRabbit") });

  // Scroll state controls the rain veil, header, and its first-screen family switch
  function onScroll() {
    if (document.documentElement.dataset.siteStyle === "sentinel") {
      document.body.classList.add("woke");
      header.classList.add("light");
      header.toggleAttribute("data-top", window.n1FirstScreen ? window.n1FirstScreen() : scrollY < innerHeight * 0.6);
      ctl.inert = true;
      return;
    }
    const t = Math.min(1, scrollY / (innerHeight * 0.9));
    canvas.style.opacity = lens.style.opacity = String(0.6 * (1 - t));
    veil.style.opacity = String(1 - t);
    const gone = t > 0.6;
    ctl.style.opacity = gone ? "0" : "1";
    ctl.style.pointerEvents = gone ? "none" : "auto";
    ctl.inert = gone;
    header.classList.toggle("light", t > 0.95);
    header.toggleAttribute("data-top", t < 0.95);
    document.body.classList.toggle("woke", t >= 1);
    if (!r.running) r.refract();
  }
  addEventListener("scroll", onScroll, { passive: true });
  document.addEventListener("n1:theme", onScroll);
  document.addEventListener("n1:menu", (e) => { if (!e.detail.open) onScroll(); });
  onScroll();

  // Decode the landing wordmark only for visitors who allow motion
  if (!reduce.matches) {
    const spans = [...document.querySelectorAll(".brand .dec")];
    const finals = spans.map((el) => el.textContent), total = finals.join("").length;
    let tick = 0;
    const timer = setInterval(() => {
      let n = 0;
      spans.forEach((el, si) => { el.textContent = [...finals[si]].map((ch) => (n++ < tick / 4 ? ch : TEXT[(Math.random() * TEXT.length) | 0])).join(""); });
      if (++tick > total * 4) { clearInterval(timer); spans.forEach((el, si) => (el.textContent = finals[si])); }
    }, 45);
  }
}
