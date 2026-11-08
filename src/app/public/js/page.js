// src/app/public/js/page.js - Rain, menu, wordmark, and the white rabbit; the rain itself is shared with 1NEON.

import { rain, controls, TEXT } from "/shared/rain.js";
import { whiteRabbit } from "/js/white-rabbit.js";
import { chat } from "/shared/chat.js";
{
  // Footer year
  document.getElementById("yr").textContent = new Date().getFullYear();

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

  // The "ask neon1" window, answered from this page's own copy
  chat();

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

  // ---- 1NEON: the page fades to the rain, then hands over to the portal, which fades itself in ----
  document.querySelectorAll("a[data-handoff]").forEach((a) => a.addEventListener("click", (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return; // new tab or window: a plain link
    e.preventDefault();
    try { sessionStorage.setItem("neon1.handoff", "1"); } catch { /* storage blocked: the portal just won't fade in */ }
    if (reduce.matches) { location.href = a.href; return; }
    document.body.classList.add("leaving");
    setTimeout(() => (location.href = a.href), 450);
  }));

  // ---- Menu: open/close, Esc, close on link; returns focus to the button ----
  // The page behind an open menu is inert, so Tab moves only between the menu and its button
  const menu = document.getElementById("menu"), menuBtn = document.getElementById("menuBtn");
  const behind = document.querySelectorAll(".top, .awake, .rainctl");
  function setMenu(open) {
    menu.hidden = !open;
    behind.forEach((el) => (el.inert = open));
    if (!open) onScroll(); // restores the rain controls' own inert state
    menuBtn.setAttribute("aria-expanded", String(open));
    menuBtn.textContent = open ? "close" : "menu";
    header.classList.toggle("menu-open", open);
    document.body.style.overflow = open ? "hidden" : "";
    if (open) menu.querySelector("a").focus(); else menuBtn.focus();
  }
  menuBtn.addEventListener("click", () => setMenu(menu.hidden));
  menu.addEventListener("click", (e) => { if (e.target.closest("a") || e.target === menu) setMenu(false); });
  addEventListener("keydown", (e) => { if (e.key === "Escape" && !menu.hidden) setMenu(false); });
  // Widening past the menu's breakpoint brings back the header links, so the menu closes
  matchMedia("(min-width: 1041px)").addEventListener("change", (e) => { if (e.matches && !menu.hidden) setMenu(false); });

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
