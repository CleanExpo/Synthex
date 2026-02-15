---
id: arch-002
domain: architecture
title: MCP Server Configuration
created: 2026-02-16
updated: 2026-02-16
freshness: current
confidence: 0.9
evidence: mcp.config.json
tags: [mcp, tools, configuration]
---

# MCP Server Configuration

## Summary
MCP config defines server connections for Claude Code tooling including Sequential Thinking, Playwright browser automation, and custom toolkits.

## Detail

### Configured Servers
- **Sequential Thinking**: `@modelcontextprotocol/server-sequential-thinking` for structured reasoning
- **Playwright**: Browser automation for testing and visual validation
- **MCP Toolkit**: `@magneticwatermelon/mcp-toolkit` for extended capabilities

### Integration Points
- SEO tooling at `tools/claude-seo/` uses MCP for page fetching and analysis
- Build agents use MCP for deployment verification
- Skills reference MCP tools in their tool lists

## Implications
- MCP servers must be running for full agent capabilities
- Config changes require server restart
- MCP Inspector available via `npm run mcp:init`
