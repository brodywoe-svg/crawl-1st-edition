"""Shared site pieces: the top navigation bar and the Conditions page.

Used by tools/build.py. The navigation bar is injected into every page, and the
Conditions page is generated from content/conditions.md.
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
.navin{position:relative;max-width:1240px;margin:0 auto;padding-inline:16px;display:flex;align-items:center;gap:8px}
.navlinks{flex:1 1 auto;min-width:0;display:flex;flex-wrap:wrap;align-items:stretch;justify-content:center;gap:0 2px}
.navctl{flex:none;display:flex;align-items:center;gap:6px}
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
@media (max-width:1180px){
  .navitem{padding:15px 8px;letter-spacing:.05em}
  .navitem.soon small{display:none}
}
@media (max-width:900px){
  .navctl .adminbtn span,.navctl .modebtn span{display:none}
  .navctl .adminbtn,.navctl .modebtn{padding:6px}
}
@media (max-width:900px){
  .navitem.soon small{display:none}
}
@media (max-width:700px){
  .navin{gap:4px;padding-inline:6px}
  .navitem{padding:10px 7px;font-size:.66rem;letter-spacing:.04em}
  .navdrop{position:static}
  .navmenu{left:12px;right:12px;transform:none;min-width:0}
}
"""

NAV_JS = """(function(){
  var nav=document.querySelector('.sitenav');
  function h(){document.documentElement.style.setProperty('--navh',(nav?nav.offsetHeight:0)+'px')}
  h();window.addEventListener('resize',h);if(document.fonts&&document.fonts.ready)document.fonts.ready.then(h);
  document.addEventListener('keydown',function(e){if(e.key==='Escape'&&document.activeElement&&document.activeElement.closest('.navdrop'))document.activeElement.blur()});
})();"""

# ---------------------------------------------------------------- conditions


def slug(name):
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def parse_conditions(md):
    """Returns (intro_notes, [ {name, lead, bullets, notes:[(label,text)]} ])."""
    conds, intro = [], []
    cur = None
    for raw in md.splitlines():
        line = raw.strip()
        if not line or line == "---" or line.startswith("# "):
            continue
        if line.startswith("## "):
            cur = {"name": line[3:].strip(), "lead": "", "bullets": [], "notes": []}
            conds.append(cur)
            continue
        if cur is None:
            if line.lower().startswith("removed from the game:"):
                intro.append(line.split(":", 1)[1].strip())
            continue  # skip internal status lines
        if line.startswith("- "):
            cur["bullets"].append(line[2:].strip())
        elif re.match(r"^(Design note|Note):", line):
            label, text = line.split(":", 1)
            cur["notes"].append(("Designer's note" if label == "Design note" else "Note", text.strip()))
        elif not cur["bullets"]:
            cur["lead"] = (cur["lead"] + " " + line).strip()
        else:
            cur["notes"].append(("Note", line))
    return intro, conds


def plain(text):
    return html.escape(text, quote=False)


def condition_card(c, category=None):
    """One condition as a card. Plain text only: nothing on the card is a link."""
    n = c["name"]
    bullets = "".join(f"<li>{plain(b)}</li>" for b in c["bullets"])
    notes = "".join(f'<p class="cnote"><b>{lab}:</b> {plain(txt)}</p>' for lab, txt in c["notes"])
    search = html.escape(" ".join([n, c["lead"], *c["bullets"], *(t for _, t in c["notes"])]).lower())
    tag = f'<span class="ctag">{category}</span>' if category else ""
    return (
        f'<section class="cond" id="{slug(n)}" data-search="{search}">'
        f'<h2 class="chead"><span>{plain(n)}</span>{tag}</h2>'
        f'<div class="cbody"><p class="clead">{plain(c["lead"])}</p><ul class="cul">{bullets}</ul>{notes}</div></section>'
    )


def search_bar(placeholder, count_text):
    return f"""<div class="cbar">
  <input id="cq" type="search" placeholder="{placeholder}" aria-label="{placeholder}" autocomplete="off">
  <span class="ccount" id="ccount">{count_text}</span>
</div>"""


