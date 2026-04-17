# Execution Protocol

Read this before making any changes.

## Discipline rules

1. Read `PLAN.md` — understand the full milestone sequence before touching any file.
2. Make changes in the smallest atomic unit possible. One milestone at a time.
3. After each milestone: verify with the command listed in `PLAN.md` for that milestone.
4. On failure: repair immediately before proceeding to the next milestone.
5. Update `STATUS.md` after every milestone with:
   - What was done (1-2 sentences)
   - Any surprises or deviations from the plan
   - What comes next

## Code standards

- Match existing code style exactly — no reformatting of unrelated code.
- No debug prints, TODO stubs, or commented-out code in final commits.
- Every new function needs a docstring with its purpose and return type.
- Run tests if a test suite exists (`pytest tests/` or equivalent).

## Verification

Observable outcomes only. Don't say "the function should work" — show the output:

```
$ python -c "from app.server.X import Y; print(Y('test'))"
expected_output
```

## Recovery

If interrupted mid-milestone: re-read `STATUS.md` to resume from the last checkpoint.
If a repair fails after 2 attempts: escalate — document in `STATUS.md` and stop.
