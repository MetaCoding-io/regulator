/**
 * Identity as a mechanism (lesson 12). The identity set is four Markdown
 * files — what the system is, what it must never change about itself, what
 * its words mean, where its boundaries are — committed, write-protected, and
 * rendered into every unit's context from the files, never from a context
 * window. What can be checked mechanically is: the set is complete, the
 * invariant ids are well-formed and unique, and a contract's authority
 * references resolve to something that exists.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";

export const IDENTITY_FILES = ["IDENTITY.md", "INVARIANTS.md", "GLOSSARY.md", "BOUNDARIES.md"] as const;
export type IdentityFile = (typeof IDENTITY_FILES)[number];

export interface Invariant {
  id: string;
  title: string;
  /** The paragraph(s) under the heading, trimmed. */
  text: string;
}

/** A word the glossary refuses, and the word it says instead (lesson 15). */
export interface ForbiddenTerm {
  term: string;
  say: string;
}

const FORBIDDEN_HEADING = /^##\s+Words this instance does not use\s*$/m;
const FORBIDDEN_LINE = /^-\s+(.+?)\s+\(say\s+([^)]+)\)\s*$/;

/** The glossary's `## Words this instance does not use` section: `- task, job (say unit)` lines. Absent section, no terms. */
export function parseForbiddenTerms(markdown: string): ForbiddenTerm[] {
  const start = markdown.search(FORBIDDEN_HEADING);
  if (start < 0) return [];
  const rest = markdown.slice(start).split("\n").slice(1);
  const out: ForbiddenTerm[] = [];
  for (const line of rest) {
    if (/^##\s/.test(line)) break;
    const m = FORBIDDEN_LINE.exec(line.trim());
    if (!m) continue;
    for (const term of m[1]!.split(",").map((t) => t.trim()).filter(Boolean)) out.push({ term, say: m[2]!.trim() });
  }
  return out;
}

export interface IdentitySet {
  dir: string;
  files: Partial<Record<IdentityFile, string>>;
  invariants: Invariant[];
  /** Words the glossary refuses (lesson 15), for the `glossary-lint` host check. */
  forbidden: ForbiddenTerm[];
  problems: string[];
}

const HEADING = /^##\s+(INV-\d{3})\s+[—-]\s+(.+?)\s*$/;

/** Every `## INV-nnn — title` section of an invariants file. */
export function parseInvariants(markdown: string): Invariant[] {
  const invariants: Invariant[] = [];
  let current: Invariant | undefined;
  for (const line of markdown.split("\n")) {
    const m = HEADING.exec(line);
    if (m) {
      current = { id: m[1]!, title: m[2]!, text: "" };
      invariants.push(current);
    } else if (current && !line.startsWith("#")) {
      current.text = `${current.text}${current.text ? "\n" : ""}${line}`;
    } else if (line.startsWith("#")) {
      current = undefined;
    }
  }
  for (const inv of invariants) inv.text = inv.text.trim();
  return invariants;
}

/** Read an identity directory. Missing files and malformed invariants are problems, not exceptions. */
export async function readIdentity(dir: string): Promise<IdentitySet> {
  const set: IdentitySet = { dir, files: {}, invariants: [], forbidden: [], problems: [] };
  for (const name of IDENTITY_FILES) {
    try {
      set.files[name] = await readFile(path.join(dir, name), "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      set.problems.push(`${name} is missing from the identity set`);
    }
  }
  const invariants = set.files["INVARIANTS.md"];
  if (invariants !== undefined) {
    set.invariants = parseInvariants(invariants);
    if (!set.invariants.length) set.problems.push("INVARIANTS.md declares no invariant (a `## INV-nnn — title` heading)");
    const seen = new Set<string>();
    for (const inv of set.invariants) {
      if (seen.has(inv.id)) set.problems.push(`INVARIANTS.md declares ${inv.id} twice`);
      seen.add(inv.id);
      if (!inv.text) set.problems.push(`${inv.id} has a heading and no statement`);
    }
  }
  const glossary = set.files["GLOSSARY.md"];
  if (glossary !== undefined) set.forbidden = parseForbiddenTerms(glossary);
  return set;
}

/**
 * The identity as the model sees it: a system-prompt section rebuilt from the
 * files on every run. Compaction cannot lose it and a model version cannot
 * reinterpret it, because it never lived in the transcript.
 */
export function renderIdentitySection(identity: IdentitySet, options: { maxChars?: number } = {}): string {
  const max = options.maxChars ?? 6000;
  const parts: string[] = ["This instance's identity (S5). It is committed, write-protected, and rebuilt from the files each run; you may propose a change to it (propose_policy_change) and never make one."];
  const order: IdentityFile[] = ["IDENTITY.md", "INVARIANTS.md", "BOUNDARIES.md", "GLOSSARY.md"];
  for (const name of order) {
    const text = identity.files[name];
    if (text === undefined) continue;
    parts.push(`--- ${name} ---`, text.trim());
  }
  const rendered = parts.join("\n\n");
  return rendered.length <= max ? rendered : `${rendered.slice(0, max)}\n[identity truncated at ${max} characters; the files are authoritative]`;
}

/** Authority references a fixed decision may cite, and how each is resolved. */
export interface AuthorityContext {
  /** Invariant ids the identity declares. */
  invariants: readonly string[];
  /** Regulator ids the registry declares. */
  regulators: readonly string[];
  /** Obligation ids the instance holds, when known; `undefined` accepts any obligation reference by form. */
  obligations?: readonly string[];
}

export interface AuthorityProblem {
  path: string;
  message: string;
}

const FORMS = "an invariant (INV-nnn), a regulator (reg.…), a person (human:<name>) or an obligation (obligation:<id>)";

/**
 * Every fixed decision cites the authority that fixed it, and the citation
 * must resolve: an invariant the identity declares, a regulator the registry
 * declares, a named person, or an obligation. Free text is not an authority.
 */
export function checkAuthorityRefs(fixed: ReadonlyArray<{ id: string; authorityRef: string }>, context: AuthorityContext): AuthorityProblem[] {
  const problems: AuthorityProblem[] = [];
  fixed.forEach((d, i) => {
    const ref = d.authorityRef.trim();
    const where = `fixed[${i}].authorityRef`;
    if (/^INV-\d{3}$/.test(ref)) {
      if (!context.invariants.includes(ref)) problems.push({ path: where, message: `"${d.id}" cites ${ref}, which the identity does not declare (it declares ${context.invariants.join(", ") || "none"})` });
    } else if (/^reg\./.test(ref)) {
      if (!context.regulators.includes(ref)) problems.push({ path: where, message: `"${d.id}" cites ${ref}, which the registry does not declare` });
    } else if (/^human:\S/.test(ref)) {
      // A named person is an authority; whether they had it is lesson 13's.
    } else if (/^obligation:\S/.test(ref)) {
      const id = ref.slice("obligation:".length);
      if (context.obligations && !context.obligations.some((o) => o === id || o.startsWith(id))) problems.push({ path: where, message: `"${d.id}" cites obligation ${id}, which the instance does not hold` });
    } else {
      problems.push({ path: where, message: `"${d.id}" cites "${ref}", which is free text; an authority is ${FORMS}` });
    }
  });
  return problems;
}
