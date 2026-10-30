"""Build the Crawl 1st Edition website from its sources.

Run from the repo root:  python tools/build.py

Reads   src/page.html          the page template (shared by every version)
        crawl-spells.json      the spell list
Writes  index.html             the home page
        spells.html            the Spells page
        conditions.html, glossary.html   the Glossary pages (entries from crawl-glossary.json)
        app/index.html         the Windows app's page (offline, saves on the computer)
        downloads/Crawl-1st-Edition-Installer.zip   the Windows installer

The GitHub Pages site also reads crawl-spells.json when it loads, so replacing
that file is enough to update the site's spells. Rebuild when src/page.html
changes or when you want the app and installer to start from the new list.
"""
import json
import re
import sys
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import sitekit as crawlsite  # noqa: E402  (tools/sitekit.py: navigation bar + Conditions page)

ROOT = Path(__file__).resolve().parents[1]
TEMPLATE = ROOT / "src" / "page.html"
GLOSSARY = ROOT / "crawl-glossary.json"
SPELLS = ROOT / "crawl-spells.json"
REPO_URL = "https://github.com/brodywoe-svg/crawl-1st-edition"
INSTALLER_NAME = "Crawl 1st Edition Installer"

RESET = (
    ":root{color-scheme:light}body{margin:0;font:14px system-ui,sans-serif}"
    "img{max-width:100%}[hidden]{display:none!important}"
)

FOOTER = f"""
<footer style="max-width:900px;margin:0 auto;padding:0 16px 120px;font-family:Montserrat,Arial,sans-serif;font-size:13px;line-height:1.5;color:#5c5c5c;text-align:center">
  <p style="margin:0 0 8px"><a href="downloads/Crawl-1st-Edition-Installer.zip" style="color:#000;font-weight:700">Download the offline Windows app</a> &middot; <a href="{REPO_URL}" style="color:#000;font-weight:700">View on GitHub</a></p>
  <p style="margin:0">Spell content, card designs and the Crawl logo &copy; 2026 Brody Woelke. All rights reserved.<br>
  This work includes material taken from the System Reference Document 5.1 (&ldquo;SRD 5.1&rdquo;) by Wizards of the Coast LLC, available at <a href="https://dnd.wizards.com/resources/systems-reference-document" style="color:#5c5c5c">dnd.wizards.com</a>. The SRD 5.1 is licensed under the <a href="https://creativecommons.org/licenses/by/4.0/legalcode" style="color:#5c5c5c">Creative Commons Attribution 4.0 International License</a>.</p>
</footer>
"""


