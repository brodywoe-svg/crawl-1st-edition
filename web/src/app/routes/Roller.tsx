/* Prototype: the dice roller (dev/testing/dice-rolling.md). Type a roll or tap a quick one; results are listed with
   every die shown. With a character open on the play sheet, rolls also go in that character's log. */
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { useCharacter } from "../store/character";
import { rollDice, useRolls } from "../play/rolls";

const QUICK: [string, string][] = [["d4", "d4"], ["d6", "d6"], ["d8", "d8"], ["d10", "d10"], ["d12", "d12"], ["d20", "d20"], ["d%", "d100"]];
const PRESETS: [string, string][] = [["2d20kh1", "Advantage"], ["2d20kl1", "Disadvantage"], ["4d6kh3", "Ability score"], ["1d6!", "Exploding d6"]];

export function Roller() {
  const { history, last, error, clear } = useRolls();
  const { char, derived, init } = useCharacter();
  const [expr, setExpr] = useState("");
  useEffect(() => { init() }, [init]);
  const go = (e: string, label = "") => { if (rollDice(e, label)) setExpr("") };

  return (
    <div className="wrap playwrap">
      <section className="pcard">
        <p className="ptag">Prototype · Testing</p>
        <h1>Dice roller</h1>
        <p className="pmuted">Type a roll such as <code>2d6 + 3</code>, <code>4d6kh3</code> (keep highest 3) or <code>1d6!</code> (exploding), or tap one below.
          {char ? <> Rolls go in <b>{derived?.name}</b>'s log on the <Link to="/testing/sheet">play sheet</Link>.</> : <> Open a character on the <Link to="/testing/sheet">play sheet</Link> to keep rolls in its log.</>}</p>
        <form className="prow" onSubmit={e => { e.preventDefault(); go(expr) }}>
          <input className="pin grow" value={expr} onChange={e => setExpr(e.target.value)} placeholder="e.g. 2d6 + 3" aria-label="Roll" autoComplete="off" />
          <button type="submit" className="pbtn solid">Roll</button>
        </form>
        {error && <p className="pwarn" role="alert">{error}</p>}
        <div className="prow">
          {QUICK.map(([e, l]) => <button key={e} type="button" className="pbtn" onClick={() => go(e)}>{l}</button>)}
          {derived?.die && <button type="button" className="pbtn solid" onClick={() => go(derived.die!, "Action Die")}>Action Die ({derived.die})</button>}
        </div>
        <div className="prow">
          {PRESETS.map(([e, l]) => <button key={e} type="button" className="pbtn" onClick={() => go(e, l)}>{l} <small>{e}</small></button>)}
        </div>
      </section>

      {last && (
        <section className="pcard presult" aria-live="polite">
          <p className="pmuted">{last.label || last.roll.expr}</p>
          <p className="pbig">{last.roll.total}</p>
          <div className="pdice">
            {last.roll.parts.map((p, i) => "num" in p
              ? <span key={i} className="pmod">{i ? p.op : ""}{p.num}</span>
              : <span key={i} className="pgroup">{i ? <em>{p.op}</em> : null}{p.rolls.map((d, j) => <span key={j} className={"pdie" + (d.drop ? " drop" : "") + (d.v === p.sides ? " max" : d.v === 1 ? " min" : "")} title={d.extra ? "exploded" : ""}>{d.v}</span>)}</span>)}
          </div>
        </section>
      )}

      <section className="pcard">
        <h2>History {history.length > 0 && <button type="button" className="pbtn small" onClick={clear}>Clear</button>}</h2>
        {!history.length && <p className="pmuted">Rolls you make on this visit are listed here.</p>}
        <ol className="plog">
          {history.map(h => <li key={h.id}><time>{new Date(h.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</time>{h.label && <b>{h.label}: </b>}{h.text}</li>)}
        </ol>
        <p className="pmuted psmall">Compare with the <a href="/testing/dice.html">3D dice prototype</a>.</p>
      </section>
    </div>
  );
}
