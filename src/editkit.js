/* Shared editing tools for the Glossary, Items and Crafting pages:
   the Text color sidebar (shown while something is being edited) and the save bar spacing.
   Text inputs and textareas inside an element with class "gediting" can be colored. */
const SWATCHES = [["Crawl red", "#8e171c"], ["Blue", "#1f5fbf"], ["Green", "#2e7d32"], ["Purple", "#6a1b9a"], ["Gold", "#b7791f"]];
let lastBox = null;
document.body.insertAdjacentHTML("beforeend", `<aside class="gside" id="gside" hidden aria-label="Text color">
<div class="gsh">Text color</div>
<div class="gsb">
<div class="gsws">${SWATCHES.map(([n, c]) => `<button type="button" class="gsw" data-c="${c}" style="--c:${c}" title="${n}" aria-label="Color selected text ${n}"></button>`).join("")}</div>
<label class="gpickl">Any color <input type="color" class="gpick" id="gpick" value="#8e171c"></label>
<button type="button" class="btn solid gapply">Color selected text</button>
<button type="button" class="btn gclear">Remove color</button>
<p class="ghelp" id="gsideMsg">Select text in any box, then pick a color.</p>
</div></aside>`);
const side = $("gside"), sideMsg = (m, bad) => { $("gsideMsg").textContent = m || "Select text in any box, then pick a color."; $("gsideMsg").classList.toggle("bad", !!bad) };
function sideShow(on) { side.hidden = !on; document.body.classList.toggle("gside-on", !!on) }
document.addEventListener("focusin", ev => { if (ev.target.matches && ev.target.matches(".gediting textarea, .gediting input[type=text]")) lastBox = ev.target });
side.addEventListener("mousedown", ev => { if (ev.target.closest("button")) ev.preventDefault() });
function colorSel(c) {
  const t = lastBox && lastBox.isConnected ? lastBox : null;
  if (t && window.colorNameHook && window.colorNameHook(t, c)) { sideMsg(c ? "Name color set." : "Name color removed."); return }
  if (!t || t.selectionStart === t.selectionEnd) { sideMsg("Select some text in one of the boxes first, then pick a color.", true); return }
  sideMsg("");
  const a = t.selectionStart, b = t.selectionEnd, v = t.value;
  let mid = v.slice(a, b).replace(/\[\/?color[^\]]*\]/gi, "");
  if (c) mid = `[color=${c}]${mid}[/color]`;
  t.focus(); t.setSelectionRange(a, b);
  if (!document.execCommand || !document.execCommand("insertText", false, mid)) { t.setRangeText(mid, a, b, "select"); t.dispatchEvent(new Event("input", { bubbles: true })) }
  t.setSelectionRange(a, a + mid.length);
}
side.addEventListener("click", ev => {
  const sw = ev.target.closest(".gsw"); if (sw) { $("gpick").value = sw.dataset.c; colorSel(sw.dataset.c); return }
  if (ev.target.closest(".gapply")) { colorSel($("gpick").value); return }
  if (ev.target.closest(".gclear")) colorSel("");
});
$("gpick").addEventListener("change", () => { if (lastBox && lastBox.isConnected && lastBox.selectionStart !== lastBox.selectionEnd) colorSel($("gpick").value) });
/* keep the sidebar clear of the save bar on small screens */
new MutationObserver(() => document.documentElement.style.setProperty("--sbh", $("savebar").hidden ? "0px" : $("savebar").offsetHeight + "px"))
  .observe($("savebar"), { attributes: true, attributeFilter: ["hidden"] });
const slugOf = s => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const saveError = (c, what) => c === "bad_key" ? "GitHub no longer accepts your access key. It may have expired; set up admin access again." : c === "no_access" ? "Your access key can't change this repo anymore." : c === "conflict" ? `The ${what} changed on GitHub while you were editing. Reload the page and make your changes again.` : "Saving failed. Check your connection and try again.";
