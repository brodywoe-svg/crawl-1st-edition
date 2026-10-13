"""Shared site pieces: the top navigation bar and the Conditions page.

Used by tools/build.py. The navigation bar is injected into every page, and the
Glossary and Conditions pages draw their entries from crawl-glossary.json.
"""
import html
import re

# ---------------------------------------------------------------- navigation

# (label, href or None when the section isn't built yet, dropdown items)
NAV_ITEMS = [
    ("Character Creator", None, None),
    ("Classes", None, None),
    ("Crafting", None, None),
    ("Rules", None, None),
    ("Glossary", "glossary.html", [("Conditions", "conditions.html")]),
    ("About", None, None),
]
# which nav item each page belongs to
SECTION = {"spells": "Spells", "glossary": "Glossary", "conditions": "Glossary"}

CARET = '<svg viewBox="0 0 10 6" aria-hidden="true"><path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>'


def nav_html(active, controls=""):
    """active: 'spells', 'glossary' or 'conditions'. controls: buttons for the right side."""
    sec = SECTION.get(active)
    parts = [
        '<nav class="sitenav" aria-label="Crawl"><div class="navin"><div class="navlinks">',
        f'<a class="navitem navhome" href="index.html"{' aria-current="page"' if active == "spells" else ""}>Spells</a>',
    ]
    for label, href, menu in NAV_ITEMS:
        if href is None:
            parts.append(f'<span class="navitem soon" aria-disabled="true" title="Coming soon">{label}<small>Soon</small></span>')
            continue
        cur = ' aria-current="page"' if (active == label.lower()) else (' data-current="1"' if sec == label else "")
        if not menu:
            parts.append(f'<a class="navitem" href="{href}"{cur}>{label}</a>')
            continue
        items = "".join(
            f'<a href="{h}"{' aria-current="page"' if h.startswith(active) else ""}>{t}</a>' for t, h in menu
        )
        parts.append(
            f'<div class="navdrop"><a class="navitem" href="{href}"{cur} aria-haspopup="true">{label}{CARET}</a>'
            f'<div class="navmenu">{items}</div></div>'
        )
    parts.append(f'</div><div class="navctl" id="navctl">{controls}</div></div></nav>')
    parts.append(f"<script>{NAV_JS}</script>")
    return "".join(parts)


