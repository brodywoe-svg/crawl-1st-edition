/** The admin sign-in modal. Copied from src/page.html, plus the Supabase account fields (name, email, password again, Forgot), shown only when Supabase is on. */
export const ADMIN_MODAL = `<div class="modal" id="adminModal" hidden>
  <form class="mbox" id="adminForm" novalidate role="dialog" aria-modal="true" aria-labelledby="adminTitle">
    <div class="mhead"><h2 id="adminTitle">Admin sign-in</h2></div>
    <div class="mbody">
      <div id="loginPane">
        <div id="signupRow" hidden><label class="mlabel" for="signupName">Your name</label>
        <input type="text" id="signupName" autocomplete="nickname" maxlength="40"></div>
        <div id="emailRow" hidden><label class="mlabel" for="adminEmail">Email</label>
        <input type="email" id="adminEmail" autocomplete="username" spellcheck="false"></div>
        <div id="passRow"><label class="mlabel" for="adminPass" id="adminPassLabel">Admin password</label>
        <input type="password" id="adminPass" autocomplete="current-password"></div>
        <div id="pass2Row" hidden><label class="mlabel" for="signupPass2">Type the password again</label>
        <input type="password" id="signupPass2" autocomplete="new-password">
        <p class="mhelp">Use at least 6 characters.</p></div>
        <button type="button" class="mlink" id="adminForgot" hidden>Forgot your password?</button>
      </div>
      <div id="setupPane" hidden>
        <p class="mnote">One-time setup. Paste a GitHub access key that can change this repo, then choose your admin password. The key is locked with your password before it's stored, so only someone with the password can use it.</p>
        <label class="mlabel" for="setupKey">GitHub access key</label>
        <input type="password" id="setupKey" autocomplete="off" spellcheck="false">
        <p class="mhelp"><a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">Make a key on GitHub</a>: choose only this repository, and set <b>Contents</b> to <b>Read and write</b>.</p>
        <label class="mlabel" for="setupName">Your name</label>
        <input type="text" id="setupName" autocomplete="nickname" maxlength="40">
        <label class="mlabel" for="setupPass">New admin password</label>
        <input type="password" id="setupPass" autocomplete="new-password">
        <label class="mlabel" for="setupPass2">Type the password again</label>
        <input type="password" id="setupPass2" autocomplete="new-password">
        <p class="mhelp">Use at least 12 characters. A few random words with a number works well.</p>
      </div>
      <p class="merr" id="adminErr" role="alert"></p>
    </div>
    <div class="mfoot">
      <button type="button" class="mlink" id="adminSwitch">First time? Set up admin access</button>
      <span class="mbtns"><button type="button" class="btn" id="adminCancel">Cancel</button><button type="submit" class="btn solid" id="adminGo">Unlock</button></span>
    </div>
  </form>
</div>`;
