---
paths: apps/backend/src/**/*.py
---

# FastAPI + LangGraph Backend Rules

## Framework Configuration

- **Framework**: FastAPI
- **AI Orchestration**: LangGraph
- **Validation**: Pydantic
- **Python Version**: 3.12+
- **Package Manager**: uv

## Agent Patterns

### ✅ DO: Agent Structure

```python
from abc import ABC, abstractmethod
from pydantic import BaseModel, Field

class BaseAgent(ABC):
    """Abstract base class for all agents."""

    def __init__(self, name: str, capabilities: list[str]):
        self.name = name
        self.capabilities = capabilities
        self.agent_id = str(uuid.uuid4())

    @abstractmethod
    async def execute(self, task: str, context: dict) -> TaskOutput:
        """Execute a task. Must be implemented by subclasses."""
        pass

    def can_handle(self, task: str) -> bool:
        """Check if agent can handle this task."""
        return any(cap in task.lower() for cap in self.capabilities)
```

### ✅ DO: Pydantic Models

```python
class TaskOutput(BaseModel):
    """Structured output from task execution."""
    task_id: str
    agent_id: str
    status: str = Field(description="completed, failed, or pending_verification")
    outputs: list[dict[str, Any]] = Field(default_factory=list)
    requires_verification: bool = Field(default=True)
```

### ✅ DO: API Route Pattern

```python
from fastapi import APIRouter

router = APIRouter(prefix="/api", tags=["api"])

@router.get("/endpoint")
async def endpoint() -> dict:
    """Endpoint description."""
    return {"status": "success"}
```

## Critical Rules

- **No Self-Attestation**: Agents CANNOT verify their own work - use IndependentVerifier
- **Async Everywhere**: All agent methods must be `async def`
- **Type Hints Required**: Every function needs type hints, use Pydantic for complex types
- **Environment Variables**: Never hardcode secrets, use `config/settings.py`

## Anti-Patterns

❌ Missing type hints, using dict instead of Pydantic, self-verification, sync functions in async context

## Key Commands

```bash
cd apps/backend && uv sync                    # Install dependencies
uv run uvicorn src.api.main:app --reload     # Development server
uv run pytest                                # Run tests
uv run mypy src/                             # Type checking
uv run ruff check src/                       # Linting
```

## Verification Required

- Independent verification for all agent outputs
- Type checking with mypy passes
- All tests pass
- Linting passes
