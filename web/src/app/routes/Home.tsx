/* Home: cards to every part of the site, with live counts from the content files.
   Ported from web/index.html and web/src/pages/home.ts (the plain-TypeScript home page before the React app). */
import { siteHref } from "../../config";
import { Logo } from "../components/Logo";
import { useCounts, type CountKey } from "../hooks/useCounts";

type Card = { title: string; href: string; text: string; count?: CountKey; main?: boolean };
const CARDS: Card[] = [
  { title: "Character Creator", href: "creator.html", main: true, text: "Build a character step by step, from race and class to gear, then print the character sheet." },
  { title: "Classes", href: "classes.html", count: "classes", text: "Class charts, features by level, proficiencies and subclasses." },
  { title: "Races", href: "races.html", count: "races", text: "The peoples of Crawl, their subraces and what they bring." },
  { title: "Backgrounds", href: "backgrounds.html", count: "backgrounds", text: "The life a character lived before adventuring." },
  { title: "Feats", href: "feats.html", count: "feats", text: "Special talents every class gains as it levels up." },
  { title: "Spells", href: "spells.html", count: "spells", text: "Every spell, by class or magic source, with its +1 to +10 Ranks." },
  { title: "Crafting", href: "crafting.html", count: "recipes", text: "Recipes for every trade skill: ingredients, tools and checks." },
  { title: "Items", href: "items.html", count: "items", text: "Weapons, armor, consumables, materials and magic items." },
  { title: "Combat", href: "glossary.html?s=combat", text: "Combat rules, and weapon and combat actions." },
  { title: "Glossary", href: "glossary.html", count: "entries", text: "Every rules term in one searchable list, conditions included." },
];

export function Home() {
  const counts = useCounts();
  return (
    <div className="wrap condwrap homewrap">
      <header className="intro">
        <Logo />
        <h1>Crawl 1st Edition</h1>
        <p>Welcome, adventurer. Everything you need to play Crawl is here: make a character, read up on classes, races, backgrounds and feats, and look up spells, items, crafting and the rules.</p>
      </header>
      <main className="hgrid">
        {CARDS.map(c => (
          <a key={c.title} className={c.main ? "hcard hmain" : "hcard"} href={siteHref(c.href)}>
            <span className="hct">{c.title}</span>
            {c.count && counts[c.count] != null && <span className="hcount">{counts[c.count]}</span>}
            <span className="hcd">{c.text}</span>
          </a>
        ))}
      </main>
    </div>
  );
}
