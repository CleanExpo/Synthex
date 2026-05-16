# Vibetest-use Gap — 2026-05-16

## Status: NOT INSTALLED

```bash
which vibetest                            # → "vibetest not found"
ls ~/.config/Claude/mcp_servers/          # → empty
grep -i vibetest ~/.claude/settings.json  # → no matches
```

`vibetest-use` MCP server is **not wired** on this machine. The Phase 6 plan + Board memo mandate a top-10 customer-journey smoke pass before sign-off, but the substrate to run it is not deployed.

## Why deferred, not failed

- Phase 6 explicitly lists this as KNOWN-OUT-OF-SCOPE-IF-NOT-WIRED.
- Plan instructs: "DO NOT block sign-off on this — it's an operational follow-up."

## Install command (per Wave 1 mandate)

```bash
git clone https://github.com/browser-use/vibetest-use.git ~/vibetest-use
cd ~/vibetest-use && uv sync
# then add to ~/.claude/settings.json:
# "vibetest": { "command": "uv", "args": ["--directory", "~/vibetest-use", "run", "vibetest-mcp"] }
```

## Verdict: DEFERRED — substrate not wired, follow-up tracked
