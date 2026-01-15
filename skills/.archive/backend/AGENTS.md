---
name: agents
version: 1.0.0
priority: 3
triggers:
  - agent
  - orchestrator
  - ai
---

# Agent Building Patterns

## Architecture

```python
class BaseAgent(ABC):
    def __init__(self, name: str, capabilities: list[str]):
        self.name = name
        self.capabilities = capabilities

    @abstractmethod
    async def execute(self, task: str, context: dict) -> Any: pass

    def can_handle(self, task: str) -> bool:
        return any(cap in task.lower() for cap in self.capabilities)
```

## Registry & Orchestrator

```python
class AgentRegistry:
    def register(self, agent: BaseAgent): self._agents[agent.name] = agent
    def find_agent_for_task(self, task: str) -> BaseAgent | None: ...

class Orchestrator:
    def __init__(self):
        self.registry = AgentRegistry()
        self.memory = AgentMemory()

    async def process(self, task: str) -> dict:
        agent = self.registry.find_agent_for_task(task)
        return await agent.execute(task, {"history": self.memory.get_context()})
```

## Verification Loop

```python
async def execute_with_verification(agent, task, max_attempts=3):
    for attempt in range(max_attempts):
        result = await agent.execute(task)
        if (await verify_result(result)).passed:
            return {"success": True, "result": result}
    return {"success": False, "error": "Max attempts exceeded"}
```

## Key Classes

| Class | Purpose |
|-------|---------|
| `BaseAgent` | Abstract base with `execute()`, `can_handle()` |
| `AgentRegistry` | Register and find agents by capability |
| `AgentMemory` | Short-term (list) + long-term (dict) storage |
| `ToolExecutor` | Execute tools on behalf of agents |

See: `agents/base_agent.py`, `agents/orchestrator.py`
