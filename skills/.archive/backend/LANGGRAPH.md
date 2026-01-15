---
name: langgraph
version: 1.0.0
description: LangGraph workflow patterns
author: Your Team
priority: 3
triggers:
  - langgraph
  - workflow
  - graph
---

# LangGraph Patterns

## Graph Structure

```python
from typing import TypedDict
from langgraph.graph import StateGraph, END

class GraphState(TypedDict):
    """State passed between nodes."""
    input: str
    output: str | None
    error: str | None

def create_graph() -> StateGraph:
    workflow = StateGraph(GraphState)

    # Add nodes
    workflow.add_node("process", process_node)
    workflow.add_node("validate", validate_node)
    workflow.add_node("respond", respond_node)

    # Set entry point
    workflow.set_entry_point("process")

    # Add edges
    workflow.add_edge("process", "validate")
    workflow.add_conditional_edges(
        "validate",
        check_validation,
        {
            "valid": "respond",
            "invalid": END,
        }
    )
    workflow.add_edge("respond", END)

    return workflow.compile()
```

## Node Implementation

```python
async def process_node(state: GraphState) -> GraphState:
    """Process the input."""
    try:
        result = await process_input(state["input"])
        state["output"] = result
    except Exception as e:
        state["error"] = str(e)
    return state

def check_validation(state: GraphState) -> str:
    """Determine next step based on state."""
    if state.get("error"):
        return "invalid"
    return "valid"
```

## State Management

### Checkpointing
```python
from langgraph.checkpoint.memory import MemorySaver

memory = MemorySaver()
graph = create_graph()
app = graph.compile(checkpointer=memory)

# Run with thread ID for persistence
result = await app.ainvoke(
    {"input": "process this"},
    config={"configurable": {"thread_id": "user-123"}}
)
```

### State Updates
```python
# Partial state updates
def update_node(state: GraphState) -> dict:
    return {"output": "updated value"}  # Only updates 'output'
```

## Conditional Routing

```python
def router(state: GraphState) -> str:
    """Route to different nodes based on state."""
    input_type = classify_input(state["input"])

    match input_type:
        case "question":
            return "answer_node"
        case "command":
            return "execute_node"
        case _:
            return "fallback_node"

workflow.add_conditional_edges(
    "classify",
    router,
    {
        "answer_node": "answer",
        "execute_node": "execute",
        "fallback_node": "fallback",
    }
)
```

## Parallel Execution

```python
from langgraph.graph import StateGraph
from typing import Annotated
import operator

class ParallelState(TypedDict):
    inputs: list[str]
    results: Annotated[list[str], operator.add]

async def parallel_process(state: ParallelState) -> ParallelState:
    tasks = [process(inp) for inp in state["inputs"]]
    results = await asyncio.gather(*tasks)
    return {"results": results}
```

## Error Handling

```python
async def safe_node(state: GraphState) -> GraphState:
    """Node with error handling."""
    try:
        result = await risky_operation(state["input"])
        return {"output": result}
    except ValidationError as e:
        return {"error": f"Validation: {e}"}
    except Exception as e:
        logger.error("Unexpected error", error=str(e))
        return {"error": "Internal error"}
```

## Testing Graphs

```python
@pytest.mark.asyncio
async def test_graph_happy_path():
    graph = create_graph()

    result = await graph.ainvoke({"input": "test"})

    assert result["output"] is not None
    assert result["error"] is None

@pytest.mark.asyncio
async def test_graph_error_handling():
    graph = create_graph()

    result = await graph.ainvoke({"input": "invalid"})

    assert result["error"] is not None
```

## Verification

- [ ] Graph compiles without errors
- [ ] All nodes are connected
- [ ] Conditional edges cover all cases
- [ ] Error paths handled
- [ ] State types are correct
