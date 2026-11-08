/* Home: the playtest landing page (dev/planning/home-page.md). It's about your characters: each one opens on the play sheet.
   The section cards to every part of the wiki are on the Wiki page (wiki.html). */
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { siteHref } from "../../config";
import { derive } from "../../lib/character/derive";
import { migrate } from "../../lib/character/migrate";
import type { Character } from "../../lib/character/types";
import { Logo } from "../components/Logo";
import { useCharacter } from "../store/character";

/** The rules looked up most at the table. */
const RULES: [string, string][] = [
  ["Combat", "glossary.html?s=combat"], ["Conditions", "conditions.html"], ["Spells", "spells.html"],
  ["Items", "items.html"], ["Classes", "classes.html"], ["Glossary", "glossary.html"], ["Everything", "wiki.html"],
];
const sheetHref = (id: string) => `/testing/sheet?c=${encodeURIComponent(id)}`;
const editHref = (id: string) => siteHref(`creator.html?c=${encodeURIComponent(id)}`);
const label = () => window.crawlCloud?.label || "Saved in this browser";

export function Home() {
  const { list, drafts, init } = useCharacter();
  const [where, setWhere] = useState(label);
  useEffect(() => {
    init();
    const sync = () => { useCharacter.getState().refreshList(); setWhere(label()) };
    window.addEventListener("crawl-characters-changed", sync);
    return () => window.removeEventListener("crawl-characters-changed", sync);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="wrap playwrap homeplay">
      <header className="hhead">
        <Logo />
        <div><h1>Crawl 1st Edition</h1><p className="ptag">Playtest</p></div>
      </header>

      <section aria-labelledby="yours">
        <div className="hsec">
          <h2 id="yours">Your characters</h2>
          {list.length + drafts.length > 0 && <a className="pbtn" href={siteHref("creator.html")}>+ New character</a>}
        </div>
        {list.length + drafts.length === 0 ? <Empty /> : (
          <div className="hchars">
            {list.map(c => <CharCard key={c.id} c={c} />)}
            {drafts.map(c => (
              <article key={c.id} className="pcard hchar draft">
                <h3>{String(c.name || "Unnamed character")}</h3>
                <p className="pmuted">In progress: finish it in the Character Creator to play it.</p>
                <div className="prow"><a className="pbtn" href={editHref(c.id)}>Continue</a></div>
              </article>
            ))}
          </div>
        )}
        <p className="pmuted psmall">{where}. <Link to="/testing/sheet?sample=1">Try the sample character</Link></p>
      </section>

      <section className="pcard" aria-labelledby="rules">
        <h2 id="rules">Look up the rules</h2>
        <nav className="hrules">{RULES.map(([n, h]) => <a key={n} href={siteHref(h)}>{n}</a>)}</nav>
      </section>
    </div>
  );
}

function Empty() {
  return (
    <div className="pcard hempty">
      <p>You don't have a character in this browser yet.</p>
      <a className="pbtn solid big" href={siteHref("creator.html")}>Make your first character</a>
      <p className="pmuted psmall">Made one on another device? Sign in to bring it here.</p>
    </div>
  );
}

/** One character: who they are, their HP and Action Pool, and buttons to play or edit. */
function CharCard({ c }: { c: Character }) {
  const content = useCharacter(s => s.content);
  const pc = migrate(c), d = derive(pc, content), s = pc.state;
  const max = d.maxHp, slots = d.maxPool ?? 0;
  const dots = [...Array(s.pool.ap).fill("ap"), ...Array(s.pool.mp).fill("mp"), ...Array(s.pool.ep).fill("ep")];
  return (
    <article className="pcard hchar">
      <div className="hctop">
        <h3>{d.name || "Unnamed character"}</h3>
        {s.mode === "combat" && <span className="hbadge">In combat</span>}
      </div>
      <p className="pmuted">Level {d.level}{d.race && ` · ${d.race}`}{d.cls && ` · ${d.cls}`}</p>
      <p className="hhp"><b>HP {s.hp}</b>{max != null && <small> / {max}</small>}{s.tempHp > 0 && <span className="ptemp">+{s.tempHp} temp</span>}</p>
      {max != null && <div className="pbar" aria-hidden="true"><i style={{ width: `${Math.min(100, (s.hp / Math.max(1, max)) * 100)}%` }} /></div>}
      {slots > 0 && (
        <div className="hpool" aria-label={`Action Pool: ${s.pool.ap} AP, ${s.pool.mp} MP, ${s.pool.ep} EP of ${slots}`}>
          {Array.from({ length: Math.max(slots, dots.length) }, (_, i) => <span key={i} className={"hdot " + (dots[i] || "")} />)}
          {s.pool.ep > 0 && <small className="ep">{s.pool.ep} EP</small>}
        </div>
      )}
      {s.conds.length > 0 && <p className="psmall pmuted">{s.conds.map(id => content?.conditions.get(id)?.n || id).join(", ")}</p>}
      <div className="prow">
        <Link className="pbtn solid grow" to={sheetHref(c.id)}>Play</Link>
        <a className="pbtn" href={editHref(c.id)}>Edit</a>
      </div>
    </article>
  );
}
