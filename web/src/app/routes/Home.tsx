/* Home: the playtest landing page (dev/planning/home-page.md). It's about your characters: each one opens on its character sheet in the Creator.
   The interactive play sheet is a prototype, in the Testing menu (/testing/sheet).
   The section cards to every part of the wiki are on the Wiki page (wiki.html). */
import { useEffect, useState } from "react";
import { changelog, changeText, dayLabel, type Change } from "../../lib/edits";
import { loadJson } from "../../lib/data";
import { useCounts, type CountKey } from "../hooks/useCounts";
import { siteHref } from "../../config";
import { derive } from "../../lib/character/derive";
import { migrate } from "../../lib/character/migrate";
import type { Character } from "../../lib/character/types";
import { Logo } from "../components/Logo";
import { useCharacter } from "../store/character";

/** The Wiki's sections, as on the Wiki page (wiki.html), with the most-used ones first. */
const WIKI: { title: string; href: string; text: string; count?: CountKey }[] = [
  { title: "Combat", href: "glossary.html?s=combat", text: "Combat rules, and weapon and combat actions." },
  { title: "Conditions", href: "conditions.html", text: "Prone, grappled, poisoned and the rest." },
  { title: "Spells", href: "spells.html", count: "spells", text: "Every spell, with its +1 to +10 Ranks." },
  { title: "Items", href: "items.html", count: "items", text: "Weapons, armor, consumables and magic items." },
  { title: "Classes", href: "classes.html", count: "classes", text: "Class charts, features and subclasses." },
  { title: "Glossary", href: "glossary.html", count: "entries", text: "Every rules term in one searchable list." },
];
const SYNCED = "Saved to your account";
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
        <p className="pmuted psmall">{where}.{where !== SYNCED && list.length + drafts.length > 0 && <> <a href={siteHref("creator.html?example=1")}>See an example character sheet</a></>}</p>
      </section>

      <Wiki />
      <WhatsNew />

    </div>
  );
}

function Empty() {
  return (
    <div className="pcard hempty">
      <p>You don't have a character in this browser yet.</p>
      <div className="prow">
        <a className="pbtn solid big" href={siteHref("creator.html")}>Make your first character</a>
        <a className="pbtn big" href={siteHref("creator.html?example=1")}>See an example sheet</a>
      </div>
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

/** The Wiki: its main sections with live counts, and a link to all of them. */
function Wiki() {
  const counts = useCounts();
  return (
    <section aria-labelledby="wiki">
      <div className="hsec">
        <h2 id="wiki">Wiki</h2>
        <a className="pbtn" href={siteHref("wiki.html")}>All sections</a>
      </div>
      <p className="pmuted hlead">Look anything up: the rules, classes, spells, items and more.</p>
      <div className="hgrid hwiki">
        {WIKI.map(w => (
          <a key={w.title} className="hcard" href={siteHref(w.href)}>
            <span className="hct">{w.title}</span>
            {w.count && counts[w.count] != null && <span className="hcount">{counts[w.count]}</span>}
            <span className="hcd">{w.text}</span>
          </a>
        ))}
      </div>
    </section>
  );
}

/** What's new: the latest rule changes from the Admin edit log, grouped by day. */
function WhatsNew() {
  const [all, setAll] = useState<Change[] | null>(null), [more, setMore] = useState(false);
  useEffect(() => { loadJson("crawl-edits.json").then(log => setAll(changelog(log, 30))) }, []);
  if (all && !all.length) return null;
  const shown = (all || []).slice(0, more ? 30 : 6);
  const days = [...new Set(shown.map(c => c.day))];
  return (
    <section className="pcard" aria-labelledby="new">
      <h2 id="new">What's new in the rules</h2>
      {!all && <p className="pmuted">Loading…</p>}
      {days.map(day => (
        <div key={day} className="hday">
          <h3>{dayLabel(day)}</h3>
          <ul className="hnew">
            {shown.filter(c => c.day === day).map(c => (
              <li key={c.day + c.page + c.title}>
                <a href={siteHref(c.href)}><b>{c.title}</b></a>{c.title !== c.page && <span className="pmuted"> · {c.page}</span>}
                <span className="hwhat">{changeText(c)}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
      {all && all.length > 6 && <button type="button" className="pbtn small" onClick={() => setMore(!more)}>{more ? "Show less" : "Show more"}</button>}
    </section>
  );
}
