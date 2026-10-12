"""Shared site pieces: the top navigation bar and the Conditions page.

Used by tools/build.py. The navigation bar is injected into every page, and the
Conditions page is generated from content/conditions.md.
"""
import html
import re

# ---------------------------------------------------------------- navigation

# (label, href or None when the section isn't built yet)
NAV_ITEMS = [
    ("Character Creator", None),
    ("Classes", None),
    ("Crafting", None),
    ("Rules", None),
    ("Glossary", [("Conditions", "conditions.html")]),
    ("About", None),
]

CARET = '<svg viewBox="0 0 10 6" aria-hidden="true"><path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>'


def nav_html(active):
    """active: 'spells' or 'conditions'."""
    parts = [
        '<nav class="sitenav" aria-label="Crawl">',
        '<div class="navin">',
        f'<a class="navitem navhome" href="index.html"{" aria-current=\"page\"" if active == "spells" else ""}>Spells</a>',
    ]
    for label, target in NAV_ITEMS:
        if target is None:
            parts.append(
                f'<span class="navitem soon" aria-disabled="true" title="Coming soon">{label}<small>Soon</small></span>'
            )
        else:
            here = any(h.startswith(active) for _, h in target)
            parts.append(
                '<div class="navdrop">'
                f'<button type="button" class="navitem" aria-haspopup="true" aria-expanded="false"{" data-current=\"1\"" if here else ""}>{label}{CARET}</button>'
                '<div class="navmenu">'
                + "".join(
                    f'<a href="{h}"{" aria-current=\"page\"" if h.startswith(active) else ""}>{t}</a>'
                    for t, h in target
                )
                + "</div></div>"
            )
    parts.append("</div></nav>")
    parts.append(f"<script>{NAV_JS}</script>")
    return "".join(parts)


NAV_CSS = """
.sitenav{position:relative;z-index:25;background:var(--ink);color:var(--paper)}
.navin{position:relative;max-width:1200px;margin:0 auto;padding-inline:16px;display:flex;flex-wrap:wrap;align-items:stretch;justify-content:center;gap:0 2px}
.navitem{display:inline-flex;align-items:center;gap:6px;font:700 .78rem var(--font);letter-spacing:.08em;text-transform:uppercase;color:var(--paper);background:none;border:0;padding:15px 12px;text-decoration:none;cursor:pointer;border-radius:0;white-space:nowrap}
.navitem svg{width:10px;height:6px}
a.navitem:hover,button.navitem:hover,.navdrop.open>.navitem,.navdrop:hover>.navitem{background:var(--barhover)}
.navitem[aria-current="page"],.navitem[data-current]{box-shadow:inset 0 -3px 0 var(--paper)}
.navitem.soon{opacity:.5;cursor:default}
.navitem.soon small{font-size:.55rem;letter-spacing:.1em;border:1px solid currentColor;border-radius:999px;padding:1px 5px}
.navitem:focus-visible{outline:3px solid var(--paper);outline-offset:-3px}
.navdrop{position:relative;display:flex}
.navmenu{display:none;position:absolute;top:100%;left:50%;transform:translateX(-50%);min-width:210px;background:var(--paper);color:var(--ink);border:2px solid var(--ink);border-radius:12px;padding:6px;box-shadow:0 10px 28px rgba(0,0,0,.22)}
.navdrop:hover .navmenu,.navdrop:focus-within .navmenu,.navdrop.open .navmenu{display:grid}
.navmenu a{display:block;padding:10px 12px;border-radius:8px;font:700 .92rem var(--font);color:var(--ink);text-decoration:none}
.navmenu a:hover,.navmenu a:focus-visible{background:var(--soft);outline:none}
.navmenu a[aria-current="page"]{text-decoration:underline;text-underline-offset:4px}
@media (max-width:1080px){
  .navitem{padding:15px 9px;letter-spacing:.06em}
}
@media (max-width:900px){
  .navitem.soon small{display:none}
}
@media (max-width:700px){
  .navin{gap:0;padding-inline:6px}
  .navitem{padding:10px 7px;font-size:.66rem;letter-spacing:.04em}
  .navdrop{position:static}
  .navmenu{left:12px;right:12px;transform:none;min-width:0}
}
"""

