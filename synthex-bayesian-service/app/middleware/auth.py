"""
Service-to-service authentication middleware.

Validates the X-Service-Key header against the configured SERVICE_API_KEY.
Used as a FastAPI dependency on protected routes.
"""

from fastapi import Header, HTTPException

from app.config import settings


async def verify_service_key(
    x_service_key: str = Header(..., alias="X-Service-Key"),
) -> str:
    """
    Verify the service API key from the X-Service-Key header.

    Raises HTTP 401 if the key is missing or does not match.
    Returns the validated key on success.
    """
    if not settings.SERVICE_API_KEY:
        # If no key is configured, reject all requests for safety
        raise HTTPException(
            status_code=401,
            detail="Service authentication is not configured",
        )

    if x_service_key != settings.SERVICE_API_KEY:
        raise HTTPException(
            status_code=401,
            detail="Invalid service key",
        )

    return x_service_key
