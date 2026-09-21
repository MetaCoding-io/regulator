# Assessment

Assessment is split deliberately. Anything mechanically checkable is graded by a
deterministic grader; only design judgment is reviewed by a human. That split is itself a
demonstration of the mechanism hierarchy the course teaches.

## 1. Lab grading (automatic)

Each checkpoint has a grader that:

- runs the learner's harness headlessly against the fixture repository;
- asserts the checkpoint's capability exists and behaves;
- **attempts the forbidden action adversarially** where the checkpoint claims enforcement
  (write to a protected path via six routes; close a unit with stale evidence; settle an
  unresolved decision silently; exceed a budget ceiling);
- reports pass/fail per assertion with the exact command output.

A grader never asks the learner's agent whether it complied. Self-report is not evidence
in the course either.

## 2. Viability Review rubric (design work)

Used for module design write-ups and for the capstone. Each row is scored
0–3 (absent / asserted / implemented / implemented and evidenced).

| Dimension | What is being judged |
| --- | --- |
| **Function placement** | Is each of S1, S2, S3, S3\*, S4, S5 actually present, and located in a mechanism rather than a prompt persona? |
| **Channel discipline** | Do messages crossing boundaries carry type, authority, and destination? Is a signal distinguishable from an audit, an audit from a policy decision, a proposal from a mutation? |
| **Authority separation** | Can an executor certify its own work, mutate identity, or grant itself capability anywhere in the design? |
| **Mechanism level** | For each rule: is it enforced at the highest feasible level (type > gate > typed tool > judgment > prompt), with a reason when it is not? |
| **Feedback delay** | How long between a wrong assumption and the signal that reveals it? What was done to shorten it? |
| **Variety balance** | Where is incoming variety attenuated and regulatory variety amplified? Is the system over-regulated anywhere (cost without absorbed variety)? |
| **Failure honesty** | Is the enforcement boundary documented? Are the routes that bypass each gate named? |
| **Evidence** | Are claims about the harness supported by runs, traces, and an eval with a control arm? |
| **Residual uncertainty** | Are open questions, unresolved decisions, and known weaknesses reported rather than smoothed over? |

Scoring bands: 0–8 incomplete, 9–17 developing, 18–22 competent, 23–27 strong.

**Automatic markdown**: a submission that claims complete coverage with no residual
uncertainty and no documented boundary loses the *Failure honesty* and *Residual
uncertainty* rows outright. By the course's own argument, a system that cannot report
what it does not know is not well regulated.

## 3. Capstone

Two artifacts, one session.

**Artifact A — the harness.** Running, installed in a repository other than the starter
fixture, with its eval report.

**Artifact B — the viability case** (~2,000 words plus diagrams):

1. system map (S1–S5 + S3\*, mechanism vs judgment per function);
2. channel table (type, authority, destination, mutates-policy yes/no);
3. mechanism ledger (rule → hierarchy level → why not higher);
4. enforcement boundary statement;
5. evidence: control vs treatment, with interpretation including where regulation lost;
6. residual uncertainty and what would resolve it.

**The crit.** 20 minutes: 8 present, 12 adversarial. Reviewers attack the harness live —
choosing routes from the learner's own boundary statement. Losing a route to an attack is
not a failure; failing to have predicted the *class* of attack is.

## 4. Certification

- **Completion** — all fifteen checkpoint graders pass.
- **Certified (Viable Agents Practitioner)** — completion plus a capstone scoring
  ≥18 with no zero rows.
- **Cohort distinction** — ≥23 and a capstone contributed back as a public worked
  example.

## 5. Instructor notes

- Grade the *drill*, not the outcome. A learner whose harness fails a failure drill but
  who predicted and documented the failure understood the module. One whose harness
  happens to pass but who cannot say why has not.
- Watch for **cargo-cult VSM**: five labelled modules with no channels, no authority
  boundaries, and no independent audit. That is persona theatre with better vocabulary,
  and it is the exact failure this course exists to prevent.
- Watch equally for **over-regulation**: learners who gate everything and can no longer
  ship. M14's eval arms exist partly to catch this, and finding a fixture where the gated
  arm loses should be treated as a strong result, not a broken lab.
