# Homelab control plane — a design note

- **Status:** open.
- **Source:** a design conversation (2026-09-27) about building a homelab and its
  control plane together. Claims about what `regulator` does today cite the file.

> Nothing here is implemented. It records an idea,
> the technology choices proposed for it, and the architectural conflicts it raises
> against `regulator` as built, so that the homelab and its control plane can be built side
> by side — by a person, with an agent helping — without either being bolted onto the
> other afterwards. Choices marked **proposed** are defaults, not decisions; §9 lists
> what is still open. A fully worked example (`docs/examples/homelab.md`, a fixture,
> a workload under `pnpm check`) is the later step, not this one.

## 1. The idea

Most agent-for-operations offerings are brownfield: an architecture exists, and an
agent is introduced into it with whatever guardrails fit. This note asks the opposite
question. If the infrastructure and its control system are designed **together**, which
architectural choices make the regulators cheap, strong or unnecessary — and which make
them impossible?

The homelab is the first case. It is small enough to build alone, real enough that its
effects are not reversible by `git checkout`, and far enough from software development
that it tests whether the control plane is really generic over workloads (the
`personal-finance` workload tested this for a non-code domain; this one tests it for a
domain whose state does not live in a repository).

The design principle this note proposes, and that every stage in §6 follows:

> **Evidence before authority.** No capability is granted to a unit until an evidence
> channel the unit cannot write exists to verify its use. A unit may not restart a
> service until a probe it does not control can say whether the service came back.

It is the course's lesson 09 turned into a build order: the independent check is built
first, and the grant is what it earns.

## 2. What changes when the domain is infrastructure

`regulator` was built against a repository. Several of its assumptions hold for
infrastructure only if the architecture is chosen to make them hold. That is the
design opportunity of building both at once.

| `regulator` assumes | Brownfield infrastructure | Chosen so it holds |
| --- | --- | --- |
| Domain output lives in the repository ([AGENTS.md](../../AGENTS.md), architectural boundaries) | Live hosts are the truth; the repository is what someone hoped | The IaC repository is the only write path; live state is *observed*, and the difference between declared and observed is a check (§7, conflict 1) |
| Isolation is a git worktree; reintegration is a merge | No equivalent | Two layers: the worktree isolates the *change*, the environment isolates the *effect*. Staging is the worktree of the world; promotion is reintegration (§5) |
| Evidence is host-run and the unit cannot author it | The agent reads the same logs it can influence | Monitoring runs on credentials the agent never holds, ideally on separate hardware (§7, conflict 9) |
| Tools are typed with declared effects | The shell *is* the tool; [`DEBT.md`](../DEBT.md) row 8 | No profile gets a shell on a managed host. Write tools are job templates with a schema; the architecture removes the limitation instead of documenting it |
| Leases cover files | Two remediations fight over one host | Leases cover hosts and failure domains; maintenance windows are declared policy |

## 3. Technology — proposed stack

Each choice is justified by what it does for the control plane, not only by what it
does for the homelab. Alternatives are recorded so a later reader can re-examine the
choice.

### 3.1 Layers

```text
S5  identity           homelab repo: identity/ (purpose, invariants, boundaries, glossary)
S3  orchestrator       regulator, running on a control node (laptop for staging)
S3* evidence           Prometheus + Alertmanager + blackbox exporter; promtool-tested rules
S1  write path         Ansible roles, launched as AWX job templates (production)
    provisioning       OpenTofu over Proxmox (production) | Vagrant (staging)
    substrate          Proxmox VE on the homelab hardware | laptop hypervisor
S4  intelligence       advisory feeds, upstream releases, Proxmox/Debian changelogs
```

### 3.2 Choices

