---
name: advanced-tool-use
version: "1.0"
triggers:
  - tool use
  - context optimization
  - token efficiency
  - tool search
  - programmatic calling
priority: 8
---

# Advanced Tool Use System

Context-efficient tool management via search, deferred loading, and programmatic calling.

## Features

| Feature | Benefit | API Type |
|---------|---------|----------|
| Tool Search | 85% context reduction | `tool_search_tool_regex_20251119` |
| Programmatic Calling | 37% token reduction | `allowed_callers: ["code_execution_20250825"]` |
| Tool Examples | 72%→90% accuracy | Examples in tool definition |
| Deferred Loading | On-demand only | `defer_loading: true` |

## Tool Categories

| Category | Loading | Examples |
|----------|---------|----------|
| CORE | Always | health_check, get_task_status |
| VERIFICATION | Deferred | verify_task, collect_evidence |
| DATABASE | Deferred | query, insert |
| FILE_SYSTEM | Deferred | read, write, list |

## Configuration

```python
@dataclass
class ToolConfig:
    defer_loading: bool = False      # Load on-demand via search
    allowed_callers: list[str] = []  # ["code_execution_20250825"]
    parallel_safe: bool = True
    cache_results: bool = False
```

## Usage

```python
from src.tools import register_all_tools
from src.tools.search import ToolSearcher

registry = register_all_tools()
searcher = ToolSearcher(registry)

# Search for tools (85% context savings)
results = searcher.search("verify outputs", limit=3)

# Get API tools with deferred loading
api_tools = registry.to_api_format(include_search_tool=True, include_deferred=False)

# Beta header required
headers = {"anthropic-beta": "advanced-tool-use-2025-11-20"}
```

## Context Savings

| Metric | Before | After |
|--------|--------|-------|
| Upfront tokens | 55,000 | 8,000 (85%) |
| Per-call tokens | 1,200 | 760 (37%) |
| Parameter accuracy | 72% | 90% |

## Rules

- Mark infrequent tools as `defer_loading: true`
- Enable `allowed_callers` for batch operations
- Add examples for complex parameters
- Use categories/keywords for better search
- Monitor with `orchestrator.get_context_stats()`

See: `tools/`, `core/VERIFICATION.md`
