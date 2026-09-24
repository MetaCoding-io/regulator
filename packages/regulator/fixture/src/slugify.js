import { leftPad } from "../vendor/left-pad.js";

/**
 * Turn free text into a URL slug.
 *
 * Known defect (see README): repeated separators are not collapsed and
 * leading/trailing dashes are not trimmed.
 */
export function slugify(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, (match) => "-".repeat(match.length));
}

/** Zero-padded numeric slug suffix, e.g. `slugSuffix(7, 3)` → `"007"`. */
export function slugSuffix(n, width) {
  return leftPad(String(n), width, "0");
}
