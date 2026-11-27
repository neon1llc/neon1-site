// src/app/public/js/frame.js - What every page's frame does: the footer year and the phone menu. Each page loads it as a module; pages react to the menu through the
// "n1:menu" event instead of reaching into it.
{
  // Footer year; without the script the line still reads "© neon1 LLC"
  const yr = document.getElementById("yr");
  if (yr) yr.textContent = new Date().getFullYear();

  // ---- Focus rings for the keyboard only ----
  // Tab, arrows, or F6 (outside a text field's own caret) mark html[data-keys]; a pointer or touch clears it. shared/neon1.css
  // hides :focus-visible rings without it, the same rule 1NEON's lib/keys.ts sets
  {
    const root = document.documentElement;
    const moves = new Set(["Tab", "F6", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End", "PageUp", "PageDown"]);
    const field = (t) => t instanceof Element && t.matches("input:not([type=checkbox]):not([type=radio]), textarea, select, [contenteditable='true']");
    addEventListener("keydown", (e) => { if (moves.has(e.key) && !(e.key.startsWith("Arrow") && field(e.target))) root.dataset.keys = ""; }, true);
    addEventListener("pointerdown", () => { delete root.dataset.keys; }, true);
  }

  const header = document.querySelector(".n1-bar");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");

  // ---- A tab left open across a deploy ----
  // The page in an old tab is the old release's, but the scripts it loads later (the white rabbit's scene, a lazy import)
  // come from the live one, so the two can disagree. When the tab is looked at again, it asks /version.json what is live and,
  // if that is not its own release, reloads, unless that would lose something (words typed in a form, an open case study,
  // the white rabbit); it asks again the next time the tab is shown.
  {
    const mine = document.querySelector('meta[name="version"]')?.content;
    let asked = 0;
    const busy = () => [...document.querySelectorAll("textarea, input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=submit]):not([type=button])")].some((f) => f.value)
      || document.querySelector(".case-layer:not([hidden])") || document.body.classList.contains("white-rabbit-on") || document.body.classList.contains("white-rabbit-cover");
    const check = async () => {
      if (!mine || document.hidden || Date.now() - asked < 30000) return;
      asked = Date.now();
      try {
        const live = (await (await fetch("/version.json", { cache: "no-store" })).json()).version;
        if (live && live !== mine && !busy()) location.reload();
      } catch { /* offline, or no such file in a preview: stay as it is */ }
    };
    document.addEventListener("visibilitychange", check);
    addEventListener("pageshow", (e) => { if (e.persisted) check(); });
  }

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
  // The Matrix landing menu is dark only while its rain hero is the active screen
  const rain = document.getElementById("rain"), nextView = rain && document.querySelector(".view");
  if (nextView) {
    const syncRainScreen = () => {
      const nextTop = nextView.getBoundingClientRect().top + scrollY - 64;
      document.documentElement.toggleAttribute("data-rain-screen", scrollY < nextTop - 2);
    };
    syncRainScreen();
    addEventListener("scroll", syncRainScreen, { passive: true });
    addEventListener("resize", syncRainScreen, { passive: true });
    addEventListener("pageshow", syncRainScreen);
  }
  const behind = () => document.querySelectorAll(".top, .awake, .rainctl, .n1chat-launch, .n1chat");
  // Closing by Escape, the button, or a click outside gives focus back to the button. Choosing a link
  // doesn't: the page focuses where the link went (js/views.js), or the browser follows it (AS-02)
  // Opening and closing ease (css/frame.css); a close keeps the overlay up while it fades, then hides it
  const still = matchMedia("(prefers-reduced-motion: reduce)");
  // Making the page behind inert restyles all of it, which took tens of milliseconds on a phone. Done in the frame the menu
  // opened or closed, it held back the first frame of the fade, so the menu stuttered. Now the menu moves first: the page goes
  // inert once the entrance has played, and comes back once the fade out is over. The chat steps aside at once (a class on
  // its own two elements, which costs nothing), since it sits above the menu
  let fading = 0, settling = 0, turn = 0;
  const chatAway = (away) => document.querySelectorAll(".n1chat, .n1chat-launch").forEach((el) => el.classList.toggle("under-menu", away));
  function setMenu(open, restore = true) {
    clearTimeout(fading); clearTimeout(settling);
    const moving = !still.matches;
    // The entrance plays again on the next open. A close leaves "shown" on: dropping it would replay the links' rise as the fade starts
    if (open) menu.classList.remove("shown");
    menu.classList.toggle("closing", !open && !menu.hidden && moving);
    const closing = menu.classList.contains("closing");
    if (open || !closing) menu.hidden = !open;
    menuBtn.setAttribute("aria-expanded", String(open));
    // What restyles or reflows the page (the bar's menu look, the scroll lock that brings the scrollbar back) waits for the fade's
    // first frame, so that frame carries only the fade
    const mine = ++turn;
    const frame = () => {
      if (mine !== turn) return; // opened or closed again meanwhile
      menuBtn.textContent = open ? "close" : "menu";
      header.classList.toggle("menu-open", open);
      document.body.style.overflow = open ? "hidden" : "";
    };
    if (closing) requestAnimationFrame(() => requestAnimationFrame(frame)); else frame();
    if (open) chatAway(true);
    // The home page restores its rain controls' own inert state when the menu closes, so the event follows the page's own restore
    const settle = () => {
      behind().forEach((el) => (el.inert = open));
      if (!open) { menu.hidden = true; menu.classList.remove("closing"); chatAway(false); }
      document.dispatchEvent(new CustomEvent("n1:menu", { detail: { open } }));
    };
    if (open && moving) settling = setTimeout(settle, 380); // the links' rise (.36s) is over
    else if (closing) fading = setTimeout(settle, 220); // the fade out (.22s) is over
    else settle();
    if (open) menu.querySelector("a").focus(); else if (restore) menuBtn.focus({ preventScroll: true });
  }
  if (menu && menuBtn) {
    // The entrance is over: drop its animations so a screenshot or restyle can't replay them from the first frame
    menu.querySelector("ul").addEventListener("animationend", () => { if (!menu.hidden && !menu.classList.contains("closing")) menu.classList.add("shown"); });
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
