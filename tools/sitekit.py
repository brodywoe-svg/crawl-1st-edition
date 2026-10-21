"""Shared site pieces: the top navigation bar and the Conditions page.

Used by tools/build.py. The navigation bar is injected into every page, and the
Glossary and Conditions pages draw their entries from crawl-glossary.json.
"""
import html
import json
import re

# ---------------------------------------------------------------- navigation

# (label, href or None when the section isn't built yet, dropdown items or "glossary")
NAV_ITEMS = [
    ("Home", "index.html", None),
    ("Character Creator", "creator.html", None),
    ("Classes", "classes.html", "classes"),
    ("Races", "races.html", "races"),
    ("Backgrounds", "backgrounds.html", "backgrounds"),
    ("Feats", "feats.html", "feats"),
    ("Spells", "spells.html", [("All spells", "spells.html?show=all"), ("By magic source", None),
                              ("Arcane", "spells.html?source=arcane"), ("Divine", "spells.html?source=divine"), ("Primal", "spells.html?source=primal"), ("Occult", "spells.html?source=occult"),
                              ("By class", None),
                              ("Wizard", "spells.html?class=wizard"), ("Sorcerer", "spells.html?class=sorcerer"), ("Cleric", "spells.html?class=cleric"), ("Paladin", "spells.html?class=paladin"),
                              ("Druid", "spells.html?class=druid"), ("Warlock", "spells.html?class=warlock"), ("Bard", "spells.html?class=bard")]),
    ("Crafting", "crafting.html", [("Blacksmithing", "crafting.html?p=blacksmithing"), ("Tailoring", "crafting.html?p=tailoring"), ("Woodworking", "crafting.html?p=woodworking"), ("Cooking", "crafting.html?p=cooking"), ("Alchemy", "crafting.html?p=alchemy"), ("Leatherworking", "crafting.html?p=leatherworking"), ("Scribing", "crafting.html?p=scribing"), ("Tinkering", "crafting.html?p=tinkering"), ("Goldsmithing", "crafting.html?p=goldsmithing"), ("Enchanting", "crafting.html?p=enchanting")]),
    ("Items", "items.html", [("Weapons", "items.html?c=weapons"), ("Ammunition", "items.html?c=ammunition"), ("Armor", "items.html?c=armor"), ("Consumables", "items.html?c=consumables"),
                             ("Materials", "items.html?c=materials"), ("Magic Items", "items.html?c=magic-items"), ("Miscellaneous", "items.html?c=miscellaneous")]),
    ("Glossary", "glossary.html", "glossary"),
    ("Tabletop", "https://brodywoe-svg.github.io/crawl-1st-edition/tabletop/", None),
    ("About", None, None),
]
# which nav item each page belongs to
SECTION = {"home": "Home", "creator": "Character Creator", "classes": "Classes", "backgrounds": "Backgrounds", "feats": "Feats", "races": "Races", "spells": "Spells", "glossary": "Glossary", "conditions": "Glossary", "items": "Items", "crafting": "Crafting"}

CARET = '<svg viewBox="0 0 10 6" aria-hidden="true"><path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>'


def slug(name):
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


# sections whose menu item gets a flyout listing each of its entries (linking to glossary.html?s=<section>#g-<entry>)
FLY_SECTIONS = ["Damage Types"]
SECTION_ENTRIES = {}


def glossary_sections(glossary):
    """Section names in menu order: Conditions first, then A to Z. Also notes each flyout section's entries."""
    for s in FLY_SECTIONS:
        SECTION_ENTRIES[s] = sorted((e.get("n", "") for e in glossary.get("entries", []) if (e.get("sec") or "").strip() == s), key=lambda n: (not n.lower().endswith(" damage") or n.lower() == "bleeding damage", n.lower()))
    secs = {(e.get("sec") or "Conditions").strip() or "Conditions" for e in glossary.get("entries", [])}
    secs.add("Conditions")
    return sorted(secs, key=lambda x: (x != "Conditions", x.lower()))


def section_href(sec):
    return "conditions.html" if sec == "Conditions" else "glossary.html?s=" + slug(sec)


# Glossary menu groups: a group is a page of its own (glossary.html?s=<slug>) with a flyout of its sections.
# The sections in a group always exist, even before they have entries. The browser copy of this is CRAWL_GTREE.
GLOSSARY_TREE = [{"n": "Combat", "slug": "combat", "items": ["Combat Rules", {"n": "Actions", "slug": "actions", "items": ["Weapon Actions", "Combat Actions", "General Actions"]}]}]


def tree_leaves(items):
    return [y for x in items for y in ([x] if isinstance(x, str) else tree_leaves(x["items"]))]


def glossary_menu(sections):
    """Conditions, then the groups (Combat ▸ ...), then every other section A to Z."""
    def node(x):
        if isinstance(x, str) and SECTION_ENTRIES.get(x):
            return (f'<div class="navsub"><a href="{section_href(x)}">{html.escape(x)}{CARET_R}</a><div class="navfly{" cols2" if len(SECTION_ENTRIES[x]) > 10 else ""}">'
                    + "".join(f'<a href="{section_href(x)}#g-{slug(n)}">{html.escape(n)}</a>' for n in SECTION_ENTRIES[x]) + '</div></div>')
        if isinstance(x, str):
            return f'<a href="{section_href(x)}">{html.escape(x)}</a>'
        return (f'<div class="navsub"><a href="glossary.html?s={x["slug"]}">{html.escape(x["n"])}{CARET_R}</a>'
                f'<div class="navfly">{"".join(node(y) for y in x["items"])}</div></div>')
    grouped = set(tree_leaves(GLOSSARY_TREE))
    rest = [s for s in sections if s != "Conditions" and s not in grouped]
    return node("Conditions") + "".join(node(g) for g in GLOSSARY_TREE) + "".join(node(s) for s in rest)


LIST_MENUS = {
    # menu kind: (page, data key, "All ..." label)
    "races": ("races.html", "races", "All races"),
    "classes": ("classes.html", "classes", "All classes"),
    "backgrounds": ("backgrounds.html", "backgrounds", "All backgrounds"),
    "feats": ("feats.html", "feats", "All feats"),
}


def list_menu(kind, data):
    """Races, Classes and Backgrounds menus: each entry, with its subraces or subclasses in a flyout (or indented on phones)."""
    page, key, all_label = LIST_MENUS[kind]
    out = [f'<a href="{page}">{all_label}</a>']
    for r in sorted((data or {}).get(key, []), key=lambda x: x.get("n", "").lower()):
        subs = sorted(r.get("subs", []), key=lambda x: x.get("n", "").lower())
        link = f'<a href="{page}#{html.escape(r.get("id", ""))}">{html.escape(r.get("n", ""))}</a>'
        if subs:
            fly = "".join(f'<a href="{page}#{html.escape(x.get("id", ""))}">{html.escape(x.get("n", ""))}</a>' for x in subs)
            out.append(f'<div class="navsub">{link.replace("</a>", CARET_R + "</a>")}<div class="navfly">{fly}</div></div>')
        else:
            out.append(link)
    return "".join(out)


CARET_R = '<svg class="caretr" viewBox="0 0 6 10" aria-hidden="true"><path d="M1 1l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>'