def as_js(value):
    """JSON that is safe to place inside a <script> element."""
    return json.dumps(value, ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003c")


def read_glossary():
    return json.loads(GLOSSARY.read_text(encoding="utf-8"))


def read_catalog():
    if not CATALOG.exists():
        CATALOG.write_text('{\n "v": 1,\n "items": [],\n "recipes": []\n}\n', encoding="utf-8")
    return json.loads(CATALOG.read_text(encoding="utf-8"))


TREE_BTN = ('<button type="button" class="treebtn" id="treeBtn" role="switch" aria-checked="false" title="Tree mode: the Character Creator shows classes as a skill tree">'
            '<span class="tsw" aria-hidden="true"></span><span>Tree mode</span></button>')


def page_body(template, spells):
    # the glossary goes in first: the TPL copy of the template also contains its placeholder
    body = template.replace("/*@GLOSSARY@*/null", as_js(read_glossary()), 1)
    body = body.replace("/*@DATA@*/", as_js(spells), 1).replace("/*@TPL@*/", as_js(template), 1)
    body = body.replace("<!--@NAV@-->", crawlsite.nav_html("spells", sections=crawlsite.glossary_sections(read_glossary()), races=read_races(), classes=read_classes(), backgrounds=read_backgrounds(), feats=read_feats()), 1)
    return body.replace("/*@NAVCSS@*/", crawlsite.NAV_CSS, 1)


CATALOG = ROOT / "crawl-items.json"
GLOSSARY_PAGES = {
    # file name: (page key, <title>, meta description)
    "index.html": ("home", "Crawl 1st Edition", "Crawl 1st Edition: the Character Creator, classes, races, backgrounds, feats, spells, crafting, items and the rules glossary."),
    "glossary.html": ("glossary", "Glossary · Crawl 1st Edition",
                      "The Crawl 1st Edition glossary: every rules term in one searchable list."),
    "conditions.html": ("conditions", "Conditions · Crawl 1st Edition",
                        "The conditions of Crawl 1st Edition: what each one does and how it ends."),
    "items.html": ("items", "Items · Crawl 1st Edition", "Every item in Crawl 1st Edition, with what crafts it and what it's used in."),
    "crafting.html": ("crafting", "Crafting · Crawl 1st Edition", "Crafting recipes for Crawl 1st Edition: results, ingredients, tools and checks."),
    "races.html": ("races", "Races · Crawl 1st Edition", "The races of Crawl 1st Edition and their subraces: ability score increases, proficiencies, languages and features."),
    "classes.html": ("classes", "Classes · Crawl 1st Edition", "The classes of Crawl 1st Edition: class charts, features by level, proficiencies, skill points, starting equipment and subclasses."),
    "backgrounds.html": ("backgrounds", "Backgrounds · Crawl 1st Edition", "The backgrounds of Crawl 1st Edition: proficiencies, languages, starting gear and features."),
    "feats.html": ("feats", "Feats · Crawl 1st Edition", "The feats of Crawl 1st Edition: special talents every class gains at 2nd level and every 2 levels after."),
    "creator.html": ("creator", "Character Creator · Crawl 1st Edition", "Make a Crawl 1st Edition character step by step: race, class, background, ability scores, skills, spells and gear, then a printable character sheet."),
}
CREATOR = ROOT / "crawl-creator.json"
TREE = ROOT / "crawl-tree.json"
CLASSES = ROOT / "crawl-classes.json"
BACKGROUNDS = ROOT / "crawl-backgrounds.json"
FEATS = ROOT / "crawl-feats.json"


def read_json(path, empty):
    if not path.exists():
        path.write_text(empty, encoding="utf-8")
    return json.loads(path.read_text(encoding="utf-8"))


def spell_schools():
    """The schools of magic named on spells (their Category), without notes such as (Ritual)."""
    spells = json.loads(SPELLS.read_text(encoding="utf-8"))
    return sorted({re.sub(r"\s*\(.*?\)", "", str(s.get("f", {}).get("cat", ""))).strip() for s in spells} - {""})


def read_classes():
    return read_json(CLASSES, '{\n "v": 1,\n "classes": []\n}\n')


def read_backgrounds():
    return read_json(BACKGROUNDS, '{\n "v": 1,\n "backgrounds": []\n}\n')


def read_feats():
    return read_json(FEATS, '{\n "v": 1,\n "feats": []\n}\n')


def read_tree():
    """Tree mode's skill tree: only the admin's changes to the tree built from the data"""
    if not TREE.exists():
        TREE.write_text('{\n "v": 1,\n "nodes": {},\n "extra": [],\n "links": [],\n "unlinks": []\n}\n', encoding="utf-8")
    return json.loads(TREE.read_text(encoding="utf-8"))


def read_creator():
    if not CREATOR.exists():
        CREATOR.write_text('{\n "v": 1,\n "rules": {}\n}\n', encoding="utf-8")
    return json.loads(CREATOR.read_text(encoding="utf-8"))
RACES = ROOT / "crawl-races.json"


def feature_sources():
    """feature name -> where it comes from, e.g. {"Martial Arts": [{"n": "Monk", "lv": 2, "href": "classes.html#class-monk"}]},
    so the glossary can group actions under the feature they come from"""
    out = {}
    def put(name, src):
        if name and src not in out.setdefault(name, []):
            out[name].append(src)
    for k in read_classes().get("classes", []):
        for f in k.get("feats", []):
            put(f.get("n", "").strip(), {"n": k.get("n", ""), "lv": f.get("lv") or 1, "href": "classes.html#" + k.get("id", "")})
        for s in k.get("subs", []) or []:
            for f in s.get("feats", []):
                put(f.get("n", "").strip(), {"n": f"{s.get('n', '')} ({k.get('n', '')})", "lv": f.get("lv") or 1, "href": "classes.html#" + s.get("id", "")})
    for r in read_races().get("races", []):
        for f in r.get("feats", []) or []:
            put(f.get("n", "").strip(), {"n": r.get("n", ""), "href": "races.html#" + r.get("id", "")})
    for f in read_feats().get("feats", []):
        put(f.get("n", "").strip(), {"n": "Feat", "href": "feats.html#" + f.get("id", "")})
    for b in read_backgrounds().get("backgrounds", []):
        for f in b.get("feats", []) or []:
            put(f.get("n", "").strip(), {"n": b.get("n", "") + " background", "href": "backgrounds.html#" + b.get("id", "")})
    return out


def read_races():
    if not RACES.exists():
        RACES.write_text('{\n "v": 1,\n "races": []\n}\n', encoding="utf-8")
    return json.loads(RACES.read_text(encoding="utf-8"))


def between(text, start, end):
    i = text.index(start)
    return text[i + len(start):text.index(end, i)]


def glossary_page(template, glossary, name):
    """A Glossary page that shares the spell page's look, navigation and admin sign-in."""
    page, title, _ = GLOSSARY_PAGES[name]
    style = re.search(r"<style>(.*?)</style>", template, re.S).group(1).replace("/*@NAVCSS@*/", "")
    links = "".join(re.findall(r'<link rel="(?:preconnect|stylesheet)"[^>]*>', template)[:2])
    mode_init = re.search(r"<script>try\{if\(localStorage[^<]*</script>", template).group(0)
    logo = re.search(r'<svg class="logo".*?</svg>', template, re.S).group(0)
    admin_btn = re.search(r'<button type="button" class="adminbtn".*?</button>', template, re.S).group(0)
    mode_btn = re.search(r'<button type="button" class="modebtn".*?</button>', template, re.S).group(0)
    modal = re.search(r'<div class="modal" id="adminModal".*?\n</div>\n', template, re.S).group(0)
    mode_js = (
        "(function(){var b=document.getElementById('modeBtn'),r=document.documentElement;"
        "var M='M13.5 9.8A6 6 0 0 1 6.2 2.5a6 6 0 1 0 7.3 7.3z',S='M8 4.2a3.8 3.8 0 1 1 0 7.6 3.8 3.8 0 0 1 0-7.6zM7.2 0h1.6v2.4H7.2zM7.2 13.6h1.6V16H7.2zM0 7.2h2.4v1.6H0zM13.6 7.2H16v1.6h-2.4zM2.2 3.3l1.1-1.1 1.7 1.7-1.1 1.1zM11 12.1l1.1-1.1 1.7 1.7-1.1 1.1zM2.2 12.7l1.7-1.7 1.1 1.1-1.7 1.7zM11 3.9l1.7-1.7 1.1 1.1-1.7 1.7z';"
        "function show(){var d=r.getAttribute('data-mode')==='dark';b.setAttribute('aria-pressed',d);document.getElementById('modeLabel').textContent=d?'Light mode':'Dark mode';document.getElementById('modeIcon').setAttribute('d',d?S:M)}"
        "b.addEventListener('click',function(){var d=r.getAttribute('data-mode')!=='dark';if(d)r.setAttribute('data-mode','dark');else r.removeAttribute('data-mode');try{localStorage.setItem('crawl-mode',d?'dark':'light')}catch(e){}show()});show()})();"
        # Tree mode: an on/off switch kept in this browser; the Character Creator turns its Class step into a skill tree
        "(function(){var b=document.getElementById('treeBtn'),r=document.documentElement;if(!b)return;"
        "function set(on){if(on)r.setAttribute('data-tree','on');else r.removeAttribute('data-tree');b.setAttribute('aria-checked',on)}"
        "var on=false;try{on=localStorage.getItem('crawl-tree-mode')==='1'}catch(e){}set(on);"
        "b.addEventListener('click',function(){on=r.getAttribute('data-tree')!=='on';set(on);try{localStorage.setItem('crawl-tree-mode',on?'1':'0')}catch(e){}window.dispatchEvent(new Event('crawl-tree-mode'))})})();"
    )
    sections = crawlsite.glossary_sections(glossary)
    catalog = page in ("items", "crafting")
    prelude = (
        "const APP=window.crawlApp||null;const STATIC=!APP&&!!window.CRAWL_STATIC;"
        "const $=id=>document.getElementById(id);"
        "const esc=s=>String(s??\"\").replace(/[&<>\"]/g,c=>({\"&\":\"&amp;\",\"<\":\"&lt;\",\">\":\"&gt;\",'\"':\"&quot;\"}[c]));"
        f"const GLOSSARY={as_js(glossary)};window.GL_PAGE={json.dumps(page)};"
        + f"const CATALOG={as_js(read_catalog())};"
        + (f"const RACES={as_js(read_races())};" if page in ("races", "creator") else "")
        + (f"const CREATOR={as_js(read_creator())};const SPELLS={as_js(json.loads(SPELLS.read_text(encoding='utf-8')))};" if page == "creator" else f"const CREATOR={as_js(read_creator())};" if page in ("classes", "feats") else "")
        + (f"const FEATS={as_js(read_feats())};" if page in ("feats", "creator") else "")
        + (f"const TREE={as_js(read_tree())};" if page == "creator" else "")
        + (f"const FEAT_SRC={as_js(feature_sources())};" if page in ("glossary", "conditions") else "")
        + (f"const CLASSES={as_js(read_classes())};const BACKGROUNDS={as_js(read_backgrounds())};const SCHOOLS={as_js(spell_schools())};" if page in ("creator", "classes", "backgrounds", "feats") else "") + "\n"
    )
    shared = between(template, "/*@GLCORE@*/", "/*@GLCORE-END@*/") + between(template, "/*@ADMIN@*/", "/*@ADMIN-END@*/")
    page_js = "home.js" if page == "home" else "catalog.js" if catalog else "races.js" if page == "races" else "creator.js" if page == "creator" else "classes.js" if page in ("classes", "backgrounds", "feats") else "glossary.js"
    script = "" if page == "home" else (ROOT / "src" / "editkit.js").read_text(encoding="utf-8")
    if page in ("creator", "classes", "backgrounds", "feats"):
        script += (ROOT / "src" / "crawldata.js").read_text(encoding="utf-8")
    script += (ROOT / "src" / page_js).read_text(encoding="utf-8")
    if page == "creator":
        script += (ROOT / "src" / "skilltree.js").read_text(encoding="utf-8")
    return (
        f"<title>{title}</title>" + links + mode_init
        + f"<style>{style}{crawlsite.NAV_CSS}{crawlsite.CONDITIONS_CSS}{crawlsite.CREATOR_CSS if page == 'creator' else crawlsite.CLASSES_CSS if page in ('classes', 'backgrounds', 'feats') else crawlsite.HOME_CSS if page == 'home' else ''}</style>"
        + crawlsite.nav_html(page, controls=admin_btn + TREE_BTN + mode_btn, sections=sections, races=read_races(), classes=read_classes(), backgrounds=read_backgrounds(), feats=read_feats())
        + (crawlsite.home_shell(logo, modal, home_counts()) if page == "home" else crawlsite.catalog_shell(page, logo, modal) if catalog else crawlsite.races_shell(logo, modal) if page == "races" else crawlsite.creator_shell(logo, modal) if page == "creator" else crawlsite.list_shell(page, logo, modal) if page in ("classes", "backgrounds", "feats") else crawlsite.glossary_shell(page, logo, modal))
        + f"<script>{mode_js}</script><script>{prelude}{shared}{script}</script>"
    )


def home_counts():
    cat = read_catalog()
    return {"classes": len(read_classes().get("classes", [])), "races": len(read_races().get("races", [])), "backgrounds": len(read_backgrounds().get("backgrounds", [])),
            "feats": len(read_feats().get("feats", [])), "spells": len(json.loads(SPELLS.read_text(encoding="utf-8"))), "items": len(cat.get("items", [])),
            "recipes": len(cat.get("recipes", [])), "entries": len(read_glossary().get("entries", []))}


def build_site(body):
    head = (
        '<!doctype html><html lang="en"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
        '<meta name="description" content="Every spell in Crawl 1st Edition, filterable by class and magic source.">'
        '<link rel="icon" type="image/png" href="favicon.png"><link rel="icon" href="favicon.ico" sizes="any"><link rel="apple-touch-icon" href="apple-touch-icon.png">'
        f"<style>{RESET}</style>"
        "<script>window.CRAWL_STATIC=true;window.CRAWL_REPO={owner:\"brodywoe-svg\",repo:\"crawl-1st-edition\",branch:\"main\"}</script></head><body>"
    )
    (ROOT / "spells.html").write_text(head.replace("<title>", "<title>") + body + FOOTER + "</body></html>", encoding="utf-8")
    template, glossary = TEMPLATE.read_text(encoding="utf-8"), read_glossary()
    for name, (_, _, desc) in GLOSSARY_PAGES.items():
        ghead = head.replace("Every spell in Crawl 1st Edition, filterable by class and magic source.", desc)
        (ROOT / name).write_text(ghead + glossary_page(template, glossary, name) + FOOTER + "</body></html>", encoding="utf-8")


def build_app(body):
    fonts = "".join(
        f'@font-face{{font-family:"Montserrat";font-weight:{w};font-style:{s};'
        f'src:url(fonts/montserrat-latin-{w}-{s}.woff2) format("woff2")}}'
        for w, s in [(600, "normal"), (600, "italic"), (700, "normal"), (800, "normal")]
    )
    head = (
        '<!doctype html><html lang="en"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1">'
        f"<style>{RESET}{fonts}</style>"
        '<script src="html2canvas.min.js"></script></head><body>'
    )
    # The app is offline: its fonts are bundled, so drop the Google Fonts links.
    body = re.sub(r'<link rel="preconnect" href="https://fonts.googleapis.com">\n?', "", body, count=1)
    body = re.sub(r'<link rel="stylesheet" href="https://fonts.googleapis.com/css2[^"]*">\n?', "", body, count=1)
    (ROOT / "app" / "spells.html").write_text(head + body + "</body></html>", encoding="utf-8")
    template, glossary = TEMPLATE.read_text(encoding="utf-8"), read_glossary()
    for name in GLOSSARY_PAGES:
        page = glossary_page(template, glossary, name)
        page = re.sub(r'<link rel="preconnect"[^>]*>|<link rel="stylesheet" href="https://fonts.googleapis.com[^>]*>', "", page)
        (ROOT / "app" / name).write_text(head + page + "</body></html>", encoding="utf-8")


def build_installer():
    out = ROOT / "downloads" / "Crawl-1st-Edition-Installer.zip"
    out.parent.mkdir(exist_ok=True)
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for f in sorted((ROOT / "installer").rglob("*")):
            if f.is_file():
                z.write(f, f"{INSTALLER_NAME}/{f.relative_to(ROOT / 'installer').as_posix()}")
        for f in sorted((ROOT / "app").rglob("*")):
            if f.is_file():
                z.write(f, f"{INSTALLER_NAME}/app/{f.relative_to(ROOT / 'app').as_posix()}")
    return out


def main():
    template = TEMPLATE.read_text(encoding="utf-8")
    spells = json.loads(SPELLS.read_text(encoding="utf-8"))
    body = page_body(template, spells)
    build_site(body)
    build_app(body)
    out = build_installer()
    print(f"Built index.html (home), spells.html, feats.html, conditions.html, glossary.html, items.html, crafting.html, races.html, classes.html, backgrounds.html, creator.html, app/ and {out.relative_to(ROOT)} with {len(spells)} spells.")


if __name__ == "__main__":
    main()
