/* Home page (index.html): cards to every part of the site, with live counts from the content files.
   Ported from src/home.js and home_shell() in tools/sitekit.py. The Wiki page (pages/wiki.ts) works the same way. */
import "../styles/reset.css";
import "../styles/base.css";
import "../styles/nav.css"; // same cascade order as the old site: page, nav, layout, home
import "../styles/conditions.css";
import "../styles/home.css";
import "../styles/footer.css";
import { fixLinks } from "../config";
import { refreshCounts } from "../ui/counts";
import { initNav } from "../ui/nav";
import { initTheme } from "../ui/theme";
import { initAdmin, restoreAdmin } from "../ui/admin";
import { ADMIN_BTN, MODE_BTN, TREE_BTN } from "../ui/controls.html";

initNav("home", ADMIN_BTN + TREE_BTN + MODE_BTN);
initTheme();
initAdmin();
restoreAdmin();
fixLinks(document.querySelector("main")!);
refreshCounts();
