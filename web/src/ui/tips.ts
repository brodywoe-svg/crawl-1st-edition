/* Glossary tooltips on pages built from data (Items, Classes, Races, Backgrounds, Feats): mark glossary words in rendered text,
   and show the popup on hover, focus or tap. Ported from the /*@GLCORE@*\/ block in src/page.html. */
import { tipHTML, type GHit, type GMap } from "../lib/markup";

const TIP_SKIP = "a,button,input,textarea,select,option,label,.gl,.pdn,h1,h2,h3,h4,.chead,.gediting,.gform,.cform,.rform,.navmenu,.sitenav,.gtip,.savebar,script,style";

/** Wrap every glossary word under root in a .gl span. skip(word, textNode) can veto a match. */
export function markTips(root: Element | null, g: GMap | null, skip?: (m: string, n: Text) => boolean): void {
  if (!root || !g || !g.re) return;
  const re = g.re, w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), nodes: Text[] = [];
  while (w.nextNode()) { const n = w.currentNode as Text; if (n.nodeValue!.trim() && !n.parentElement?.closest(TIP_SKIP)) nodes.push(n) }
  nodes.forEach(n => {
    const t = n.nodeValue!; re.lastIndex = 0; if (!re.test(t)) return; re.lastIndex = 0;
    const f = document.createDocumentFragment(); let i = 0;
    t.replace(re, (m: string, _x: string, at: number) => {
      if (skip && skip(m, n)) return m;
      f.append(t.slice(i, at));
      const s = document.createElement("span"); s.className = "gl"; s.tabIndex = 0; s.dataset.g = m.toLowerCase(); s.textContent = m; f.append(s);
      i = at + m.length; return m;
    });
    f.append(t.slice(i)); n.replaceWith(f);
  });
}

/** Show the popup for .gl words. lookup turns a .gl element into its glossary hit. */
export function tipRuntime(lookup: (el: HTMLElement) => GHit | null | undefined): void {
  let tip = document.getElementById("gtip");
  if (!tip) { tip = document.createElement("div"); tip.className = "gtip"; tip.id = "gtip"; tip.setAttribute("role", "tooltip"); tip.hidden = true; document.body.appendChild(tip) }
  const box = tip;
  const show = (el: HTMLElement) => {
    const hit = lookup(el); if (!hit) return;
    const tp = tipHTML(hit); box.innerHTML = tp.html; box.classList.toggle("gtipact", tp.act); box.hidden = false;
    const r = el.getBoundingClientRect(), w = box.offsetWidth, h = box.offsetHeight, vw = document.documentElement.clientWidth, vh = window.innerHeight;
    let y = r.bottom + 8; if (y + h > vh - 12 && r.top - h - 8 > 12) y = r.top - h - 8;
    box.style.left = Math.min(Math.max(12, r.left + r.width / 2 - w / 2), vw - w - 12) + "px"; box.style.top = Math.max(12, y) + "px";
  };
  const hide = () => { box.hidden = true }, at = (t: EventTarget | null) => (t as HTMLElement | null)?.closest?.<HTMLElement>(".gl") || null;
  document.addEventListener("pointerover", ev => { if (ev.pointerType === "mouse") { const el = at(ev.target); if (el) show(el) } });
  document.addEventListener("pointerout", ev => { if (ev.pointerType === "mouse") { const el = at(ev.target); if (el && !el.contains(ev.relatedTarget as Node)) hide() } });
  document.addEventListener("focusin", ev => { const el = at(ev.target); if (el) show(el) });
  document.addEventListener("click", ev => { const el = at(ev.target); if (el) { ev.preventDefault(); show(el) } else hide() });
  window.addEventListener("scroll", hide, { passive: true, capture: true });
}