| Layer | Proposed | Why, in control-plane terms | Alternatives considered |
| --- | --- | --- | --- |
| Hypervisor (production) | **Proxmox VE** | Snapshots and backups through an API: reversibility becomes something a check can ask for, not a hope. Cloud-init templates make a guest a declaration | Incus (lighter, good API, smaller ecosystem); bare Debian + libvirt |
| Guest OS | **Debian stable, cloud image** | Boring, well-understood by Ansible; the course audience can follow it | NixOS (declared state *is* live state and every change has a rollback generation — strongest for drift and reversibility, highest learning cost); Fedora CoreOS |
| Provisioning (production) | **OpenTofu** with a Proxmox provider | `tofu plan` is a dry run a host check can run and bind to a revision; state is explicit | Ansible's Proxmox modules only (one tool fewer, weaker plan) |
| Provisioning (staging) | **Vagrant** | Named in the brief; one command to rebuild the world | Incus/LXD VMs, Multipass |
| Configuration | **Ansible** roles and playbooks | Existing expertise; `--check --diff` is a dry run; idempotence is itself a check (a second run reports no change) | Salt, NixOS modules |
| Execution authority (production) | **AWX** job templates | A job template is a typed tool: its survey spec is the runtime schema, its credential is held by AWX, not the agent; RBAC scopes who may launch what | Semaphore (lighter, fewer controls); `ansible-runner` behind a small typed service |
| Monitoring and evidence | **Prometheus, Alertmanager, blackbox exporter** | Rules and alerts are files in git, and `promtool test rules` is a unit test for an alert; queries are an API a host check can call | **Zabbix** (existing expertise; configuration lives in its database and is exported rather than declared — weaker as a declared artifact, see §9) |
| Logs | **Loki** (later) | Evidence for "why", not "whether"; not needed before stage 5 | journald over SSH, read-only |
| Secrets | **SOPS + age** in the repository | Encrypted at rest in git; the decryption key lives with AWX and the operator, never in a unit's session | Vault (heavier), AWX credentials alone |
| Backups | **Proxmox Backup Server** or restic | The object of the first invariant (§4); a restore test is a check | — |

### 3.3 The two parity boundaries

Staging and production cannot share every layer. The design declares where they differ
instead of pretending they do not:

- **Below the guest** (substrate and provisioning): Vagrant versus OpenTofu over
  Proxmox. Staging does not test provisioning code. This is a stated limitation of the
  staging environment, not a gap to discover.
- **The execution authority**: AWX in production; in staging either AWX as well (it
  needs a Kubernetes node — k3s in one more VM — and several GB of RAM) or the same
  playbooks through `ansible-runner`. If staging skips AWX, the survey schema and RBAC
  are untested there, and the typed tool's backend differs by environment (§9,
  decision 3).

Everything from the guest's OS upward — roles, playbooks, monitoring rules, the
regulator definition — is identical in both, and that is what staging proves.

## 4. S5 — the homelab's identity, before any hardware

Written first, committed, protected like the lab's `identity/`. A starting set, to be
argued with:

- **Purpose.** What the homelab is for, in two sentences. A unit that cannot say which
  purpose a change serves has no business making it.
- **Invariants** (each needs a mechanism, not only a sentence):
  - **HL-INV-001** Backups are never deleted, pruned or reconfigured by a unit. Mechanism:
    no job template grants it; a host check compares backup inventory before and after.
  - **HL-INV-002** Nothing is exposed beyond the LAN without an accepted proposal.
    Mechanism: a host check over firewall and reverse-proxy state against the declared
    exposure list.
  - **HL-INV-003** Production changes only from a revision that passed in staging.
    Mechanism: the promotion gate (§5).
  - **HL-INV-004** The evidence channel is never changed by the unit it verifies.
    Mechanism: the monitoring paths are protected in every profile but one, and that one
    changes nothing else.
- **Boundaries.** What the homelab does not do (no public services in phase one; no
  data the household cannot lose without a backup).
- **Glossary.** The shipped identity's glossary refuses the word *job*
  ([`packages/regulator/identity/GLOSSARY.md`](../../packages/regulator/identity/GLOSSARY.md));
  AWX calls its runs jobs. The
  homelab instance declares its own glossary (§7, conflict 10).

## 5. Environments

### 5.1 One declaration, two renderers

A single environment spec per environment is the source of truth for what hosts exist.
Both provisioners read it; neither is edited by hand to add a host.

