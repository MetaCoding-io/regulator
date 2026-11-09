# Nix read against the control plane: the environment as a named input to evidence

- **Status:** open. No issue yet; the next step is in §6.
- **Source:** Geoffrey Huntley, "the world hasn't figured out yet that you can literally
  just fix everything with a Nix overlay", <https://ghuntley.com/nix/> (7 Oct 2026), read
  2026-11-09. The post links a demo repository,
  [ghuntley/nix-demo](https://github.com/ghuntley/nix-demo) ("patch git once with a Nix
  overlay; use it in devenv, a NixOS VM test and a Docker image"), which was not read for
  this note; every claim about what the author does is the post's.
- **Why a note:** the post is an opinion piece with one argument the registry already
  has a word for. It says a team that defines its toolchain separately for the laptop, for
  CI and for the agent's sandbox is "triplicating that drift", and that one declarative
  definition should serve all three. Regulator's answer to drift is to name what ran and
  bind evidence to it: the harness revision, the policy versions, the Pi pin, the graders'
  hashes. The one input it does not name is the environment the checks ran under. That is
  DEBT row 4, and the post's mechanism is a way to name it. The rest of the post (agents
  with sudo, agents patching the toolchain, bare metal) is either outside the control
  plane's concern or against its boundary, and §5 says which.

Claims about what the code does today cite the file, at `main` `eca429b`. Claims about Nix
cite the post or the Nix manual. The rest is proposal.

## 1. What the post argues

**One definition, four consumers.** A `devenv.nix` declares the packages, the language
toolchains, the services and the git hooks; the same expression serves the developer's
shell (`devenv up`), CI, a production image (`pkgs.dockerTools.buildLayeredImage` over a
`buildEnv` of the same packages) and "ephemeral sandbox development environments used by
agents". The author's complaint is that his clients build these separately and the
sandbox for agents is a third copy of a drift that already existed between the first two.

**Everything is patchable in place.** An *overlay* overrides one package (the example is
OpenSSL pinned to a version by hash) and every dependent is rebuilt against it. The
author's agent sandbox patches `git` to remove force-push. He is careful to call this a
capability removal and not a boundary.

**The system under test is the operating system.** NixOS VM tests (`runNixOSTest`) boot
QEMU nodes from the same package set and run a Python test script against them; his
example is HAProxy behind a firewall across two nodes. He says that when others run agent
loops they test the application and perhaps a database, and that his loops test the whole
machine.

**Agents can write the Nix.** The learning curve that kept teams off Nix no longer applies
because the model writes the expressions; he prompts his agents to use `sudo` on NixOS and
relies on generation rollback as the safety net; he suggests burning tokens to find
vulnerabilities in dependencies and fixing them by overlay.

What the post does not do: it does not describe a sandbox in the isolation sense, does not
address secrets or egress, offers no data or failure cases for any agent claim, and its
OpenSSL snippet is incomplete. It concedes that the derivation store's incremental caching
is weaker than Bazel's or Buck2's and does not say how. It should be read as a strong
position on *environment definition*, and only that is read here.

## 2. Where regulator is today

The control plane already treats most of its inputs as named and recorded:

| Input | Where it is named | Where it is recorded |
| --- | --- | --- |
| the definition | the package version and git revision | the manifest's `definition.harnessRevision` and `packageVersion` (`packages/regulator/src/instance.ts`); the fingerprint's `harnessRevision` (`packages/regulator/src/evals.ts`, `fingerprintFor`) |
| the agent runtime | the Pi pin in `peerDependencies` | the manifest's `definition.pi`; the fingerprint's `pi`; `doctor` compares the pin with what is installed |
| the policies | `name` and `version` in each file | the fingerprint's `policies` |
| the graders | the file under the definition | the fingerprint's `graders[].sha256` |
| the model | the route | the fingerprint's `model` and `modelsObserved` |
| **the environment the checks ran under** | **nothing** | `node`, `platform`, `arch` on every evidence record (`packages/checks/src/verify.ts`, `hostEnvironment`) and on the fingerprint |

The last row is the gap. An evidence record says a check passed under Node 22 on Linux
x64 and nothing else: not which `git`, which `pnpm`, which Python when a declared check
is Python, which system libraries. The closeout gate's second limitation states it ("the
environment recorded is the orchestrator's host; a check that passes here and fails on the
target platform is not caught"), DEBT row 4 carries it as *unscheduled*, and the roadmap's
"Not planned" table says the environment matrix is CI's.

Three places the gap is about to matter more than it does on the software fixture:

