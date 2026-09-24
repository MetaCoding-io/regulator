# Pi feature coverage matrix

The course promises that a learner acquires Pi's feature base *as a by-product* of
building a harness. This matrix is how that promise is checked. Every Pi documentation
page and every extension API area is listed with the module that teaches it, or with an
explicit statement that it is out of scope. A blank cell is a gap, not an oversight to
be discovered by a learner mid-lab.

It also serves as the upgrade checklist (`packages/regulator/OPERATING.md`, "Upgrading"): when
the pinned Pi version moves, walk the rows.

Source of truth for the left-hand column: `packages/coding-agent/docs/` in
`earendil-works/pi`, at the version pinned in the course starter repo.

## 1. Documentation pages

| Pi doc | Taught in | How it shows up |
| --- | --- | --- |
| `quickstart.md` | M01 | Install, provider setup, first session |
| `usage.md` | M01 | Commands, modes, `-e` loading |
| `tui.md` | M01, M13 | Orientation; then custom status, widgets, dialogs |
| `sessions.md` | M01, M14 | `/tree`, `/fork`, `/clone`, `/export`, `/share`; counterfactual branches |
| `session-format.md` | M14 | Session file as durable record; replay |
| `compaction.md` | M07 | Threshold compaction, custom summarization, summary format, branch summaries |
| `skills.md` | M04 | Capability loaded on demand; authoring and validation |
| `prompt-templates.md` | M04 | Parameterized templates as selectable profiles |
| `settings.md` | M07, M12, M15 | Budget/compaction settings; project overrides; team distribution |
| `extensions.md` | M02–M15 | See §2 |
| `sdk.md` | M06 | Session runtime as the dispatch driver; run modes; `ResourceLoader` |
| `rpc.md` | M11, M15 | Non-Node consumers; IDE and product integration |
| `json.md` | M11, M14, M15 | Machine-readable event stream; CI/headless |
| `packages.md` | M10, M15 | Trust and production-only installs; distributing the harness |
| `providers.md` | M01, M07 | Provider setup; failover and per-phase routing |
| `models.md` | M07 | Custom models, per-model overrides |
| `custom-provider.md` | M07, M11 | `pi.registerProvider`; a different model for intelligence |
| `llama-cpp.md` | M07 | Local models for cheap phases |
| `security.md` | M05, M10 | No built-in sandbox; untrusted/unmonitored work; project trust |
| `containerization.md` | M05, M15 | Actual isolation for untrusted or unattended runs |
| `environment-variables.md` | M15 | Headless/CI configuration |
| `keybindings.md` | M15 | Daily ergonomics; `pi.registerShortcut` in M13 |
| `themes.md` | M15 | Ergonomics only |
| `terminal-setup.md` | M15 | Ergonomics only |
| `tmux.md` | M15 | Ergonomics only |
| `shell-aliases.md` | M15 | Mentioned |
| `development.md` | M03 | Extension testing patterns |
| `termux.md` | — | **Out of scope**: platform setup |
| `windows.md` | — | **Out of scope**: platform setup |

## 2. Extension API surface (`extensions.md`)

