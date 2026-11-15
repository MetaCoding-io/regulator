import { slugify } from "./slugify.js";

/** The calendar date of `date` in the process's local time zone, as zero-padded `[year, month, day]`. */
function localDate(date) {
  return [String(date.getFullYear()), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")];
}

/**
 * A slug with its date appended, e.g. `datedSlug("Release notes", date)` → `"release-notes-20260301"`.
 * The date is the local calendar date, so the same instant can carry a different suffix in another time zone.
 */
export function datedSlug(text, date) {
  return `${slugify(text)}-${localDate(date).join("")}`;
}
