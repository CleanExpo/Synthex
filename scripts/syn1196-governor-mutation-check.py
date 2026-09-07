#!/usr/bin/env python3
"""SYN-1196 mutation harness.

For each control: plant the defect it guards against, run the suite, record the
observed output, restore the source, assert the tree is byte-identical again.

A control that has not been observed failing proves nothing. And a mutant that
does not actually break the thing is not a control either — the first run of
this harness reported M6 GREEN, which turned out to be a broken mutant (it added
a cache READ and never a WRITE), not a weak test.
"""
import subprocess, sys, os, re

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENV = {**os.environ}
ANSI = re.compile(r"\x1b\[[0-9;]*m")

BYOK = "tests/unit/ai/governor/governor-byok.test.ts"
BUDGET = "tests/unit/ai/governor/governor-budget.test.ts"
KILL = "tests/unit/ai/governor/governor-kill-switch.test.ts"
REGISTRY = "tests/unit/ai/governor/governor-model-registry.test.ts"

# name, file, [(find, replace), ...], suite
MUTANTS = [
    ("M1 BYOK falls back to the platform env key when the brand has none",
     "lib/ai/governor/byok.ts",
     [("""  if (!credential) {
    return {
      ok: false,
      verdict: 'byok_missing',
      outcome: 'refused_byok_missing',
    };
  }""",
       """  if (!credential) {
    const platform =
      process.env.ANTHROPIC_API_KEY ??
      process.env.OPENAI_API_KEY ??
      process.env.GOOGLE_API_KEY ??
      process.env.OPENROUTER_API_KEY;
    if (platform) {
      return { ok: true, apiKey: platform, verdict: 'byok_present', credentialId: 'platform' };
    }
    return {
      ok: false,
      verdict: 'byok_missing',
      outcome: 'refused_byok_missing',
    };
  }""")],
     BYOK),

    ("M2 BYOK revoked-key check removed (missing-key check left intact)",
     "lib/ai/governor/byok.ts",
     [("""  if (credential.revokedAt !== null) {
    return {
      ok: false,
      verdict: 'byok_revoked',
      outcome: 'refused_byok_revoked',
    };
  }""", "  // MUTANT: revoked check deleted")],
     BYOK),

    ("M3 budget halt removed (receipt path left intact)",
     "lib/ai/governor/index.ts",
     [("  const budget = await checkBudget(organizationId, provider, estimatedCostUsd);\n  if (!budget.allowed) {",
       "  const budget = await checkBudget(organizationId, provider, estimatedCostUsd);\n  if (false && !budget.allowed) {")],
     BUDGET),

    # Targets the RECEIPT mechanism only: the ledger row is never written while
    # the log line and every refusal decision stay exactly as they were. A
    # behavioural mutant, not a compile break — the earlier version of this
    # mutant produced "Tests: 0 total", which proves the suite cannot build,
    # not that the receipt assertion can fail.
    ("M4 ledger receipt row never written (log line + halt left intact)",
     "lib/ai/governor/receipts.ts",
     [("    await prisma.pipelineCostLedger.create({",
       "    await Promise.resolve();\n    const skipped = (_: unknown) => undefined;\n    skipped({")],
     BUDGET),

    ("M5 brand-wide kill-switch branch removed",
     "lib/ai/governor/flags.ts",
     [("""  const brandRow = rows.find(r => r.runner === BRAND_WIDE_RUNNER);
  if (brandRow?.killSwitch) {
    return {
      allowed: false,
      verdict: 'brand_kill_switch',
      outcome: 'refused_kill_switch',
    };
  }""", "  // MUTANT: brand-wide kill-switch branch deleted")],
     KILL),

    ("M6 flag decision CACHED (kill-switch no longer immediate)",
     "lib/ai/governor/flags.ts",
     [("  let rows;\n  try {",
       """  const mutantCache = (((globalThis as Record<string, unknown>)
    .__mutantFlagCache ??= new Map()) as Map<string, FlagDecision>);
  const cacheKey = `${organizationId}:${brandSlug}:${runner}`;
  const cachedDecision = mutantCache.get(cacheKey);
  if (cachedDecision) {
    return cachedDecision;
  }
  let rows;
  try {"""),
      # The write half. Without this the mutant changes nothing at all.
      ("  return ALLOWED;",
       "  mutantCache.set(cacheKey, ALLOWED);\n  return ALLOWED;")],
     KILL),

    ("M7 audit matcher neutered (scanner can no longer detect anything)",
     "scripts/audit-governor-model-strings.mjs",
     [("const MODEL_ID_PATTERNS = [", "const MODEL_ID_PATTERNS = [];\nconst UNUSED_PATTERNS = [")],
     REGISTRY),
]


def run(cmd):
    return subprocess.run(cmd, cwd=REPO, env=ENV, capture_output=True, text=True)


def jest(path):
    r = run(["npx", "jest", "--config", "config/jest/jest.worktree.cjs", path, "--coverage=false"])
    out = ANSI.sub("", r.stdout + r.stderr)
    t = re.search(r"^Tests:.*$", out, re.M)
    s = re.search(r"^Test Suites:.*$", out, re.M)
    return r.returncode, (s.group(0).strip() if s else "?"), (t.group(0).strip() if t else "?")


def main():
    print("=" * 78)
    print("BASELINE (unmutated tree)")
    code, suites, tests = jest("tests/unit/ai/governor")
    print(f"  exit={code}  {suites}  {tests}\n")
    if code != 0:
        print("BASELINE RED — mutants prove nothing against a red baseline.")
        return 1

    failures = []
    for name, rel, edits, suite in MUTANTS:
        path = os.path.join(REPO, rel)
        original = open(path, encoding="utf-8").read()
        mutated = original
        missing = [f for f, _ in edits if f not in mutated]
        if missing:
            print(f"!! {name}: ANCHOR NOT FOUND in {rel} — mutant not applied")
            failures.append(name)
            continue
        for find, repl in edits:
            mutated = mutated.replace(find, repl, 1)
        assert mutated != original, name
        open(path, "w", encoding="utf-8").write(mutated)

        code, suites, tests = jest(suite)
        verdict = "RED (control fires)" if code != 0 else "GREEN -- CONTROL DID NOT FIRE"
        print(f"{name}\n   mutated: {rel}   suite: {os.path.basename(suite)}")
        print(f"   exit={code}  {suites}  {tests}\n   => {verdict}")

        open(path, "w", encoding="utf-8").write(original)
        restored = run(["git", "diff", "--quiet"])
        print(f"   restore: git diff --quiet exit={restored.returncode} "
              f"({'byte-identical' if restored.returncode == 0 else 'TREE STILL DIRTY'})\n")
        if code == 0:
            failures.append(name)
        if restored.returncode != 0:
            failures.append(name + " (restore)")

    print("=" * 78)
    print("POST-MUTATION BASELINE (must be green again)")
    code, suites, tests = jest("tests/unit/ai/governor")
    print(f"  exit={code}  {suites}  {tests}")
    final = run(["git", "diff", "--quiet"])
    print(f"  final git diff --quiet exit={final.returncode}")

    if failures or code != 0 or final.returncode != 0:
        print("\nMUTANTS THAT DID NOT PROVE THEIR CONTROL: " + (", ".join(failures) or "none"))
        return 1
    print(f"\nALL {len(MUTANTS)} MUTANTS OBSERVED RED; TREE RESTORED BYTE-IDENTICAL.")
    return 0


sys.exit(main())
