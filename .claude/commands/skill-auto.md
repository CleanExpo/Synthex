# Skill Auto-Select & Generate Command

**Usage**: `/skill-auto [optional: task description]`

Automatically identify, invoke, and (if needed) generate the best skill(s) for the
current task. Run this at the start of any task where you are unsure which skill applies,
or to guarantee the right specialised skill is loaded before work begins.

---

## What This Command Does

1. **Analyse the task** — understand what is being asked (build, fix, audit, deploy, verify, etc.)
2. **Scan available skills** — match task keywords against all skills in `.claude/skills/` and loaded skills
3. **Invoke matching skills** — use the Skill tool to load every applicable skill
4. **Generate missing skills** — if no matching skill exists, create a new specialised skill on the fly

---

## Step 1: Task Analysis

Read the task description (from `$ARGUMENTS` or the current conversation context).

Classify into one or more categories:

| Category    | Keywords                                              | Likely skills                          |
| ----------- | ----------------------------------------------------- | -------------------------------------- |
| Build       | new feature, add, create, implement, scaffold         | feature-dev, spec-generator, ui-ux     |
| Fix         | bug, broken, error, not working, failing              | browser-debug, api-testing             |
| Verify      | check, confirm, works, visible, pass                  | browser-verify, site-smoke-test        |
| Deploy      | deploy, ship, release, production, Vercel             | build-orchestrator, vercel:deploy      |
| Auth        | login, auth, session, JWT, RBAC, Supabase             | auth-patterns, browser-auth            |
| Database    | schema, migration, Prisma, model, query               | database-prisma, sql-hardener          |
| API         | route, endpoint, REST, POST, GET, Zod                 | api-testing, route-auditor             |
| UI          | component, page, layout, style, Tailwind              | ui-ux, ui-review, design               |
| Security    | vulnerability, CORS, rate limit, injection            | security-hardener, route-auditor       |
| SEO         | search, keywords, schema, GEO, ranking                | seo-geo-architect, seo-technical-audit |
| Code review | review, quality, refactor, clean up                   | code-review, architecture-enforcer     |
| Browser     | browser, Chrome, screenshot, console                  | browser-verify, browser-debug          |
| Content     | content, post, campaign, social                       | content-pipeline, platform-showcase    |

---

## Step 2: Skill Matching

For the identified categories, attempt to load skills in this priority order:

1. **Exact match** — skill name directly matches the task type
2. **Domain match** — skill covers the domain (e.g. `auth-patterns` for any auth work)
3. **Process match** — skill covers the workflow (e.g. `build-orchestrator` for deploy tasks)

**Invoke each matching skill using the Skill tool:**

```
Skill tool: { skill: "matching-skill-name" }
```

Multiple skills can apply. Load all that are relevant.

---

## Step 3: Gap Detection

After matching, check: **Is there a skill specifically for this exact task?**

Signs a new skill is needed:
- The task is highly specialised (e.g. "generate weekly advisor metrics brief")
- No existing skill covers the exact workflow
- The task has a repeatable pattern that will occur again
- The task involves a specific Synthex integration not covered by existing skills

If a gap is detected: **proceed to Step 4**.
If all needs are covered: **skip to Step 5**.

---

## Step 4: Generate Missing Skill

Use the skill-creator pattern to generate a new specialised skill.

### Skill structure to create:

**Path**: `.claude/skills/<skill-name>/SKILL.md`

**Template:**

```markdown
---
name: <skill-name>
description: >-
  [One paragraph: what this skill does, when to use it,
   trigger phrases that should auto-invoke it]
metadata:
  author: synthex
  version: '1.0'
  type: action-skill | reference-skill
  triggers:
    - [trigger phrase 1]
    - [trigger phrase 2]
    - [trigger phrase 3]
context: fork
---

# [Skill Name]

## Purpose
[Why this skill exists and what problem it solves]

## Protocol
[Step-by-step instructions for executing this skill]

## Output Format
[What the output should look like]

## Pass / Fail Rules (if applicable)
[When to consider the task done]
```

**Rules for generated skills:**
- `type: action-skill` if the skill takes actions (browser, code, deploy)
- `type: reference-skill` if the skill is a pattern guide (architecture, standards)
- Trigger phrases must be natural language — what a developer would actually say
- Keep the protocol steps numbered and unambiguous
- Include at least one concrete code example or command

After creating the skill file: **immediately invoke it** to load it for the current task.

---

## Step 5: Report & Proceed

Output a brief skill-selection report, then begin the task using the loaded skills.

```markdown
## Skill Auto-Select Report

**Task classified as:** [category]
**Skills loaded:**
- [skill-name]: [one-line reason it applies]
- [skill-name]: [one-line reason it applies]

**New skill generated:** [skill-name | None]

**Proceeding with task...**
```

---

## Everyday Usage Examples

| User says                              | Skills auto-selected                          |
| -------------------------------------- | --------------------------------------------- |
| "add advisor page to sidebar"          | ui-ux, auth-patterns                          |
| "why is the dashboard blank?"          | browser-debug, browser-verify                 |
| "deploy to production"                 | build-orchestrator, vercel:deploy             |
| "add a new API route for team stats"   | api-testing, route-auditor, database-prisma   |
| "check if synthex.social is working"   | site-smoke-test, browser-verify               |
| "fix the failing tests"                | api-testing, database-prisma                  |
| "add JSON-LD schema to client pages"   | → generates new `json-ld-schema` skill        |
| "write a cron job for weekly digest"   | build-orchestrator, database-prisma           |
| "review this PR"                       | code-review, security-hardener, api-testing   |
