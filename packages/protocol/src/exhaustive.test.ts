import assert from "node:assert/strict";
import test from "node:test";
import { assertNever } from "./exhaustive.js";
import type { InteractionKind } from "./interaction.js";

type Light = "red" | "amber" | "green";

function next(light: Light): Light {
  switch (light) {
    case "red": return "green";
    case "amber": return "red";
    case "green": return "amber";
    default: return assertNever(light, "light");
  }
}

test("assertNever closes a switch that lists every member, and throws on a value the type never held", () => {
  assert.equal(next("red"), "green");
  // What the compiler cannot see: a value that arrived unvalidated. The helper names what it was asked to match.
  assert.throws(() => next("blue" as Light), /unhandled light: "blue"/);
  assert.throws(() => assertNever(undefined as never, "thing"), /unhandled thing: undefined/);
});

test("a switch that misses a member of its union fails typecheck at assertNever", () => {
  const incomplete = (light: Light): Light => {
    switch (light) {
      case "red": return "green";
      case "amber": return "red";
      // @ts-expect-error "green" is not handled, so `light` is not `never` here: the missing case is a compile error.
      default: return assertNever(light, "light");
    }
  };
  assert.throws(() => incomplete("green"), /unhandled light: "green"/);

  // The same over a protocol union: a kind added to `InteractionKind` fails every switch that does not list it.
  const waits = (kind: InteractionKind): boolean => {
    switch (kind) {
      case "recap": return false;
      case "choice": case "clarification": case "consent": return true;
      // @ts-expect-error "uat" is not handled.
      default: return assertNever(kind, "interaction kind");
    }
  };
  assert.throws(() => waits("uat"), /unhandled interaction kind: "uat"/);
});