- **The Terminal-Bench run** ([minimal-harness note
  §5.4](2026-11-05-minimal-harness-and-terminal-bench.md#54-the-design)): the Harbor
  adapter's `install()` puts Node, pnpm, the published packages and the pinned Pi into
  each task image by script, per trial. That script is the post's third copy of the
  drift. The same section wants the failure observer to classify a missing interpreter as
  `environment` (`packages/protocol/src/recovery.ts` has the cause), which is an
  inference today and a comparison once the environment has a name.
- **Declared checks in other domains**: the Python-domain decision the statistics and
  SemanticSeams notes share, and ArticleMiner's OCR and vision libraries ([ArticleMiner
  note §4.8](2026-09-25-articleminer-knowledge-production.md#48-isolation-is-the-hosts-not-the-profiles)).
  A check's argv is recorded; what the argv resolved to is not.
- **The second host** ([#58](https://github.com/MetaCoding-io/regulator/issues/58)): a
  dispatcher that runs the session in a container so that "the profile's grant and the
  container's boundary are the same statement". Something has to build that container
  from the definition.

## 3. What regulator could take, at the mechanism level

In order of fit. Items 1 and 2 are small and against existing seams; 3 and 4 attach to
threads that exist; 5 is a reading of a decision already taken.

### 3.1 The environment definition is protected by default (level 2)

The post's "ask an agent to customize anything by overlay" is, in regulator's terms, a
unit editing the thing that verifies it: a patched toolchain is a self-certification path,
the drift suite's fourth behaviour with a new target. The control plane's answer is the
one it gives `vendor/`: convention discovery (`packages/checks/src/conventions.ts`,
`discoverConventions`) treats a present `vendor/` as a protected path, the write gate
refuses writes under it, the bash watch snapshots and restores it
(`packages/regulator-pi/src/authority.ts`, `snapshotProtected`), and `identity-untouched`
diffs it at closeout.

Proposed: `flake.nix`, `flake.lock`, `devenv.nix`, `devenv.lock` and `devenv.yaml` join
`vendor/` as discovered protected conventions when present. A contract that means to change
the environment exempts them, as a contract exempts an inherited test file it changes on
purpose. Mechanism level 2; a list in one function; the `identity-untouched` card gains a
sentence and no limitation. This is the one place the post's advice is inverted: the
environment is S5 material, and a person changes it by a merged change.

### 3.2 A toolchain hash on evidence and on the fingerprint (level 2)

`EvidenceEnvironment` (`packages/protocol/src/audit.ts`) and `EnvironmentFingerprint`
(`packages/protocol/src/evals.ts`) gain one optional field, `toolchain`: a content hash of
the environment the checks ran under, with how it was obtained. Three sources, tried in
order by the check runner:

| Source | What is hashed | When |
| --- | --- | --- |
| a Nix store path | the path in `DEVENV_PROFILE` or the shell's `IN_NIX_SHELL` profile, which is already content-addressed | the orchestrator runs inside a devenv or flake shell |
| a lock file | SHA-256 of `flake.lock` or `devenv.lock` at the unit's revision | the repository declares an environment the orchestrator is not running under |
| the package lock | SHA-256 of `pnpm-lock.yaml` (or the discovered equivalent) | nothing else; the software fixture today |

Then two readers. `doctor` compares the toolchain hash the manifest recorded at `init`
with the one it computes now and reports `environment-drift` beside `definition-drift`
(`packages/regulator/src/instance.ts`), as information and not as a failure, since the
manifest is not the place a person declares the environment. The eval harness refuses to
compare two reports whose toolchain hashes differ, the way it already refuses a run on a
fallback model (`evals.ts`, the 2026-11-08 rule), because the arms were pre-registered
under one environment.

What this pays: part of DEBT row 4. An evidence record then says *what* it ran under and
not only *where*. What it does not pay: the row's second half. Naming the environment is
not matching the target's; the matrix stays CI's. The card's limitation is rewritten, not
struck.

### 3.3 One image for the Terminal-Bench trials (the eval thread)

The adapter's `install()` (minimal-harness note §5.4) becomes `nix build` of a layered
image whose package set is Node 22, pnpm, the two published packages at the suite's
version, and Pi at the pin, with `config.Env` carrying `PATH` and the CA bundle as the
post's git image does. The image's store hash is the suite's `toolchain` (§3.2), so all
150 trials of the three arms are stamped with one environment and the report can say so.
This is a change to `bench/harbor/` and the suite file only; it waits on the thread's
first decision (in-place isolation) like everything else in that section.

### 3.4 The container host is built from the definition (#58)

The ArticleMiner note placed isolation with the second host: a dispatcher that runs the
session in a container with the workspace mounted. The post supplies the construction.
The image is `buildLayeredImage` over a `buildEnv` whose packages are derived from the
profile's tool surface and the workload's declared checks, so the image is a function of
the definition and `regulator check` can hold the two together. Two things the post shows
that belong in that host's `BOUNDARY.md` column:

- A `git` built without force-push is the structural form of what the bash watch does by
  snapshot-and-restore: the capability is absent rather than reverted. The card would say
  what else is absent (no `curl`, no package manager in the image) as the shell's declared
  reach, which is what OPERATING.md § Security posture says the container is for.
- The caveat the post does not draw: profiles grant by *effect*
  (`profile-write-grant`: read-only means read-only by effect, not by tool name) and a
  package set grants by *name*. The image narrows the shell's reach; it does not replace
  the effect model, and a program present in the image can still have any effect. The host
  manifest #58 asks for would say so.

DEBT rows 8 and 19 stay "not planned": isolation is still the deployment's. What changes
is that the deployment can declare it in a form the harness records (§3.2) and derives from
the definition (this item).

### 3.5 A VM test as a runtime-class host check (reading, not a change)

The closeout treats a `runtime` criterion like a `semantic` one because no host mechanism
observes runtime behaviour (`closeout-gate` limitation 3). A NixOS VM test is a runtime
observation a host can run and bind to a revision: a declared check whose argv is
`nix build .#checks.<system>.<name>` and whose pass is exit zero. Nothing in the check
runner would change; the workload declares it as it declares any check. The homelab note
chose Debian with Ansible over NixOS (its §9, decision 5) and this note does not reopen
that; it records that the note's "evidence names its environment" gate (its stage 3) has a
concrete form if the stack ever changes, and that a Python- or infrastructure-domain
workload can declare a VM test without the control plane growing anything.

## 4. What regulator already does, and should not replace

- **Backpressure.** The post's backpressure is in-session git hooks (`prek` running
  `rustfmt`). Regulator's host checks run after the session, at the revision, with the
  orchestrator's own process runner, and the session's claim to have run them never counts
  ([host checks](../reference/host-checks.md)). The in-session hook is advice to the
  model; the post-session check is evidence. Keep the second.
- **Rollback.** NixOS generations roll back the machine. The recovery router, the effect
  journal reconciled on restart, and `regulator upgrade` with its migration notes already
  cover the harness's own state, and a unit's domain changes live on a branch that is
  simply not merged. A per-unit environment rollback would only be worth building inside
  the container host (§3.4), where an aborted unit's image is discarded with it.
- **The maintainers' shell.** For this repository's own development a flake adds little:
  Node and pnpm are pinned in `package.json`, Pi is a peer dependency at a pin `doctor`
  checks, and CI runs two Node versions under `--frozen-lockfile`. The value of §3 is in
  the instance, the evidence and the eval images, not in a `devenv.nix` at the root.

## 5. What not to take

- **Agents with `sudo`.** The post's safety case is rollback. Regulator's is that a unit
  cannot reach the thing that judges it; rollback after the fact is not that, and nothing
  in the post addresses secrets, egress or untrusted code. The profile's grant stays as it
  is.
- **Agents writing the environment.** §3.1 is the inverse. If a unit proposes an
  environment change, it is a proposal through the typed path, and a person merges it.
- **"The model knows Nix because the labs use it."** Unsourced, and irrelevant to a
  mechanism: a check does not care who wrote the expression it runs under.
- **Vulnerability hunting by token.** A fixed dependency is a changed lock, which §3.1
  protects and §3.2 names; the hunt itself is S4 intelligence a person raises, which the
  open-questions note §2 already designs, and not a unit's job.

## 6. Next step

1. §3.1 and §3.2 are one issue when a person decides, under 0.2 beside #46 or after it:
   the protected conventions, the `toolchain` field on the two schemas, the three sources
   in the check runner, `environment-drift` in `doctor`, the eval harness's refusal, and
   the rewritten limitation on `closeout-gate` with DEBT row 4 marked part-paid. Done
   when a scripted eval report under a flake shell carries the store hash, and
   `identity-untouched` refuses a unit that edits `flake.lock` without an exemption.
2. §3.3 joins the Terminal-Bench thread's adapter issue when that is filed.
3. §3.4 is a paragraph on #58 (the image as a function of the definition; the
   effect-versus-name caveat in the host manifest), not an issue of its own.
4. §3.5 is this note's record and nothing else.

## 7. Reading

- The post, and the Nix manual's sections on overlays, `dockerTools.buildLayeredImage`
  and NixOS tests (`runNixOSTest`), which the post links.
- Gabriella Gonzalez, "Stop calling everything Nix" (Haskell for All), the post's own
  recommended starting point, on the layers: the language, the package set, the OS, the
  shell.
- The [minimal-harness note §5](2026-11-05-minimal-harness-and-terminal-bench.md#5-terminal-bench-20-with-regulator),
  for the adapter this note's §3.3 changes, and the [ArticleMiner note
  §4.8](2026-09-25-articleminer-knowledge-production.md#48-isolation-is-the-hosts-not-the-profiles)
  for where isolation was placed.
- [Evidence about the regulators](../concepts/evidence-about-the-regulators.md), for the
  fingerprint this note adds one field to.
