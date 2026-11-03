/* Tiny DOM helpers shared by every page (the old prelude in tools/build.py). */
export { esc } from "../lib/text";

/** The element with this id. Pages only ask for ids they know exist. */
export const $ = <T extends HTMLElement = HTMLElement>(id: string): T => document.getElementById(id) as T;
