/** Minimal process runner for the lab's Pi-free modules and CLI. Mirrors Pi's `exec` result shape. */
import { execFile } from "node:child_process";

export interface ExecResult {
  stdout: string;
  stderr: string;
  code: number;
}

export interface ExecOptions {
  cwd?: string;
  timeout?: number;
  env?: NodeJS.ProcessEnv;
}

export type Exec = (command: string, args: string[], options?: ExecOptions) => Promise<ExecResult>;

export const realExec: Exec = (command, args, options = {}) => {
  // The lab tools spawn `node --test`. Under the test runner, children inherit
  // NODE_TEST_CONTEXT and refuse to run "recursively"; production never sets it.
  const env = { ...process.env, ...options.env };
  delete env.NODE_TEST_CONTEXT;
  return new Promise((resolve) => {
    execFile(command, args, { cwd: options.cwd, timeout: options.timeout, env }, (error, stdout, stderr) => {
      const code = error && typeof (error as { code?: unknown }).code === "number" ? (error as { code: number }).code : error ? 127 : 0;
      resolve({ stdout: String(stdout), stderr: String(stderr), code });
    });
  });
};
