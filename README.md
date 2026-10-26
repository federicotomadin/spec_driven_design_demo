# Spec-Driven Design — framework + harness

A small framework to take **an idea → a spec → verified code**,
built for working with AI agents without skipping steps:

- **Specs as the unit of work**, with a lifecycle (`idea → draft → approved → planned → in_progress → review → done`) and gates a program verifies.
- **A generic harness** (`harness/`, no dependencies) that works with any stack. Configure it in `harness.config.json`.
- **Agent roles** (leader, spec-writer, planner, implementer, reviewer) that leave everything in `progress/`.
- **Cursor and Claude Code hooks** that require human approval and verify state on close.

## Get started

Requires Node.js 20 or later. There are no dependencies to install.

1. Fill in `docs/project/architecture.md`, `conventions.md`, and `verification.md`.
2. In `harness.config.json`, configure where your tests live (`tests.dirs`) and your verification commands (`verify`).
3. Confirm everything is green:

   ```bash
   npm run harness -- check
   ```

## Start from an idea

```bash
npm run harness -- new "I want users to be able to reset their password by email" --title "Reset password"
```

Then, in Cursor, ask the agent: **"follow AGENTS.md and advance spec 001"**.
The agent takes the matching role, returns the spec with open questions,
and stops until you approve it:

```bash
npm run harness -- move 001 approved --by <your-name>
```

## Commands

| Command | What it does |
|---------|--------------|
| `npm run harness -- new "<idea>" --title "..."` | Creates `specs/NNN-slug/spec.md` in `idea` status |
| `npm run harness -- status` | Status of each spec and the next step |
| `npm run harness -- next-ac` | Next free criterion ID |
| `npm run harness -- plan <id>` | Creates `plan.md` and `tasks.md` from the templates |
| `npm run harness -- move <id> <status>` | Changes status if the gate passes |
| `npm run harness -- check` | Full verification (at start and close) |
| `npm run harness -- trace` | Traceability between criteria and tests only |

## Guide

1. [What is Spec-Driven Design?](docs/01-what-is-sdd.md)
2. [The flow, step by step](docs/02-flow.md)
3. [How to write a good spec](docs/03-how-to-write-a-spec.md)
4. [Your first spec, from idea to done](docs/04-exercise.md)
5. [The framework: specs + harness](docs/05-framework-and-harness.md): lifecycle, gates, roles, hooks, and how to use it in your project

## Structure

```
AGENTS.md              map for agents (entry point)
CHECKPOINTS.md         what "correct final state" means
harness.config.json    verification commands and where tests live  ← per project
harness/cli.js         new · plan · status · move · check · trace · next-ac
harness/agents/        roles: leader, spec-writer, planner, implementer, reviewer
templates/             spec, plan, and task templates
specs/                 one folder per spec: spec.md, plan.md, tasks.md  ← source of truth
progress/              session state, log, and agent reports
docs/project/          architecture, conventions, verification  ← per project
.cursor/hooks*         human approval + check on close (Cursor)
.claude/               same hooks for Claude Code
```

## The golden rule

**Change the spec first, then the code.** If `npm run harness -- check` is
red, the code and the specs are not aligned.
