/* account.html (new site only): who you're signed in as, and where a password-reset email lands.
   Supabase puts the reset sign-in in the link's #hash; the client reads it and reports PASSWORD_RECOVERY,
   and then this page asks for a new password. See dev/planning/supabase-database.md (phase 2). */
import { initNav } from "../ui/nav";
import { initTheme } from "../ui/theme";
import { initAdmin, restoreAdmin } from "../ui/admin";
import { ADMIN_BTN, MODE_BTN } from "../ui/controls.html";
import { $, esc } from "../ui/dom";
import { MIN_PASSWORD, SUPABASE_ON, currentAccount, onAuthChange, setPassword, type AuthError } from "../lib/auth";

initNav("account", ADMIN_BTN + MODE_BTN);
initTheme();
initAdmin();
restoreAdmin();

const box = $("acctPage");
const openSignIn = () => $("adminBtn").click(); // the nav's button opens the sign-in box, or your account box when signed in
const hash = new URLSearchParams(location.hash.slice(1));
let resetting = hash.get("type") === "recovery";

async function showStatus(): Promise<void> {
  if (resetting) return;
  const a = await currentAccount().catch(() => null);
  box.innerHTML = a
    ? `<p>Signed in as <b>${esc(a.name || "you")}</b> (${esc(a.email)})${a.role === "admin" ? ", an admin" : ""}.</p>
<p>Characters you make in the Character Creator are saved to this account, and on this device.</p>
<div class="row"><a class="btn solid" href="creator.html">Character Creator</a><button type="button" class="btn" data-go="acct">Name and password</button></div>`
    : `<p>Sign in to save your Character Creator characters to your account, so they're on every device you use.</p>
<div class="row"><button type="button" class="btn solid" data-go="acct">Sign in or create an account</button></div>`;
}
function showReset(): void {
  resetting = true;
  box.innerHTML = `<h2>Choose a new password</h2>
<label class="mlabel" for="np1">New password</label><input type="password" id="np1" autocomplete="new-password">
<label class="mlabel" for="np2">Type it again</label><input type="password" id="np2" autocomplete="new-password">
<p class="mhelp">Use at least ${MIN_PASSWORD} characters.</p>
<div class="row"><button type="button" class="btn solid" data-go="save">Save new password</button></div><p class="merr" id="npErr" role="alert"></p>`;
  $("np1").focus();
}
async function saveReset(): Promise<void> {
  const err = (m: string) => { $("npErr").textContent = m }, p1 = $<HTMLInputElement>("np1").value, p2 = $<HTMLInputElement>("np2").value;
  if (p1.length < MIN_PASSWORD) { err(`Use at least ${MIN_PASSWORD} characters for the password.`); return }
  if (p1 !== p2) { err("The two passwords don't match."); return }
  err("Saving…");
  try {
    await setPassword(p1);
    history.replaceState(null, "", location.pathname + location.search); // drop the one-time link from the address bar
    resetting = false; await showStatus();
    box.insertAdjacentHTML("afterbegin", `<p><b>Password changed.</b> Use it next time you sign in.</p>`);
  } catch (x) {
    err((x as AuthError)?.code === "weak_password" ? "That password is too easy to guess. Try a longer one."
      : "Couldn't save it. The reset link may have expired: ask for a new one from the sign-in box.");
  }
}

box.addEventListener("click", e => {
  const g = (e.target as HTMLElement).closest<HTMLElement>("[data-go]")?.dataset.go;
  if (g === "acct") openSignIn(); else if (g === "save") saveReset();
});

if (!SUPABASE_ON) box.innerHTML = `<p>Accounts aren't switched on for this copy of the site yet.</p>`;
else if (hash.get("error")) {
  // e.g. an expired or already-used reset link
  box.innerHTML = `<p>${esc(hash.get("error_description") || "That link didn't work.")}</p>
<p>Ask for a new one: <b>Sign in</b> → <b>Forgot your password?</b></p><div class="row"><button type="button" class="btn solid" data-go="acct">Sign in</button></div>`;
} else {
  if (resetting) showReset(); else showStatus();
  onAuthChange(event => {
    if (event === "PASSWORD_RECOVERY") showReset();
    else if (event === "SIGNED_IN" || event === "SIGNED_OUT") showStatus();
  }).catch(() => { /* offline */ });
}
