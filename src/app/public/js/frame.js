// src/app/public/js/frame.js - What every page's frame does: the footer year, the fade on the way to
// 1NEON, and the phone menu. Each page loads it as a module; pages react to the menu through the
// "n1:menu" event instead of reaching into it.
{
  // Footer year; without the script the line still reads "© NEON1 LLC"
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

  // ---- Menu: open/close, Esc, close on link; returns focus to the button ----
  // The page behind an open menu is inert, so Tab moves only between the menu and its button.
  // Looked up each time, because the chat window arrives after the page starts; missing parts are skipped
  const menu = document.getElementById("menu"), menuBtn = document.getElementById("menuBtn");
  const behind = () => document.querySelectorAll(".top, .awake, .rainctl, .n1chat-launch, .n1chat");
  function setMenu(open) {
    menu.hidden = !open;
    behind().forEach((el) => (el.inert = open));
    menuBtn.setAttribute("aria-expanded", String(open));
    menuBtn.textContent = open ? "close" : "menu";
    header.classList.toggle("menu-open", open);
    document.body.classList.toggle("menu-open", open); // the chat window steps aside under the menu
    document.body.style.overflow = open ? "hidden" : "";
    // The home page restores its rain controls' own inert state when the menu closes
    document.dispatchEvent(new CustomEvent("n1:menu", { detail: { open } }));
    if (open) menu.querySelector("a").focus(); else menuBtn.focus();
  }
  if (menu && menuBtn) {
    menuBtn.addEventListener("click", () => setMenu(menu.hidden));
    menu.addEventListener("click", (e) => { if (e.target.closest("a") || e.target === menu) setMenu(false); });
    addEventListener("keydown", (e) => { if (e.key === "Escape" && !menu.hidden) setMenu(false); });
    // Widening past the menu's breakpoint brings back the bar's links, so the menu closes
    matchMedia("(min-width: 1041px)").addEventListener("change", (e) => { if (e.matches && !menu.hidden) setMenu(false); });
  }
}
