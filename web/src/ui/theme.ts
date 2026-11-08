/* Dark mode, and Tree mode (ported from mode_js in tools/build.py). Dark mode is remembered in this browser,
   under the same localStorage key as the old site. Tree mode is a prototype: it's on only for a page opened with ?tree=1,
   which the admin-only Testing menu links to (DECISIONS.md, 2026-11-07). An inline script in each page's <head> applies dark mode
   before first paint, so there's no flash of the light theme. */
const root = document.documentElement;
const MOON = "M13.5 9.8A6 6 0 0 1 6.2 2.5a6 6 0 1 0 7.3 7.3z";
const SUN = "M8 4.2a3.8 3.8 0 1 1 0 7.6 3.8 3.8 0 0 1 0-7.6zM7.2 0h1.6v2.4H7.2zM7.2 13.6h1.6V16H7.2zM0 7.2h2.4v1.6H0zM13.6 7.2H16v1.6h-2.4zM2.2 3.3l1.1-1.1 1.7 1.7-1.1 1.1zM11 12.1l1.1-1.1 1.7 1.7-1.1 1.1zM2.2 12.7l1.7-1.7 1.1 1.1-1.7 1.7zM11 3.9l1.7-1.7 1.1 1.1-1.7 1.7z";
const store = (k: string, v: string) => { try { localStorage.setItem(k, v) } catch { /* private mode */ } };

function showMode(): void {
  const dark = root.getAttribute("data-mode") === "dark";
  document.getElementById("modeBtn")?.setAttribute("aria-pressed", String(dark));
  const label = document.getElementById("modeLabel"); if (label) label.textContent = dark ? "Light mode" : "Dark mode";
  document.getElementById("modeIcon")?.setAttribute("d", dark ? SUN : MOON);
}

/** Tree mode: the Character Creator shows the Class step as a skill tree. */
function setTree(on: boolean): void {
  if (on) root.setAttribute("data-tree", "on"); else root.removeAttribute("data-tree");
}

/** Wire up #modeBtn, if the page has it, and turn Tree mode on for ?tree=1. */
export function initTheme(): void {
  document.getElementById("modeBtn")?.addEventListener("click", () => {
    const dark = root.getAttribute("data-mode") !== "dark";
    if (dark) root.setAttribute("data-mode", "dark"); else root.removeAttribute("data-mode");
    store("crawl-mode", dark ? "dark" : "light"); showMode();
  });
  showMode();
  setTree(new URLSearchParams(location.search).get("tree") === "1");
  try { localStorage.removeItem("crawl-tree-mode") } catch { /* private mode */ } // the old switch's memory, so it can't stick on
}
