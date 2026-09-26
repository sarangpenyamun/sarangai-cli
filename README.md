# SarangAI CLI

SarangAI CLI is an **autonomous terminal coding agent** that lives entirely inside your shell. It drives five locked, coding-tuned frontier models through a single gateway, executes file edits directly on disk, and renders everything inside a hand-rolled **Alternate Screen Buffer TUI** that never flickers, never scrolls your layout out of view, and never dumps raw code walls over your prompt.

```
███████╗ █████╗ ██████╗  █████╗ ███╗   ██╗ ██████╗  █████╗ ██╗
██╔════╝██╔══██╗██╔══██╗██╔══██╗████╗  ██║██╔════╝ ██╔══██╗██║
███████╗███████║██████╔╝███████║██╔██╗ ██║██║  ███╗███████║██║
╚════██║██╔══██║██╔══██╗██╔══██║██║╚██╗██║██║   ██║██╔══██║██║
███████║██║  ██║██║  ██║██║  ██║██║ ╚████║╚██████╔╝██║  ██║██║
╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═══╝ ╚═════╝ ╚═╝  ╚═╝╚═╝
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
● Account: SA-8WWREVSJ  |  Tier: DEVELOPER  |  ⚡ Balance: 55,318
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Why SarangAI

- **Zero-flicker, fixed-layout TUI** — the entire interface is repainted as one atomic ANSI frame per change; only dirty rows are rewritten while idle. No tearing, no runaway escape sequences, no autoscroll chaos.
- **Persistent layout** — the ASCII header, account line, and model line are locked to the top; the rounded prompt box is locked to the bottom; the content viewport sits between them, pinned to the bottom (sticky scroll). Modals (the model selector) paint *over* the viewport without shifting any other region.
- **Multi-turn FIFO context memory** — every completed task is distilled into a strict summary (touched files + core explanation) and kept in an in-memory session history. The last 6 turns (≤ 12,000 chars, trimmed at intact line boundaries) ride along with each request, so follow-up tasks understand previous instructions without blowing the token budget.
- **Silent file execution** — the agent emits structured file-operation tags; the CLI parses and applies them straight to disk and prints only a clean report. Reasoning monologue is captured internally and never printed.

## Locked Model Roster

Five models are permanently registered — the roster cannot drift. Pick by workload:

| Alias | Model ID | Role | Recommended for |
|---|---|---|---|
| `glm` | `z-ai/glm-5.3-flash` | Rapid Scaffolder | **Recommended default.** Instant execution for scaffolding new projects, boilerplate, and everyday scripting. |
| `sonnet` | `anthropic/claude-sonnet-4.6` | Deep Architect & Refactor | Architecture design, systematic refactoring, and complex multi-module codebase changes. |
| `luna` | `openai/gpt-5.6-luna` | Fast Precision & Fixer | Fast precision work: bug fixes, edge-case analysis, and strict verification. |
| `deepseek` | `deepseek/deepseek-v3.2` | Logic & Algorithm Engineer | Core logic, algorithms, and query/performance optimization. |
| `mimo` | `xiaomi/mimo-v2.5-pro` | Fullstack & Multimodal Agent | Fullstack development and multimodal workflows (logs, traces, build automation). |

## Core Architecture Highlights

- **Alternate Screen Buffer isolation** — the TUI enters with `\x1b[?1049h` and restores your shell exactly with `\x1b[?1049l`; your scrollback is never touched.
- **Fixed header with live balance** — ASCII branding plus `● Account | Tier | ⚡ Balance` fetched in real time from the gateway (`/api/gateway/v1/balance`) and refreshed after every task.
- **Floating in-place ticker** — a single status line directly above the prompt box updates in place (`Analyzing… → Reading context files… → Applying code changes… → Done`) with a spinner and elapsed seconds; it never reflows other rows.
- **Interactive startup selector** — the first thing you see. Navigate with `↑`/`↓` or `j`/`k`, quick-pick with `1`–`5`, confirm with `Enter`. `Ctrl+C`, `Esc`, or `q` aborts cleanly (terminal restored, exit code 0) — you are never forced to pick a model to leave.
- **Direct disk mutations, no code dumps** — `WRITE_FILE` (create/rewrite) and `REPLACE…WITH` (byte-exact `str_replace` edits) are parsed from the response and applied silently; the terminal only shows the file list and a concise summary.
- **Strict typo rejection** — an unknown `/model` argument is an error, never a silent fallback.
- **Ad-free & sponsor-free** — the agent prompt itself forbids promotional content; no sponsored tasks, no external advertising, ever.

## Installation

Requirements: **Node 18+** (tested on Node 20 LTS).

```bash
npm install -g sarangai-cli
```

Or run from a clone of this repository:

```bash
npm install
npm run build
node dist/index.js
```

### Authentication

SarangAI reads its gateway credentials from, in order:

1. `SARANGAI_TOKEN` / `SARANGAI_API_KEY` environment variables
2. `apiKey` in `~/.sarangairc`

`~/.sarangairc` also accepts `baseUrl` (default `https://idshop.or.id`) and `defaultModel` (`glm | sonnet | luna | deepseek | mimo`).

## CLI Commands & Navigation

### Starting a session

```bash
sarang                # header → interactive model selector → workspace
sarang run            # same as above
sarang -m sonnet      # skip the selector, start directly on a model
sarang run "build a REST API with express"   # start with an initial task
```

On startup the selector is mandatory (you cannot cancel your way past it): highlight a model, press `Enter` (or hit its number), and the workspace activates with the prompt `sarang(<alias>)>`.

### REPL slash commands

| Command | Effect |
|---|---|
| `/model` | Reopen the interactive model selector mid-session (`Esc`/`q` cancel is allowed here). |
| `/model <alias>` | Switch instantly, e.g. `/model sonnet`. Header and prompt box update in place. |
| `/clear` | Wipe the viewport **and** the multi-turn session memory (`Session memory cleared.`). |
| `exit` / `quit` | Leave the workspace (`Goodbye! Workspace closed.`). |

Anything that is not a slash command is treated as a coding task and executed autonomously.

### Strict model argument validation

Typos are rejected loudly instead of silently falling back:

```
✖ Model 'sonneth' not found. Available: glm, sonnet, luna, deepseek, mimo.
```

The active model is left untouched; fix the alias and retry.

### Keyboard map (selector)

| Key | Action |
|---|---|
| `↑` / `↓` or `j` / `k` | Move the highlight (wraps around) |
| `1` – `5` | Select that model directly |
| `Enter` | Confirm the highlighted model |
| `Ctrl+C` / `Esc` / `q` | Abort — startup mode exits the app; session mode just closes the menu |

## Prerequisites & Developer Workflows

- **Node 18+** (project is exercised on Node 20 LTS).
- A gateway API key in `~/.sarangairc` or `SARANGAI_API_KEY`.

```bash
npm run build     # bundle to dist/ with tsup
npx tsc --noEmit  # typecheck
npm test          # run the vitest suite (61 tests)
npm run test:watch
```

The test suite covers the locked model roster, the pure model-selector logic, strict argument validation, the `WRITE_FILE`/`REPLACE` parsers, multi-turn memory budgets, the Codebuff-style prompt assembly, and TUI layout primitives.

## Project Layout

```
src/
├── index.ts             # CLI entry, REPL session, startup flow, slash commands
├── constants.ts         # Locked model roster + strict model lookup
├── config.ts            # ~/.sarangairc persistence
├── core/
│   ├── workspace.ts     # Autonomous agent loop, context assembly, file exec
│   ├── prompt-builder.ts# Codebuff-style task-first / rules-last prompt assembly
│   ├── memory.ts        # Bounded multi-turn conversation memory
│   ├── gateway.ts       # Streaming chat completions client
│   ├── auth.ts          # Credential detection + real-time balance
│   ├── fs-agent.ts      # Safe file read/write primitives
│   ├── scanner.ts       # Project tree scanning
│   └── history.ts       # Optional on-disk session records
└── ui/
    ├── tui.ts           # Alternate Screen Buffer TUI (atomic frame renderer)
    ├── model-menu.ts    # Pure model-selector state machine + rendering
    └── banner.ts        # ASCII banner + account line
```

## License

MIT © SarangAI
