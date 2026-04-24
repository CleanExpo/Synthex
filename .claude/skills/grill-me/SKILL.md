---
name: grill-me
description: Forces explicit scope clarification before any code change. Invoked at Stage 2 of the Synthex development loop (see prd.md). Produces 3–7 scope-defining questions and waits for human confirmation before implementation begins. No code may be written until the Grilled scope is written to HANDOFF.md.
---

# /grill-me

## When to invoke

Every non-trivial task enters this skill **before any code is written**. The loop protocol (see `prd.md`) makes this Stage 2.

Trivial exceptions (skip Grill-Me):

- Typo fixes in existing text
- Pure dependency bumps with no code change
- Reverting a single commit at Phill's direct request

Everything else — Grill-Me first.

## Contract

1. **Read the ticket.** Use Linear MCP to fetch the Linear issue referenced in the current loop. If no Linear ID is in scope, stop and ask for one.
2. **Read only what the ticket names.** Do not explore the codebase beyond the files and directories the ticket explicitly mentions, plus any files the user has pointed at in this session. Token discipline.
3. **Produce 3–7 numbered questions.** Each question must cover one of:
   - Scope boundaries — what is explicitly out of scope?
   - Data model — new tables, enum extensions, migration story?
   - Failure modes — what happens if this breaks in production?
   - Auth / authorisation — public? org-scoped? admin-only?
   - Rollback — reversible without data loss?
   - Acceptance — what does "done" look like in one sentence?
   - Human gates — what needs a human before or after this ships?
4. **State your assumption per question.** If the question is unanswered, that assumption is what you will proceed with.
5. **Wait.** Do not continue to implementation until Phill responds with either:
   - Direct answers per question
   - The literal token `proceed with assumptions`
   - The literal token `reject` (abandons the loop)

## Output format

```
## Grill-Me — <SYN-XXX>

**Read:** ticket + <files>

**Scope as I understand it:** <one sentence>

**Questions:**

1. <question>
   *Assumption if unanswered:* <fallback>

2. <question>
   *Assumption if unanswered:* <fallback>

... (up to 7)

**What I will NOT do in this loop:** <one-sentence exclusion list>

Reply with answers, `proceed with assumptions`, or `reject`.
```

## After confirmation

Append the confirmed scope to `.claude/loop/HANDOFF.md` under `## Grilled`:

```
### <SYN-XXX> — <date>

**Confirmed scope:** <one or two sentences>

**Key decisions:**
- <decision> — <reason>
- <decision> — <reason>

**Out of scope:** <exclusion list>
```

Then — and only then — begin implementation.

## Hard rules

- **No code before confirmation.** Write, Edit, and NotebookEdit are off-limits until Grilled scope is written.
- **No more than 7 questions.** If the scope needs more, the task is too big — break it into two loops.
- **No leading questions.** Do not ask "you want X, right?" — ask the question neutrally and state your assumption separately.
- **One Linear ticket per Grill-Me.** Compound scopes are forbidden (see prd.md §8).
