/**
 * The product's programmatic surface. The CLI (`cli.ts`) is the operator's; this is
 * what another program — the control room, a CI step, a test — imports.
 */
export {
  readDefinition, readInstance, readStatus, renderStatusText,
  type DefinitionView, type InstanceView, type LifecycleRow, type ReadStatusOptions, type StatusView, type UnitView,
} from "./status.js";
export { closeUnit, driveUnit, routeUnit, runUnit, type Dispatcher, type RunUnitOptions, type RunUnitOutcome } from "./controller.js";
export { doctor, initInstance, readManifest } from "./instance.js";
export { finishUnit, initFixture, startUnit, unitStatus } from "./unit.js";
export { loadWorkload, loadWorkloadFor, unitTypeOf } from "./workload.js";
export { loadSuite, runSuite, ablationCoverage } from "./evals.js";
export { loadPolicy, POLICY_PATH } from "./policy.js";
export { loadRecoveryPolicy, RECOVERY_POLICY_PATH } from "./recovery-policy.js";
export { loadRoutingPolicy, ROUTING_POLICY_PATH } from "./routing-policy.js";
export { loadInteractionPolicy, INTERACTION_POLICY_PATH } from "./interaction-policy.js";
