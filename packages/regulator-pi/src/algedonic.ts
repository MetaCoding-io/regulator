/**
 * Checkpoint 12 — algedonic channels and human interaction contracts (lesson 13).
 *
 * The session side of the algedonic path. A unit gets one typed way to
 * interrupt a person, `ask_human`, under an interaction contract:
 *
 *   recap          decisions offered for correction while reversible work
 *                  continues; nonblocking — no answer is fine, the obligation
 *                  stays open for correction
 *   choice         pick one; work waits
 *   clarification  an open question; work waits
 *   consent        authorization for an irreversible action; work waits, and
 *                  nothing but a yes is a yes
 *   uat            subjective acceptance; work waits
 *
 * With a person present (`ctx.hasUI`) the question is a dialog with the
 * policy's timeout for the kind. Without one — headless, the dispatcher's
 * sessions — or when the dialog times out or is cancelled, the request is
 * recorded, an obligation owed to a person is opened, and for every kind but
 * recap the unit is *paused*: the pause gate refuses every tool with an
 * effect until the session ends, the orchestrator records the attempt as
 * paused and holds the unit on the obligation, and a person answers with
 * `regulator answer`. Silence, cancellation and timeout are never consent,
 * and that is a gate, not a sentence in the tool's description.
 *
 * Attention is the scarcest budget: the policy caps blocking interrupts per
 * attempt, and the tool refuses past the cap. An answer given in a dialog is
 * recorded as the person's disposition of the obligation, on the spot.
 *
 * Load with checkpoints 2–11.
 */
import { randomUUID } from "node:crypto";
import path from "node:path";
import { Type } from "typebox";
import type { ExtensionAPI, ToolCallEventResult } from "@earendil-works/pi-coding-agent";
import { InteractionKindSchema, InteractionPolicySchema, ReportedEvidenceSchema, assertValid, type InteractionKind, type InteractionOutcome, type InteractionPolicy } from "@metacoding/vsm-pi-protocol";
import { ExecutionStore, ObligationLedger, TOOL_EFFECTS, continuesWithoutAnswer, dispositionForAnswer, isReadOnlyEffect, severityForKind } from "@metacoding/vsm-pi-core";
import type { Exec } from "@metacoding/regulator";
import { INTERACTION_POLICY_PATH } from "@metacoding/regulator";
import { leaseStoreFor } from "@metacoding/regulator";
import { baseRoot, headRevision } from "@metacoding/regulator";

export const PAUSED_ENTRY_TYPE = "regulator:paused";
export const INTERACTION_ENTRY_TYPE = "regulator:interaction";

export interface AlgedonicExtensionOptions {
  now?: () => number;
  /** The interaction policy; defaults to the definition's file (or REGULATOR_INTERACTION_POLICY). */
  policy?: InteractionPolicy;
  /** Who a dialog answer is recorded as. Defaults to the OS user. */
  person?: string;
}

export const AskHumanInputSchema = Type.Object({
  kind: InteractionKindSchema,
  subject: Type.String({ minLength: 1, maxLength: 120, description: "What the question is about" }),
  question: Type.String({ minLength: 1, maxLength: 1000, description: "The question, with what you would do under each answer" }),
  options: Type.Optional(Type.Array(Type.String({ minLength: 1, maxLength: 120 }), { minItems: 2, maxItems: 6, description: "For a choice: the options to pick from" })),
  action: Type.Optional(Type.String({ minLength: 1, maxLength: 300, description: "For consent: the irreversible action a yes authorizes, concretely" })),
  evidence: Type.Array(ReportedEvidenceSchema, { description: "What the person needs to decide: files, output, versions" }),
}, { additionalProperties: false });

