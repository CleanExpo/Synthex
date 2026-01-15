---
name: error-handling
version: 1.0.0
description: Error handling patterns and practices
author: Your Team
priority: 2
---

# Error Handling Patterns

## Principles

1. **Fail Fast**: Detect errors early and report them immediately
2. **Fail Clearly**: Error messages should be actionable
3. **Fail Safely**: Errors should not corrupt state or leak data
4. **Fail Loudly**: Errors should be logged and observable

## Error Types

### Expected Errors
Errors that can occur during normal operation:
- Validation failures
- Authentication failures
- Resource not found
- Rate limiting

Handle these gracefully with user-friendly messages.

### Unexpected Errors
Errors that indicate bugs or system failures:
- Null pointer exceptions
- Database connection failures
- Out of memory errors
- Network timeouts

Log these with full context and return generic error to user.

## Frontend Error Handling

### API Errors
```typescript
try {
  const response = await fetch('/api/endpoint');
  if (!response.ok) {
    const error = await response.json();
    throw new ApiError(error.message, response.status);
  }
  return response.json();
} catch (error) {
  if (error instanceof ApiError) {
    // Handle known API errors
    toast.error(error.message);
  } else {
    // Handle unexpected errors
    console.error('Unexpected error:', error);
    toast.error('Something went wrong. Please try again.');
  }
}
```

### Error Boundaries
```typescript
export function ErrorBoundary({ children }) {
  return (
    <ReactErrorBoundary
      fallback={<ErrorFallback />}
      onError={(error) => {
        console.error('Error boundary caught:', error);
        // Report to error tracking service
      }}
    >
      {children}
    </ReactErrorBoundary>
  );
}
```

## Backend Error Handling

### FastAPI Exception Handlers
```python
@app.exception_handler(ValidationError)
async def validation_exception_handler(request: Request, exc: ValidationError):
    return JSONResponse(
        status_code=422,
        content={"error": "Validation failed", "details": exc.errors()},
    )

@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    logger.error("Unhandled exception", error=str(exc), exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"error": "Internal server error"},
    )
```

### Agent Error Handling
```python
async def execute_with_retry(task: str, max_retries: int = 3) -> Result:
    last_error = None

    for attempt in range(max_retries):
        try:
            return await execute_task(task)
        except RetryableError as e:
            last_error = e
            logger.warning(f"Attempt {attempt + 1} failed: {e}")
            await asyncio.sleep(2 ** attempt)
        except FatalError as e:
            logger.error(f"Fatal error: {e}")
            raise

    raise MaxRetriesExceeded(f"Failed after {max_retries} attempts: {last_error}")
```

## Error Logging

### What to Log
- Error type and message
- Stack trace
- Request context (URL, method, user ID)
- Timestamp
- Relevant state/data (sanitized)

### What NOT to Log
- Passwords
- API keys
- PII (unless necessary and compliant)
- Credit card numbers

## Error Monitoring

Use structured logging for easy filtering:
```python
logger.error(
    "Failed to process task",
    error=str(e),
    task_id=task.id,
    user_id=user.id,
    attempt=attempt,
)
```
