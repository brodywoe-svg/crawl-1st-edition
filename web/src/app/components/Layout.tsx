/* The frame around every screen of the React app: the site nav, dark mode and Admin / sign-in.
   These still come from the plain-TypeScript modules in web/src/ui/, which the pages not yet in the app also use,
   so there's one nav while both kinds of page exist. They set themselves up once, on the placeholder bar in index.html.
   A React nav replaces them when the last of those pages moves into the app (dev/planning/react-migration.md). */
import { useEffect } from "react";
import { Outlet, matchRoutes, useNavigate, type RouteObject } from "react-router";
import { initNav } from "../../ui/nav";
import { initTheme } from "../../ui/theme";
import { initAdmin, restoreAdmin } from "../../ui/admin";
import { ADMIN_BTN, MODE_BTN } from "../../ui/controls.html";

let started = false; // React's StrictMode runs effects twice in development; the nav must be set up only once

/** Which nav section an app route belongs to (SECTION in ui/nav.ts). Only home so far. */
const navSection = (path: string) => (path === "/" || path === "/index.html" ? "home" : "");

export function Layout({ routes }: { routes: RouteObject[] }) {
  const navigate = useNavigate();

  useEffect(() => {
    if (started) return;
    started = true;
    initNav(navSection(location.pathname), ADMIN_BTN + MODE_BTN);
    initTheme();
    initAdmin();
    restoreAdmin();
  }, []);

  // Links to the app's own screens (from the nav or anywhere else) change screen without reloading the page.
  // Links to pages not in the app yet (spells.html…) load normally.
  useEffect(() => {
    const onClick = (ev: MouseEvent) => {
      if (ev.defaultPrevented || ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
      const a = (ev.target as Element).closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target || a.hasAttribute("download") || a.origin !== location.origin) return;
      const matches = matchRoutes(routes, a.pathname);
      if (!matches || matches[matches.length - 1].route.path === "*") return;
      ev.preventDefault();
      navigate(a.pathname + a.search + a.hash);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [navigate, routes]);

  return <Outlet />;
}
