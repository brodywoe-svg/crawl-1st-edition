"""Build the Crawl Spell Compendium from its sources.

Run from the repo root:  python tools/build.py

Reads   src/page.html          the page template (shared by every version)
        crawl-spells.json      the spell list
Writes  index.html             the GitHub Pages site (read-only)
        conditions.html, glossary.html   the Glossary pages (from content/conditions.md)
        app/index.html         the Windows app's page (offline, saves on the computer)
        downloads/Crawl-Spell-Compendium-Installer.zip   the Windows installer

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
CONDITIONS = ROOT / "content" / "conditions.md"
SPELLS = ROOT / "crawl-spells.json"
REPO_URL = "https://github.com/brodywoe-svg/crawl-spell-compendium"
INSTALLER_NAME = "Crawl Spell Compendium Installer"

RESET = (
    ":root{color-scheme:light}body{margin:0;font:14px system-ui,sans-serif}"
    "img{max-width:100%}[hidden]{display:none!important}"
)

FOOTER = f"""
<footer style="max-width:900px;margin:0 auto;padding:0 16px 120px;font-family:Montserrat,Arial,sans-serif;font-size:13px;line-height:1.5;color:#5c5c5c;text-align:center">
  <p style="margin:0 0 8px"><a href="downloads/Crawl-Spell-Compendium-Installer.zip" style="color:#000;font-weight:700">Download the offline Windows app</a> &middot; <a href="{REPO_URL}" style="color:#000;font-weight:700">View on GitHub</a></p>
  <p style="margin:0">Spell content, card designs and the Crawl logo &copy; 2026 Brody Woelke. All rights reserved.<br>
  This work includes material taken from the System Reference Document 5.1 (&ldquo;SRD 5.1&rdquo;) by Wizards of the Coast LLC, available at <a href="https://dnd.wizards.com/resources/systems-reference-document" style="color:#5c5c5c">dnd.wizards.com</a>. The SRD 5.1 is licensed under the <a href="https://creativecommons.org/licenses/by/4.0/legalcode" style="color:#5c5c5c">Creative Commons Attribution 4.0 International License</a>.</p>
</footer>
"""


def as_js(value):
    """JSON that is safe to place inside a <script> element."""
    return json.dumps(value, ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003c")


def page_body(template, spells):
    body = template.replace("/*@DATA@*/", as_js(spells), 1).replace("/*@TPL@*/", as_js(template), 1)
    body = body.replace("<!--@NAV@-->", crawlsite.nav_html("spells"), 1)
    return body.replace("/*@NAVCSS@*/", crawlsite.NAV_CSS, 1)


GLOSSARY_PAGES = {
    # file name: (nav section, <title>, meta description, body builder)
    "conditions.html": ("conditions", "Crawl Conditions",
                        "The conditions of Crawl 1st Edition: what each one does and how it ends.",
                        crawlsite.conditions_body),
    "glossary.html": ("glossary", "Crawl Glossary",
                      "The Crawl 1st Edition glossary: every rules term in one searchable list.",
                      crawlsite.glossary_body),
}


def glossary_page(template, name):
    """A standalone Glossary page that shares the spell page's look and navigation."""
    active, title, _, builder = GLOSSARY_PAGES[name]
    style = re.search(r"<style>(.*?)</style>", template, re.S).group(1).replace("/*@NAVCSS@*/", "")
    links = "".join(re.findall(r'<link rel="(?:preconnect|stylesheet)"[^>]*>', template)[:2])
    mode_init = re.search(r"<script>try\{if\(localStorage[^<]*</script>", template).group(0)
    logo = re.search(r'<svg class="logo".*?</svg>', template, re.S).group(0)
    mode_btn = re.search(r'<button type="button" class="modebtn".*?</button>', template, re.S).group(0)
    mode_js = (
        "(function(){var b=document.getElementById('modeBtn'),r=document.documentElement;"
        "var M='M13.5 9.8A6 6 0 0 1 6.2 2.5a6 6 0 1 0 7.3 7.3z',S='M8 4.2a3.8 3.8 0 1 1 0 7.6 3.8 3.8 0 0 1 0-7.6zM7.2 0h1.6v2.4H7.2zM7.2 13.6h1.6V16H7.2zM0 7.2h2.4v1.6H0zM13.6 7.2H16v1.6h-2.4zM2.2 3.3l1.1-1.1 1.7 1.7-1.1 1.1zM11 12.1l1.1-1.1 1.7 1.7-1.1 1.1zM2.2 12.7l1.7-1.7 1.1 1.1-1.7 1.7zM11 3.9l1.7-1.7 1.1 1.1-1.7 1.7z';"
        "function show(){var d=r.getAttribute('data-mode')==='dark';b.setAttribute('aria-pressed',d);document.getElementById('modeLabel').textContent=d?'Light mode':'Dark mode';document.getElementById('modeIcon').setAttribute('d',d?S:M)}"
        "b.addEventListener('click',function(){var d=r.getAttribute('data-mode')!=='dark';if(d)r.setAttribute('data-mode','dark');else r.removeAttribute('data-mode');try{localStorage.setItem('crawl-mode',d?'dark':'light')}catch(e){}show()});show()})();"
    )
    md = CONDITIONS.read_text(encoding="utf-8")
    return (
        f"<title>{title}</title>" + links + mode_init
        + f"<style>{style}{crawlsite.NAV_CSS}{crawlsite.CONDITIONS_CSS}</style>"
        + crawlsite.nav_html(active, controls=mode_btn)
        + builder(md, logo)
        + f"<script>{mode_js}{crawlsite.CONDITIONS_JS}</script>"
    )


def build_site(body):
    head = (
        '<!doctype html><html lang="en"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
        '<meta name="description" content="Every spell in Crawl 1st Edition, filterable by class and magic source.">'
        '<link rel="icon" type="image/png" href="favicon.png"><link rel="icon" href="favicon.ico" sizes="any"><link rel="apple-touch-icon" href="apple-touch-icon.png">'
        f"<style>{RESET}</style>"
        "<script>window.CRAWL_STATIC=true;window.CRAWL_REPO={owner:\"brodywoe-svg\",repo:\"crawl-spell-compendium\",branch:\"main\"}</script></head><body>"
    )
    (ROOT / "index.html").write_text(head + body + FOOTER + "</body></html>", encoding="utf-8")
    template = TEMPLATE.read_text(encoding="utf-8")
    for name, (_, _, desc, _) in GLOSSARY_PAGES.items():
        ghead = head.replace("Every spell in Crawl 1st Edition, filterable by class and magic source.", desc)
        (ROOT / name).write_text(ghead + glossary_page(template, name) + FOOTER + "</body></html>", encoding="utf-8")


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
    (ROOT / "app" / "index.html").write_text(head + body + "</body></html>", encoding="utf-8")
    template = TEMPLATE.read_text(encoding="utf-8")
    for name in GLOSSARY_PAGES:
        page = glossary_page(template, name)
        page = re.sub(r'<link rel="preconnect"[^>]*>|<link rel="stylesheet" href="https://fonts.googleapis.com[^>]*>', "", page)
        (ROOT / "app" / name).write_text(head + page + "</body></html>", encoding="utf-8")


def build_installer():
    out = ROOT / "downloads" / "Crawl-Spell-Compendium-Installer.zip"
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
    print(f"Built index.html, conditions.html, glossary.html, app/ and {out.relative_to(ROOT)} with {len(spells)} spells.")


if __name__ == "__main__":
    main()