```yaml
# environments/staging.yaml   (production.yaml has the same shape)
name: staging
substrate: vagrant            # or: proxmox
arch: amd64                   # see §9, decision 2
failureDomains:
  - name: laptop
hosts:
  - name: dns1
    role: dns
    cpus: 1
    memoryMb: 512
    failureDomain: laptop
  - name: mon1
    role: monitoring
    cpus: 2
    memoryMb: 2048
    failureDomain: laptop
networks:
  - name: lan
    cidr: 10.20.0.0/24
```

- The `Vagrantfile` loads `environments/staging.yaml` and defines one VM per host.
- OpenTofu reads `environments/production.yaml` (via `yamldecode`) and defines one
  Proxmox guest per host.
- The Ansible inventory is generated from the same file (a small script or a dynamic
  inventory plugin), so a host exists in configuration exactly when it exists in the
  declaration.
- A host check (`env-spec-valid`) validates the spec against a schema, and a second
  (`inventory-matches-spec`) fails if the inventory and the spec disagree.

The spec is the place a person decides *what exists*; roles decide *how it is
configured*. A unit changing a role cannot add a host, and a unit changing the spec is
a different unit type with a different profile.

### 5.2 Promotion is reintegration

```text
unit on branch  ──►  staging apply at revision R  ──►  evidence(R, staging)
                                                       │
                     promotion gate: fresh passing evidence for R in staging,
                     no open blocking obligation, consent from a named person
                                                       ▼
                     production apply at revision R  ──►  evidence(R, production)
```

- Evidence records name the **target environment** they observed, not the host the
  orchestrator runs on (§7, conflict 3).
- The promotion gate is the closeout gate's rule with one more binding: the revision
  applied to production must carry passing evidence from staging.
- Production apply is a consent-class interaction in lesson 13's sense until the
  eval (§6, stage 7) says otherwise.

### 5.3 Repository layout (proposed)

```text
homelab/
  .regulator/               instance manifest, events, outbox (regulator init)
  identity/                 S5: purpose, invariants, boundaries, glossary (protected)
  environments/             staging.yaml, production.yaml (+ schema)
  provision/
    vagrant/Vagrantfile     reads environments/staging.yaml
    tofu/                   reads environments/production.yaml
  ansible/
    roles/  playbooks/
    inventories/{staging,production}/   generated from environments/
  monitoring/
    prometheus/rules/       alert rules + promtool tests
    blackbox/               probe definitions
  awx/                      job templates and surveys as code (production)
  secrets/                  SOPS-encrypted (protected)
  runbooks/                 standing contracts (§7, conflict 7)
  decisions/                one record per decision in §9 as it is made
```

The regulator definition — the `homelab` workload, its profiles, policies and registry
cards — lives with the other definitions in `packages/regulator/` when it becomes the worked
example; the homelab repository is an *instance* of it, created by `regulator init`.

## 6. Build order — infrastructure and regulator together

Each stage adds a piece of infrastructure and the regulator it makes possible. A stage
ends when its exit criterion is met in staging; production follows through the
promotion gate once stage 3 exists.

| Stage | Infrastructure | Regulator | Exit criterion |
| --- | --- | --- | --- |
| 0 | None. The repository, `identity/`, `environments/` with its schema | Identity protected; `env-spec-valid`; `regulator init` | `regulator doctor` passes on an empty homelab |
| 1 | Staging: Vagrant guests from the spec; Ansible baseline role (users, SSH, updates, time) | `inventory-matches-spec`; idempotence check (second run changes nothing); `ansible --check` as a dry run | A fresh `vagrant up` plus baseline converges twice with no changes |
| 2 | Monitoring host: Prometheus, Alertmanager, blackbox; rules tested with promtool | Probe-backed checks: a criterion like "dns1 answers for lan names" is observed by a query, not reported | A unit's closeout can cite a Prometheus observation bound to revision and environment |
| 3 | First services (DNS, then one more); production hardware with Proxmox; OpenTofu | Promotion gate; evidence names its environment; host leases | A change reaches production only with staging evidence at the same revision |
| 4 | Agent, read-only: an `investigator` profile over Prometheus queries and read-only host facts | Alerts arrive as signals; routing policy opens obligations; nothing is remediated | An injected fault produces an obligation with the evidence attached, and no write |
| 5 | AWX in production; job templates with surveys; an `operator` profile granted named templates only | Work contract per remediation; `ask_human` for consent-class templates; effect journal over launches | A remediation runs under a contract, is verified by a probe, and is dispositioned |
| 6 | Maintenance windows and failure domains declared | Standing contracts for pre-authorized runbooks; recovery lattice; pause gate; escalation when verification stays uncertain | An alert at 3 a.m. is either fixed-and-verified inside a window or escalated with evidence — never silently retried |
| 7 | Fault injection (a stopped service, a full disk, a misleading alert, two competing remediations) | Eval arms: control, treatment, ablation per regulator | A report, honest about where a regulator cost more than it absorbed |