export function createAlgedonicExtension(options: AlgedonicExtensionOptions = {}): (pi: ExtensionAPI) => void {
  const now = options.now ?? Date.now;

  return (pi) => {
    const exec: Exec = async (command, args, execOptions) => {
      const result = await pi.exec(command, args, execOptions?.cwd ? { cwd: execOptions.cwd } : {});
      return { stdout: result.stdout, stderr: result.stderr, code: result.code };
    };
    let base = "";
    let unitId = "";
    let attempt = 1;
    let policy: InteractionPolicy | undefined = options.policy;
    let ledger: ObligationLedger | undefined;
    let blockingAsked = 0;
    /** Set when a blocking question went unanswered: the unit is paused for the rest of the session. */
    let paused: { kind: InteractionKind; question: string; obligationId: string } | undefined;

    pi.on("session_start", async (_event, ctx) => {
      unitId = "";
      blockingAsked = 0;
      paused = undefined;
      ledger = undefined;
      if (!options.policy) {
        try {
          const file = process.env.REGULATOR_INTERACTION_POLICY ?? INTERACTION_POLICY_PATH;
          const value: unknown = JSON.parse(await (await import("node:fs/promises")).readFile(file, "utf8"));
          assertValid(InteractionPolicySchema, value, "interaction policy");
          policy = value;
        } catch (error) {
          policy = undefined;
          ctx.ui.notify(`regulator: interaction policy refused — ${(error as Error).message}; ask_human will pause on every question`, "warning");
        }
      }
      try {
        base = await baseRoot(exec, ctx.cwd);
        ledger = new ObligationLedger(base, now);
        for (const lease of await leaseStoreFor(base, now).list()) {
          if (path.resolve(lease.resource) === path.resolve(ctx.cwd)) unitId = lease.unitId;
        }
        attempt = unitId ? ((await new ExecutionStore(base, now).getUnit(unitId))?.attempts ?? 0) + 1 : 1;
      } catch {
        base = "";
      }
      ctx.ui.setStatus("algedonic", `algedonic: ${ctx.hasUI ? "a person is present" : "headless — questions pause"}; ${policy?.attention.blockingPerAttempt ?? 0} blocking interrupt(s) allowed`);
    });

    // The pause gate: once a blocking question went unanswered, nothing with an effect runs. Not the model's decision.
    pi.on("tool_call", (event): ToolCallEventResult | undefined => {
      if (!paused) return undefined;
      const effect = TOOL_EFFECTS[event.toolName];
      if (effect && isReadOnlyEffect(effect)) return undefined;
      if (event.toolName === "report_result") return undefined;
      return { block: true, reason: `regulator: the unit is paused — a ${paused.kind} question ("${paused.question.slice(0, 120)}") has no answer, and ${paused.kind === "consent" ? "silence is not consent" : "work waits for one"}. Nothing with an effect runs until a person answers (obligation ${paused.obligationId.slice(0, 8)}). Call report_result with what you have and stop.` };
    });

    // The pause is recorded where the session ends, so the record does not depend on the model calling anything.
    pi.on("agent_before_settle", (event) => {
      if (!paused) return undefined;
      return { entries: [...event.entries, { type: "custom_message", customType: PAUSED_ENTRY_TYPE, content: `paused: ${paused.kind} unanswered — ${paused.question}`, display: false, details: paused }], continue: false };
    });

    pi.registerTool({
      name: "ask_human",
      label: "Ask a person",
      description:
        "Interrupt a person under an interaction contract. kind=recap offers decisions for correction and does not wait; choice, clarification and uat wait for an answer; " +
        "consent asks authorization for an irreversible action and nothing but a yes is a yes. If no person is present, or no answer comes in time, the question is recorded as an " +
        "obligation owed to a person and the unit pauses: every tool with an effect is refused until someone answers. Attention is a budget: the policy caps how many blocking " +
        "questions an attempt may ask. Prefer a recap; ask consent only for what cannot be undone.",
      promptSnippet: "Ask a person under a contract: recap (no wait), choice / clarification / uat (wait), consent (wait; only a yes is a yes)",
      promptGuidelines: ["Before an irreversible, public, paid, destructive or account-level action, ask_human with kind=consent and do not proceed without a yes; for everything else prefer a recap."],
      parameters: AskHumanInputSchema,
      async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
        if (!base || !ledger) throw new Error("This session is not inside a repository the orchestrator knows; a question has nowhere to be recorded.");
        const kind = params.kind;
        const blocking = !continuesWithoutAnswer(kind);
        if (kind === "consent" && !params.action) throw new Error("consent needs `action`: say concretely what a yes authorizes.");
        if (kind === "choice" && !params.options) throw new Error("choice needs `options`.");
        const budget = policy?.attention.blockingPerAttempt ?? 0;
        if (blocking && blockingAsked >= budget) {
          throw new Error(`attention budget exhausted: this attempt may ask ${budget} blocking question(s) and has asked ${blockingAsked}. Record the decision as residual uncertainty in report_result, or offer it as a recap.`);
        }
        if (blocking) blockingAsked += 1;
        const timeoutMs = policy?.timeoutsMs[kind] ?? 0;
        const revision = await headRevision(exec, ctx.cwd).catch(() => undefined);
        const evidence = params.evidence.map((e) => ({ ...e, ...(revision ? { sourceRevision: revision } : {}) }));
        const channel = ctx.hasUI ? (ctx.mode === "rpc" ? "rpc" : "tui") : "none";
        const severity = severityForKind(kind);
        const subject = `${kind}: ${params.subject}`;

        // Open the obligation first: whatever the dialog does, the question is owed until answered.
        const obligation = await ledger.openObligation({
          subject, ...(unitId ? { unit: unitId } : {}), concern: "interaction", sources: [`ask:${randomUUID()}`], severity, consumer: "human", blocks: blocking, question: params.question, openedBy: "S1",
        });
        const request = {
          id: randomUUID(), kind, subject: params.subject, question: params.question, ...(params.options ? { options: params.options } : {}), ...(params.action ? { action: params.action } : {}),
          severity, ...(unitId ? { unit: unitId } : {}), attempt, obligationId: obligation.id, evidence, raisedBy: "S1" as const, raisedAt: new Date(now()).toISOString(), timeoutMs, channel: channel as "tui" | "rpc" | "none",
        };
        await ledger.requestInteraction(request, "S1");
        pi.appendEntry(INTERACTION_ENTRY_TYPE, { requestId: request.id, obligationId: obligation.id, kind, channel });

        // Ask, if anyone is there to ask.
        let outcome: InteractionOutcome = "unavailable";
        let answer: string | undefined;
        if (ctx.hasUI && (timeoutMs > 0 || !policy)) {
          const title = `${kind === "consent" ? "Consent" : kind === "uat" ? "Acceptance" : kind === "recap" ? "Recap" : "Question"} — ${params.subject}${unitId ? ` (unit ${unitId})` : ""}`;
          const body = `${params.question}${params.action ? `\n\nA yes authorizes: ${params.action}` : ""}${evidence.length ? `\n\nEvidence: ${evidence.map((e) => `${e.class} ${e.ref}`).join(", ")}` : ""}`;
          const opts = timeoutMs > 0 ? { timeout: timeoutMs } : {};
          try {
            if (kind === "consent") {
              const yes = await ctx.ui.confirm(title, body, opts);
              // confirm() returns false for no, cancel and timeout alike: a false is never distinguished into a yes.
              answer = yes ? "yes" : undefined;
              outcome = yes ? "answered" : "timed-out";
            } else if (kind === "choice") {
              const picked = await ctx.ui.select(`${title}\n${body}`, params.options ?? [], opts);
              answer = picked;
              outcome = picked === undefined ? "timed-out" : "answered";
            } else {
              const text = await ctx.ui.input(`${title}\n${body}`, kind === "uat" ? "accept / reject, with a note" : "your answer", opts);
              answer = text?.trim() ? text.trim() : undefined;
              outcome = answer === undefined ? "timed-out" : "answered";
            }
          } catch {
            outcome = "cancelled";
          }
        }
        const person = options.person ?? (await import("node:os")).userInfo().username;
        await ledger.answerInteraction({ requestId: request.id, outcome, ...(answer === undefined ? {} : { answer }), by: outcome === "answered" ? person : "S1", channel: outcome === "answered" ? (channel as "tui" | "rpc") : "none" });

        if (outcome === "answered" && answer !== undefined) {
          const disposition = dispositionForAnswer(kind, answer);
          await ledger.resolve(obligation.id, { by: person, disposition, rationale: `${kind} answered in the session: ${answer}` });
          ctx.ui.notify(`regulator: ${kind} answered by ${person} (${disposition})`, "info");
          const consented = kind === "consent" && disposition === "accepted";
          return {
            content: [{ type: "text", text: kind === "consent"
              ? (consented ? `Consent given by ${person}: "${answer}". The action is authorized: ${params.action}.` : `Consent refused by ${person}: "${answer}". Do not perform: ${params.action}. Continue without it or report and stop.`)
              : `${person} answered: ${answer}` }],
            details: { obligationId: obligation.id, disposition, answer },
          };
        }
        if (!blocking) {
          ctx.ui.notify(`regulator: recap recorded for a person (${obligation.id.slice(0, 8)}); work continues`, "info");
          return { content: [{ type: "text", text: `Recap recorded as obligation ${obligation.id.slice(0, 8)} for a person to correct later. No answer is needed; continue with reversible work.` }], details: { obligationId: obligation.id, outcome } };
        }
        paused = { kind, question: params.question, obligationId: obligation.id };
        ctx.ui.setStatus("algedonic", `algedonic: PAUSED — ${kind} unanswered (${obligation.id.slice(0, 8)})`);
        ctx.ui.notify(`regulator: ${kind} question ${outcome === "unavailable" ? "has no person to answer it" : outcome}; the unit is paused on obligation ${obligation.id.slice(0, 8)}`, "warning");
        return {
          content: [{ type: "text", text: `No answer (${outcome === "unavailable" ? "no person is present" : outcome}). ${kind === "consent" ? "Silence is not consent: do NOT perform the action." : "Work waits for the answer."} The unit is paused: tools with an effect are refused from now on, the question is recorded as obligation ${obligation.id.slice(0, 8)} owed to a person, and the orchestrator will hold the unit until someone answers with \`regulator answer\`. Call report_result with what you have so far and stop.` }],
          details: { obligationId: obligation.id, outcome, paused: true },
        };
      },
    });
  };
}

export default createAlgedonicExtension();
