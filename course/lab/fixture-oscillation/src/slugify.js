import { leftPad } from "../vendor/left-pad.js";

/** Turn free text into a URL slug: lowercase, non-alphanumerics to single dashes, trimmed. */
export function slugify(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Zero-padded numeric slug suffix, e.g. `slugSuffix(7, 3)` → `"007"`. */
export function slugSuffix(n, width) {
  return leftPad(String(n), width, "0");
}
