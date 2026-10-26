# 4. Your first spec, from idea to done

A full walkthrough with the harness. Do it by hand the first time so you see
each gate; then try delegating it to the agent.

## Step 0 — Prepare the project

1. Fill in `docs/project/architecture.md`, `conventions.md`, and `verification.md`. Without that, the agent will invent the architecture.
2. In `harness.config.json`, point `tests.dirs` at where your tests will live and add your commands under `verify`:

   ```json
   "verify": [
     { "name": "lint", "run": "npm run lint" },
     { "name": "tests", "run": "npm test" }
   ]
   ```

3. `npm run harness -- check` must be green.

## Step 1 — Start from the idea

```bash
npm run harness -- new "I want users to be able to reset their password by email" --title "Reset password"
npm run harness -- status
```

This creates `specs/001-reset-password/spec.md` in `idea` status, with the original
phrase in section 0. That phrase is not edited: at the end you will compare how much it grew.

## Step 2 — Turn it into a spec (spec-writer)

Do it by hand, or ask the agent: *"You are the spec-writer, follow `harness/agents/spec-writer.md` for spec 001"*.

A sentence like that leaves many decisions open. The ones you do not have clear
go in "Open questions" as `- [ ] ...`:

- What do we respond if the email does not exist? (do not leak which emails are registered!)
- How long does the link last? Can it be used more than once?
- What happens if two links are requested in a row? Does the first one still work?
- Is there a request limit per email or per IP?
- What rules does the new password have?
- Are open sessions closed when it is changed?

```bash
npm run harness -- move 001 draft
```

## Step 3 — Try to approve it with open questions

```bash
npm run harness -- move 001 approved --by <your-name>
```

If any `- [ ]` remains, the harness rejects it:

```
✘ 001: draft → approved rejected by the gate:
   - has 2 unresolved open question(s) in the "Open questions" section
```

Answer them: mark them `- [x]` and record the decision in section 9. Then approve again.
If an agent tries to approve it for you, the agent hook (Cursor or Claude Code) asks you for confirmation.

## Step 4 — Plan (planner)

```bash
npm run harness -- plan 001
```

Fill in `plan.md` and `tasks.md`. If a task does not mention an AC, `move 001 planned` tells you which one is missing.

## Step 5 — Implement (implementer)

```bash
npm run harness -- move 001 in_progress
```

For each task: tests with `[AC-n]`, watch them fail, implement, run `npm run harness -- check`, and mark `[x]`.
`npm run harness -- trace` shows with `○` the criteria that still have no test.

## Step 6 — Review (reviewer)

```bash
npm run harness -- move 001 review
```

Ask a **different** agent, without the context of whoever implemented, to act
as reviewer (`harness/agents/reviewer.md`). Only with `**Verdict:** APPROVED`
in `progress/review_001.md` can you move to done:

```bash
npm run harness -- move 001 done
```

## Variant: everything with one prompt

With the harness ready, ask the agent only *"follow AGENTS.md and advance
spec 001 as far as you can"*. Notice when it stops and asks you for
approval, and which reports land in `progress/`.
