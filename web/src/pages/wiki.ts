/* Wiki page (wiki.html): a card for each reference section, with live counts. The nav's Wiki menu lists the same sections. */
import "../styles/reset.css";
import "../styles/base.css";
import "../styles/nav.css";
import "../styles/conditions.css";
import "../styles/home.css";
import "../styles/footer.css";
import { initNav } from "../ui/nav";
import { initTheme } from "../ui/theme";
import { initAdmin, restoreAdmin } from "../ui/admin";
import { refreshCounts } from "../ui/counts";
import { ADMIN_BTN, MODE_BTN, TREE_BTN } from "../ui/controls.html";

initNav("wiki", ADMIN_BTN + TREE_BTN + MODE_BTN);
initTheme();
initAdmin();
restoreAdmin();
refreshCounts();
