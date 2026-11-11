// src/app/public/js/frame.js - What every page's frame does: the footer year, the fade on the way to
// 1NEON, and the phone menu. Each page loads it as a module; pages react to the menu through the
// "n1:menu" event instead of reaching into it.
{
  // Footer year; without the script the line still reads "© neon1 LLC"
  const yr = document.getElementById("yr");
  if (yr) yr.textContent = new Date().getFullYear();

  const header = document.querySelector(".n1-bar");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");

  // ---- 1NEON: the page fades out, then hands over to the portal, which fades itself in ----
  document.querySelectorAll("a[data-handoff]").forEach((a) => a.addEventListener("click", (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return; // new tab or window: a plain link
    e.preventDefault();
    try { sessionStorage.setItem("neon1.handoff", "1"); } catch { /* storage blocked: the portal just won't fade in */ }
    if (reduce.matches) { location.href = a.href; return; }
    document.body.classList.add("leaving");
    setTimeout(() => (location.href = a.href), 450);
  }));
  // Coming back with the browser's Back button restores the page as it was left, faded out; undo the fade
  addEventListener("pageshow", (e) => { if (e.persisted) document.body.classList.remove("leaving"); });

  // Focus an in-page destination without scrolling (the caller or the browser does that), making a
  // section or heading focusable for the moment. Shared with js/views.js through window.n1focus
  function focusTarget(id) {
    const el = document.getElementById(id);
    if (!el) return;
    const at = el.matches("section, .view, .hero") ? (el.querySelector("h1, h2") || el) : el;
    if (!at.matches("a[href], button, input, textarea, select, [tabindex]")) at.setAttribute("tabindex", "-1");
    at.focus({ preventScroll: true });
  }
  window.n1focus = focusTarget;
  // Any link to a part of this page (from the menu, a case study, or the text) leaves keyboard focus at its
  // destination once the jump is done, whether the page glides there (js/views.js) or the browser jumps
  // natively (reduced motion). Checked after the click settles, so it only fills in when focus went nowhere
  document.addEventListener("click", (e) => {
    const a = e.target instanceof Element && e.target.closest('a[href^="#"]');
    const id = a && a.getAttribute("href").slice(1);
    if (!id || id.startsWith("case-") || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; // case links focus their card
    setTimeout(() => {
      const el = document.getElementById(id);
      if (el && !el.contains(document.activeElement)) focusTarget(id);
    }, 0);
  });

  // ---- Menu: open/close, Esc, close on link; returns focus to the button ----
  // The page behind an open menu is inert, so Tab moves only between the menu and its button.
  // One overlay owns the screen at a time: an open case study (js/cases.js) or white rabbit makes the
  // bar inert too, so the menu can't open over them, and the menu makes their openers unreachable.
  // Looked up each time, because the chat window arrives after the page starts; missing parts are skipped
  const menu = document.getElementById("menu"), menuBtn = document.getElementById("menuBtn");
  const behind = () => document.querySelectorAll(".top, .awake, .rainctl, .n1chat-launch, .n1chat");
  // Closing by Escape, the button, or a click outside gives focus back to the button. Choosing a link
  // doesn't: the page focuses where the link went (js/views.js), or the browser follows it (AS-02)
  function setMenu(open, restore = true) {
    menu.hidden = !open;
    behind().forEach((el) => (el.inert = open));
    menuBtn.setAttribute("aria-expanded", String(open));
    menuBtn.textContent = open ? "close" : "menu";
    header.classList.toggle("menu-open", open);
    document.body.classList.toggle("menu-open", open); // the chat window steps aside under the menu
    document.body.style.overflow = open ? "hidden" : "";
    // The home page restores its rain controls' own inert state when the menu closes
    document.dispatchEvent(new CustomEvent("n1:menu", { detail: { open } }));
    if (open) menu.querySelector("a").focus(); else if (restore) menuBtn.focus();
  }
  if (menu && menuBtn) {
    menuBtn.addEventListener("click", () => setMenu(menu.hidden));
    menu.addEventListener("click", (e) => {
      const a = e.target.closest("a");
      if (!a && e.target !== menu) return;
      setMenu(false, !a);
    });
    addEventListener("keydown", (e) => { if (e.key === "Escape" && !menu.hidden) setMenu(false); });
    // Widening past the menu's breakpoint brings back the bar's links, so the menu closes. The menu button
    // is hidden at that width, so focus goes to the same link in the bar, or the logo, never to nothing
    matchMedia("(min-width: 1041px)").addEventListener("change", (e) => {
      if (!e.matches || menu.hidden) return;
      const href = menu.contains(document.activeElement) && document.activeElement.getAttribute("href");
      setMenu(false, false);
      const same = href && [...document.querySelectorAll(".links a")].find((l) => l.getAttribute("href") === href);
      (same || header.querySelector(".n1-logo"))?.focus({ preventScroll: true });
    });
  }
}
