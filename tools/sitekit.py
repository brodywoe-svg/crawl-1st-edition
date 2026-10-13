"""Shared site pieces: the top navigation bar and the Conditions page.

Used by tools/build.py. The navigation bar is injected into every page, and the
Glossary and Conditions pages draw their entries from crawl-glossary.json.
"""
import html
import re

# ---------------------------------------------------------------- navigation

# (label, href or None when the section isn't built yet, dropdown items or "glossary")
NAV_ITEMS = [
    ("Character Creator", None, None),
    ("Classes", None, None),
    ("Races", "races.html", None),
    ("Backgrounds", None, None),
    ("Spells", "index.html", [("All spells", "index.html?show=all"), ("By magic source", None),
                              ("Arcane", "index.html?source=arcane"), ("Divine", "index.html?source=divine"), ("Primal", "index.html?source=primal"), ("Occult", "index.html?source=occult"),
                              ("By class", None),
                              ("Wizard", "index.html?class=wizard"), ("Sorcerer", "index.html?class=sorcerer"), ("Cleric", "index.html?class=cleric"), ("Paladin", "index.html?class=paladin"),
                              ("Druid", "index.html?class=druid"), ("Warlock", "index.html?class=warlock"), ("Bard", "index.html?class=bard")]),
    ("Crafting", "crafting.html", [("Blacksmithing", "crafting.html?p=blacksmithing"), ("Tailoring", "crafting.html?p=tailoring"), ("Woodworking", "crafting.html?p=woodworking"), ("Cooking", "crafting.html?p=cooking"), ("Alchemy", "crafting.html?p=alchemy"), ("Leatherworking", "crafting.html?p=leatherworking"), ("Scribing", "crafting.html?p=scribing"), ("Tinkering", "crafting.html?p=tinkering"), ("Goldsmithing", "crafting.html?p=goldsmithing"), ("Enchanting", "crafting.html?p=enchanting")]),
    ("Items", "items.html", [("Weapons", "items.html?c=weapons"), ("Ammunition", "items.html?c=ammunition"), ("Armor", "items.html?c=armor"), ("Consumables", "items.html?c=consumables"),
                             ("Materials", "items.html?c=materials"), ("Magic Items", "items.html?c=magic-items")]),
    ("Glossary", "glossary.html", "glossary"),
    ("About", None, None),
]
# which nav item each page belongs to
SECTION = {"races": "Races", "spells": "Spells", "glossary": "Glossary", "conditions": "Glossary", "items": "Items", "crafting": "Crafting"}

CARET = '<svg viewBox="0 0 10 6" aria-hidden="true"><path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>'


def slug(name):
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def glossary_sections(glossary):
    """Section names in menu order: Conditions first, then A to Z."""
    secs = {(e.get("sec") or "Conditions").strip() or "Conditions" for e in glossary.get("entries", [])}
    secs.add("Conditions")
    return sorted(secs, key=lambda x: (x != "Conditions", x.lower()))


def section_href(sec):
    return "conditions.html" if sec == "Conditions" else "glossary.html?s=" + slug(sec)


