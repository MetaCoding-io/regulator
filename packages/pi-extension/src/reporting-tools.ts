import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createRegulatoryEvent, RegulatoryEventStore } from "@metacoding/vsm-pi-core";
import {
  PolicyProposalInputSchema, AuditFindingInputSchema, UncertaintyInputSchema,
  type ReportingAuthority,
} from "@metacoding/vsm-pi-protocol";
import { VERSION, type ExtensionAPI, type ExtensionContext } from "@earendil-works/pi-coding-agent";

export interface HostReportingContext {
  authority: ReportingAuthority;
  unit?: string;
  sourceRevision?: string;
  /** Canonical project root for shared runtime history; defaults to execution cwd. */
  runtimeRoot?: string;
}
export interface ReportingToolOptions {
  /** Trusted host seam only. Never derive grants from model messages or tool input. */
  resolveReportingContext?: (ctx: ExtensionContext) => HostReportingContext | undefined | Promise<HostReportingContext | undefined>;
}
const execFileAsync = promisify(execFile);
async function sourceRevision(cwd: string): Promise<string | undefined> {
  try {
    const { stdout } = await execFileAsync("git", ["-C", cwd, "rev-parse", "HEAD"], { timeout: 2000, maxBuffer: 4096 });
    const revision = stdout.trim();
    return /^[a-f0-9]{40,64}$/i.test(revision) ? revision : undefined;
  } catch { return undefined; }
}

export function registerReportingTools(pi: ExtensionAPI, options: ReportingToolOptions): void {
  const specifications = [
    {
      name: "vsm_propose_policy_change", label: "Propose S5 policy change", parameters: PolicyProposalInputSchema,
      description: "Request a policy/identity change when authorized as S1, S3, or S4. Report rationale, requested change, reported severity, and evidence. This records a proposal; it never approves or mutates S5.",
    },
    {
      name: "vsm_report_audit_finding", label: "Report independent audit finding", parameters: AuditFindingInputSchema,
      description: "Report an independent architecture/invariant finding only in a host-authorized S3* context. Blocking/critical reported severity requires evidence. Recording does not verify evidence or resolve obligations, pause, or retry work.",
    },
    {
      name: "vsm_report_uncertainty", label: "Report implementation uncertainty", parameters: UncertaintyInputSchema,
      description: "In an authorized S1 context, preserve a consequential decision you cannot confidently resolve locally: reason, alternatives, consequence, coarse impact, and evidence (empty if unavailable). Follow-up is a recommendation, not routing or escalation. No numeric confidence is required.",
    },
  ] as const;
  for (const specification of specifications) {
    pi.registerTool<typeof specification.parameters>({
      ...specification,
      async execute(toolCallId, params, signal, _onUpdate, ctx) {
        signal?.throwIfAborted();
        const resolved = await options.resolveReportingContext?.(ctx);
        if (!resolved) throw new Error("Reporting authority denied: this Pi context has no host reporting grants.");
        const trusted = structuredClone(resolved);
        const revision = trusted.sourceRevision ?? await sourceRevision(ctx.cwd);
        const event = createRegulatoryEvent(specification.name, params, {
          authority: trusted.authority,
          provenance: {
            host: `@earendil-works/pi-coding-agent@${VERSION}`,
            sessionId: ctx.sessionManager.getSessionId(),
            ...(trusted.unit === undefined ? {} : { unit: trusted.unit }),
            ...(revision === undefined ? {} : { sourceRevision: revision }),
          },
        }, toolCallId);
        signal?.throwIfAborted();
        const store = new RegulatoryEventStore(trusted.runtimeRoot ?? ctx.cwd);
        try {
          const receipt = store.append(event);
          return { content: [{ type: "text", text: JSON.stringify(receipt) }], details: receipt };
        } finally { store.close(); }
      },
    });
  }
}
