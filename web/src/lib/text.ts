/* Small text helpers with no DOM, shared by lib/ and ui/. */

/** Escape text for use inside HTML or a quoted attribute. */
export const esc = (s: unknown): string =>
  String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
