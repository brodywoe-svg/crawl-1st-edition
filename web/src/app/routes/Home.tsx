/* Home: the playtest landing page (dev/planning/home-page.md). It's about your characters: each one opens on its character sheet in the Creator.
   The interactive play sheet is a prototype, in the Testing menu (/testing/sheet).
   The section cards to every part of the wiki are on the Wiki page (wiki.html). */
import { useEffect, useState } from "react";
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
/** The Creator opens a finished character on its sheet, and an unfinished one where it was left. */
const sheetHref = (id: string) => siteHref(`creator.html?c=${encodeURIComponent(id)}`);
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
                <div className="prow"><a className="pbtn" href={sheetHref(c.id)}>Continue</a></div>
              </article>
            ))}
          </div>
        )}
        <p className="pmuted psmall">{where}.</p>
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

/** One character: who they are, and a button to their character sheet in the Creator. */
function CharCard({ c }: { c: Character }) {
  const content = useCharacter(s => s.content);
  const d = derive(migrate(c), content);
  const stats = [d.maxHp != null && `HP ${d.maxHp}`, d.ac != null && `AC ${d.ac}`, d.maxPool != null && `Max Pool ${d.maxPool}`, d.die && `Action Die ${d.die}`].filter(Boolean).join(" · ");
  return (
    <article className="pcard hchar">
      <h3>{d.name || "Unnamed character"}</h3>
      <p className="pmuted">Level {d.level}{d.race && ` · ${d.race}`}{d.cls && ` · ${d.cls}`}</p>
      {stats && <p className="hstats">{stats}</p>}
      <div className="prow"><a className="pbtn solid grow" href={sheetHref(c.id)}>Character sheet</a></div>
    </article>
  );
}
