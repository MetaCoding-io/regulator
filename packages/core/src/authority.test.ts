import assert from "node:assert/strict";
import { link, mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";
import { isUnderProtectedPath, prepareWritePath } from "./authority.js";

async function project(t: TestContext): Promise<string> {
  const cwd = await mkdtemp(path.join(tmpdir(), "regulator-authority-"));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  await mkdir(path.join(cwd, "regulator/identity"), { recursive: true });
  await writeFile(path.join(cwd, "regulator/identity/INVARIANTS.md"), "INV-001");
  await mkdir(path.join(cwd, "vendor"));
  await writeFile(path.join(cwd, "vendor/left-pad.js"), "export const leftPad = 0;");
  await mkdir(path.join(cwd, "src"));
  await writeFile(path.join(cwd, "src/index.js"), "before");
  return cwd;
}

const PROTECTED = ["regulator/identity/", "vendor/"];

test("prepareWritePath refuses every route to a protected path and lets an ordinary write through as the one path it checked", async (t) => {
  const cwd = await project(t);
  const refuse = async (input: unknown, cause: string) => {
    const r = await prepareWritePath(cwd, input, { protectedPaths: PROTECTED });
    assert.equal(r.allowed, false, String(input));
    assert.equal(!r.allowed && r.cause, cause, String(input));
  };
  for (const input of ["regulator/identity/INVARIANTS.md", "./regulator/identity/INVARIANTS.md", "@regulator/identity/INVARIANTS.md", "regulator\\identity\\INVARIANTS.md", "regulator//./identity/new.md", "vendor/left-pad.js", "vendor/deeper/x.js", "vendor", "regulator/identity"]) await refuse(input, "protected");
  await refuse("regulator", "protected");
  for (const input of ["../x.js", "src/../../x.js", "~/x.js", "file:///tmp/x", "@../x.js"]) await refuse(input, "traversal");
  for (const input of ["", ".", "./", "@", "src/\0", undefined, 42]) await refuse(input, "malformed");
  for (const input of ["vsm/IDENTITY.md", "vsm/channels.yaml"]) await refuse(input, "protected");
  const ok = await prepareWritePath(cwd, "@src/index.js", { protectedPaths: PROTECTED });
  assert.deepEqual(ok, { allowed: true, normalizedPath: "src/index.js", path: "./src/index.js" });
  const fresh = await prepareWritePath(cwd, "src/new/dir/file.js", { protectedPaths: PROTECTED });
  assert.equal(fresh.allowed, true, "missing parents are Pi's to create");
  assert.equal((await prepareWritePath(cwd, "vsm/IDENTITY.md", { authority: "s5-authority" })).allowed, true, "S5 authority is the caller's to grant, never the argument's");
});

test("filesystem aliases cannot bypass the lexical check: symlinks, hard links, dangling links and non-directory parents are refused", async (t) => {
  const cwd = await project(t);
  const outside = await mkdtemp(path.join(tmpdir(), "regulator-outside-"));
  t.after(() => rm(outside, { recursive: true, force: true }));
  await symlink(path.join(cwd, "regulator/identity/INVARIANTS.md"), path.join(cwd, "notes.md"));
  await symlink(path.join(cwd, "regulator"), path.join(cwd, "docs"));
  await symlink(outside, path.join(cwd, "elsewhere"));
  await symlink(path.join(outside, "missing"), path.join(cwd, "dangling"));
  await symlink("loop", path.join(cwd, "loop"));
  await link(path.join(cwd, "vendor/left-pad.js"), path.join(cwd, "src/pad.js"));
  for (const input of ["notes.md", "docs/identity/INVARIANTS.md", "elsewhere/new.js", "dangling/new.js", "loop/x.js", "src/pad.js", "src/index.js/child"]) {
    const r = await prepareWritePath(cwd, input, { protectedPaths: PROTECTED });
    assert.equal(r.allowed, false, input);
    assert.equal(!r.allowed && r.cause, "alias", input);
  }
  assert.equal((await prepareWritePath(path.join(cwd, "missing-root"), "src/index.js")).allowed, false, "an unresolvable root fails closed");
});

test("isUnderProtectedPath: a prefix covers itself and everything beneath; an exact path covers only itself", () => {
  assert.equal(isUnderProtectedPath("vendor/x.js", PROTECTED), "vendor/");
  assert.equal(isUnderProtectedPath("vendor", PROTECTED), "vendor/");
  assert.equal(isUnderProtectedPath("vendored/x.js", PROTECTED), undefined);
  assert.equal(isUnderProtectedPath("vsm/IDENTITY.md", ["vsm/IDENTITY.md"]), "vsm/IDENTITY.md");
  assert.equal(isUnderProtectedPath("vsm/IDENTITY.md.bak", ["vsm/IDENTITY.md"]), undefined);
});