def nav_html(active, controls="", sections=("Conditions",), races=None, classes=None, backgrounds=None, feats=None):
    """active: the page key. controls: buttons for the right side. sections: Glossary menu entries.
    races, classes, backgrounds: the data behind those menus."""
    lists = {"races": races, "classes": classes, "backgrounds": backgrounds, "feats": feats}
    sec = SECTION.get(active)
    parts = [
        '<nav class="sitenav" aria-label="Crawl"><div class="navin">'
        '<button type="button" class="navarr l" tabindex="-1" aria-label="Show earlier menu items"><svg viewBox="0 0 8 14" aria-hidden="true"><path d="M7 1L1 7l6 6" fill="none" stroke="currentColor" stroke-width="2"/></svg></button>'
        '<div class="navlinks">',
    ]
    for label, href, menu in NAV_ITEMS:
        if href is None:
            parts.append(f'<span class="navitem soon" aria-disabled="true" title="Coming soon">{label}<small>Soon</small></span>')
            continue
        cur = ' aria-current="page"' if (active == label.lower()) else (' data-current="1"' if sec == label else "")
        if not menu:
            extra = " adminonly" if label == "Tabletop" else ""
            parts.append(f'<a class="navitem{extra}" href="{href}"{cur}{' title="Only you can see this while the Tabletop is in testing"' if extra else ""}>{label}</a>')
            continue
        if isinstance(menu, str) and menu in LIST_MENUS:
            items, menu_id = list_menu(menu, lists[menu]), f' id="nav{menu.capitalize()}"'
        elif menu == "glossary":
            items, menu_id = glossary_menu(sections), ' id="navGlossary"'
        else:
            items, menu_id = "".join(f'<a href="{h}">{html.escape(t)}</a>' if h else f'<span class="navmenuh">{html.escape(t)}</span>' for t, h in menu), ""
        parts.append(
            f'<div class="navdrop"><a class="navitem" href="{href}"{cur} aria-haspopup="true">{label}{CARET}</a>'
            f'<div class="navmenu"{menu_id}>{items}</div></div>'
        )
    parts.append('</div><button type="button" class="navarr r" tabindex="-1" aria-label="Show more menu items"><svg viewBox="0 0 8 14" aria-hidden="true"><path d="M1 1l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2"/></svg></button>')
    parts.append(f'<div class="navctl" id="navctl">{controls}</div></div></nav>')
    parts.append(f"<script>{NAV_JS.replace('/*@GTREE@*/null', json.dumps(GLOSSARY_TREE)).replace('/*@FLY@*/null', json.dumps(FLY_SECTIONS))}</script>")
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
.navitem.adminonly{display:none}
html.is-admin .navitem.adminonly{display:inline-flex}
.navitem.soon small{font-size:.55rem;letter-spacing:.1em;border:1px solid currentColor;border-radius:999px;padding:1px 5px}
.navitem:focus-visible{outline:3px solid var(--paper);outline-offset:-3px}
.navdrop{position:relative;display:flex}
.navmenu{display:none;position:absolute;top:100%;left:50%;transform:translateX(-50%);min-width:210px;background:var(--paper);color:var(--ink);border:2px solid var(--ink);border-radius:12px;padding:6px;box-shadow:0 10px 28px rgba(0,0,0,.22)}
.navdrop:hover .navmenu,.navdrop:focus-within .navmenu{display:grid}
@media (hover:none){.navdrop:hover .navmenu{display:none}}
.navmenu a{display:block;padding:10px 12px;border-radius:8px;font:700 .92rem var(--font);color:var(--ink);text-decoration:none}
.navmenu a:hover,.navmenu a:focus-visible{background:var(--soft);outline:none}
.navsub{position:relative}
.navsub>a{display:flex!important;align-items:center;justify-content:space-between;gap:10px}
.caretr{width:6px;height:10px;flex:none}
/* flyouts open to the right and stay open for a moment after the pointer leaves, so moving onto them is easy */
.navfly{display:grid;visibility:hidden;opacity:0;position:absolute;left:100%;top:-8px;min-width:190px;background:var(--paper);border:2px solid var(--ink);border-radius:12px;padding:6px;box-shadow:0 10px 28px rgba(0,0,0,.22);margin-left:2px;z-index:1;transition:opacity .12s ease .3s,visibility 0s linear .42s}
.navfly::before{content:"";position:absolute;top:-8px;bottom:-8px;left:-16px;width:16px}
.navsub:hover>.navfly,.navsub:focus-within>.navfly{visibility:visible;opacity:1;z-index:2;transition-delay:0s}
.navsub:hover>a{background:var(--soft)}
.navfly.cols2{grid-template-columns:repeat(2,minmax(150px,1fr));column-gap:2px}
@media (prefers-reduced-motion:reduce){.navfly{transition:visibility 0s linear .35s}}
@media (hover:none),(max-width:700px){.navfly{visibility:visible;opacity:1;transition:none;position:static;border:0;box-shadow:none;padding:0 0 0 14px;margin:0;min-width:0}.navfly::before{display:none}.caretr{display:none}}
.navmenuh{display:block;padding:8px 12px 2px;font:800 .62rem var(--font);letter-spacing:.12em;text-transform:uppercase;color:var(--muted)}
.navmenu a[aria-current="page"]{text-decoration:underline;text-underline-offset:4px}
/* NAV_JS steps through these until the links fit on one row beside the buttons */
.nav-c1 .navitem{padding-inline:9px;letter-spacing:.06em}
.nav-c2 .navitem.soon small{display:none}
.nav-c3 .navctl .adminbtn span,.nav-c3 .navctl .modebtn span{display:none}
.nav-c3 .navctl .adminbtn,.nav-c3 .navctl .modebtn{padding:6px}
.nav-c4 .navitem{padding-inline:7px;font-size:.72rem;letter-spacing:.04em}
/* when the links still don't fit (phones, half-width windows): one row that scrolls sideways, with arrows */
.navarr{display:none;flex:none;align-self:stretch;width:28px;border:0;padding:0;background:var(--ink);color:var(--paper);cursor:pointer;align-items:center;justify-content:center;border-radius:6px}
.navarr svg{width:8px;height:14px}
.navarr:hover:not([disabled]){background:var(--barhover)}
.navarr[disabled]{opacity:.22;cursor:default}
.navscroll .navarr{display:flex}
.navscroll .navin{gap:2px}
.navscroll .navlinks{flex-wrap:nowrap!important;justify-content:flex-start!important;overflow-x:auto;overflow-y:hidden;scrollbar-width:none;scroll-behavior:smooth;overscroll-behavior-x:contain;position:relative}
.navscroll .navarr{position:relative;z-index:1}
.navscroll .navarr:not([disabled])::after{content:"";position:absolute;top:0;bottom:0;width:16px;pointer-events:none}
.navscroll .navarr.l:not([disabled])::after{left:100%;background:linear-gradient(to right,var(--ink),transparent)}
.navscroll .navarr.r:not([disabled])::after{right:100%;background:linear-gradient(to left,var(--ink),transparent)}
.navscroll .navlinks::-webkit-scrollbar{display:none}
.navscroll .navdrop{position:static}
.navscroll .navmenu{position:fixed;transform:none}
@media (prefers-reduced-motion:reduce){.navscroll .navlinks{scroll-behavior:auto}}
@media (max-width:700px){
  .navin{gap:4px;padding-inline:6px}
  .navscroll .navmenu{max-height:calc(100vh - var(--navh,48px) - 16px);overflow-y:auto}
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
  var STEPS=['nav-c1','nav-c2','nav-c3','nav-c4'],arrL=nav&&nav.querySelector('.navarr.l'),arrR=nav&&nav.querySelector('.navarr.r'),centered=false;
  var over=function(){return links.scrollWidth>links.clientWidth+1};
  function arrows(){if(!arrL)return;arrL.disabled=links.scrollLeft<=1;arrR.disabled=links.scrollLeft+links.clientWidth>=links.scrollWidth-1}
  function fit(){
    if(!nav||busy)return;busy=true;
    STEPS.concat('navscroll').forEach(function(c){nav.classList.remove(c)});
    if(window.innerWidth>700){for(var i=0;i<STEPS.length&&over();i++)nav.classList.add(STEPS[i])}
    if(over()){nav.classList.add('navscroll');
      if(!centered){centered=true;var cur=links.querySelector('[aria-current="page"],[data-current]');if(cur){var b=links.style.scrollBehavior;links.style.scrollBehavior='auto';links.scrollLeft=cur.offsetLeft-(links.clientWidth-cur.offsetWidth)/2;links.style.scrollBehavior=b}}}
    arrows();
    document.documentElement.style.setProperty('--navh',nav.offsetHeight+'px');busy=false;
  }
  if(links){links.addEventListener('scroll',arrows,{passive:true});
    [[arrL,-1],[arrR,1]].forEach(function(a){if(a[0])a[0].addEventListener('click',function(){links.scrollBy({left:a[1]*Math.max(120,links.clientWidth*0.7)})})});
    /* in the scrolling row, menus are fixed under the bar (so the row doesn't clip them), next to their item */
    /* a menu sits under its item, moved left when needed so it and its flyouts (which open to the right) fit on screen */
    var chainW=function(el){var best=0;[].forEach.call(el.children,function(c){if(!c.classList.contains('navsub'))return;var f=c.querySelector(':scope>.navfly');if(f)best=Math.max(best,f.offsetWidth+2+chainW(f))});return best};
    var place=function(e){var d=e.target.closest&&e.target.closest('.navdrop');if(!d)return;var m=d.querySelector('.navmenu');if(!m)return;
      var scroll=nav.classList.contains('navscroll'),wide=window.innerWidth>700;
      if(!wide){m.style.left='';m.style.right='';m.style.transform='';m.style.top=scroll?nav.getBoundingClientRect().bottom+'px':'';return}
      var r=d.getBoundingClientRect(),w=m.offsetWidth||220,need=w+chainW(m)+8;
      var x=Math.max(8,Math.min(window.innerWidth-need-8,r.left+r.width/2-w/2));
      if(scroll){m.style.top=nav.getBoundingClientRect().bottom+'px';m.style.left=x+'px'}else{m.style.top='';m.style.left=(x-r.left)+'px'}
      m.style.right='auto';m.style.transform='none'};
    nav.addEventListener('mouseover',place);nav.addEventListener('focusin',place);
    links.addEventListener('scroll',function(){var a=document.activeElement;if(a&&a.closest&&a.closest('.navdrop')&&!a.closest('.navmenu'))a.blur()},{passive:true});
  }
  window.crawlNavFit=fit;fit();window.addEventListener('resize',fit);
  if(window.MutationObserver)new MutationObserver(function(){requestAnimationFrame(fit)}).observe(document.documentElement,{attributes:true,attributeFilter:['class']});
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
  /* Races, Classes and Backgrounds menus: rebuilt when the data loads or an admin edits it */
  var LISTS={races:['races.html','All races'],classes:['classes.html','All classes'],backgrounds:['backgrounds.html','All backgrounds'],feats:['feats.html','All feats']};
  window.crawlNavList=function(kind,items){
    var m=document.getElementById('nav'+kind.charAt(0).toUpperCase()+kind.slice(1)),L=LISTS[kind];
    if(!m||!L||!items)return;
    var by=function(a,b){return String(a.n||'').toLowerCase().localeCompare(String(b.n||'').toLowerCase())};
    m.innerHTML='<a href="'+L[0]+'">'+L[1]+'</a>'+items.filter(function(r){return r&&r.n&&!r._new}).slice().sort(by).map(function(r){
      var subs=(r.subs||[]).filter(function(x){return x&&x.n&&!x._new}).slice().sort(by),link='<a href="'+L[0]+'#'+esc(r.id)+'">'+esc(r.n);
      return subs.length?'<div class="navsub">'+link+'<svg class="caretr" viewBox="0 0 6 10" aria-hidden="true"><path d="M1 1l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.8"/></svg></a><div class="navfly">'+subs.map(function(x){return '<a href="'+L[0]+'#'+esc(x.id)+'">'+esc(x.n)+'</a>'}).join('')+'</div></div>':link+'</a>';
    }).join('');
  };
  window.crawlNavRaces=function(data){if(data)window.crawlNavList('races',data.races)};
  if(window.CRAWL_STATIC)Object.keys(LISTS).forEach(function(kind){
    if(!document.getElementById('nav'+kind.charAt(0).toUpperCase()+kind.slice(1)))return;
    fetch('crawl-'+kind+'.json',{cache:'no-cache'}).then(function(r){return r.ok?r.json():null}).then(function(j){if(j&&j[kind])window.crawlNavList(kind,j[kind])}).catch(function(){});
  });
  var GTREE=window.CRAWL_GTREE=/*@GTREE@*/null||[];
  function leaves(items){var o=[];items.forEach(function(x){if(typeof x==='string')o.push(x);else o=o.concat(leaves(x.items))});return o}
  var FLY=/*@FLY@*/null||[],FLYE={};
  function node(x){if(typeof x==='string'&&FLYE[x]&&FLYE[x].length)return '<div class="navsub"><a href="'+href(x)+'">'+esc(x)+'<svg class="caretr" viewBox="0 0 6 10" aria-hidden="true"><path d="M1 1l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.8"/></svg></a><div class="navfly'+(FLYE[x].length>10?' cols2':'')+'">'+FLYE[x].map(function(n){return '<a href="'+href(x)+'#g-'+slug(n)+'">'+esc(n)+'</a>'}).join('')+'</div></div>';
    if(typeof x==='string')return '<a href="'+href(x)+'">'+esc(x)+'</a>';
    return '<div class="navsub"><a href="glossary.html?s='+x.slug+'">'+esc(x.n)+'<svg class="caretr" viewBox="0 0 6 10" aria-hidden="true"><path d="M1 1l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.8"/></svg></a><div class="navfly">'+x.items.map(node).join('')+'</div></div>'}
  window.crawlNavSections=function(list,ents){
    if(!menu)return;if(ents){FLYE={};FLY.forEach(function(s){FLYE[s]=ents.filter(function(e){return String(e.sec||'').trim()===s}).map(function(e){return e.n}).sort(function(a,b){var k=function(n){n=n.toLowerCase();return (/ damage$/.test(n)&&n!=='bleeding damage'?'0':'1')+n};return k(a).localeCompare(k(b))})})}var seen={conditions:1},out=[],grouped={};leaves(GTREE).forEach(function(s){grouped[s.toLowerCase()]=1});
    (list||[]).slice().sort(function(a,b){return a.toLowerCase().localeCompare(b.toLowerCase())}).forEach(function(s){s=String(s||'').trim();if(s&&!seen[s.toLowerCase()]&&!grouped[s.toLowerCase()]){seen[s.toLowerCase()]=1;out.push(s)}});
    menu.innerHTML=node('Conditions')+GTREE.map(node).join('')+out.map(node).join('');mark();
  };
  mark();
  if(window.CRAWL_STATIC&&menu&&!window.GL_PAGE)fetch('crawl-glossary.json',{cache:'no-cache'}).then(function(r){return r.ok?r.json():null}).then(function(j){if(j&&j.entries)window.crawlNavSections(j.entries.map(function(e){return e.sec||'Conditions'}),j.entries)}).catch(function(){});
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


def creator_shell(logo_svg, admin_modal):
    return f"""
<div class="ccwrap">
<header class="intro ccintro">
  <div id="ccLogo">{logo_svg}</div>
  <h1>Character Creator</h1>
  <p>Build a Crawl 1st Edition character one step at a time, then play from the finished character sheet.</p>
</header>
<div class="cctop"><button type="button" class="btn" id="ccAdminBtn" hidden>Edit creator rules</button></div>
<p class="gmsg" id="gmsg" role="status"></p>
<div id="cchome"></div>
<div class="ccgame" id="ccgame" hidden>
  <div class="cctitle"><button type="button" class="ccbar" id="ccHome">My characters</button><b id="ccName">New character</b><button type="button" class="ccbar" id="ccToSheet">Character sheet</button></div>
  <nav class="ccsteps" id="ccsteps" aria-label="Character creation steps"></nav>
  <section class="ccmain" id="ccmain" aria-live="polite"></section>
  <aside class="ccinfo" id="ccinfo" aria-label="About this choice"></aside>
  <div class="ccfoot" id="ccfoot"><button type="button" class="ccbar" id="ccBack">Back</button><button type="button" class="ccbar" id="ccRestart">Start over</button><span class="sp"></span><button type="button" class="ccbar solid" id="ccNext">Next</button></div>
</div>
<div id="ccsheet" hidden>
  <div class="sheettools"><button type="button" class="btn" id="sheetHome">My characters</button><b id="sheetName"></b><span class="sp"></span><button type="button" class="btn" id="sheetEdit">Edit in the creator</button><button type="button" class="btn" id="sheetFile">Save to file</button><button type="button" class="btn" id="sheetReset">Clear typed-in values</button><button type="button" class="btn solid" id="sheetPrint">Print or save as PDF</button></div>
  <p class="ccnote sheethelp">Everything on the sheet can be typed over, and it saves as you go. Click a star to mark a proficiency and a circle to set a rank. Values worked out from your choices update when you change them in the creator.</p>
  <div id="sheetPages"></div>
</div>
<div id="ccadmin" hidden>
  <div class="ccadmintop"><h2 class="cch2">Character Creator rules</h2><button type="button" class="btn" id="ccAdminDone">Back to the creator</button></div>
  <p class="ccnote">Classes are edited on the <a href="classes.html">Classes page</a> and backgrounds on the <a href="backgrounds.html">Backgrounds page</a>; races come from the <a href="races.html">Races page</a>, spells from the <a href="spells.html">Spells page</a> and gear from the <a href="items.html">Items page</a>. Proficiencies are read from the text: name skills, weapon types, armor and trade skills, write &ldquo;Either Alchemy or Cooking&rdquo; for a choice, or &ldquo;Two skills of your choice&rdquo; for free picks.</p>
  <div id="ccAdminList"></div>
</div>
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


LIST_PAGES = {
    "classes": ("Classes", "The classes of Crawl 1st Edition: each one's class chart, features by level, proficiencies, skill points and starting equipment, followed by its subclasses. Everything here can be chosen in the Character Creator.", "Search classes, features and subclasses", "Add class"),
    "backgrounds": ("Backgrounds", "The backgrounds of Crawl 1st Edition: the life a character lived before adventuring, with the proficiencies, languages and gear it brings. Everything here can be chosen in the Character Creator.", "Search backgrounds", "Add background"),
    "feats": ("Feats", "The feats of Crawl 1st Edition: special talents that set a character apart. Every class gains a feat at 2nd level and every 2 levels after (4th, 6th, 8th and so on).", "Search feats", "Add feat"),
}


def list_shell(page, logo_svg, admin_modal):
    title, intro, placeholder, add = LIST_PAGES[page]
    return f"""
<div class="wrap condwrap{' clswrap' if page == 'classes' else ''}">
<header class="intro">
  {logo_svg}
  <h1>{title}</h1>
  <p id="lintro">{intro}</p>
</header>
<div class="cbar">
  <input id="cq" type="search" placeholder="{placeholder}" aria-label="{placeholder}" autocomplete="off">
  <span class="ccount" id="ccount"></span>
  <button type="button" class="btn solid" id="gAdd" hidden>{add}</button>
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


CLASSES_CSS = """
.pgive{display:grid;gap:10px;border:2px solid var(--hair);border-radius:12px;padding:10px 12px;margin-bottom:12px}
.pgrow{display:grid;grid-template-columns:110px 1fr;gap:10px;align-items:start}
.pglab{font-size:.75rem;font-weight:800;letter-spacing:.1em;text-transform:uppercase;padding-top:7px}
.pgchips{display:flex;flex-wrap:wrap;gap:6px}
.pgc{display:inline-flex;align-items:center;gap:4px;font:600 .85rem var(--font);color:var(--ink);background:var(--paper);border:2px solid var(--hair);border-radius:999px;padding:3px 10px;cursor:pointer;line-height:1.3}
.pgc.tiered{cursor:default;padding:2px 3px 2px 10px}
.pgc.on{border-color:var(--ink);background:var(--soft);font-weight:800}
.pgb{width:24px;height:24px;border-radius:50%;border:2px solid var(--hair);background:var(--paper);color:var(--muted,#777);font:800 .72rem var(--font);cursor:pointer;padding:0;display:inline-grid;place-items:center}
.pgb.on{background:var(--ink);border-color:var(--ink);color:var(--paper)}
.pgb:focus-visible,.pgc:focus-visible{outline:3px solid var(--accent,#c58b1b);outline-offset:1px}
.chopt.tiered{padding:2px 3px 2px 6px;gap:4px}
.chopt.tiered>label{display:inline-flex;align-items:center;gap:6px;margin:0;cursor:pointer;font-size:.85rem}
.chopt.tiered .chtiers{display:none;gap:2px}
.chopt.tiered:has(input:checked) .chtiers{display:inline-flex}
@media (max-width:560px){.pgrow{grid-template-columns:1fr;gap:4px}.pglab{padding-top:0}}
.ptgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px;border:2px solid var(--hair);border-radius:12px;padding:10px 12px}
.ptcol{display:grid;gap:4px;align-content:start}
.ptcol>b{font-size:.78rem;letter-spacing:.1em;text-transform:uppercase}
.ptrow{display:grid!important;grid-template-columns:1fr 128px;align-items:center;gap:8px;font-weight:600;font-size:.9rem;margin:0!important}
.ptrow select{font:700 .85rem var(--font);color:var(--ink);background:var(--paper);border:2px solid var(--ink);border-radius:8px;padding:4px 6px;width:100%}
:root{--gold:#b7791f}
:root[data-mode="dark"]{--gold:#e8b350}
.clswrap{max-width:1100px}
.clsgrid{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,1fr);gap:14px;margin:4px 0 6px}
.clschart{border:2px solid var(--ink);border-radius:12px;overflow:hidden;align-self:start}
.clschart table{width:100%;border-collapse:collapse;font-size:.88rem}
.clschart th,.clschart td{padding:6px 8px;text-align:center;border-top:1px solid var(--hair)}
.clschart thead th{background:var(--ink);color:var(--paper);font-size:.7rem;letter-spacing:.08em;text-transform:uppercase;border-top:0}
.clschart tbody th{font-weight:800;width:56px}
.clschart td:nth-child(2),.clschart td:nth-child(3){width:86px;white-space:nowrap}
.clschart td:last-child,.clschart thead th:last-child{text-align:left}
.clschart tbody tr:nth-child(even){background:var(--soft)}
.flink{font:inherit;font-weight:700;color:var(--red);background:none;border:0;padding:0;cursor:pointer;text-decoration:underline;text-decoration-thickness:1.5px;text-underline-offset:2px}
.clsfeats{position:relative;border:2px solid var(--ink);border-radius:12px;overflow:hidden;min-height:280px;background:var(--page)}
.cfh{position:absolute;top:0;left:0;right:0;z-index:1;background:var(--ink);color:var(--paper);font-size:.7rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase;padding:8px 12px}
.cfin{position:absolute;inset:31px 0 0 0;overflow-y:auto;padding:10px 12px 14px;display:grid;gap:10px;align-content:start;scroll-behavior:smooth}
.cfin:focus-visible{outline:3px solid var(--red);outline-offset:-3px}
.clsf{border-bottom:1px solid var(--hair);padding-bottom:10px;border-radius:6px}
.clsf:last-child{border-bottom:0}
.clsf h4{margin:0 0 4px;display:flex;align-items:baseline;justify-content:space-between;gap:8px;font-size:.98rem}
.clsf p{margin:0 0 4px;font-weight:600;font-size:.9rem}
.clsf.flash{animation:clsflash 1.4s ease-out}
@keyframes clsflash{0%{background:color-mix(in srgb,var(--gold) 35%,transparent)}100%{background:transparent}}
.lvtag{font-size:.62rem;font-weight:800;letter-spacing:.1em;text-transform:uppercase;border:1.5px solid currentColor;border-radius:999px;padding:1px 8px;white-space:nowrap;color:var(--muted)}
.clsload h3{margin:8px 0 6px;font-size:.72rem;letter-spacing:.12em;text-transform:uppercase;color:var(--muted)}
.loadgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px}
.loadc{border:2px solid var(--ink);border-radius:12px;padding:10px 12px;display:grid;gap:4px;align-content:start}
.loadc.money{border-style:dashed}
.loadc p{margin:0;font-weight:600}
.gearl{margin:0;padding:0;list-style:none;display:grid;gap:3px;font-weight:600;font-size:.92rem}
.gearl li{position:relative;padding-left:16px}
.gearl li::before{content:"";position:absolute;left:2px;top:.55em;width:6px;height:6px;background:var(--ink);transform:rotate(45deg)}
.fgrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
.cform select{font:600 .95rem var(--font);color:var(--ink);background:var(--paper);border:2px solid var(--ink);border-radius:8px;padding:8px 10px;width:100%}
.frow{grid-template-columns:minmax(120px,200px) 64px 1fr auto}
.frow .pl,.chrow input,.grow input,.lhead input{font:600 .95rem var(--font);color:var(--ink);background:var(--paper);border:2px solid var(--ink);border-radius:8px;padding:8px 10px;width:100%;min-width:0}
.chlist{display:grid;gap:6px;max-height:420px;overflow-y:auto;padding-right:4px}
.chrow{display:grid;grid-template-columns:70px 1fr 1fr auto;gap:8px;align-items:center}
.chh{font-size:.72rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
.llist{display:grid;gap:10px}
.lrow{border:2px dashed var(--ink);border-radius:12px;padding:10px 12px;display:grid;gap:8px}
.lrow>.btn{justify-self:start}
.lhead{display:grid;grid-template-columns:1fr auto;gap:8px}
.glist{display:grid;gap:6px}
.schlist{display:grid;gap:6px}
.chlist2{display:grid;gap:10px}
.choicerow{border:2px dashed var(--ink);border-radius:12px;padding:10px 12px;display:grid;gap:8px}
.chtop{display:flex;flex-wrap:wrap;align-items:center;gap:8px;font-weight:800;font-size:.9rem}
.chtop .xdel{margin-left:auto}
.chtop input,.chtop select{font:600 .95rem var(--font);color:var(--ink);background:var(--paper);border:2px solid var(--ink);border-radius:8px;padding:6px 8px}
.chtop input{width:70px}
.chtop select{width:auto}
.chopts{display:flex;flex-wrap:wrap;gap:6px}
.chopt{display:inline-flex!important;align-items:center;gap:6px;border:2px solid var(--hair);border-radius:999px;padding:3px 10px 3px 6px;font-size:.85rem!important;cursor:pointer}
.chopt:has(input:checked){border-color:var(--ink);background:var(--soft)}
.chopt input{width:16px!important;height:16px;accent-color:var(--ink)}
.chopts .chtext{width:100%}
.schrow{display:grid;grid-template-columns:1fr 1fr auto;gap:8px;align-items:center}
.schrow input{font:600 .95rem var(--font);color:var(--ink);background:var(--paper);border:2px solid var(--ink);border-radius:8px;padding:8px 10px;width:100%;min-width:0}
.grow{display:grid;grid-template-columns:1fr 80px auto;gap:8px;align-items:center}
.cform>.btn,.cform .gbtns+.btn{justify-self:start}
@media (max-width:760px){
  .clsgrid{grid-template-columns:1fr}
  .clschart th,.clschart td{padding:6px 5px}
  .clschart tbody th{width:38px}
  .clschart td:nth-child(2),.clschart td:nth-child(3){width:52px}
  .clschart thead th{font-size:.62rem;letter-spacing:.04em}
  .clsfeats{min-height:0;height:340px}
  .fgrid{grid-template-columns:1fr}
  .frow{grid-template-columns:1fr 70px}.frow .pd{grid-column:1/-1}.frow .xdel{justify-self:start}
  .chrow{grid-template-columns:56px 1fr 1fr}.chrow .xdel{grid-column:1/-1;justify-self:start}
  .frow input,.chrow input,.grow input,.lhead input,.cform select{font-size:16px}
}
"""


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
.ctag.apc{background:var(--paper);color:var(--ink);border-color:var(--paper)}
.cond[id^="g-"]{scroll-margin-top:calc(var(--navh,48px) + 14px)}
.cond.gflash{animation:flash 1.6s ease-out}
.gact{display:grid;grid-template-columns:120px 1fr;gap:10px}
.pretoggle{display:inline-flex;align-items:center;gap:8px;background:none;border:0;padding:0;font:inherit;color:inherit;cursor:pointer}
.pretoggle svg{width:12px;height:8px;transform:rotate(-90deg);transition:transform .15s}
.ipresets.open .pretoggle svg{transform:none}
.pretoggle:focus-visible{outline:3px solid var(--red);outline-offset:3px;border-radius:6px}
.prenote{margin:0 0 8px;font-weight:600;font-size:.88rem;color:var(--muted)}
.gtips{border:2px solid var(--hair);border-radius:10px;padding:6px 12px 8px;margin:0;display:flex;flex-wrap:wrap;gap:4px 18px}
.gtips legend{font-weight:800;font-size:.85rem;padding:0 4px}
.gtips .chk{margin:0}
.gact[hidden]{display:none}
@media (max-width:560px){.gact{grid-template-columns:1fr}}
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
.gsb:not(:last-child){border-radius:0;border-bottom:2px solid var(--ink)}
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
  body.gside-on .condwrap{padding-bottom:270px}
  .gsb:last-child{grid-template-columns:auto 1fr}
  .gsb:last-child .ghelp{grid-column:auto}
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
/* item list: Item, Slot, Type, Rarity, Magic, Value, Weight */
.itab th:nth-child(2),.itab td:nth-child(2){width:130px;text-align:center}
.itab th:nth-child(3),.itab td:nth-child(3){width:64px;text-align:center}
.itab th:nth-child(4),.itab td:nth-child(4){width:100px;text-align:center}
.itab th:nth-child(5),.itab td:nth-child(5){width:70px;text-align:center}
.itab th:nth-child(6),.itab td:nth-child(6){width:90px;text-align:right}
.itab th:nth-child(7),.itab td:nth-child(7){width:80px;text-align:right}
.itab .islot{font-size:.85rem}
.wtier{display:inline-grid;place-items:center;width:24px;height:24px;border-radius:50%;border:2px solid var(--ink);font:800 .72rem var(--font);color:var(--ink);background:var(--paper);vertical-align:middle}
.wtier.wt-M{background:var(--ink);color:var(--paper)}
.wtier.wt-E{background:#b8860b;border-color:#b8860b;color:#fff}
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
.wacts{display:grid;gap:10px;margin-top:6px}
.wact p{margin:0}
.wact .wah{font-weight:700}
.wact .wam{font-weight:700;color:var(--muted);margin-left:6px}
.wact .wah+p,.wact .wah+*{margin-top:3px}
.walist{display:grid;gap:10px;margin-bottom:8px}
.warow{display:grid;gap:6px;border:2px solid var(--hair);border-radius:12px;padding:10px}
.wagrid{display:grid;grid-template-columns:2fr 80px 1.2fr 1.2fr;gap:6px}
.warow .wan{color:var(--red);font-weight:800}
.wahead{font-size:.7rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin-bottom:-2px}
.warow .xdel{justify-self:start}
@media (max-width:600px){.wagrid{grid-template-columns:1fr 1fr}.wahead{display:none}}
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
  /* Slot and Magic fold to nothing on phones (not display:none, which would break the full-width group rows) */
  .itab th:nth-child(2),.itab td:nth-child(2),.itab th:nth-child(5),.itab td:nth-child(5){width:0;padding:0!important;font-size:0;overflow:hidden;border-left:0;border-right:0}
  .itab td:nth-child(5) .magicbox{display:none}
  .itab th:nth-child(3),.itab td:nth-child(3){width:36px}
  .itab th:nth-child(4),.itab td:nth-child(4){width:60px}
  .itab th:nth-child(6),.itab td:nth-child(6){width:50px}
  .itab th:nth-child(7),.itab td:nth-child(7){width:44px}
  .wtier{width:20px;height:20px;font-size:.62rem}
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
.subr{scroll-margin-top:calc(var(--navh,0px) + 80px);border:2px solid var(--ink);border-radius:12px;padding:10px 14px;display:grid;gap:6px;background:var(--page)}
.subh{display:flex;align-items:center;justify-content:space-between;gap:10px}
.subh b{font-size:1.02rem;font-weight:800}
.subr .gedit,.rbtn{color:var(--ink);border-color:var(--ink);padding:2px 10px;font-size:.72rem}
.subr .gedit:hover{background:var(--ink);color:var(--paper)}
.rfeats{display:grid;gap:6px}
.fopts{display:grid;gap:6px;margin:4px 0 6px}
.fopts .fchoose{margin:0;font-weight:800;font-size:.86rem}
.fopt{border-left:3px solid var(--gold,#b7791f);background:var(--page,#f4f4f4);border-radius:0 8px 8px 0;padding:5px 10px}
.fopt b{color:var(--gold,#b7791f);font-size:.92rem}
.fopt p{margin:2px 0 0;font-weight:600;font-size:.88rem}
.foptbox{grid-column:1/-1;border:2px dashed var(--hair,#ccc);border-radius:10px;padding:6px 10px}
.foptbox summary{cursor:pointer;font-weight:800;font-size:.86rem}
.foptbox summary small{font-weight:600;color:var(--muted,#666);margin-left:6px}
.foptctl{display:flex;flex-wrap:wrap;gap:12px;margin:8px 0}
.foptctl label{display:flex;align-items:center;gap:6px;font-weight:700;font-size:.85rem}
.foptctl input{font:600 .95rem var(--font);color:var(--ink);background:var(--paper);border:2px solid var(--ink);border-radius:8px;padding:6px 8px;width:110px}
.foptctl .fpick{width:64px}
.folist{display:grid;gap:6px;margin-bottom:6px}
.forow{display:grid;grid-template-columns:minmax(120px,200px) 1fr auto;gap:8px;align-items:start}
.forow input,.forow textarea{font:600 .95rem var(--font);color:var(--ink);background:var(--paper);border:2px solid var(--ink);border-radius:8px;padding:8px 10px;width:100%;min-width:0}
.forow .fon{color:var(--gold,#b7791f);font-weight:800}
.forow textarea{resize:vertical;field-sizing:content;min-height:2.6em;line-height:1.4}
@media (max-width:700px){.forow{grid-template-columns:1fr}.forow .xdel{justify-self:start}}
.rfeats p{margin:0;font-weight:600}
.fopts{display:grid;gap:6px;margin:4px 0 6px}
.fopts .fchoose{margin:0;font-weight:800;font-size:.86rem}
.fopt{border-left:3px solid var(--gold,#b7791f);border-radius:0 8px 8px 0;padding:4px 10px;background:color-mix(in srgb,var(--gold,#b7791f) 8%,transparent)}
.fopt b{color:var(--gold,#b7791f);font-size:.9rem}
.fopt p{margin:2px 0 0;font-weight:600;font-size:.86rem}
.ccpickn{font-size:.72rem;font-weight:700;color:var(--muted,#666);letter-spacing:.04em;text-transform:none;margin-left:6px}
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


CREATOR_CSS = """
:root{--gold:#b7791f}
:root[data-mode="dark"]{--gold:#e8b350}
.ccwrap{position:relative;max-width:1240px;margin:0 auto;padding:24px 16px 120px}
.ccintro .logo{width:min(300px,70%)}
.ccintro h1{margin:0 0 4px}
.ccintro p{margin-top:0;max-width:640px}
body.cc-sheet .ccintro{display:none}
.cctop{display:flex;justify-content:flex-end;min-height:0}
.ccnote{margin:8px 0;padding:8px 12px;border-left:4px solid var(--ink);background:var(--soft);border-radius:0 8px 8px 0;font-size:.88rem;font-weight:600}
.ccnote .btn{margin-left:6px;padding:2px 10px;font-size:.8rem}
.cempty{color:var(--muted);font-weight:600}
/* my characters */
.cchero{display:flex;flex-wrap:wrap;gap:12px;align-items:center;margin:10px 0 18px}
.ccnew{display:flex;align-items:center;gap:12px;font:800 1.1rem var(--font);background:var(--ink);color:var(--paper);border:3px solid var(--ink);border-radius:14px;padding:16px 26px;cursor:pointer}
.ccnew span{font-size:1.7rem;line-height:1}
.ccnew:hover{background:var(--barhover);border-color:var(--barhover)}
.cchero label.btn{cursor:pointer;font-weight:700}
.cch2{font-size:1.15rem;margin:8px 0 10px;display:flex;align-items:baseline;gap:10px;border-bottom:2px solid var(--ink);padding-bottom:6px}
.cch2 small{font-size:.78rem;color:var(--muted)}
.ccchars{display:grid;gap:10px}
.ccchar{display:grid;grid-template-columns:56px 1fr auto;gap:14px;align-items:center;border:2px solid var(--ink);border-radius:14px;padding:10px 14px;background:var(--paper)}
.ccchar img,.ccnopic{width:56px;height:56px;border-radius:50%;border:2px solid var(--ink);object-fit:cover;display:grid;place-items:center;font-weight:800;font-size:1.4rem;background:var(--soft)}
.ccchar b{display:block;font-size:1.05rem}
.ccchar small{color:var(--muted);font-weight:700}
.ccbtns{display:flex;flex-wrap:wrap;gap:6px;justify-content:flex-end}
.ccbtns .btn{padding:4px 12px;font-size:.82rem;font-weight:700}
@media (max-width:640px){.ccchar{grid-template-columns:48px 1fr}.ccchar img,.ccnopic{width:48px;height:48px}.ccchar .ccbtns{grid-column:1/-1;justify-content:flex-start}}
/* the creation screen */
.ccgame{display:grid;grid-template-columns:210px minmax(0,1fr) 330px;grid-template-areas:"title title title" "steps main info" "foot foot foot";border:3px solid var(--ink);border-radius:18px;overflow:hidden;background:var(--ink);scroll-margin-top:calc(var(--navh,0px) + 10px)}
.cctitle{grid-area:title;display:flex;align-items:center;gap:10px;padding:8px 10px;color:var(--paper)}
.cctitle b{flex:1;text-align:center;font-size:1.05rem;letter-spacing:.06em;text-transform:uppercase;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ccbar{font:700 .8rem var(--font);color:var(--paper);background:transparent;border:2px solid var(--paper);border-radius:999px;padding:6px 14px;cursor:pointer;white-space:nowrap}
.ccbar:hover:not([disabled]){background:var(--barhover)}
.ccbar.solid{background:var(--paper);color:var(--ink);padding-inline:26px}
.ccbar.solid.go{background:var(--red);border-color:var(--red);color:#fff}
.ccbar[disabled]{opacity:.4;cursor:default}
.ccbar:focus-visible,.ccstep:focus-visible{outline:3px solid var(--paper);outline-offset:2px}
.ccsteps{grid-area:steps;display:flex;flex-direction:column;gap:4px;padding:6px 10px 12px}
.ccstep{display:flex;align-items:center;gap:10px;font:700 .86rem var(--font);color:var(--paper);background:transparent;border:2px solid transparent;border-radius:10px;padding:8px 10px;text-align:left;cursor:pointer}
.ccstep:hover{border-color:var(--barhover)}
.ccstep.on{border-color:var(--paper);background:var(--barhover)}
.ccn{flex:none;width:24px;height:24px;border-radius:50%;border:2px solid var(--paper);display:grid;place-items:center;font-size:.72rem}
.ccstep.ok .ccn{background:var(--paper);color:var(--ink)}
.ccmain{grid-area:main;background:var(--paper);border-radius:14px 0 0 14px;padding:16px 20px 22px;min-height:460px;min-width:0}
.cch{display:flex;align-items:baseline;justify-content:space-between;gap:10px;border-bottom:2px solid var(--ink);padding-bottom:8px;margin-bottom:14px}
.cch h2{margin:0;font-size:1.3rem;font-weight:800}
.ccof{font-size:.78rem;color:var(--muted);font-weight:700;white-space:nowrap}
.cch3{margin:16px 0 8px;font-size:.74rem;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}
.ccinfo{grid-area:info;background:var(--page);border-left:3px solid var(--ink);display:flex;flex-direction:column;min-width:0}
.cih{display:flex;align-items:center;justify-content:space-between;gap:8px;background:var(--ink);color:var(--paper);padding:10px 14px;font-weight:800;font-size:1.02rem}
.cii{position:sticky;top:calc(var(--navh,0px) + 8px);max-height:calc(100vh - var(--navh,0px) - 16px);display:flex;flex-direction:column}
.cib{padding:12px 14px 16px;display:grid;gap:10px;font-size:.9rem;align-content:start;overflow-y:auto;min-height:0;scrollbar-width:thin}
.spchips{display:flex;flex-wrap:wrap;gap:5px}
.spchips span{font-size:.66rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase;border:1.5px solid var(--ink);border-radius:999px;padding:2px 8px}
.spchips span.on{background:var(--gold);border-color:var(--gold);color:#fff}
.sptiers{display:grid;gap:5px;border-top:2px solid var(--ink);padding-top:8px}
.sptiers h4{margin:0;font-size:.7rem;letter-spacing:.12em;text-transform:uppercase;color:var(--muted)}
.sptiers p{margin:0;opacity:.6}
.sptiers p.got{opacity:1}
.sptiers p b{display:inline-block;min-width:2.2em}
.cib p{margin:0}
.cib .gfacts{grid-template-columns:1fr;gap:0;font-size:.86rem}
.cib .gfacts dt{margin-top:6px}
.cib .glink{justify-self:start}
.ccfoot{grid-area:foot;display:flex;align-items:center;gap:8px;padding:10px 12px}
.ccfoot .sp{flex:1}
.ccopts{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:8px}
.ccopts.sub{grid-template-columns:repeat(auto-fill,minmax(150px,1fr))}
.ccopt{display:grid;gap:2px;text-align:left;font:800 1rem var(--font);color:var(--ink);background:var(--page);border:2px solid var(--ink);border-radius:12px;padding:12px 14px;cursor:pointer}
.ccopt small{font-size:.74rem;font-weight:700;color:var(--muted)}
.ccopt:hover{background:var(--soft)}
.ccopt.on{background:var(--ink);color:var(--paper)}
.ccopt.on small{color:var(--paper);opacity:.75}
.ccopt:focus-visible{outline:3px solid var(--red);outline-offset:2px}
.ccform{display:grid;gap:12px;margin-top:14px}
.ccform label{display:grid;gap:5px;font-size:.85rem;font-weight:800}
.ccform input,.ccform textarea,.cctool input,.cctool select,.cclangs input,.ccgear input,.ccgear select,.ccadd input,.ccasi select,.ccdice input{font:600 .95rem var(--font);color:var(--ink);background:var(--paper);border:2px solid var(--ink);border-radius:8px;padding:8px 10px;width:100%;min-width:0}
.ccform textarea{resize:vertical;field-sizing:content;min-height:3.2em;line-height:1.4}
.ccform .ccbig{font-size:1.3rem;font-weight:800;padding:12px 14px}
/* abilities */
.ccmeth{display:inline-flex;border:2px solid var(--ink);border-radius:999px;overflow:hidden;margin-bottom:12px}
.ccmeth button{font:700 .82rem var(--font);border:0;background:var(--paper);color:var(--ink);padding:7px 14px;cursor:pointer}
.ccmeth button[aria-pressed="true"]{background:var(--ink);color:var(--paper)}
.ccab{width:100%;border-collapse:separate;border-spacing:0 6px}
.ccab th{font-size:.7rem;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);text-align:center;padding:0 6px}
.ccab th:first-child{text-align:left}
.ccab tbody th{font-size:.95rem;letter-spacing:.02em;color:var(--paper);background:var(--ink);text-align:left;padding:8px 12px;border-radius:10px 0 0 10px;text-transform:uppercase}
.ccab td{background:var(--page);text-align:center;padding:4px 6px;border-block:2px solid var(--ink)}
.ccab td:last-child{border-right:2px solid var(--ink);border-radius:0 10px 10px 0}
.ccdice{white-space:nowrap}
.ccdice input{width:80px;text-align:center}
.die{display:inline-grid;place-items:center;width:28px;height:28px;margin:0 2px;border:2px solid var(--ink);border-radius:7px;background:var(--paper);font-weight:800;font-size:.9rem}
.die.drop{opacity:.4;text-decoration:line-through;text-decoration-thickness:2px}
.die.spin{animation:ccspin .36s linear}
@keyframes ccspin{50%{transform:rotate(90deg) scale(.9)}100%{transform:rotate(180deg)}}
.ccscore{font:800 1.15rem var(--font);width:46px;height:38px;border:2px solid var(--ink);border-radius:9px;background:var(--paper);color:var(--ink);cursor:pointer}
.ccscore:hover{background:var(--soft)}
.ccscore.sel{background:var(--red);border-color:var(--red);color:#fff}
.cctot{font-size:1.25rem;font-weight:800}
.ccrac,.ccmod{font-weight:800}
.ccroll{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:10px}
.cctotal{flex:1 1 180px;font-weight:700}
.cctotal b{font-size:1.3rem}
.cctotal small{color:var(--muted)}
.ccasi{display:grid;gap:8px;margin-top:14px;border:2px solid var(--ink);border-radius:12px;padding:10px 14px}
.ccasi label{display:grid;grid-template-columns:1fr minmax(150px,220px);gap:10px;align-items:center;font-weight:700;font-size:.9rem}
.ccab .short{display:none}
@media (max-width:640px){
  .ccab .full{display:none}.ccab .short{display:inline}
  .ccab th:nth-child(4),.ccab td:nth-child(4){display:none}
  .ccab tbody th{padding:8px 8px;font-size:.85rem}
  .ccab td{padding:4px 3px}
  .die{width:21px;height:24px;margin:0 1px;font-size:.78rem;border-radius:5px}
  .ccscore{width:40px}
  .ccdice input{width:64px}
  .ccasi label{grid-template-columns:1fr}
}
/* skills and proficiencies */
.cccounter{margin:0 0 8px;padding:7px 12px;border:2px solid var(--ink);border-radius:10px;font-size:.88rem;font-weight:700}
.cccounter.done{background:var(--soft)}
.cccounter.over{border-color:var(--red)}
.cceither{border:2px solid var(--red);border-radius:12px;padding:8px 14px 10px;margin:0 0 10px;display:flex;flex-wrap:wrap;gap:6px 18px}
.cceither legend{font-weight:800;font-size:.85rem;padding:0 6px}
.cceither legend small{font-weight:700;color:var(--muted);margin-left:6px}
.cceither input[type=checkbox]{accent-color:var(--gold);width:16px;height:16px}
.cceither label{display:flex;gap:6px;align-items:center;font-weight:700;cursor:pointer}
.ccskills{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:12px;align-items:start}
.ccsk{border:2px solid var(--ink);border-radius:12px;overflow:hidden}
.ccsk h3{margin:0;display:flex;justify-content:space-between;background:var(--ink);color:var(--paper);font-size:.86rem;letter-spacing:.06em;text-transform:uppercase;padding:7px 12px}
.ccsk h3 span{letter-spacing:0}
.ccchk{display:grid;grid-template-columns:auto minmax(0,1fr) auto auto;gap:2px 8px;align-items:center;padding:6px 12px;border-top:1px solid var(--hair);font-weight:700;font-size:.92rem}
.ccchk:first-of-type{border-top:0}
.ccchk input{grid-row:1;grid-column:1;width:18px;height:18px;accent-color:var(--gold);cursor:pointer}
.ccchk label{grid-row:1;grid-column:2;cursor:pointer}
.ccchk small{grid-row:2;grid-column:2;font-size:.72rem;color:var(--muted)}
.ccchk .ccstepper{grid-row:1;grid-column:3}
.ccchk .ccb{grid-row:1;grid-column:4;min-width:2.2em;text-align:right}
.ccchk.given input{cursor:default}
.ccchk.given input:checked{appearance:none;width:18px;height:18px;border-radius:4px;background:var(--gold) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath d='M3 8.5l3 3 7-7' fill='none' stroke='white' stroke-width='2.4'/%3E%3C/svg%3E") center/14px no-repeat}
.ccstepper{display:inline-flex;align-items:center;gap:4px;font-size:.8rem;font-weight:800}
.ccstepper button{width:24px;height:24px;border-radius:50%;border:2px solid var(--ink);background:var(--paper);color:var(--ink);font:800 .9rem/1 var(--font);cursor:pointer;padding:0}
.ccstepper button[disabled]{opacity:.3;cursor:default}
.ccstepper span{min-width:2.1em;text-align:center}
.ccload{border:2px solid var(--ink);border-radius:12px;padding:8px 12px 12px;margin:0 0 10px;display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px}
.ccload legend{font-weight:800;font-size:.85rem;padding:0 6px}
.ccload label{display:flex;gap:8px;align-items:flex-start;border:2px solid var(--hair);border-radius:10px;padding:8px 10px;cursor:pointer}
.ccload label.on{border-color:var(--ink);background:var(--soft)}
.ccload input{margin-top:3px;accent-color:var(--red)}
.ccload b{display:block}
.ccload small{display:block;font-size:.76rem;color:var(--muted);font-weight:600}
.cclinks{margin:0}
.ccsl{display:grid;gap:1px}
.ccsl small{font-size:.66rem;font-weight:600;opacity:.75;line-height:1.2}
.cch h2 small{display:block;font-size:.8rem;font-weight:700;color:var(--muted);margin-top:2px}
.ccprof{border:2px solid var(--ink);border-radius:12px;padding:4px 12px 6px;margin-top:12px}
.ccprof .ccprow{display:grid;grid-template-columns:minmax(0,1fr) 24px auto 186px;gap:12px;align-items:center}
.ccprof .cchead{border-top:0;align-items:end;padding:6px 0 4px}
.ccprof .cchead h3{margin:0;font-size:.74rem;letter-spacing:.12em;text-transform:uppercase;color:var(--ink)}
.ccprof .cchead>span:not(.ccscale){font-size:.66rem;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);width:98px;text-align:center}
.cclh{margin:16px 0 6px;font-size:.74rem;letter-spacing:.12em;text-transform:uppercase}
.ccpips,.ccscale{display:grid;grid-template-columns:repeat(10,14px) 1fr;gap:3px;align-items:center}
.ccscale span{font-size:.56rem;font-weight:800;text-align:center;white-space:nowrap;letter-spacing:-.04em;color:var(--muted)}
.ccpip{width:14px;height:14px;border-radius:50%;border:2px solid var(--ink);background:var(--paper);padding:0;cursor:pointer}
.ccpip.on{background:var(--ink)}
.ccpip:hover:not([disabled]){background:var(--gold);border-color:var(--gold)}
.ccpip[disabled]{cursor:default}
.ccpips b{font-size:.8rem;text-align:right}
.ccpip.cap{border-color:var(--hair);background:var(--soft)}
.ccpip.base{cursor:default}
.cclist .ccsph{font-size:.62rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);padding-block:6px;background:var(--page)}
.cclist .ccsph>span{justify-self:start}
.cclist .ccsph .ccscale{justify-self:end}
.cbadge{width:24px;height:24px;padding:0;border:0;background:none;cursor:pointer;display:grid;place-items:center}
.cbadge svg{width:22px;height:22px;fill:var(--paper);stroke:var(--ink);stroke-width:1.4}
.cbadge.on svg{fill:var(--gold);stroke:var(--gold)}
.cbadge.given{cursor:default}
.cbadge:focus-visible{outline:3px solid var(--red);outline-offset:1px;border-radius:50%}
.ccbh{width:24px!important}
.ccpop{position:fixed;inset:0;z-index:60;background:rgba(0,0,0,.45);display:grid;place-items:center;padding:16px}
.ccpopin{width:min(420px,100%);background:var(--ink);border:2px solid var(--ink);border-radius:16px;overflow:hidden;box-shadow:0 16px 40px rgba(0,0,0,.35)}
.ccpoph{color:var(--paper);font-weight:800;padding:10px 16px}
.ccpopb{background:var(--paper);border-radius:14px 14px 0 0;padding:14px 16px 16px;display:grid;gap:12px}
.ccpopb p{margin:0;font-weight:600}
.ccpopbtns{display:flex;justify-content:flex-end;gap:8px}
.ccpips.off{opacity:.35}
.ccstepper.off{opacity:.35}
.ccrow.pinned{outline:3px solid var(--gold);outline-offset:-3px;background:var(--soft)}
.ccpick{cursor:pointer;border-radius:4px}
.ccpick:hover{text-decoration:underline;text-underline-offset:3px}
.ccpick:focus-visible{outline:3px solid var(--red);outline-offset:2px}
.cchw{display:grid;grid-template-columns:1fr 1fr;gap:12px}
@media (max-width:640px){.ccprof .ccprow{grid-template-columns:minmax(0,1fr) 24px auto;row-gap:4px}.cclist .ccsph{display:none}.ccsp .sprank{grid-column:2/-1}.ccprof .ccprow>.ccpips,.ccprof .cchead>.ccscale{grid-column:1/-1}.ccprof .cchead>span:not(.ccscale){display:none}}
.ccschools{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:10px;margin-top:16px;align-items:stretch}
.ccschools>label[data-ik="major"]{grid-column:1}
.ccschools>label.solo{grid-column:1/-1}
.ccschools>.ccnote{grid-column:1/-1}
.ccopp{border:3px solid var(--red);border-radius:12px;padding:10px 14px;display:grid;gap:3px;align-content:center;background:color-mix(in srgb,var(--red) 7%,var(--paper))}
.ccoppt{font-size:.66rem;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:var(--red)}
.ccopp>b{font-size:1.25rem;color:var(--red)}
.ccopp p{margin:0;font-size:.82rem;font-weight:600}
.ccschools>label[data-ik="minor"]{grid-column:1/-1}
@media (max-width:640px){.ccschools{grid-template-columns:1fr}.ccschools>*{grid-column:1/-1!important}}
.ccschools label{display:grid;gap:5px;font-weight:800;font-size:.85rem;border:2px solid var(--ink);border-radius:12px;padding:10px 12px}
.ccschools select{font:600 .95rem var(--font);color:var(--ink);background:var(--paper);border:2px solid var(--ink);border-radius:8px;padding:8px 10px;width:100%}
.ccschools small{font-weight:600;color:var(--muted);font-size:.78rem}
.ccschools .ccnote{margin:0;align-self:center}
.cclist .ccsp{grid-template-columns:auto minmax(0,1fr) 44px 60px 186px}
.ccsp>.ccrm,.ccsp>.ccstepper{justify-self:end}
.ccsp .ccrn{cursor:pointer}
.sctag{font-size:.6rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase;border-radius:999px;padding:1px 7px;margin-left:4px;vertical-align:1px}
.sctag.mj{background:var(--gold);color:#fff}
.sctag.op{border:1.5px solid var(--red);color:var(--red)}
.ccmoney{display:flex;flex-wrap:wrap;align-items:center;gap:6px 14px;border:2px solid var(--ink);border-radius:12px;padding:10px 14px;margin-bottom:10px;font-weight:700}
.ccml{font-size:.72rem;letter-spacing:.12em;text-transform:uppercase;color:var(--muted)}
.ccmr{display:flex;flex-wrap:wrap;align-items:center;gap:4px}
.ccmt{margin-left:auto}
.ccmt b{font-size:1.1rem}
.ccmoney small{flex-basis:100%;color:var(--muted);font-weight:600}
@media (max-width:640px){.cclist .ccsp{grid-template-columns:auto minmax(0,1fr) auto}.cclist .ccsp>.ccrm{display:none}}
.ccgrid2{display:grid;grid-template-columns:1fr 1fr;gap:14px}
@media (max-width:760px){.ccgrid2{grid-template-columns:1fr}}
.ccsec h3{margin:8px 0 6px;font-size:.74rem;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}
.ccprow{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:5px 0;border-top:1px solid var(--hair);font-weight:700;font-size:.92rem}
.ccprow small{display:block;font-size:.72rem;color:var(--muted)}
.cctiers{display:flex;gap:4px;flex:none}
.ctier{width:30px;height:30px;border-radius:50%;border:2px solid var(--ink);background:var(--paper);color:var(--ink);font:800 .8rem var(--font);cursor:pointer}
.ctier.on{background:var(--ink);color:var(--paper)}
.ctier[disabled]{cursor:default;background:var(--gold);border-color:var(--gold);color:#fff}
.cclangs{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:8px;align-items:center}
.cclangs .btn{justify-self:start}
/* spells and equipment */
.cctool{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:10px}
.cctool input{flex:1 1 200px;width:auto}
.cctool select{flex:0 1 200px;width:auto}
.cccount{font-weight:800;font-size:.9rem;white-space:nowrap}
.cclist{display:grid;border:2px solid var(--ink);border-radius:12px;overflow:hidden;max-height:460px;overflow-y:auto}
.ccrow{display:grid;grid-template-columns:auto minmax(0,1fr) auto auto;gap:10px;align-items:center;padding:8px 12px;border-top:1px solid var(--hair);font-weight:700;font-size:.92rem}
.ccrow:first-child{border-top:0}
label.ccrow{cursor:pointer}
.ccrow.on{background:var(--soft)}
.ccrow input[type=checkbox]{width:18px;height:18px;accent-color:var(--red)}
.ccrn{min-width:0;overflow:hidden;text-overflow:ellipsis}
.ccrn small{display:block;font-size:.72rem;color:var(--muted)}
.ccrm{font-size:.8rem;color:var(--muted);white-space:nowrap}
.cclist.shop .ccrow{grid-template-columns:minmax(0,1fr) auto auto auto}
.ccbtns .btn[disabled]{opacity:.4}
.ccpurse{display:flex;flex-wrap:wrap;gap:4px 14px;align-items:baseline;background:var(--ink);color:var(--paper);border-radius:12px;padding:10px 14px;margin-bottom:10px}
.ccpurse b{font-size:1.15rem}
.ccpurse small{opacity:.8}
.ccwarn{color:#ff8a8a;font-weight:800}
.ccgear{display:grid;border:2px solid var(--ink);border-radius:12px;overflow:hidden}
.ccgear .ccrow{grid-template-columns:minmax(0,1fr) 70px minmax(120px,170px) 104px}
.ccgear .ccrow .btn{width:100%;padding-inline:6px}
.ccgear input,.ccgear select{padding:5px 8px;font-size:.88rem}
.ccadd{display:flex;gap:8px;padding:8px 12px;border-top:2px solid var(--ink)}
@media (max-width:640px){.ccgear .ccrow{grid-template-columns:1fr 70px}.ccgear .ccrow select{grid-column:1}.cclist.shop .ccrow{grid-template-columns:1fr auto}.cclist.shop .ccrm{display:none}}
/* appearance and summary */
.cclook{display:grid;grid-template-columns:200px 1fr;gap:18px;align-items:start}
.ccportrait{display:grid;gap:8px;justify-items:center}
.ccportrait img,.ccportrait>span{width:180px;height:180px;border-radius:16px;border:3px solid var(--ink);object-fit:cover;display:grid;place-items:center;background:var(--soft);color:var(--muted);font-weight:700}
.ccportrait .btn{cursor:pointer;font-weight:700}
.cclook .ccform{margin-top:0}
@media (max-width:640px){.cclook{grid-template-columns:1fr}}
.ccsum{display:grid;grid-template-columns:auto 1fr;gap:16px;margin-top:16px;border:2px solid var(--ink);border-radius:14px;padding:14px}
.ccsum img{width:110px;height:110px;border-radius:12px;border:2px solid var(--ink);object-fit:cover}
.ccsum .gfacts{grid-column:-2}
@media (max-width:1060px){.ccgame{grid-template-columns:200px minmax(0,1fr);grid-template-areas:"title title" "steps main" "info info" "foot foot"}.ccmain{border-radius:14px 0 0 0}.ccinfo{border-left:0;border-top:3px solid var(--ink)}.cib{max-height:none}.cii{position:static;max-height:none}}
@media (max-width:760px){
  .ccgame{grid-template-columns:minmax(0,1fr);grid-template-areas:"title" "steps" "main" "info" "foot";border-radius:14px}
  .ccsteps{flex-direction:row;overflow-x:auto;padding:4px 8px 10px;scrollbar-width:thin}
  .ccstep{flex:none;padding:6px 8px;font-size:.78rem}
  .ccmain{border-radius:12px 12px 0 0;padding:14px 12px 18px;min-height:0}
  .cctitle .ccbar{padding:5px 10px;font-size:.74rem}
  .ccform input,.ccform textarea,.cctool input,.cctool select,.cclangs input,.ccgear input,.ccgear select,.ccadd input,.ccasi select,.ccdice input{font-size:16px}
}
/* admin */
.ccadmintop{display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between;margin:6px 0}
.cctabs{display:inline-flex;border:2px solid var(--ink);border-radius:999px;overflow:hidden}
.cctabs button{font:700 .86rem var(--font);border:0;background:var(--paper);color:var(--ink);padding:8px 18px;cursor:pointer}
.cctabs button[aria-pressed="true"]{background:var(--ink);color:var(--paper)}
#ccAdminList{display:grid;gap:14px;margin-top:12px}
#ccAdminList>.btn{justify-self:start}
.rules{border:2px solid var(--ink);border-radius:14px;padding:14px 16px;background:var(--paper)}
/* the character sheet */
.sheettools{position:sticky;top:var(--navh,0px);z-index:6;display:flex;flex-wrap:wrap;gap:8px;align-items:center;background:var(--page);padding:10px 0}
.sheettools b{font-size:1.1rem}
.sheettools .sp{flex:1}
.sheettools .btn{font-weight:700;font-size:.85rem}
#sheetPages{display:grid;grid-template-columns:minmax(0,1fr);gap:22px;justify-items:center}
.spage{width:100%;max-width:900px;background:var(--paper);color:var(--ink);border:2px solid var(--ink);border-radius:10px;padding:22px;font-size:12px;line-height:1.3}
.spage *{-webkit-print-color-adjust:exact;print-color-adjust:exact}
.sf{font:600 12px var(--font);color:var(--ink);background:transparent;border:0;width:100%;min-width:0;padding:4px 5px;border-radius:0}
.sf:focus{outline:2px solid var(--red);outline-offset:-2px;background:var(--soft)}
.sf::placeholder{color:var(--placeholder)}
.sck{width:15px;height:15px;margin:0;accent-color:var(--red)}
.shead{display:grid;grid-template-columns:36% 1fr;gap:16px;align-items:center;margin-bottom:12px}
.slogo{display:flex;align-items:center;gap:10px}
.slogo .logo{flex:1 1 auto;min-width:0;width:100%;margin:0;color:var(--ink)}
.sportrait{flex:none;width:72px;height:72px;border-radius:50%;border:3px solid var(--ink);object-fit:cover;background:var(--paper)}
.sid{border:2px solid var(--ink);border-radius:10px;overflow:hidden;display:grid}
.sid label{display:grid;grid-template-columns:44% 1fr;align-items:stretch}
.sid label+label .sf{border-top:1px solid var(--hair)}
.sid span{background:var(--ink);color:var(--paper);font-size:11px;font-weight:700;text-transform:uppercase;padding:5px 8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sbar{background:var(--ink);color:var(--paper);border-radius:12px;padding:7px 10px;font-size:9.5px;font-weight:800;text-transform:uppercase;text-align:center;letter-spacing:.02em}
.satk{overflow-x:auto}
.satk>div{min-width:660px}
.sgrid9{display:grid;grid-template-columns:2.3fr .8fr .9fr .7fr .8fr .8fr 1fr .9fr .8fr;align-items:center}
.satr{border-bottom:1px solid var(--hair);margin-inline:6px}
.satr .sf+.sf{border-left:1px solid var(--hair);text-align:center}
.sinit{display:flex;flex-wrap:wrap;gap:6px 24px;margin:12px 0;border-radius:999px;text-align:left;padding:5px 14px}
.sinit span{display:inline-flex;align-items:center;gap:6px}
.sinit svg,.sstar svg{width:15px;height:15px}
.sinit svg{fill:var(--paper)}
.sinit .sf{width:52px;background:var(--paper);border-radius:6px;text-align:center;font-weight:800}
.scols{display:grid;grid-template-columns:54% minmax(0,1fr);gap:16px;align-items:start}
.ssub{display:grid;grid-template-columns:84px minmax(0,1fr);font-size:8.5px;font-weight:800;text-transform:uppercase;text-align:center;margin-bottom:3px;align-items:end}
.srowh{display:grid;grid-template-columns:minmax(0,1fr) 18px 152px 40px;gap:5px;padding:0 3px 0 7px;align-items:end;font-size:8.5px;font-weight:800;text-transform:uppercase;text-align:center}
.srowh>span:first-child{text-align:left}
.sscalew{display:grid;gap:1px}
.sscalew small{font-size:8px;font-weight:800}
.sscale{display:flex;justify-content:space-between;padding:0 6px}
.sscale span{width:11px;display:flex;justify-content:center;white-space:nowrap;font-size:7.5px;font-weight:800;letter-spacing:-.03em;text-transform:none}
.sab{display:grid;grid-template-columns:84px 1fr;margin-bottom:8px}
.sabox{border:3px solid var(--ink);border-radius:6px 0 0 6px;display:grid;align-content:start;text-align:center;min-height:86px}
.sabn{background:var(--ink);color:var(--paper);font-size:9px;font-weight:800;text-transform:uppercase;padding:3px 1px}
.sabs{font-size:26px;font-weight:800;padding-top:6px}
.sabm{font-size:13px;font-weight:800;border-top:2px solid var(--ink);margin:2px 14px 6px;padding-top:2px}
.sabrows{display:grid;align-content:start;gap:2px}
.srow{display:grid;grid-template-columns:minmax(0,1fr) 18px 152px 40px;align-items:center;gap:5px;background:var(--ink);color:var(--paper);border-radius:3px 999px 999px 3px;padding:2px 3px 2px 7px;min-height:24px}
.srl{font-size:10px;font-weight:700;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.spips{display:flex;align-items:center;justify-content:space-between;width:152px;background:var(--paper);border-radius:999px;padding:2px 6px}
.spip{width:11px;height:11px;border-radius:50%;border:1.5px solid var(--ink);background:var(--paper);padding:0;cursor:pointer}
.spip.on{background:var(--ink)}
.sstar{width:18px;height:18px;padding:0;border:0;background:none;cursor:pointer;display:grid;place-items:center}
.sstar svg{width:18px;height:18px;fill:var(--paper);stroke:var(--paper);stroke-width:1}
.sstar.on svg{fill:var(--gold);stroke:var(--gold)}
.spip:focus-visible,.sstar:focus-visible{outline:2px solid var(--red);outline-offset:1px}
.stot{background:var(--paper);color:var(--ink);border-radius:999px;text-align:center;font-weight:800;font-size:12px;padding:2px 0;min-width:0}
.stot .sf{text-align:center;padding:0;font-weight:800}
.stiers{display:flex;gap:2px}
.stier{width:16px;height:16px;border-radius:50%;border:1.5px solid var(--paper);font-size:8.5px;display:grid;place-items:center;font-weight:800}
.stier.on{background:var(--paper);color:var(--ink)}
.stiers{width:54px;justify-content:center}
.sleft .srow:has(.stiers),.sprofh{grid-template-columns:minmax(0,1fr) 54px 18px 152px 40px}
.sgroup{font-weight:800;font-size:12px;border:1px solid var(--ink);padding:2px 6px;margin:6px 0 3px;display:flex;justify-content:space-between;align-items:baseline}
.sgroup small{font-size:8.5px;text-transform:uppercase}
.sbox{border:2px solid var(--ink);border-radius:12px;padding:18px 8px 8px;position:relative;margin-top:18px}
.stab{position:absolute;top:-12px;left:50%;transform:translateX(-50%);background:var(--ink);color:var(--paper);font-size:10px;font-weight:800;text-transform:uppercase;padding:5px 22px;clip-path:polygon(9% 0,91% 0,100% 50%,91% 100%,9% 100%,0 50%);white-space:nowrap}
.spool{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px}
.scell{display:grid;border:2px solid var(--ink);border-radius:8px;overflow:hidden;align-content:start}
.scell>span{background:var(--ink);color:var(--paper);font-size:9px;font-weight:800;text-transform:uppercase;text-align:center;padding:4px 2px;line-height:1.15}
.scell>.sf{text-align:center;font-size:16px;font-weight:800;padding:10px 2px}
.scell small{font-size:9px;font-weight:700;display:flex;align-items:center;gap:2px;padding:0 4px 4px;text-transform:uppercase}
.scell small .sf{font-size:11px;padding:1px 2px;border-bottom:1px solid var(--hair);text-align:center}
.sstatus{display:grid;grid-template-columns:1.7fr 1fr 1fr 1.15fr;gap:6px}
.sac,.stbl{border:2px solid var(--ink);border-radius:6px;overflow:hidden;font-size:10px;align-self:start}
.sth{display:flex;justify-content:space-between;background:var(--ink);color:var(--paper);font-weight:800;text-transform:uppercase;padding:4px 6px;gap:6px;font-size:9.5px}
.stbl label,.sac label{display:grid;grid-template-columns:1fr 50px;border-top:1px solid var(--ink);align-items:center}
.stbl label>span,.sac label>span{padding:3px 6px;text-transform:uppercase;font-weight:700;text-align:center;border-right:1px solid var(--ink)}
.stbl label>span small{color:var(--muted);font-size:8.5px}
.stbl .sf,.sac .sf{text-align:center;font-size:11px}
.sac .sacr{display:grid;grid-template-columns:minmax(0,1fr) 50px;align-items:center;border-top:1px solid var(--ink)}
.sacr>span{padding:3px 6px;text-transform:uppercase;font-weight:700;text-align:center;border-right:1px solid var(--ink)}
.sac .sach{background:var(--ink);color:var(--paper);border-top:0;font-weight:800;font-size:9.5px}
.sach>span{border-right:0;padding-block:4px}
.sacx{grid-template-columns:minmax(0,1fr) 25px 25px!important}
.sacx .sf{padding-inline:0}
.sacx .sf+.sf{border-left:1px solid var(--ink)}
.sduo{grid-template-rows:1fr auto}
.sduot{display:grid;align-content:start}
.sduot>span{background:var(--ink);color:var(--paper);font-size:9px;font-weight:800;text-transform:uppercase;text-align:center;padding:4px 2px;line-height:1.15}
.sduot>.sf{text-align:center;font-size:18px;font-weight:800;padding:10px 2px}
.sduob{display:grid;border-top:2px solid var(--ink)}
.sduob>span{font-size:8.5px;font-weight:800;text-transform:uppercase;text-align:center;padding-top:3px}
.sduob>.sf{text-align:center;font-weight:800;font-size:13px;padding:2px}
.sdeath{gap:2px;padding-bottom:6px}
.sdeath>small{justify-content:center;padding:2px 0 0}
.sdeath>span:not(:first-child){display:flex;justify-content:center;gap:6px}
.scond{display:grid;grid-template-columns:1.35fr 1fr;gap:10px;margin-top:18px;align-items:start}
.scond>.sbox{margin-top:0}
.sblack{background:var(--ink);color:var(--paper)}
.sblack .stab{background:var(--ink);color:var(--paper);outline:2px solid var(--paper)}
.sconds{display:grid;grid-template-columns:1fr 1fr;gap:3px 8px;font-size:10px;text-transform:uppercase;font-weight:700}
.sconds label{display:flex;gap:5px;align-items:center}
.sconds .gl{color:var(--paper);text-decoration-color:var(--red)}
.sconds .gl:hover,.sconds .gl.on{background:transparent}
.stack{display:grid;gap:10px;align-content:start}
.snotes textarea,.sfeat textarea{width:100%;border:0;background:repeating-linear-gradient(transparent 0 21px,var(--hair) 21px 22px);font:600 12px/22px var(--font);color:var(--ink);resize:vertical;padding:0 4px}
.sline{display:block;border-bottom:1px solid var(--hair)}
.spair{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px;align-items:start}
.spair .stbl label{grid-template-columns:1fr 46px}
.spair .stbl label>span{text-align:left}
.swealth{margin-top:14px;max-width:330px}
.swealth .sth span{flex:1;text-align:center}
.swealth label{grid-template-columns:1fr 1fr 1fr!important}
.swealth label .sf+.sf{border-left:1px solid var(--ink)}
.sright .sblock+.sblock{margin-top:14px}
.ssq{border:2px solid var(--ink)}
.ssq .sbar{border-radius:0}
.ssq .srow{border-radius:0;margin:0;box-shadow:inset 0 -1px 0 color-mix(in srgb,var(--paper) 30%,var(--ink))}
.ssq .sgroup{margin:0;border:0;border-block:2px solid var(--ink);padding:3px 7px}
.sprofh{background:var(--paper);color:var(--ink);padding-block:3px 2px}
.ssq .sinv,.ssq .seq{border:0;border-top:1px solid var(--ink)}
.ssq .sinv:first-of-type,.ssq .seq:first-of-type{border-top:0}
.seqh{display:grid;grid-template-columns:minmax(0,1fr) 64px 64px;align-items:center}
.sgrid3{display:grid;grid-template-columns:1fr 64px 64px}
.seq{display:grid;grid-template-columns:86px minmax(0,1fr) 64px 64px;border:1px solid var(--ink);border-top:0;align-items:stretch}
.seq .sf{border-left:1px solid var(--ink)}
.sslot{background:var(--ink);color:var(--paper);font-size:10px;font-weight:800;text-transform:uppercase;display:grid;place-items:center;padding:3px}
.ssq .stot2{grid-template-columns:minmax(0,1fr) 64px 64px;border-top:2px solid var(--ink)}
.stot2 label{display:grid;border-left:1px solid var(--ink)}
.stotl{display:grid;place-items:center end;padding-right:8px;font-size:9px;font-weight:800;text-transform:uppercase}
.stot2 label span{background:var(--ink);color:var(--paper);font-size:8.5px;font-weight:800;text-align:center;padding:2px}
.stot2 .sf{border:0;text-align:center}
.sgrid4{display:grid;grid-template-columns:minmax(0,1fr) 54px 60px 64px}
.sinv{border:1px solid var(--ink);border-top:0}
.sinv .sf+.sf{border-left:1px solid var(--ink);text-align:center}
.sgrid5{display:grid;grid-template-columns:22px 40px minmax(0,1.7fr) 1fr 1fr 1fr;align-items:center}
.sgrid5.sbar>span:first-child{grid-column:span 2}
.sspell{border-bottom:1px solid var(--hair);margin-inline:4px}
.sspell .sck{justify-self:center;border-radius:50%}
.sspell .sf{text-align:center}
.sspell .sf:nth-of-type(2){text-align:left}
.scast{text-align:center}
.scast>.sf{text-align:center;border-bottom:1px solid var(--ink)}
.scast .sth{justify-content:center}
.scast p{margin:0;font-size:9.5px;padding:4px;border-bottom:1px solid var(--ink)}
.scast p:last-child{border-bottom:0}
.sfeat{min-height:300px}
.sfeats{display:grid;gap:6px;margin-bottom:6px}
.sfeats p{margin:0;font-size:11.5px}
.sfeats small{color:var(--muted);font-weight:700}
@media (max-width:760px){
  .spage{padding:14px 10px}
  .shead,.scols,.scond,.spair{grid-template-columns:minmax(0,1fr)}
  .slogo{max-width:300px;width:100%;margin:0 auto}
  .sstatus{grid-template-columns:1fr 1fr}
  .spool{grid-template-columns:repeat(3,minmax(0,1fr))}
  .sf{font-size:16px}
  .scell>.sf{font-size:18px}
  .sheettools .sp{display:none}
  .srow,.sleft .srow:has(.stiers){grid-template-columns:18px minmax(0,1fr) auto 40px;border-radius:6px;row-gap:3px;padding:3px 3px 4px 7px}
  .srow .srl{grid-row:1;grid-column:1/3}.srow .stiers{grid-row:1;grid-column:3}.srow .stot{grid-row:1;grid-column:4}
  .srow .sstar{grid-row:2;grid-column:1}.srow .spips{grid-row:2;grid-column:2/5;justify-self:start}
  .ssub,.sprofh{display:none}
}
body.cc-printing .spage{border:0;border-radius:0;padding:0;max-width:none;margin:0;font-size:10.5px}
body.cc-printing .sf{font-size:10.5px;padding:2px 4px}
body.cc-printing .satk>div{min-width:0}
body.cc-printing .snotes textarea,body.cc-printing .sfeat textarea{resize:none}
@media print{
  @page{size:letter;margin:.3in}
  :root,:root[data-mode="dark"]{--ink:#000;--paper:#fff;--page:#fff;--muted:#5c5c5c;--soft:#ececec;--hair:#c9c9c9;--placeholder:transparent;--red:#a3141b;--gold:#b7791f;color-scheme:light}
  body{background:#fff}
  .sitenav,.ccintro,.cctop,.gmsg,.sheettools,.sheethelp,footer,.savebar,#gside,.gtip,#cchome,#ccgame,#ccadmin{display:none!important}
  .ccwrap{padding:0;max-width:none}
  #sheetPages{display:block}
  .spage{break-after:page;break-inside:avoid}
  .spage:last-child{break-after:auto}
}
"""


# ---------------------------------------------------------------- home page (index.html)
HOME_CARDS = [
    ("Character Creator", "creator.html", "", "Build a character step by step, from race and class to gear, then print the character sheet."),
    ("Classes", "classes.html", "classes", "Class charts, features by level, proficiencies and subclasses."),
    ("Races", "races.html", "races", "The peoples of Crawl, their subraces and what they bring."),
    ("Backgrounds", "backgrounds.html", "backgrounds", "The life a character lived before adventuring."),
    ("Feats", "feats.html", "feats", "Special talents every class gains as it levels up."),
    ("Spells", "spells.html", "spells", "Every spell, by class or magic source, with its +1 to +10 Ranks."),
    ("Crafting", "crafting.html", "recipes", "Recipes for every trade skill: ingredients, tools and checks."),
    ("Items", "items.html", "items", "Weapons, armor, consumables, materials and magic items."),
    ("Combat", "glossary.html?s=combat", "", "Combat rules, and weapon and combat actions."),
    ("Glossary", "glossary.html", "entries", "Every rules term in one searchable list, conditions included."),
]


def home_shell(logo_svg, admin_modal, counts):
    cards = "".join(
        f'<a class="hcard{" hmain" if i == 0 else ""}" href="{h}"><span class="hct">{html.escape(t)}</span>'
        f'{f"<span class=hcount data-count={k}>{counts.get(k, 0)}</span>" if k else ""}<span class="hcd">{html.escape(d)}</span></a>'
        for i, (t, h, k, d) in enumerate(HOME_CARDS))
    return f"""
<script>/* old spell links (index.html?class=wizard, index.html#a-spell) now live on spells.html */
(function(){{var q=location.search,h=location.hash;if(/[?&](show|source|class|q|lvl)=/.test(q)||(h&&h.length>1))location.replace('spells.html'+q+h)}})();</script>
<div class="wrap condwrap homewrap">
<header class="intro">
  {logo_svg}
  <h1>Crawl 1st Edition</h1>
  <p>Welcome, adventurer. Everything you need to play Crawl is here: make a character, read up on classes, races, backgrounds and feats, and look up spells, items, crafting and the rules.</p>
</header>
<main class="hgrid">{cards}</main>
</div>
{admin_modal}
"""


HOME_CSS = """
.homewrap{max-width:1040px}
.hgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:14px;margin-top:22px}
.hcard{position:relative;display:grid;align-content:start;gap:6px;padding:16px 18px 18px;border:2px solid var(--ink);border-radius:16px;background:var(--paper);color:var(--ink);text-decoration:none;transition:transform .12s ease,box-shadow .12s ease}
.hcard:hover,.hcard:focus-visible{transform:translateY(-2px);box-shadow:0 8px 0 var(--ink)}
.hcard:focus-visible{outline:3px solid var(--red);outline-offset:3px}
.hct{font-weight:800;font-size:1.12rem;letter-spacing:.01em;padding-right:56px}
.hcd{font-weight:600;font-size:.88rem;line-height:1.45;color:var(--muted)}
.hcount{position:absolute;top:14px;right:14px;min-width:30px;text-align:center;font-weight:800;font-size:.78rem;border:2px solid var(--ink);border-radius:999px;padding:1px 9px}
.hmain{grid-column:1/-1;background:var(--ink);color:var(--paper);padding:22px 24px}
.hmain .hct{font-size:1.4rem}
.hmain .hcd{color:var(--paper);opacity:.85;font-size:.95rem}
.hmain:hover,.hmain:focus-visible{box-shadow:0 8px 0 var(--red)}
@media (prefers-reduced-motion:reduce){.hcard{transition:none}.hcard:hover{transform:none}}
"""
