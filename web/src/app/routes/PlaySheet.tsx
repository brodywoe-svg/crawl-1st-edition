/* Prototype: the play sheet (dev/testing/play-sheet.md). A character during a session: HP, the Action Pool, conditions,
   rolls, actions, spells, gear and money, with a log and undo. Every change is an event (lib/character/apply.ts). */
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { overflowOf, EXPLORE_AP } from "../../lib/character/apply";
import { toCopper } from "../../lib/content/adapt";
import { diceIn } from "../../lib/dice";
import type { Pool } from "../../lib/character/types";
import { useCharacter } from "../store/character";
import { eventText, money, warningText } from "../play/words";
import { d20, rollDice, sign, useRolls } from "../play/rolls";

const num = (v: string, d = 0) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : d };

export function PlaySheet() {
  const { char, init } = useCharacter();
  const [params] = useSearchParams();
  useEffect(() => {
    init();
    const s = useCharacter.getState();
    if (params.get("sample")) s.openSample(); else if (params.get("c")) s.open(params.get("c")!);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return <div className="wrap playwrap">{char ? <Sheet /> : <Picker />}</div>;
}

/* ---------------------------------------------------------------- choosing a character */
function Picker() {
  const { list, open, openSample } = useCharacter();
  return (
    <section className="pcard">
      <p className="ptag">Prototype · Testing</p>
      <h1>Play sheet</h1>
      <p className="pmuted">Track a character during a session: HP, the Action Pool, conditions, rolls and gear. Pick a character made in the <a href="/creator.html">Character Creator</a> in this browser (or saved to your account), or try the sample.</p>
      <div className="plist">
        {list.map(c => (
          <button key={c.id} type="button" className="pbtn wide" onClick={() => open(c.id)}>
            <b>{String(c.name || c.snap?.name || "Unnamed character")}</b><small>{[c.snap?.race, c.snap?.cls].filter(Boolean).join(" · ")}</small>
          </button>
        ))}
        {!list.length && <p className="pmuted">No finished characters in this browser yet.</p>}
        <button type="button" className="pbtn wide solid" onClick={openSample}><b>Try the sample character</b><small>Changes to it aren't saved</small></button>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- the sheet */
function Sheet() {
  const { char, derived: d, sample, warnings, close, content } = useCharacter();
  if (!char || !d) return null;
  const s = char.state;
  return (
    <>
      <header className="phead">
        <div>
          <h1>{d.name}</h1>
          <p className="pmuted">Level {d.level}{d.race && ` · ${d.race}`}{d.cls && ` · ${d.cls}`}{d.bg && ` · ${d.bg}`}</p>
        </div>
        <div className="prow">
          <ModeSwitch />
          <Link className="pbtn" to="/testing/roll">Dice roller</Link>
          <Link className="pbtn" to="/" onClick={close}>All characters</Link>
        </div>
      </header>
      {sample && <p className="pnote">This is the sample character. Changes aren't saved.</p>}
      {!content && <p className="pnote">Loading the rules…</p>}
      {warnings.length > 0 && (
        <div className={"pwarn" + (warnings.some(w => w.w === "death") ? " dire" : "")} role="alert">
          {warnings.map((w, i) => <p key={i}>{warningText(w)}</p>)}
        </div>
      )}
      <div className="pgrid">
        <Hp />
        <ActionPool />
      </div>
      <Conditions />
      <div className="pgrid">
        <Abilities />
        <Skills />
      </div>
      <Attacks />
      <Actions />
      {d.spells.length > 0 && <Spells />}
      <div className="pgrid">
        <Gear />
        <Purse />
      </div>
      <Adjust />
      <Log />
      {s.notes !== undefined && <Notes />}
    </>
  );
}

function ModeSwitch() {
  const { char, dispatch } = useCharacter(), mode = char!.state.mode;
  return (
    <div className="pseg" role="group" aria-label="Exploration or combat">
      <button type="button" aria-pressed={mode === "explore"} onClick={() => mode !== "explore" && dispatch({ t: "combatEnd" })}>Exploration</button>
      <button type="button" aria-pressed={mode === "combat"} onClick={() => mode !== "combat" && dispatch({ t: "combatStart" })}>Combat</button>
    </div>
  );
}

/* ---------------------------------------------------------------- hit points */
function Hp() {
  const { char, derived: d, dispatch } = useCharacter(), s = char!.state;
  const [amt, setAmt] = useState("");
  const n = num(amt), max = d!.maxHp;
  const go = (t: "damage" | "heal" | "tempHp") => { if (n > 0) { dispatch({ t, n }); setAmt("") } };
  return (
    <section className="pcard">
      <h2>Hit points</h2>
      <p className="pbig">{s.hp}<small> / {max ?? "?"}</small>{s.tempHp > 0 && <span className="ptemp">+{s.tempHp} temp</span>}</p>
      {max != null && <div className="pbar" aria-hidden="true"><i style={{ width: `${Math.min(100, (s.hp / Math.max(1, max)) * 100)}%` }} /></div>}
      <div className="prow">
        <input className="pin" inputMode="numeric" placeholder="Amount" aria-label="Amount" value={amt} onChange={e => setAmt(e.target.value.replace(/\D/g, ""))} onKeyDown={e => e.key === "Enter" && go("damage")} />
        <button type="button" className="pbtn solid" onClick={() => go("damage")}>Damage</button>
        <button type="button" className="pbtn" onClick={() => go("heal")}>Heal</button>
        <button type="button" className="pbtn" onClick={() => go("tempHp")}>Temp HP</button>
      </div>
      {d!.ac != null && <p className="pmuted">AC {d!.ac}{d!.speed && ` · Speed ${d!.speed}`}{d!.init != null && <> · <button type="button" className="plink" onClick={() => rollDice(d20(d!.init!), "Initiative")}>Initiative {sign(d!.init)}</button></>}</p>}
    </section>
  );
}

/* ---------------------------------------------------------------- the Action Pool */
function ActionPool() {
  const { char, derived: d, dispatch } = useCharacter(), s = char!.state, max = d!.maxPool;
  const [amt, setAmt] = useState("1");
  const [bonus, setBonus] = useState({ ap: "0", mp: "0" });
  const [choose, setChoose] = useState<null | { roll: number; gain: Pool; keepAp: number }>(null);
  const n = Math.max(1, num(amt, 1));

  function startTurn() {
    if (!d!.die) return;
    const r = rollDice(d!.die, "Action Die"); if (!r) return;
    const gain = { ap: r.total + num(bonus.ap), mp: num(bonus.mp), ep: 0 };
    const extra = overflowOf({ ...s, pool: { ...s.pool, ap: 0 } }, gain, max);
    const b = { ap: num(bonus.ap), mp: num(bonus.mp) };
    // a choice only matters when both AP and MP are coming in and they don't all fit
    if (extra > 0 && gain.ap > 0 && gain.mp > 0) setChoose({ roll: r.total, gain, keepAp: Math.max(0, gain.ap - extra) });
    else dispatch({ t: "turnStart", roll: r.total, bonus: b });
  }
  function confirm() {
    if (!choose) return;
    const room = choose.gain.ap + choose.gain.mp - overflowOf({ ...s, pool: { ...s.pool, ap: 0 } }, choose.gain, max);
    dispatch({ t: "turnStart", roll: choose.roll, bonus: { ap: num(bonus.ap), mp: num(bonus.mp) }, keep: { ap: choose.keepAp, mp: Math.max(0, room - choose.keepAp) } });
    setChoose(null);
  }

  const slots = max ?? s.pool.ap + s.pool.mp + s.pool.ep;
  const kinds = [...Array(s.pool.ap).fill("ap"), ...Array(s.pool.mp).fill("mp"), ...Array(s.pool.ep).fill("ep")];
  return (
    <section className="pcard">
      <h2>Action Pool{max != null && <small> · Max {max}</small>}{d!.die && <small> · Action Die {d!.die}</small>}</h2>
      <div className="pslots" role="img" aria-label={`${s.pool.ap} AP, ${s.pool.mp} MP, ${s.pool.ep} EP${max != null ? ` of ${max}` : ""}`}>
        {Array.from({ length: Math.max(slots, 1) }, (_, i) => <span key={i} className={"pslot " + (kinds[i] || "")} />)}
      </div>
      <p className="pcounts"><b className="ap">{s.mode === "explore" ? `${EXPLORE_AP} AP (steady)` : `${s.pool.ap} AP`}</b> <b className="mp">{s.pool.mp} MP</b> <b className="ep">{s.pool.ep} EP</b>{s.mode === "combat" && <span className="pmuted"> · Turn {s.turn}</span>}</p>
      {max == null && <p className="pnote">No Max Pool for this class yet. Set one under Adjust.</p>}

      {s.mode === "combat" && !choose && (
        <div className="prow">
          <button type="button" className="pbtn solid" disabled={!d!.die} onClick={startTurn}>Start turn{d!.die ? ` (roll ${d!.die})` : ""}</button>
          <label className="psmall">Bonus AP <input className="pin tiny" inputMode="numeric" value={bonus.ap} onChange={e => setBonus({ ...bonus, ap: e.target.value.replace(/\D/g, "") })} /></label>
          <label className="psmall">Bonus MP <input className="pin tiny" inputMode="numeric" value={bonus.mp} onChange={e => setBonus({ ...bonus, mp: e.target.value.replace(/\D/g, "") })} /></label>
        </div>
      )}
      {choose && (
        <div className="pchoose">
          <p>You rolled {choose.roll}. Not everything fits: choose how many of the new AP to keep (the rest of the room goes to MP).</p>
          <div className="prow">
            <button type="button" className="pbtn" onClick={() => setChoose({ ...choose, keepAp: Math.max(0, choose.keepAp - 1) })}>−</button>
            <b>{choose.keepAp} AP</b>
            <button type="button" className="pbtn" onClick={() => setChoose({ ...choose, keepAp: Math.min(choose.gain.ap, choose.keepAp + 1) })}>+</button>
            <button type="button" className="pbtn solid" onClick={confirm}>Keep</button>
          </div>
        </div>
      )}
      <div className="prow">
        <input className="pin tiny" inputMode="numeric" aria-label="Points" value={amt} onChange={e => setAmt(e.target.value.replace(/\D/g, ""))} />
        <button type="button" className="pbtn" onClick={() => dispatch({ t: "spend", ap: n })}>Spend AP</button>
        <button type="button" className="pbtn" onClick={() => dispatch({ t: "spend", mp: n })}>Spend MP</button>
        <button type="button" className="pbtn" onClick={() => dispatch({ t: "gain", mp: n })}>+ MP</button>
        <button type="button" className="pbtn" onClick={() => dispatch({ t: "gain", ep: n })}>+ EP</button>
        {s.mode === "combat" && <button type="button" className="pbtn" onClick={() => dispatch({ t: "gain", ap: n })}>+ AP</button>}
      </div>
      <Rest />
    </section>
  );
}

function Rest() {
  const { dispatch } = useCharacter();
  const [h, setH] = useState("8");
  return (
    <div className="prow">
      <label className="psmall">Rest for <input className="pin tiny" inputMode="numeric" value={h} onChange={e => setH(e.target.value.replace(/\D/g, ""))} /> hours</label>
      <button type="button" className="pbtn" onClick={() => num(h) > 0 && dispatch({ t: "rest", hours: num(h) })}>Rest</button>
      <span className="pmuted psmall">Removes 1 EP per 2 hours</span>
    </div>
  );
}

/* ---------------------------------------------------------------- conditions */
function Conditions() {
  const { char, content, dispatch } = useCharacter(), conds = char!.state.conds;
  const all = content ? [...content.conditions.values()] : [];
  const name = (id: string) => content?.conditions.get(id)?.n || id;
  return (
    <section className="pcard">
      <h2>Conditions</h2>
      <div className="prow">
        {conds.map(id => (
          <span key={id} className="pchip" title={content?.conditions.get(id)?.text || ""}>{name(id)}
            <button type="button" aria-label={`Remove ${name(id)}`} onClick={() => dispatch({ t: "cond", remove: id })}>×</button>
          </span>
        ))}
        {!conds.length && <span className="pmuted">None</span>}
        <select className="pin" aria-label="Add a condition" value="" onChange={e => e.target.value && dispatch({ t: "cond", add: e.target.value })}>
          <option value="">Add a condition…</option>
          {all.filter(c => !conds.includes(c.id)).map(c => <option key={c.id} value={c.id}>{c.n}</option>)}
        </select>
      </div>
      {conds.map(id => content?.conditions.get(id)).filter(Boolean).map(c => <details key={c!.id} className="pdetails"><summary>{c!.n}</summary><p>{c!.text}</p></details>)}
    </section>
  );
}

/* ---------------------------------------------------------------- abilities, saves, skills */
function Abilities() {
  const d = useCharacter().derived!, abil = Object.entries(d.abil);
  return (
    <section className="pcard">
      <h2>Abilities <small>tap to roll</small></h2>
      {!abil.length && <p className="pmuted">No ability scores saved with this character. Open it in the Character Creator once to fill them in.</p>}
      <div className="pabil">
        {abil.map(([k, a]) => (
          <div key={k} className="pab">
            <button type="button" onClick={() => rollDice(d20(a.mod), `${a.n} check`)}><small>{k.toUpperCase()}</small><b>{sign(a.mod)}</b><span>{a.score}</span></button>
            <button type="button" className={"psave" + (a.saveProf ? " prof" : "")} onClick={() => rollDice(d20(a.save), `${a.n} save`)}>Save {sign(a.save)}</button>
          </div>
        ))}
      </div>
    </section>
  );
}

function Skills() {
  const d = useCharacter().derived!;
  return (
    <section className="pcard">
      <h2>Skills <small>tap to roll</small></h2>
      <div className="pskills">
        {d.skills.map(k => (
          <button key={k.n} type="button" className={k.prof ? "prof" : ""} onClick={() => rollDice(d20(k.total), k.n)}><span>{k.n}</span><b>{sign(k.total)}</b></button>
        ))}
        {!d.skills.length && <p className="pmuted">No skills saved with this character.</p>}
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- weapons, actions, spells */
function Attacks() {
  const d = useCharacter().derived!;
  if (!d.weapons.length) return null;
  return (
    <section className="pcard">
      <h2>Weapons</h2>
      {d.weapons.map((w, i) => {
        const dmg = diceIn(w.props);
        return (
          <div key={i} className="pline">
            <div><b>{w.n}</b><small className="pmuted">{w.props}</small></div>
            <div className="prow">
              <button type="button" className="pbtn" onClick={() => rollDice("d20", `${w.n} attack`)}>Attack d20</button>
              {dmg && <button type="button" className="pbtn" onClick={() => rollDice(dmg, `${w.n} damage`)}>Damage {dmg}</button>}
            </div>
          </div>
        );
      })}
      <p className="pmuted psmall">Attack bonuses aren't worked out yet: add your modifier yourself. (The full maths comes with the React Character Creator.)</p>
    </section>
  );
}

function Actions() {
  const { content, derived: d, dispatch } = useCharacter();
  const [all, setAll] = useState(false);
  const feats = useMemo(() => new Set(d!.feats.flatMap(f => [f.n, ...f.n.split(":")]).map(x => x.trim().toLowerCase())), [d]);
  if (!content) return null;
  const list = [...content.actions.values()].filter(a => a.sec !== "Item" && a.cost);
  const mine = list.filter(a => !a.requires.length || a.requires.some(r => feats.has(r.toLowerCase())));
  const shown = all ? list : mine;
  return (
    <section className="pcard">
      <h2>Actions <small>tap to spend</small></h2>
      {!shown.length && <p className="pmuted psmall">None of the actions with an AP cost are available to this character's features. Tick the box to see them all.</p>}
      <div className="pacts">
        {shown.map(a => (
          <button key={a.id} type="button" title={a.text} onClick={() => dispatch({ t: "spend", ap: a.cost!.ap || 0, for: "action" })}>
            <b>{a.n}</b><span className="ap">{a.cost!.extra ? "+" : ""}{a.cost!.ap} AP</span>
            {a.requires.length > 0 && <small>Needs {a.requires.join(", ")}</small>}
          </button>
        ))}
      </div>
      <label className="psmall"><input type="checkbox" checked={all} onChange={e => setAll(e.target.checked)} /> Show actions this character doesn't have ({list.length - mine.length} more)</label>
    </section>
  );
}

function Spells() {
  const { char, derived: d, dispatch } = useCharacter(), mode = char!.state.mode;
  return (
    <section className="pcard">
      <h2>Spells</h2>
      {char!.state.conc && <p className="pnote">Concentrating on {char!.state.conc} <button type="button" className="plink" onClick={() => dispatch({ t: "conc", spell: "" })}>Stop</button></p>}
      {d!.spells.map(sp => {
        const cost = parseInt((sp.cost.match(/(\d+)\s*MP/i) || [])[1] || "0", 10), dmg = diceIn(sp.dmg);
        const cast = () => {
          // In combat spells cost MP; in Exploration AP can pay instead (glossary: Action Points, Magic Points…)
          const w = dispatch(mode === "combat" ? { t: "spend", mp: cost, for: "spell" } : { t: "spend", ap: cost, for: "spell" });
          if (!w.some(x => x.w === "notEnough" || x.w === "wrongPoints" || x.w === "exploreLimit") && sp.conc) dispatch({ t: "conc", spell: sp.n });
        };
        return (
          <div key={sp.n} className="pline">
            <div><b>{sp.n}</b><small className="pmuted">{[sp.cost, sp.time, sp.range].filter(Boolean).join(" · ")}{sp.dc != null && ` · DC ${sp.dc}`}</small></div>
            <div className="prow">
              <button type="button" className="pbtn" onClick={cast}>Cast{cost ? ` (${cost} ${mode === "combat" ? "MP" : "AP"})` : ""}</button>
              {sp.atk != null && <button type="button" className="pbtn" onClick={() => rollDice(d20(sp.atk!), `${sp.n} attack`)}>Attack {sign(sp.atk)}</button>}
              {dmg && <button type="button" className="pbtn" onClick={() => rollDice(dmg, `${sp.n}`)}>Roll {dmg}</button>}
            </div>
          </div>
        );
      })}
    </section>
  );
}

/* ---------------------------------------------------------------- gear and money */
function Gear() {
  const { char, dispatch } = useCharacter(), inv = char!.state.inv;
  const [n, setN] = useState("");
  const add = () => { if (n.trim()) { dispatch({ t: "item", op: "add", n: n.trim() }); setN("") } };
  return (
    <section className="pcard">
      <h2>Gear</h2>
      {inv.map(i => (
        <div key={i.iid || i.n} className="pline tight">
          <span>{i.n}{i.slot && <small className="pmuted"> · {i.slot}</small>}</span>
          <div className="prow">
            <button type="button" className="pbtn small" aria-label={`One less ${i.n}`} onClick={() => dispatch({ t: "item", op: "qty", n: i.n, iid: i.iid, qty: i.qty - 1 })}>−</button>
            <b>{i.qty}</b>
            <button type="button" className="pbtn small" aria-label={`One more ${i.n}`} onClick={() => dispatch({ t: "item", op: "qty", n: i.n, iid: i.iid, qty: i.qty + 1 })}>+</button>
          </div>
        </div>
      ))}
      <div className="prow">
        <input className="pin" placeholder="Add an item" aria-label="Add an item" value={n} onChange={e => setN(e.target.value)} onKeyDown={e => e.key === "Enter" && add()} />
        <button type="button" className="pbtn" onClick={add}>Add</button>
      </div>
    </section>
  );
}

function Purse() {
  const { char, dispatch } = useCharacter(), s = char!.state;
  const [amt, setAmt] = useState(""), [xp, setXp] = useState("");
  // "5 (G)", "2 (S) 3 (C)", or a plain number of gold
  const cp = () => toCopper(amt) ?? (Number.isFinite(parseFloat(amt)) ? Math.round(parseFloat(amt) * 100) : null);
  const go = (dir: 1 | -1) => { const c = cp(); if (c) { dispatch({ t: "money", delta: dir * c }); setAmt("") } };
  return (
    <section className="pcard">
      <h2>Money and XP</h2>
      <p className="pbig sm">{money(s.money)}</p>
      <div className="prow">
        <input className="pin" placeholder="e.g. 5 (G) or 2 (S)" aria-label="Amount of money" value={amt} onChange={e => setAmt(e.target.value)} />
        <button type="button" className="pbtn" onClick={() => go(1)}>Gain</button>
        <button type="button" className="pbtn" onClick={() => go(-1)}>Spend</button>
      </div>
      <p className="pbig sm">{s.xp} XP</p>
      <div className="prow">
        <input className="pin tiny" inputMode="numeric" aria-label="XP" value={xp} onChange={e => setXp(e.target.value.replace(/[^\d-]/g, ""))} />
        <button type="button" className="pbtn" onClick={() => { if (num(xp)) { dispatch({ t: "xp", delta: num(xp) }); setXp("") } }}>Add XP</button>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- adjustments, the log, notes */
function Adjust() {
  const { derived: d, setOverride } = useCharacter();
  const SRC = { override: "set by you", sheet: "from the Creator's sheet", chart: "from the class chart", creator: "from the Creator", none: "unknown" };
  const row = (key: "maxHp" | "maxPool", label: string, v: number | null) => (
    <label className="pline tight">
      <span>{label} <small className="pmuted">({SRC[d!.source[key]]})</small></span>
      <span className="prow">
        <input className="pin tiny" inputMode="numeric" defaultValue={v ?? ""} key={v ?? "x"} aria-label={label}
          onBlur={e => { const n = parseInt(e.target.value, 10); if (Number.isFinite(n) && n !== v) setOverride(key, n) }} />
        {d!.source[key] === "override" && <button type="button" className="plink" onClick={() => setOverride(key, null)}>Clear</button>}
      </span>
    </label>
  );
  return (
    <details className="pcard">
      <summary><h2>Adjust</h2></summary>
      <p className="pmuted psmall">While the rules are still being written, you can correct numbers here. They're marked as set by you.</p>
      {row("maxHp", "Max HP", d!.maxHp)}
      {row("maxPool", "Max Pool", d!.maxPool)}
    </details>
  );
}

function Log() {
  const { char, content, undo } = useCharacter(), { history } = useRolls();
  const log = char!.log.slice(-25).reverse();
  const cond = (id: string) => content?.conditions.get(id)?.n || id;
  return (
    <section className="pcard">
      <h2>Log <button type="button" className="pbtn small" disabled={!char!.log.length} onClick={undo}>Undo</button></h2>
      {!log.length && <p className="pmuted">Nothing yet. Everything you do here is listed, newest first.</p>}
      <ol className="plog">
        {log.map((l, i) => <li key={char!.log.length - i}><time>{new Date(l.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time>{eventText(l.e, cond)}</li>)}
      </ol>
      {history[0] && <p className="pmuted psmall">Last roll: {history[0].text}. <Link to="/testing/roll">Dice roller</Link></p>}
    </section>
  );
}

function Notes() {
  const { char, dispatch } = useCharacter();
  return (
    <section className="pcard">
      <h2>Notes</h2>
      <textarea className="pin area" defaultValue={char!.state.notes} key={char!.id} aria-label="Notes"
        onBlur={e => e.target.value !== char!.state.notes && dispatch({ t: "notes", text: e.target.value })} />
    </section>
  );
}
