"""Build the Crawl Spell Compendium from its sources.

Run from the repo root:  python tools/build.py

Reads   src/page.html          the page template (shared by every version)
        crawl-spells.json      the spell list
Writes  index.html             the GitHub Pages site (read-only)
        app/index.html         the Windows app's page (offline, saves on the computer)
        downloads/Crawl-Spell-Compendium-Installer.zip   the Windows installer

The GitHub Pages site also reads crawl-spells.json when it loads, so replacing
that file is enough to update the site's spells. Rebuild when src/page.html
changes or when you want the app and installer to start from the new list.
"""
import json
import re
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TEMPLATE = ROOT / "src" / "page.html"
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
    return template.replace("/*@DATA@*/", as_js(spells), 1).replace("/*@TPL@*/", as_js(template), 1)


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
    print(f"Built index.html, app/index.html and {out.relative_to(ROOT)} with {len(spells)} spells.")


if __name__ == "__main__":
    main()
