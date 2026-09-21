# VSM-Pi native Pi extension

This package registers a typed `tool_call` handler for Pi's built-in `write` and
`edit` tools. Every intercepted call uses `authorizeWrite(path, "operational")`
from core before execution. There is no model-controlled authority flag and no
S5 approval command. Protected writes return a block reason directing the agent
to `vsm_propose_policy_change` in a host-authorized reporting context, or to the
project owner. A proposal never approves a write.

## Load from this repository

From the **project root**, using Node >=22.19.0 and pnpm 10.12.1:

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm pi
```

The root script runs the pinned Pi CLI with
`pi -e ./packages/pi-extension/dist/index.js`. With that same Pi version already
available, the equivalent documented extension mechanism is:

```sh
pi -e ./packages/pi-extension/dist/index.js
```

For another project, run Pi from that project's root and pass an absolute path
to this repository's built `packages/pi-extension/dist/index.js`. `ctx.cwd` is
the trusted project root; the extension does not discover Git roots or change
working directories. Build the workspace before loading because the core
package exports compiled JavaScript. The package's `pi.extensions` metadata
also identifies the compiled entry for Pi package loading.

Compatibility is pinned to the supported upstream
`@earendil-works/pi-coding-agent` **0.87.0**, both as the host peer dependency and
the repository development CLI. The repository engine and CI minimum are
**Node 22.19.0**, matching that host's requirement. Pi's own SDK brings its CLI
dependencies; protocol and core still have no Pi dependency.

The generic adapter's event and path semantics are tested against this pinned
host. GSD's independently versioned `@gsd/pi-coding-agent` is a separate host
binding; its adapter must compile and test against GSD's actual supported API.
No GSD compatibility is inferred from upstream Pi's version number.

## Path and authority contract

- Absolute paths (including paths inside the project), Windows drive paths,
  file URLs, home expansion, and any `..` component are blocked. Use
  project-relative paths.
- Pi's leading `@` and Unicode-space expansion is applied before checking.
  Slashes/backslashes and `.` components are normalized; accepted tool input is
  rewritten with a `./` prefix so execution uses the checked path without a
  second leading-prefix expansion. A compatibility test compares the adapter
  with the pinned host's real write-tool path preparation.
- Existing symlink components, dangling symlinks, hard-linked files, non-regular
  targets, and inaccessible parents fail closed. This deliberately restricts
  writes through aliases, including aliases to ordinary files. Missing parents
  are allowed so Pi can create ordinary new files and directories.
- Protected paths remain those defined by core; they cannot be used as parent
  directories either. Other project files, including
  unprotected files under `vsm/`, can be written. A proposal or an input field
  claiming `s5-authority` cannot grant write permission.

## Enforcement boundary

This is a **native-engine `tool_call` preflight gate**, following Pi's
[extension event contract](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/extensions.md#tool_call).
It only protects calls routed through that hook to the standard local `write`
and `edit` implementations. It does not sandbox the process or enforce S5
policy across every engine or filesystem writer.

Shell commands (including Pi `bash`), custom tools, direct tool `execute()` calls,
remote/replaced tool implementations, and engines that bypass the native hook
are outside this gate. Trusted extensions can also change arguments after this
handler. Filesystem checks are not atomic with tool execution: another writer
can change links or paths between preflight and execution. Do not treat this
as isolation against hostile extensions or concurrent filesystem mutation.

For a session that does not need shell/custom tools, Pi's supported active-tool
allowlist reduces the available write routes:

```sh
pnpm pi --tools read,write,edit
```

The extension does not silently change the user's tool set. Cross-engine
protection needs engine-supported interception or tool restrictions, and
stronger filesystem isolation where required. No GSD lifecycle state,
autonomous turns, or S5 mutation workflow are added here.

## Verification without a live model

From the repository root:

```sh
pnpm typecheck
pnpm --filter @metacoding/vsm-pi-extension test
pnpm test
pnpm check
```

The focused suite mocks registration and handler calls, tests both tools and
all core-protected paths, rejects unsafe paths and filesystem aliases, and
checks ordinary calls and unrelated tools. Its SDK smoke test loads the built
entry through `DefaultResourceLoader`, creates an in-memory Pi session, and
invokes the real native `beforeToolCall` hook. It verifies block decisions for
protected writes/edits and executes allowed calls with Pi's actual tools in a
temporary project. It uses isolated temporary model/auth storage with network
refresh disabled, no credentials or live model, and no persisted session.

To see each test's result directly after building:

```sh
node packages/pi-extension/dist/index.test.js
```

## Typed reporting tools (M0.3)

The extension also registers `vsm_propose_policy_change`,
`vsm_report_audit_finding`, and `vsm_report_uncertainty`. The default host context
has no reporting grants. A trusted host may use `createVsmPiExtension()` to
supply explicit capabilities through `resolveReportingContext`; no model payload
can grant authority. Successful calls commit to the separate VSM SQLite store
before returning receipts. See [the reporting guide](../../docs/REPORTING.md)
for host setup, closed schemas, examples, persistence semantics, and verification.