NAV_CSS = """
.sitenav{position:sticky;top:0;z-index:25;background:var(--ink);color:var(--paper);padding-top:env(safe-area-inset-top,0px)}
.navin{position:relative;padding-inline:20px;display:flex;align-items:center;gap:12px}
.navlinks{flex:1 1 auto;min-width:0;display:flex;flex-wrap:nowrap;align-items:stretch;justify-content:flex-start;gap:0 2px}
.navctl{flex:none;margin-left:auto;display:flex;align-items:center;gap:6px}
.navctl .adminbtn,.navctl .modebtn{background:transparent;color:var(--paper);border:2px solid var(--paper);border-radius:999px;padding:4px 11px 4px 9px;font:700 .74rem var(--font);display:inline-flex;align-items:center;gap:6px;cursor:pointer;white-space:nowrap}
.navctl .adminbtn:hover,.navctl .modebtn:hover{background:var(--barhover)}
.navctl .adminbtn.on{background:var(--paper);color:var(--ink)}
.navctl svg{width:13px;height:13px}
.navctl :focus-visible{outline:3px solid var(--paper);outline-offset:2px}
.navitem{display:inline-flex;align-items:center;gap:6px;font:700 .78rem var(--font);letter-spacing:.08em;text-transform:uppercase;color:var(--paper);background:none;border:0;padding:15px 12px;text-decoration:none;cursor:pointer;border-radius:0;white-space:nowrap}
.navitem svg{width:10px;height:6px}
a.navitem:hover,.navdrop:hover>.navitem{background:var(--barhover)}
.navitem[aria-current="page"],.navitem[data-current]{box-shadow:inset 0 -3px 0 var(--paper)}
.navitem.soon{opacity:.5;cursor:default}
.navitem.soon small{font-size:.55rem;letter-spacing:.1em;border:1px solid currentColor;border-radius:999px;padding:1px 5px}
.navitem:focus-visible{outline:3px solid var(--paper);outline-offset:-3px}
.navdrop{position:relative;display:flex}
.navmenu{display:none;position:absolute;top:100%;left:50%;transform:translateX(-50%);min-width:210px;background:var(--paper);color:var(--ink);border:2px solid var(--ink);border-radius:12px;padding:6px;box-shadow:0 10px 28px rgba(0,0,0,.22)}
.navdrop:hover .navmenu,.navdrop:focus-within .navmenu{display:grid}
@media (hover:none){.navdrop:hover .navmenu{display:none}}
.navmenu a{display:block;padding:10px 12px;border-radius:8px;font:700 .92rem var(--font);color:var(--ink);text-decoration:none}
.navmenu a:hover,.navmenu a:focus-visible{background:var(--soft);outline:none}
.navmenu a[aria-current="page"]{text-decoration:underline;text-underline-offset:4px}
/* NAV_JS steps through these until the links fit on one row beside the buttons */
.nav-c1 .navitem{padding-inline:9px;letter-spacing:.06em}
.nav-c2 .navitem.soon small{display:none}
.nav-c3 .navctl .adminbtn span,.nav-c3 .navctl .modebtn span{display:none}
.nav-c3 .navctl .adminbtn,.nav-c3 .navctl .modebtn{padding:6px}
.nav-c4 .navitem{padding-inline:7px;font-size:.72rem;letter-spacing:.04em}
.nav-c5 .navlinks{flex-wrap:wrap}
@media (max-width:700px){
  .navin{gap:4px;padding-inline:6px}
  .navlinks{flex-wrap:wrap;justify-content:center}
  .navitem.soon small,.navctl .adminbtn span,.navctl .modebtn span{display:none}
  .navctl .adminbtn,.navctl .modebtn{padding:6px}
  .navitem{padding:10px 7px;font-size:.66rem;letter-spacing:.04em}
  .navdrop{position:static}
  .navmenu{left:12px;right:12px;transform:none;min-width:0}
}
"""

NAV_JS = """(function(){
  var nav=document.querySelector('.sitenav'),links=nav&&nav.querySelector('.navlinks'),busy=false;
  var STEPS=['nav-c1','nav-c2','nav-c3','nav-c4','nav-c5'];
  function fit(){
    if(!nav||busy)return;busy=true;
    STEPS.forEach(function(c){nav.classList.remove(c)});
    if(window.innerWidth>700){for(var i=0;i<STEPS.length&&links.scrollWidth>links.clientWidth+1;i++)nav.classList.add(STEPS[i])}
    document.documentElement.style.setProperty('--navh',nav.offsetHeight+'px');busy=false;
  }
  window.crawlNavFit=fit;fit();window.addEventListener('resize',fit);
  if(document.fonts&&document.fonts.ready)document.fonts.ready.then(fit);
  window.addEventListener('load',fit);
  if(window.MutationObserver&&nav){new MutationObserver(function(){requestAnimationFrame(fit)}).observe(nav.querySelector('.navctl'),{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['hidden']})}
  document.addEventListener('keydown',function(e){if(e.key==='Escape'&&document.activeElement&&document.activeElement.closest('.navdrop'))document.activeElement.blur()});
})();"""

# ---------------------------------------------------------------- glossary pages
# The Glossary and Conditions pages draw their entries in the browser from
# crawl-glossary.json (src/glossary.js), so admin edits show without a rebuild.

PAGES = {
    "glossary": ("Glossary", "Every term in the Crawl rules, in one place. Search by name or by anything in its description.",
                 "Search the glossary", "Nothing matches. Try a different word, or clear the search."),
    "conditions": ("Conditions", "Conditions change what a creature can do, and how others can affect it. A creature can have more than one condition at a time. Each lasts until something ends it, such as a saving throw, a spell or the end of its duration. These match the Conditions list on page 1 of the character sheet.",
                   "Find a condition", "No conditions match. Clear the search to see them all."),
}

EXHAUSTION_NOTE = (
    '<aside class="cremoved"><h3>No Exhaustion condition</h3>'
    "<p>Exhaustion (the old 7-level condition). Exhaustion Points (EP) in the Action Pool replace it.</p></aside>"
)