## 7. Architectural conflicts

Recorded, per [AGENTS.md](../../AGENTS.md), rather than resolved by bending the architecture to fit. Each
names the existing mechanism it pushes on.

1. **Domain state outside the repository.** AGENTS.md: "Domain output (the code, the
   files) lives in the repository. Nothing reads its own progress off the domain." Here
   the repository holds the *declared* state and live hosts hold the actual state.
   Proposal: the repository stays the only write path; the live state is observed only
   through host checks, and a `drift` check (declared versus observed) is S3\* evidence,
   never a unit's report. Open: whether drift found outside any unit is an obligation on
   the instance (like the post-merge check's, lesson 15) — probably yes.

2. **Isolation has two layers.** The worktree still isolates the IaC change; it cannot
   isolate an `ansible-playbook` run against a real host. Environments and snapshots
   isolate effects. This is a new isolation mode, and it belongs in the orchestrator's
   design (leases and reintegration), not in a workload declaration. It should be
   designed before it is coded into the loop.

3. **Evidence names the wrong environment.** `DEBT.md` row 4: "The environment an
   evidence record carries is the orchestrator's host." For infrastructure that is
   wrong by construction — the laptop is not the homelab. Today the record's environment
   is `node`, `platform` and `arch` (`EvidenceEnvironmentSchema` in
   [`packages/protocol/src/audit.ts`](../../packages/protocol/src/audit.ts)); it must also
   name the target environment the check observed. This pays row 4 for
   this workload and is a protocol change, not a workload one.

4. **Leases over hosts, not files.** The lease store covers paths. Two units editing
   different roles can both restart the same host. Leases need a subject that is a host
   or failure domain; the thrash detector needs to see restarts, not writes. Row 9
   (single-machine leases) stays as it is: one orchestrator per homelab.

5. **Verification takes time.** The closeout gate observes at one moment. A service
   that recovers after ninety seconds, or an alert that must stay resolved for ten
   minutes, needs a soak: a check with a deadline and a hold period. That is a new
   property of a check, with its own budget line (wall-clock) in the policy.

6. **Effects are real.** In the code workload most effects can be undone on a branch.
   Here the effect journal (lesson 08) and consent-class interactions (lesson 13) carry
   the weight, and `DEBT.md` row 29 — whether an action needs consent is the model's to
   notice — bites harder. Proposal: consent is a property of the job template, declared
   in the definition, so a profile grant carries it; that is the per-tool consent grant
   row 29 names as the way out.

7. **Who starts a unit when an alert fires.** AGENTS.md: "Intelligence can raise an
   obligation; it never replans on its own." An alert must not dispatch a unit by
   itself. Proposal: **standing contracts** — runbooks declared in the definition, each a
   contract template with fixed decisions, a named template grant and a verification
   probe; the routing policy maps an obligation kind to a standing contract, and S3
   dispatches it. The authority is S3's declared policy, not the alert's. This is a new
   mechanism and needs its own design note before stage 6.

8. **Two authority systems.** AWX has RBAC and approval nodes; the regulator has profile
   grants and `ask_human`. If both approve, which one is authoritative, and what happens
   when they disagree? Proposal: the regulator is authoritative for *whether* a unit may
   launch; AWX RBAC is defence in depth for *what* a credential can do; a host check
   compares the two declarations and fails when a profile grants a template AWX would
   refuse, or AWX would allow one no profile grants. AWX approval nodes are not used, so
   a person is asked through one channel only.

9. **Independent evidence on shared hardware.** If Prometheus runs on the Proxmox host
   it monitors, a host failure takes the evidence with it, and a unit with a
   hypervisor-level grant can reach the evidence channel. Options: a small separate box
   for monitoring (a Raspberry Pi is enough), or an explicit registry limitation that
   the evidence shares a failure domain with its subject.

10. **Vocabulary.** The lab's identity refuses *job* and *task*; AWX's domain language
    uses both. The homelab instance's glossary declares its own refused words, and
    `glossary-lint` must read the instance's glossary, not the shipped one. The check
    takes its words as an option ([`packages/checks/src/verify.ts`](../../packages/checks/src/verify.ts));
    where the controller sources them from is to be confirmed with a test when the
    workload lands.

11. **Staging does not test provisioning.** §3.3. Stated as a limitation on the
    promotion gate's registry card: passing in staging says nothing about OpenTofu over
    Proxmox. Optional later: a nested-Proxmox staging environment for provisioning
    changes only.

12. **Secrets in the domain.** Encrypted secrets sit in the repository a unit reads.
    SOPS keeps them unreadable without the key; `secrets/` is a protected prefix in the
    manifest so no unit writes it; the key never enters a session. A leaked decryption
    key is outside every gate here and belongs in the boundary statement.

## 8. How an agent should help build this

This note is written to be handed to an agent at the start of each session. The rules
for that agent:

- **Follow the stage order.** Do not propose a capability for a stage whose evidence
  channel does not exist yet (§1).
- **Decisions are the person's.** When a choice in §9 is needed, lay out the options
  with their control-plane consequences and ask; record the answer in
  `decisions/` in the homelab repository and strike it here.
- **Staging first, always.** Nothing runs against production that has not converged in
  staging at the same revision, including the agent's own suggestions typed by hand.
- **Record conflicts, do not resolve them silently.** A new conflict with `regulator`'s
  architecture gets a numbered entry in §7.
- **Keep identity out of reach.** The agent may propose changes to `identity/`; the
  person commits them.

## 9. Open decisions

| # | Decision | Default proposed | What it changes |
| --- | --- | --- | --- |
| 1 | Production hardware: one Proxmox host, a small cluster, or one host plus a separate monitoring box | One host plus a small monitoring box | Whether evidence is independent of its subject (conflict 9); whether failure domains mean anything |
| 2 | Laptop OS and CPU architecture | — | On an ARM laptop, Vagrant guests are arm64 while an x86 homelab is amd64: images, packages and exporters differ, and parity weakens. Provider choice (libvirt, VirtualBox, VMware, Parallels, QEMU) follows from it |
| 3 | AWX in staging, or `ansible-runner` behind the same typed interface | `ansible-runner` in staging, AWX in production | AWX in both keeps the typed tool's backend and RBAC identical across environments, at the cost of a k3s VM on the laptop |
| 4 | Prometheus or Zabbix for evidence | Prometheus | Zabbix is existing expertise; Prometheus rules are declared files with unit tests. Both is possible, with Prometheus as the evidence channel |
| 5 | Debian + Ansible, or NixOS | Debian + Ansible | NixOS makes drift and rollback nearly free but moves the course away from its likely audience |
| 6 | Network gear under declaration (router/firewall, VLANs) | Out of scope for phase one | Exposure invariant HL-INV-002 needs something to observe; a declared firewall makes it a check |
| 7 | Where the homelab repository lives, and whether it is public | Separate private repository; public once secrets discipline is proven | A public repository is course material; also a larger blast radius for a mistake |
| 8 | Which services come first after DNS | — | Each service brings its own probes, backups and invariants |

## 10. Relationship to the course

If this works, it is the course's third workload and possibly an infrastructure track:
the first ten modules' method is unchanged, the fixture and workload are new, and
lessons 05 (leases), 08 (recovery), 09 (evidence) and 13 (algedonic) are where the
domain bites hardest. Conflicts 2, 3, 5 and 7 are changes to `regulator` itself and would be
paid in `packages/`, not in the workload. Nothing in this note changes the course or
the packages yet. The note graduates as the research README says: an ADR under
[`decisions/`](../decisions/) for conflicts 2 and 7, a [`DEBT.md`](../DEBT.md) change
for conflict 3, and issues for the rest.