def conditions_body(md, logo_svg):
    intro_notes, conds = parse_conditions(md)
    removed = "".join(f"<p>{plain(t)}</p>" for t in intro_notes)
    return f"""
<div class="wrap condwrap">
<header class="intro">
  {logo_svg}
  <h1>Conditions</h1>
  <p>Conditions change what a creature can do, and how others can affect it. A creature can have more than one condition at a time. Each lasts until something ends it, such as a saving throw, a spell or the end of its duration. These match the Conditions list on page 1 of the character sheet.</p>
</header>
{search_bar("Find a condition", f"{len(conds)} conditions")}
<main class="clist" id="clist" data-noun="condition">{"".join(condition_card(c) for c in conds)}</main>
<p class="cempty" id="cempty" hidden>No conditions match. Clear the search to see them all.</p>
<aside class="cremoved"><h3>No Exhaustion condition</h3>{removed}</aside>
</div>
"""


def glossary_body(md, logo_svg):
    """Every entry from every Glossary page, in one searchable list, grouped by page."""
    _, conds = parse_conditions(md)
    groups = [("Conditions", "conditions.html", conds)]
    total = sum(len(g[2]) for g in groups)
    sections = "".join(
        f'<section class="gsec" data-group><div class="ghead"><h2>{name}</h2>'
        f'<a class="glink" href="{href}">Open the {name} page</a></div>'
        f'<div class="clist">{"".join(condition_card(c, name[:-1]) for c in items)}</div></section>'
        for name, href, items in groups
    )
    return f"""
<div class="wrap condwrap">
<header class="intro">
  {logo_svg}
  <h1>Glossary</h1>
  <p>Every term in the Crawl rules, in one place. Search by name or by anything in its description.</p>
</header>
{search_bar("Search the glossary", f"{total} entries")}
<main id="clist" data-noun="entry">{sections}</main>
<p class="cempty" id="cempty" hidden>Nothing matches. Try a different word, or clear the search.</p>
</div>
"""


CONDITIONS_CSS = """
.condwrap{padding-block:28px 60px}
.cbar{position:sticky;top:var(--navh,0px);z-index:5;background:var(--page);padding-block:12px;margin-top:12px!important}
.cbar{display:flex;gap:10px;align-items:center;margin-top:24px}
.cbar input{flex:1 1 auto;min-width:0;font:600 1rem var(--font);border:2px solid var(--ink);border-radius:10px;padding:9px 12px;background:var(--paper);color:var(--ink)}
.ccount{font-size:.8rem;color:var(--muted);font-weight:600;white-space:nowrap}
.cbar+.clist,.cbar+main{margin-top:22px}
.clist{display:grid;gap:12px}
/* the card is filled with ink so no light pixels show through at the rounded corners or the top edge */
.cond{background:var(--ink);border:2px solid var(--ink);border-radius:14px;overflow:hidden;scroll-margin-top:calc(var(--navh,0px) + 16px)}
.chead{margin:0;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:11px 16px;color:var(--paper);font-size:1.05rem;font-weight:800;letter-spacing:.01em}
.ctag{font-size:.62rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;border:1.5px solid currentColor;border-radius:999px;padding:2px 8px;white-space:nowrap}
.cbody{background:var(--paper);border-radius:0 0 12px 12px;padding:12px 18px 16px;display:grid;gap:8px}
.clead{margin:0;font-weight:600}
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
"""

CONDITIONS_JS = """(function(){
  var q=document.getElementById('cq'),list=document.getElementById('clist'),noun=list.dataset.noun,
      cards=[].slice.call(document.querySelectorAll('.cond')),groups=[].slice.call(document.querySelectorAll('[data-group]')),
      count=document.getElementById('ccount'),empty=document.getElementById('cempty');
  function plural(n){return n===1?noun:(noun==='entry'?'entries':noun+'s')}
  function run(){var v=q.value.trim().toLowerCase(),n=0;cards.forEach(function(c){var ok=!v||c.dataset.search.indexOf(v)>-1;c.hidden=!ok;if(ok)n++});
    groups.forEach(function(g){g.hidden=!g.querySelector('.cond:not([hidden])')});
    count.textContent=n+' '+plural(n);empty.hidden=n>0}
  q.addEventListener('input',run);
})();"""
