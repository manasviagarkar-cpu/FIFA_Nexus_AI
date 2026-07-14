"""
FIFA Nexus AI — Wayfinding Authentication Middleware
Verifies JWT tokens and checks RBAC permissions.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Callable, Optional

import jwt
from fastapi import HTTPException, Request, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import get_settings
from shared.contracts.UserRole import UserRole, ROLE_PERMISSIONS  # We will import from shared.python or simulate
# Since shared/contracts/python/contracts.py exists, let's import directly from shared.contracts.py or import the file.
# Note that we copy the Python mirror to /app/shared/ in the Dockerfile, or it's accessible.
# Let's import it relative to app or PYTHONPATH. In PYTHONPATH we can do:
from shared.contracts import UserRole, ROLE_PERMISSIONS, JWTPayload

logger = logging.getLogger(__name__)

security_bearer = HTTPBearer(auto_error=False)


def verify_jwt(credentials: Optional[HTTPAuthorizationCredentials] = Security(security_bearer)) -> JWTPayload:
    """Validate JWT token and return payload."""
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization Header",
            headers={"WWW-Authenticate": "Bearer"},
        )

    settings = get_settings()
    token = credentials.credentials

    try:
        payload_dict = jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM],
        )
        return JWTPayload(**payload_dict)
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.InvalidTokenError as e:
        logger.warning("Invalid token verification attempt: %s", e)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )


class RequirePermission:
    """Route dependency for checking RBAC permissions."""

    def __init__(self, permission: str) -> None:
        self.permission = permission

    def __call__(self, token: JWTPayload = Security(verify_jwt)) -> JWTPayload:
        user_role = token.role
        allowed_permissions = ROLE_PERMISSIONS.get(user_role, [])

        if self.permission not in allowed_permissions:
            logger.warning(
                "Access denied for user %s (role: %s) requesting permission: %s",
                token.sub,
                user_role,
                self.permission,
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions to access this resource",
            )
        return token
