/* Tiny DOM helpers shared by every page (the old prelude in tools/build.py). */

/** The element with this id. Pages only ask for ids they know exist. */
export const $ = <T extends HTMLElement = HTMLElement>(id: string): T => document.getElementById(id) as T;

/** Escape text for use inside HTML or a quoted attribute. */
export const esc = (s: unknown): string =>
  String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