NAV_JS = """(function(){
  var drops=document.querySelectorAll('.navdrop');
  function closeAll(except){drops.forEach(function(d){if(d!==except){d.classList.remove('open');d.querySelector('.navitem').setAttribute('aria-expanded','false')}})}
  drops.forEach(function(d){
    var b=d.querySelector('.navitem');
    b.addEventListener('click',function(e){e.stopPropagation();var o=!d.classList.contains('open');closeAll(d);d.classList.toggle('open',o);b.setAttribute('aria-expanded',o?'true':'false')});
  });
  document.addEventListener('click',function(e){if(!e.target.closest('.navdrop'))closeAll()});
  document.addEventListener('keydown',function(e){if(e.key==='Escape')closeAll()});
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


def linkify(text, names, self_name):
    out = html.escape(text, quote=False)
    for n in sorted(names, key=len, reverse=True):
        if n == self_name:
            continue
        out = re.sub(rf"(?<![\w>]){re.escape(n)}(?![\w<])", f'<a class="clink" href="#{slug(n)}">{n}</a>', out)
    return out


def conditions_body(md, logo_svg, mode_btn):
    intro_notes, conds = parse_conditions(md)
    names = [c["name"] for c in conds]
    jump = "".join(f'<a class="cchip" href="#{slug(n)}">{html.escape(n)}</a>' for n in names)
    cards = []
    for c in conds:
        n = c["name"]
        lead = linkify(c["lead"], names, n)
        bullets = "".join(f"<li>{linkify(b, names, n)}</li>" for b in c["bullets"])
        notes = "".join(
            f'<p class="cnote"><b>{lab}:</b> {linkify(txt, names, n)}</p>' for lab, txt in c["notes"]
        )
        search = html.escape(" ".join([n, c["lead"], *c["bullets"], *(t for _, t in c["notes"])]).lower())
        cards.append(
            f'<section class="cond" id="{slug(n)}" data-search="{search}">'
            f'<h2 class="chead"><a href="#{slug(n)}">{html.escape(n)}</a></h2>'
            f'<div class="cbody"><p class="clead">{lead}</p><ul class="cul">{bullets}</ul>{notes}</div></section>'
        )
    removed = "".join(f"<p>{html.escape(t)}</p>" for t in intro_notes)
    return f"""
<div class="wrap condwrap">
<div class="topctl">{mode_btn}</div>
<header class="intro">
  {logo_svg}
  <h1>Conditions</h1>
  <p>Conditions change what a creature can do, and how others can affect it. A creature can have more than one condition at a time. Each lasts until something ends it, such as a saving throw, a spell or the end of its duration. These match the Conditions list on page 1 of the character sheet.</p>
</header>
<div class="cbar">
  <input id="cq" type="search" placeholder="Find a condition" aria-label="Find a condition" autocomplete="off">
  <span class="ccount" id="ccount">{len(conds)} conditions</span>
</div>
<nav class="cjump" aria-label="Jump to a condition">{jump}</nav>
<main class="clist" id="clist">{"".join(cards)}</main>
<p class="cempty" id="cempty" hidden>No conditions match. Clear the search to see them all.</p>
<aside class="cremoved"><h3>No Exhaustion condition</h3>{removed}</aside>
</div>
"""


CONDITIONS_CSS = """
.condwrap{padding-block:28px 60px}
.cbar{display:flex;gap:10px;align-items:center;margin-top:24px}
.cbar input{flex:1 1 auto;min-width:0;font:600 1rem var(--font);border:2px solid var(--ink);border-radius:10px;padding:9px 12px;background:var(--paper);color:var(--ink)}
.ccount{font-size:.8rem;color:var(--muted);font-weight:600;white-space:nowrap}
.cjump{display:flex;flex-wrap:wrap;gap:6px;margin:14px 0 22px}
.cchip{font:700 .68rem var(--font);text-transform:uppercase;letter-spacing:.1em;color:var(--ink);text-decoration:none;border:2px solid var(--ink);border-radius:999px;padding:4px 10px;background:var(--paper)}
.cchip:hover{background:var(--ink);color:var(--paper)}
.clist{display:grid;gap:12px}
.cond{background:var(--paper);border:2px solid var(--ink);border-radius:14px;overflow:hidden;scroll-margin-top:16px}
.chead{margin:0;background:var(--ink);font-size:1.05rem;font-weight:800;letter-spacing:.01em}
.chead a{display:block;padding:11px 16px;color:var(--paper);text-decoration:none}
.cbody{padding:12px 18px 16px;display:grid;gap:8px}
.clead{margin:0;font-weight:600}
.cul{margin:0;padding:0;list-style:none;display:grid;gap:6px}
.cul li{position:relative;padding-left:20px;font-weight:600;line-height:1.45}
.cul li::before{content:"";position:absolute;left:3px;top:.55em;width:7px;height:7px;background:var(--ink);transform:rotate(45deg)}
.cnote{margin:2px 0 0;padding:8px 12px;border-left:4px solid var(--ink);background:var(--soft);font-size:.9rem;font-weight:600;border-radius:0 8px 8px 0}
.cnote b{font-weight:800}
.clink{color:inherit;font-weight:800;text-decoration:underline;text-decoration-thickness:2px;text-underline-offset:3px}
.cond:target{box-shadow:0 0 0 4px var(--hair)}
.cremoved{margin-top:24px;border:2px dashed var(--ink);border-radius:14px;padding:12px 18px}
.cremoved h3{margin:0 0 4px;font-size:.95rem;font-weight:800}
.cremoved p{margin:0;font-weight:600;color:var(--muted)}
.cempty{margin:20px 0;color:var(--muted);font-weight:600}
"""

CONDITIONS_JS = """(function(){
  var q=document.getElementById('cq'),cards=[].slice.call(document.querySelectorAll('.cond')),
      count=document.getElementById('ccount'),empty=document.getElementById('cempty');
  function run(){var v=q.value.trim().toLowerCase(),n=0;cards.forEach(function(c){var ok=!v||c.dataset.search.indexOf(v)>-1;c.hidden=!ok;if(ok)n++});
    count.textContent=n+(n===1?' condition':' conditions');empty.hidden=n>0}
  q.addEventListener('input',run);
})();"""