def nav_html(active, controls="", sections=("Conditions",)):
    """active: the page key. controls: buttons for the right side. sections: Glossary menu entries."""
    sec = SECTION.get(active)
    parts = [
        '<nav class="sitenav" aria-label="Crawl"><div class="navin"><div class="navlinks">',
    ]
    for label, href, menu in NAV_ITEMS:
        if href is None:
            parts.append(f'<span class="navitem soon" aria-disabled="true" title="Coming soon">{label}<small>Soon</small></span>')
            continue
        cur = ' aria-current="page"' if (active == label.lower()) else (' data-current="1"' if sec == label else "")
        if not menu:
            parts.append(f'<a class="navitem" href="{href}"{cur}>{label}</a>')
            continue
        if menu == "glossary":
            items, menu_id = "".join(f'<a href="{section_href(t)}">{html.escape(t)}</a>' for t in sections), ' id="navGlossary"'
        else:
            items, menu_id = "".join(f'<a href="{h}">{html.escape(t)}</a>' if h else f'<span class="navmenuh">{html.escape(t)}</span>' for t, h in menu), ""
        parts.append(
            f'<div class="navdrop"><a class="navitem" href="{href}"{cur} aria-haspopup="true">{label}{CARET}</a>'
            f'<div class="navmenu"{menu_id}>{items}</div></div>'
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
.navmenuh{display:block;padding:8px 12px 2px;font:800 .62rem var(--font);letter-spacing:.12em;text-transform:uppercase;color:var(--muted)}
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
  .navitem.soon{display:none}
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
  /* Glossary menu: one link per glossary section */
  var menu=document.getElementById('navGlossary');
  function slug(s){return String(s).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}
  function esc(s){return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
  function href(s){return s==='Conditions'?'conditions.html':'glossary.html?s='+slug(s)}
  function mark(){var here=location.pathname.split('/').pop()+location.search;[].forEach.call(document.querySelectorAll('.navmenu a'),function(a){if(a.getAttribute('href')===here)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current')})}
  window.crawlNavMark=mark;
  window.crawlNavSections=function(list){
    if(!menu)return;var seen={},out=['Conditions'];seen.conditions=1;
    (list||[]).slice().sort(function(a,b){return a.toLowerCase().localeCompare(b.toLowerCase())}).forEach(function(s){s=String(s||'').trim();if(s&&!seen[s.toLowerCase()]){seen[s.toLowerCase()]=1;out.push(s)}});
    menu.innerHTML=out.map(function(s){return '<a href="'+href(s)+'">'+esc(s)+'</a>'}).join('');mark();
  };
  mark();
  if(window.CRAWL_STATIC&&menu&&!window.GL_PAGE)fetch('crawl-glossary.json',{cache:'no-cache'}).then(function(r){return r.ok?r.json():null}).then(function(j){if(j&&j.entries)window.crawlNavSections(j.entries.map(function(e){return e.sec||'Conditions'}))}).catch(function(){});
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


CATALOG_PAGES = {
    "items": ("Items", "Every item in Crawl 1st Edition, sorted into weapons, armor, consumables and crafting materials. Click an item to see its crafting recipe, weapon actions and description. A flask badge means the item still needs playtesting.",
              "Search items", "Add item"),
    "crafting": ("Crafting", "Every crafting recipe, sorted by profession. The badge on each recipe shows its tier, and a flask badge means it still needs playtesting. Click any material or yield to see that item on the Items page.",
                 "Search recipes or ingredients", "Add recipe"),
}


def races_shell(logo_svg, admin_modal):
    return f"""
<div class="wrap condwrap">
<header class="intro">
  {logo_svg}
  <h1>Races</h1>
  <p>The peoples of Crawl 1st Edition. Each race lists its ability score increases, starting proficiencies, languages and features, followed by its subraces.</p>
</header>
<div class="cbar">
  <input id="cq" type="search" placeholder="Search races and subraces" aria-label="Search races and subraces" autocomplete="off">
  <span class="ccount" id="ccount"></span>
  <button type="button" class="btn solid" id="gAdd" hidden>Add race</button>
</div>
<p class="gmsg" id="gmsg" role="status"></p>
<main id="clist"></main>
<p class="cempty" id="cempty" hidden></p>
</div>
{admin_modal}
<div class="savebar" id="savebar" hidden>
  <div class="in">
    <span class="msg" id="saveMsg">You have unsaved changes.</span>
    <button class="btn ghost" id="discardBtn">Discard</button>
    <button class="btn solid" id="saveBtn">Save changes</button>
  </div>
</div>
"""


def catalog_shell(page, logo_svg, admin_modal):
    title, intro, placeholder, add = CATALOG_PAGES[page]
    type_filter = f'<select id="cfilter" aria-label="{"Category" if page == "items" else "Profession"}"></select>'
    return f"""
<div class="wrap condwrap">
<header class="intro">
  {logo_svg}
  <h1>{title}</h1>
  <p>{intro}</p>
</header>
<div class="cbar">
  <input id="cq" type="search" placeholder="{placeholder}" aria-label="{placeholder}" autocomplete="off">
  {type_filter}
  <span class="ccount" id="ccount"></span>
  <button type="button" class="btn solid" id="gAdd" hidden>{add}</button>
</div>
<p class="gmsg" id="gmsg" role="status"></p>
<main id="clist"></main>
<p class="cempty" id="cempty" hidden></p>
</div>
<datalist id="itemNames"></datalist><datalist id="profs"></datalist>
{admin_modal}
<div class="savebar" id="savebar" hidden>
  <div class="in">
    <span class="msg" id="saveMsg">You have unsaved changes.</span>
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
.gfacts{margin:2px 0 0;display:grid;grid-template-columns:max-content 1fr;gap:5px 14px;font-size:.92rem}
.gfacts dt{font-weight:800}
.gfacts dd{margin:0;font-weight:600}
.gmod{border:2px solid var(--ink);border-radius:12px;padding:10px 14px;background:var(--page)}
.gmod+.gmod{margin-top:8px}
@media (max-width:600px){.gfacts{grid-template-columns:1fr;gap:0}.gfacts dd{margin-bottom:6px}}
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
/* items and crafting */
.cbar select{font:600 .95rem var(--font);border:2px solid var(--ink);border-radius:10px;padding:9px 10px;background:var(--paper);color:var(--ink)}
.muted{color:var(--muted);font-weight:600}
.ilink{color:var(--ink);font-weight:800;text-decoration:underline;text-decoration-thickness:2px;text-underline-offset:3px}
.ilink.gone{text-decoration:none;color:var(--muted)}
.ilink small{font-weight:600}
@keyframes flash{0%,40%{box-shadow:0 0 0 5px var(--red)}100%{box-shadow:0 0 0 0 transparent}}
.flash{animation:flash 1.6s ease-out}
.irow.flash .ihead td{animation:flashbg 1.6s ease-out}
@keyframes flashbg{0%,40%{background:var(--soft)}100%{background:transparent}}
.cond,.irow{scroll-margin-top:calc(var(--navh,0px) + 80px)}
/* items chart */
.icat{margin-top:18px}
.icath{margin:0;background:var(--ink);color:var(--paper);border-radius:14px 14px 0 0;padding:10px 16px;font-size:1.15rem;font-weight:800;display:flex;justify-content:space-between;align-items:baseline;gap:10px}
.icath span{font-size:.75rem;font-weight:700;opacity:.8}
.ichart{width:100%;border-collapse:separate;border-spacing:0;background:var(--paper);border:2px solid var(--ink);border-top:0;border-radius:0 0 14px 14px;overflow:hidden}
.gres+.ichart{border-top:2px solid var(--ink);border-radius:14px}
.ichart thead th{font-size:.7rem;letter-spacing:.1em;text-transform:uppercase;text-align:left;padding:8px 14px;border-bottom:2px solid var(--ink);background:var(--paper)}
.ichart th:nth-child(n+2),.ichart td:nth-child(n+2){width:96px;text-align:right}
.ichart th:nth-child(2),.ichart td:nth-child(2){width:110px;text-align:center}
.ichart th:nth-child(3),.ichart td:nth-child(3){width:80px;text-align:center}
.ichart .hs{display:none}
.magicbox{width:18px;height:18px;accent-color:var(--ink);vertical-align:middle;margin:0}
.magicbox:disabled{opacity:1;cursor:default}
.ncolor{display:flex;flex-wrap:wrap;align-items:center;gap:6px}
.ncolor .glab{margin-right:4px}
.pvname{margin:0 0 4px;font-size:1.1rem;font-weight:800;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.ncsw{width:26px;height:26px;border-radius:50%;border:2px solid var(--ink);background:var(--c);cursor:pointer;padding:0;font-size:.7rem;font-weight:800;color:var(--ink)}
.ncsw.on{box-shadow:0 0 0 3px var(--paper),0 0 0 5px var(--ink)}
.gform input.ncpick{width:40px;height:28px;padding:2px;border:2px solid var(--ink);border-radius:8px;background:var(--paper);cursor:pointer}
.isub th{background:var(--soft);text-align:left!important;font-size:.82rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase;padding:7px 14px;border-bottom:1px solid var(--hair)}
.ihead td{padding:0 14px;border-bottom:1px solid var(--hair);font-weight:600;font-size:.95rem;vertical-align:middle}
.irow:last-child .ihead td,.irow:last-child .idet td{border-bottom:0}
.itoggle{all:unset;box-sizing:border-box;display:flex;align-items:center;gap:8px;width:100%;padding:9px 0;cursor:pointer;font-weight:700}
.itoggle>svg{width:10px;height:6px;flex:none;transition:transform .15s;transform:rotate(-90deg)}
.irow.open .itoggle>svg{transform:none}
.itoggle:focus-visible{outline:3px solid var(--ink);outline-offset:2px;border-radius:4px}
.ihead:hover td{background:var(--soft)}
.icell{display:flex;align-items:center;gap:8px}
.icell .itoggle{flex:1;min-width:0}
.gedit.iedit{color:var(--ink);border-color:var(--ink);padding:2px 10px;font-size:.7rem}
.gedit.iedit:hover{background:var(--ink);color:var(--paper)}
.dused{margin-top:10px!important;border-top:1px solid var(--hair);padding-top:10px}
.ctag2{font-size:.6rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;border:1.5px solid currentColor;border-radius:999px;padding:1px 7px;color:var(--muted);white-space:nowrap}
.idet td{padding:4px 14px 16px;border-bottom:1px solid var(--hair);text-align:left!important;width:auto!important}
.idet .dsec{border-top:1px solid var(--hair);padding-top:10px;margin-top:10px;display:grid;gap:6px}
.idet .dsec:first-child{border-top:0;margin-top:4px}
.dsec h3{margin:0;font-size:.72rem;letter-spacing:.12em;text-transform:uppercase;color:var(--muted)}
.dsec p{margin:0}
.drec{display:grid;gap:3px}
.drec+.drec{margin-top:8px}
.dbtns{margin-top:12px;display:none}
.iform{padding-top:8px;display:grid;gap:12px}
/* recipe cards */
.rlist{grid-template-columns:repeat(auto-fill,minmax(300px,1fr));align-items:start}
.rname{display:flex;align-items:center;gap:8px;min-width:0}
.rtier{flex:none;width:22px;height:22px;display:grid;place-items:center;background:var(--paper);color:var(--ink);font-size:.75rem;font-weight:800;clip-path:polygon(50% 0,63% 13%,82% 9%,84% 28%,100% 38%,91% 56%,97% 75%,79% 82%,72% 100%,50% 92%,28% 100%,21% 82%,3% 75%,9% 56%,0 38%,16% 28%,18% 9%,37% 13%)}
.flask svg{width:22px;height:22px;display:block}
.itoggle .flask svg{width:18px;height:18px}
.chk svg{width:20px;height:20px}
.rcard .chead{font-size:.95rem;text-transform:uppercase;letter-spacing:.02em;padding:9px 12px}
.rcard .cbody{padding:10px 14px 14px;gap:2px;font-size:.9rem}
.rl{margin:0;font-weight:600;line-height:1.4}
.rl b{font-weight:700}
.rl.pre{font-style:italic}
.rkind{margin:0;color:var(--red);font-weight:800;font-style:italic}
.rfeat,.rquote{display:grid;gap:8px;margin-top:10px}
.rfeat p,.rquote p{margin:0;font-weight:600}
.rquote{font-style:italic}
.chk{display:flex!important;flex-direction:row;align-items:center;gap:8px;justify-self:start;font-weight:800;white-space:nowrap;cursor:pointer}
.chk input{width:18px!important;height:18px}
.gform select{font:600 .95rem var(--font);color:var(--ink);background:var(--paper);border:2px solid var(--ink);border-radius:8px;padding:8px 10px;width:100%}
.grid3{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}
.xlist,.qlist{display:grid;gap:8px}
.xrow{display:grid;grid-template-columns:minmax(110px,180px) 1fr auto;gap:8px}
.qrow{display:grid;grid-template-columns:76px 1fr auto;gap:8px}
.xrow input,.qrow input{font:600 .95rem var(--font);color:var(--ink);background:var(--paper);border:2px solid var(--ink);border-radius:8px;padding:8px 10px;width:100%;min-width:0}
.gform>.btn{justify-self:start}
.plist{display:grid;gap:8px}
.prow{display:grid;grid-template-columns:minmax(120px,200px) 1fr auto;gap:8px;align-items:start}
.prow input,.prow textarea{font:600 .95rem var(--font);color:var(--ink);background:var(--paper);border:2px solid var(--ink);border-radius:8px;padding:8px 10px;width:100%;min-width:0}
.prow .pn{color:var(--red);font-weight:800}
.prow textarea{resize:vertical;field-sizing:content;min-height:2.6em;line-height:1.4}
.pdn{color:var(--red);font-weight:800}
@media (max-width:600px){.prow{grid-template-columns:1fr}.prow .xdel{justify-self:start}}
@media (max-width:600px){
  .xrow{grid-template-columns:1fr}.xrow .xdel{justify-self:start}.xrow input,.qrow input,.gform select{font-size:16px}
  .ichart{table-layout:fixed}
  .ichart th:nth-child(n+2),.ichart td:nth-child(n+2){padding-inline:3px;font-size:.74rem;overflow-wrap:anywhere}
  .ichart th:nth-child(2),.ichart td:nth-child(2){width:64px}
  .ichart th:nth-child(3),.ichart td:nth-child(3){width:48px}
  .ichart th:nth-child(4),.ichart td:nth-child(4){width:46px}
  .ichart th:nth-child(5),.ichart td:nth-child(5){width:44px}
  .ichart th:nth-child(n+3),.ichart td:nth-child(n+3){text-align:center}
  .ichart thead th{font-size:.5rem;letter-spacing:0;overflow-wrap:normal!important}
  .ichart .ctag2,.gedit.iedit,.ichart .hl{display:none}
  .rchart th:nth-child(2),.rchart td:nth-child(2),.rchart th:nth-child(5),.rchart td:nth-child(5){display:none}
  .rchart th:nth-child(3),.rchart td:nth-child(3),.rchart th:nth-child(4),.rchart td:nth-child(4){width:40px}
  .ichart .hs{display:inline}
  .idet td{overflow-wrap:anywhere}
  .dbtns{display:block!important}
  .ihead td,.ichart thead th,.isub th,.idet td{padding-inline:10px}
}
/* crafting chart */
.rchart th:nth-child(2),.rchart td:nth-child(2){width:190px;text-align:left}
.rchart th:nth-child(3),.rchart td:nth-child(3),.rchart th:nth-child(4),.rchart td:nth-child(4){width:56px;text-align:center}
.rchart th:nth-child(5),.rchart td:nth-child(5){width:130px;text-align:left}
.rchart .ihead td:nth-child(n+2){font-size:.85rem}
.rchart .rtier{background:var(--ink);color:var(--paper);width:20px;height:20px;font-size:.68rem}
.rdet{display:grid;grid-template-columns:minmax(0,1fr) 270px;gap:18px;padding-top:10px;font-size:.92rem}
.rmain{display:grid;gap:2px;align-content:start}
.rside{border:2px solid var(--ink);border-radius:12px;padding:10px 12px;align-self:start;display:grid;gap:10px}
.rside h3{margin:0;font-size:.72rem;letter-spacing:.12em;text-transform:uppercase;color:var(--muted)}
.ybox{display:grid;gap:6px}
.ybox+.ybox{border-top:1px solid var(--hair);padding-top:8px}
.yname{margin:0;font-weight:800;font-size:1rem;display:flex;align-items:center;gap:6px}
.yname .ilink{text-decoration-color:currentColor}
.yname .flask svg{width:18px;height:18px}
.yfacts{margin:0;display:grid;grid-template-columns:auto 1fr;gap:3px 10px;font-size:.85rem}
.yfacts dt{font-weight:800;color:var(--muted)}
.yfacts dd{margin:0;font-weight:600}
.ilink.small{font-size:.8rem}
.gtop{justify-content:flex-end;margin-bottom:-4px}
@media (max-width:760px){.rdet{grid-template-columns:1fr}}
/* races */
.rlist2{display:grid;gap:14px}
.subs{display:grid;gap:10px;margin-top:6px}
.subs>h3{margin:4px 0 0;font-size:.72rem;letter-spacing:.12em;text-transform:uppercase;color:var(--muted)}
.subr{border:2px solid var(--ink);border-radius:12px;padding:10px 14px;display:grid;gap:6px;background:var(--page)}
.subh{display:flex;align-items:center;justify-content:space-between;gap:10px}
.subh b{font-size:1.02rem;font-weight:800}
.subr .gedit,.rbtn{color:var(--ink);border-color:var(--ink);padding:2px 10px;font-size:.72rem}
.subr .gedit:hover{background:var(--ink);color:var(--paper)}
.rfeats{display:grid;gap:6px}
.rfeats p{margin:0;font-weight:600}
.rform{display:grid;gap:12px}
.subs .rform{border:2px dashed var(--ink);border-radius:12px;padding:12px 14px}
.addsub{justify-self:start}
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
