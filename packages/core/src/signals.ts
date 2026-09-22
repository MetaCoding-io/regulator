/**
 * Typed messages an instance has recorded and not yet routed: an append-only
 * NDJSON file under `.regulator/`. Lesson 08's router consumes it. Every line
 * is validated against the protocol on the way in and on the way out.
 */
import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { VsmMessageSchema, assertValid, type VsmMessage } from "@metacoding/vsm-pi-protocol";
import { SIGNALS_RELATIVE_PATH } from "./paths.js";

export async function appendSignal(root: string, message: VsmMessage): Promise<void> {
  assertValid(VsmMessageSchema, message, "vsm message");
  const file = path.join(root, SIGNALS_RELATIVE_PATH);
  await mkdir(path.dirname(file), { recursive: true });
  await appendFile(file, `${JSON.stringify(message)}\n`, "utf8");
}

export async function readSignals(root: string): Promise<VsmMessage[]> {
  let text: string;
  try {
    text = await readFile(path.join(root, SIGNALS_RELATIVE_PATH), "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  return text.split("\n").filter(Boolean).map((line) => {
    const value: unknown = JSON.parse(line);
    assertValid(VsmMessageSchema, value, "vsm message");
    return value;
  });
}
