/* Load the typed content once per page: fetch the files the app needs and adapt them (adapt.ts). No DOM code here. */
import { loadJson } from "../data";
import { adapt } from "./adapt";
import type { Content } from "./types";

let cached: Promise<Content> | null = null;

export function loadContent(): Promise<Content> {
  cached ||= Promise.all([loadJson("crawl-classes.json"), loadJson("crawl-items.json"), loadJson("crawl-glossary.json")])
    .then(([classes, items, glossary]) => adapt({ classes, items, glossary }));
  return cached;
}