| Area | API | Taught in |
| --- | --- | --- |
| Loading and locations | `-e`, user/project/package locations, precedence | M01, M15 |
| Factory and lifecycle | sync/async factories, long-lived resources, shutdown | M02, M03 |
| Startup events | `project_trust`, `resources_discover`, `session_start` | M02, M10 |
| Session events | `session_before_switch/fork/compact/tree`, `session_compact*`, `session_info_changed`, `session_shutdown` | M02, M07, M14 |
| Agent events | `before_agent_start`, `agent_start/end`, `agent_before_settle`, `agent_settled` | M02, M04, M08, M13 |
| Turn and provider events | `turn_start/end`, `context`, `context_with_system`, `before_provider_headers/request`, `after_provider_response`, `cache_warming_decision` | M02, M07 |
| Tool events | `tool_execution_*`, `tool_call` (block), `tool_result` (modify) | M02, M09, M10 |
| Model events | `model_select`, `thinking_level_select` | M07 |
| Input and shell events | `input`, `user_bash` | M02, M05 |
| `ExtensionContext` | `cwd`, `mode`, `hasUI`, `signal`, `isProjectTrusted`, `getContextUsage`, `compact`, `getSystemPrompt`, `isIdle`/`abort`/`hasPendingMessages` | M02, M05, M07, M13 |
| Command context | `newSession`, `fork`, `navigateTree`, `switchSession`, `waitForIdle`, `reload` | M06, M14 |
| Tools | `registerTool`, typebox schemas, `StringEnum`, `prepareArguments`, `execute` signature, `details` vs `content`, `terminate`, truncation, overriding built-ins, dynamic loading, remote execution | M03 |
| Tool surface | `getActiveTools`, `getAllTools`, `setActiveTools`, `--tools` | M04, M10 |
| Messages and entries | `sendMessage`, `sendUserMessage`, `appendEntry`, `setLabel` | M06, M09 |
| Commands, flags, shortcuts | `registerCommand`, `getCommands`, `registerFlag`, `registerShortcut` | M04, M13 |
| Session naming | `setSessionName`, `getSessionName` | M14 |
| Models | `setModel`, `getThinkingLevel`/`setThinkingLevel`, `scopedModels` | M04, M07 |
| Providers | `registerProvider`, `unregisterProvider` | M07, M11 |
| Process execution | `pi.exec` | M03, M05, M09 |
| State management | extension state across sessions | M12 |
| Custom UI | dialogs, timed dialogs, `AbortSignal` dismissal, widgets, status, footer/header, autocomplete, custom components, custom editor, overlay mode | M13, M15 |
| Rendering | `renderCall`, `renderResult`, message/entry renderers, markdown transformers, theme colors | M03, M13 |
| Error handling and mode behaviour | headless vs TUI, `ctx.hasUI` | M13 |
| Event bus | `pi.events` | M14 |

## 3. Example extensions used as reading

| Example | Module |
| --- | --- |
| `hello.ts`, `commands.ts` | M01, M02 |
| `tools.ts`, `dynamic-tools.ts`, `tool-override.ts`, `truncated-tool.ts`, `structured-output.ts`, `ssh.ts` | M03 |
| `preset.ts`, `claude-rules.ts`, `system-prompt-header.ts`, `question.ts` | M04, M12 |
| `bash-spawn-hook.ts`, `dirty-repo-guard.ts`, `git-checkpoint.ts`, `git-merge-and-resolve.ts`, `project-trust.ts`, `sandbox/` | M05 |
| `custom-compaction.ts`, `summarize.ts`, `trigger-compact.ts`, `provider-payload.ts`, `custom-provider-*` | M07 |
| `permission-gate.ts`, `confirm-destructive.ts`, `protected-paths.ts`, `timed-confirm.ts` | M10 |
| `subagent/`, `plan-mode/`, `dynamic-resources/`, `file-trigger.ts`, `handoff.ts`, `github-issue-autocomplete.ts` | M11 |
| `questionnaire.ts`, `qna.ts`, `notify.ts`, `status-line.ts`, `custom-footer.ts`, `custom-header.ts`, `widget-placement.ts` | M13 |
| `event-bus.ts`, `session-name.ts` | M14 |
| `with-deps/`, `plugins/pi-example-plugin`, `reload-runtime.ts`, `shutdown-command.ts` | M15 |
| `rpc-demo.ts`, `rpc-extension-ui.ts`, `sdk/01–13` | M06, M11, M15 |
| `doom-overlay`, `snake.ts`, `space-invaders.ts`, `tic-tac-toe.ts`, `pirate.ts`, `rainbow-editor.ts` | — (not used; demonstrations of UI reach, no regulatory content) |

## 4. Honest coverage notes

- **Ergonomics pages** (themes, keybindings, terminal setup, tmux, shell aliases) are
  covered in M15 as a survey, not a lab. The course does not pretend otherwise.
- **Custom UI** is taught only to the depth that escalation and status need. A learner
  who wants a rich TUI extension gets pointers, not a module.
- **Custom providers and local models** are covered in M07 as failover and cost
  mechanisms. Writing a provider adapter from scratch is out of scope.
- **RPC** is taught as an integration surface, not protocol by protocol; the reference
  build's headless entry point uses JSON mode, not RPC.
- **Platform pages** (Termux, Windows) are out of scope by design.

If a future Pi release adds a documentation page, it gets a row here before it gets a
mention in a module.
