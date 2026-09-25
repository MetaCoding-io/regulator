/**
 * Lesson 05's lease store and thrash detector now ship in regulator's core
 * package (promoted when lesson 06's orchestrator and the `regulator status`
 * read model became their second and third consumers). The lab imports them
 * from there; this module only keeps the lesson's import path stable.
 */
export { LeaseHeldError, LeaseStore, ThrashDetector, type AcquireOptions, type Lease, type ThrashDetectorOptions, type ThrashSignal } from "@metacoding.io/regulator-core";