def glossary_shell(page, logo_svg, admin_modal):
    title, intro, placeholder, empty = PAGES[page]
    return f"""
<div class="wrap condwrap">
<header class="intro">
  {logo_svg}
  <h1>{title}</h1>
  <p>{intro}</p>
</header>
<div class="cbar">
  <input id="cq" type="search" placeholder="{placeholder}" aria-label="{placeholder}" autocomplete="off">
  <span class="ccount" id="ccount"></span>
  <button type="button" class="btn solid" id="gAdd" hidden>Add entry</button>
</div>
<p class="gmsg" id="gmsg" role="status"></p>
<main id="clist"></main>
<p class="cempty" id="cempty" hidden>{empty}</p>
{EXHAUSTION_NOTE if page == "conditions" else ""}
</div>
<datalist id="gsecs"></datalist>
{admin_modal}
<div class="savebar" id="savebar" hidden>
  <div class="in">
    <span class="msg" id="saveMsg">You have unsaved glossary changes.</span>
    <button class="btn ghost" id="discardBtn">Discard</button>
    <button class="btn solid" id="saveBtn">Save changes</button>
  </div>
</div>
"""


CONDITIONS_CSS = """
.condwrap{padding-block:28px 60px}
.cbar{position:sticky;top:var(--navh,0px);z-index:5;background:var(--page);padding-block:12px;margin-top:12px!important}
.cbar{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-top:24px}
.cbar input{flex:1 1 240px;min-width:0;font:600 1rem var(--font);border:2px solid var(--ink);border-radius:10px;padding:9px 12px;background:var(--paper);color:var(--ink)}
.ccount{font-size:.8rem;color:var(--muted);font-weight:600;white-space:nowrap}
.gmsg{margin:6px 0 0;min-height:1.2em;font-size:.85rem;font-weight:600;color:var(--muted)}
#clist{margin-top:14px}
.clist{display:grid;gap:12px}
/* the card is filled with ink so no light pixels show through at the rounded corners or the top edge */
.cond{background:var(--ink);border:2px solid var(--ink);border-radius:14px;overflow:hidden;scroll-margin-top:calc(var(--navh,0px) + 16px)}
.chead{margin:0;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:11px 16px;color:var(--paper);font-size:1.05rem;font-weight:800;letter-spacing:.01em}
.ctag{font-size:.62rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;border:1.5px solid currentColor;border-radius:999px;padding:2px 8px;white-space:nowrap}
.cbody{background:var(--paper);border-radius:0 0 12px 12px;padding:12px 18px 16px;display:grid;gap:8px}
.clead{margin:0;font-weight:600;display:grid;gap:10px}
.clead p{margin:0}
.crefs{display:grid;gap:8px;margin-top:2px}
.cref{border:2px solid var(--hair);border-radius:10px;padding:8px 12px;display:grid;gap:6px;font-size:.92rem}
.cref b{font-weight:800}
.cref p{margin:0}
.cul{margin:0;padding:0;list-style:none;display:grid;gap:6px}
.cul li{position:relative;padding-left:20px;font-weight:600;line-height:1.45}
.cul li::before{content:"";position:absolute;left:3px;top:.55em;width:7px;height:7px;background:var(--ink);transform:rotate(45deg)}
.cnote{margin:2px 0 0;padding:8px 12px;border-left:4px solid var(--ink);background:var(--soft);font-size:.9rem;font-weight:600;border-radius:0 8px 8px 0}
.cnote b{font-weight:800}
.gsec+.gsec{margin-top:30px}
.ghead{display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:4px 12px;border-bottom:2px solid var(--ink);padding-bottom:6px;margin-bottom:12px}
.ghead h2{margin:0;font-size:1.3rem;font-weight:800}
.glink{font-size:.85rem;font-weight:700;color:var(--ink);text-underline-offset:3px}
.cremoved{margin-top:24px;border:2px dashed var(--ink);border-radius:14px;padding:12px 18px}
.cremoved h3{margin:0 0 4px;font-size:.95rem;font-weight:800}
.cremoved p{margin:0;font-weight:600;color:var(--muted)}
.cempty{margin:20px 0;color:var(--muted);font-weight:600}
.chr{display:flex;align-items:center;gap:8px}
.gedit{font:700 .72rem var(--font);color:var(--paper);background:transparent;border:2px solid var(--paper);border-radius:999px;padding:3px 12px;cursor:pointer}
.gedit:hover{background:var(--paper);color:var(--ink)}
.gedit:focus-visible{outline:3px solid var(--paper);outline-offset:2px}
.gform{gap:12px}
.gform label{display:grid;gap:5px;font-size:.85rem;font-weight:800}
.gform small{font-weight:600;color:var(--muted)}
.gform input,.gform textarea{font:600 .95rem var(--font);color:var(--ink);background:var(--paper);border:2px solid var(--ink);border-radius:8px;padding:8px 10px;width:100%}
.gform textarea{resize:vertical;line-height:1.4;field-sizing:content;min-height:3.2em}
.gerr{margin:0;color:var(--red);font-weight:700;font-size:.88rem}
.gerr:empty{display:none}
.gbtns{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.gbtns .sp{flex:1}
.gdel{color:var(--red)!important;border-color:var(--red)!important}
/* text color sidebar, shown while an entry is being edited */
.gside{position:fixed;z-index:20;right:16px;top:calc(var(--navh,0px) + 16px);width:184px;background:var(--ink);border:2px solid var(--ink);border-radius:14px;overflow:hidden;box-shadow:0 10px 28px rgba(0,0,0,.2)}
.gsh{color:var(--paper);font-weight:800;font-size:.9rem;padding:8px 12px}
.gsb{background:var(--paper);border-radius:0 0 12px 12px;padding:10px 12px 12px;display:grid;gap:8px}
.gsws{display:flex;flex-wrap:wrap;gap:6px}
.gsw{width:26px;height:26px;border-radius:50%;border:2px solid var(--ink);background:var(--c);cursor:pointer;padding:0}
.gsw:hover{transform:scale(1.1)}
.gpickl{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:.82rem;font-weight:800}
.gpick{width:44px;height:30px;padding:2px;border:2px solid var(--ink);border-radius:8px;background:var(--paper);cursor:pointer}
.gside .btn{padding:6px 10px;font-size:.8rem;width:100%}
.ghelp{margin:0;font-weight:600;color:var(--muted);font-size:.76rem;line-height:1.35}
.ghelp.bad{color:var(--red)}
/* between 1000 and 1320px wide, make room for the sidebar beside the entries */
@media (min-width:1000px) and (max-width:1319px){
  body.gside-on .condwrap{max-width:1132px;padding-right:232px}
}
@media (max-width:999px){
  .gside{top:auto;left:12px;right:12px;bottom:calc(12px + var(--sbh,0px));width:auto}
  .gsh{display:none}
  .gsb{border-radius:12px;grid-template-columns:auto auto 1fr 1fr;align-items:center}
  .gside .btn{width:auto}
  .ghelp{grid-column:1/-1}
  body.gside-on .condwrap{padding-bottom:220px}
}
@media (max-width:640px){.gsb{grid-template-columns:1fr 1fr}.gsws{grid-column:1/-1}}
.gres h2{font-size:1rem}
.glab{display:grid;gap:5px;font-size:.85rem;font-weight:800}
.gwords{display:grid;gap:8px}
.gwlist{display:grid;gap:8px}
.gword{display:grid;grid-template-columns:minmax(120px,200px) 1fr auto;gap:8px;align-items:start}
.gword input,.gword textarea{font:600 .95rem var(--font);color:var(--ink);background:var(--paper);border:2px solid var(--ink);border-radius:8px;padding:8px 10px;width:100%}
.gword textarea{resize:vertical;field-sizing:content;min-height:2.6em;line-height:1.4}
.gwords>.btn{justify-self:start}
@media (max-width:600px){.gword{grid-template-columns:1fr}.gword .gwdel{justify-self:start}}
.gprev{display:grid;gap:6px}
.gprevbody{border:2px dashed var(--hair);border-radius:10px;padding:10px 14px;display:grid;gap:8px}
@media (max-width:600px){.gform input,.gform textarea,.cbar input{font-size:16px}}
"""
