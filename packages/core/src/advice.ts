/**
 * Advice as a file set (the accept-path split, #110). A profile's advice —
 * what a unit of that profile is told and no gate can enforce — is one
 * Markdown file per profile, `advice/<profile>.md` in the definition and
 * `regulator/advice/<profile>.md` in the instance, seeded like identity and
 * written only by `advice accept`. What can be checked mechanically is: a
 * file per declared profile, no file for an undeclared one, no profile that
 * carries the text twice (inline and in a file), and the rendering's size
 * against the budget policy's `advice.maxChars`, with the same cut-and-warn
 * path the identity's `identity.maxChars` takes.
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

/** The advice file of a profile, under the class's seed or instance directory. */
export function adviceFileName(profile: string): string {
  return `${profile}.md`;
}

/** The profile an advice file name belongs to, or undefined when the name is not `<profile>.md`. */
export function profileOfAdviceFile(file: string): string | undefined {
  const m = /^([a-z][a-z0-9-]*)\.md$/.exec(file);
  return m?.[1];
}

export interface AdviceProblem {
  /** The definition file the problem is about, as `checkDefinition` reports it. */
  file: string;
  message: string;
}

export interface AdviceSet {
  dir: string;
  /** The text of each advice file read, by profile name. */
  files: Record<string, string>;
  problems: AdviceProblem[];
}

/** A declared profile, as the set is checked against: its name, and whether it still carries advice inline (one release of overlap). */
export interface DeclaredProfile {
  name: string;
  inline: boolean;
}

/**
 * Read an advice directory against the declared profiles. A file for no profile, a profile with both inline advice and a
 * file, and a profile with neither are problems, not exceptions; a profile may have an empty file.
 */
export async function readAdviceSet(dir: string, profiles: readonly DeclaredProfile[]): Promise<AdviceSet> {
  const set: AdviceSet = { dir, files: {}, problems: [] };
  let entries: string[];
  try {
    entries = (await readdir(dir)).sort();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    entries = [];
  }
  const declared = new Map(profiles.map((p) => [p.name, p]));
  const seen = new Set<string>();
  for (const entry of entries) {
    const profile = profileOfAdviceFile(entry);
    if (!profile || !declared.has(profile)) {
      set.problems.push({ file: `advice/${entry}`, message: `names no declared profile (declared: ${[...declared.keys()].join(", ") || "none"}); an advice file is \`<profile>.md\` for a profile under profiles/` });
      continue;
    }
    seen.add(profile);
    set.files[profile] = await readFile(path.join(dir, entry), "utf8");
    if (declared.get(profile)!.inline) set.problems.push({ file: `profiles/${profile}.json`, message: `carries advice inline and advice/${adviceFileName(profile)} exists: move the text into the file, do not carry two copies` });
  }
  for (const p of profiles) {
    if (!seen.has(p.name) && !p.inline) set.problems.push({ file: `advice/${adviceFileName(p.name)}`, message: `is missing: profile "${p.name}" declares no advice; every profile has an advice file (an empty one says the profile is told nothing beyond its grant)` });
  }
  return set;
}

/**
 * The characters of advice a unit's prompt carries before the rendering is cut, when the budget policy declares no
 * `advice.maxChars`. Room for the longest shipped advice file four times over.
 */
export const ADVICE_CONTEXT_MAX_CHARS = 4000;

/** The limit that applies under a budget policy: its `advice.maxChars`, or the default. */
export function adviceMaxChars(policy?: { advice?: { maxChars?: number } } | undefined): number {
  return policy?.advice?.maxChars ?? ADVICE_CONTEXT_MAX_CHARS;
}

export interface AdviceContextBudget {
  profile: string;
  /** What the advice file renders to. */
  chars: number;
  /** What a unit's prompt carries. */
  max: number;
  truncated: boolean;
  /** What `check`, `doctor` and the session say when the advice is cut. */
  warning?: string;
}

/** A profile's advice against its context budget: past the cap, part of the advice is text the model never sees, and this makes the cut visible. */
export function adviceContextBudget(profile: string, advice: string, maxChars: number = ADVICE_CONTEXT_MAX_CHARS): AdviceContextBudget {
  const chars = advice.trim().length;
  if (chars <= maxChars) return { profile, chars, max: maxChars, truncated: false };
  return { profile, chars, max: maxChars, truncated: true, warning: `the advice for profile "${profile}" renders to ${chars} characters and a unit's prompt carries ${maxChars}: ${chars - maxChars} character(s) of ${adviceFileName(profile)} are advice the model never sees. Shorten the file, or raise \`advice.maxChars\` in the budget policy; the file is authoritative either way.` };
}

/** The advice as the model sees it: the file's text, cut at the limit with a marker that says the file is authoritative. */
export function renderAdvice(advice: string, maxChars: number = ADVICE_CONTEXT_MAX_CHARS): string {
  const text = advice.trim();
  return text.length <= maxChars ? text : `${text.slice(0, maxChars)}\n[advice truncated at ${maxChars} characters; the file is authoritative]`;
}
