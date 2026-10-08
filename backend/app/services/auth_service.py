"""
Authentication service for SmartCloud backend.

This module provides:
1. JWT validation via Supabase
2. Current user ID extraction from Authorization header
3. User profile retrieval
4. Dependency injection for FastAPI
"""

from typing import Optional
from fastapi import HTTPException, Header, status
from supabase import create_client, Client

from app.config import SUPABASE_URL, SUPABASE_KEY


class AuthService:
    """Service for JWT validation and user management."""

    def __init__(self):
        self._client: Optional[Client] = None

    @property
    def client(self) -> Client:
        """Lazy-load Supabase client."""
        if self._client is None:
            self._client = create_client(SUPABASE_URL, SUPABASE_KEY)
        return self._client

    async def validate_token(self, token: str) -> str:
        """
        Validate JWT token and return user ID.

        Args:
            token: JWT token from Authorization header (without "Bearer " prefix)

        Returns:
            User ID (UUID)

        Raises:
            HTTPException: 401 if token is invalid or expired
        """
        if not token or not token.strip():
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Missing authorization token.",
            )

        try:
            response = self.client.auth.get_user(token.strip())
            if not response or not response.user or not response.user.id:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid or expired token.",
                )
            return response.user.id
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token validation failed.",
            ) from exc

    async def get_current_user_id(self, authorization: str = Header(...)) -> str:
        """
        FastAPI dependency to extract and validate user ID from Authorization header.

        Usage:
            @router.get("/me")
            async def get_me(user_id: str = Depends(get_auth_service().get_current_user_id)):
                # user_id is now the authenticated user's UUID
                return {"user_id": user_id}

        Args:
            authorization: Authorization header (e.g., "Bearer <jwt>")

        Returns:
            User ID (UUID)

        Raises:
            HTTPException: 401 if header is invalid or token is invalid
        """
        if not authorization.startswith("Bearer "):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Missing or invalid Authorization header. Expected: Bearer <token>",
            )

        token = authorization.removeprefix("Bearer ").strip()
        return await self.validate_token(token)

    async def get_user_profile(self, user_id: str) -> dict:
        """
        Get user profile from public.profiles table.

        Args:
            user_id: User UUID

        Returns:
            Profile data (id, email, full_name, avatar_url, etc.)

        Raises:
            HTTPException: 404 if profile not found
        """
        try:
            response = self.client.table("profiles").select("*").eq("id", user_id).single().execute()
            if not response.data:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="User profile not found.",
                )
            return response.data
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to retrieve user profile.",
            ) from exc

    async def get_user_subscription(self, user_id: str) -> dict:
        """
        Get user subscription from public.user_subscriptions table.
        
        If subscription doesn't exist, creates one automatically (handles trigger failures).

        Args:
            user_id: User UUID

        Returns:
            Subscription data (plan, storage_limit_bytes, ai_request_quota, etc.)

        Raises:
            HTTPException: 500 if subscription retrieval/creation fails
        """
        try:
            response = self.client.table("user_subscriptions").select("*").eq("user_id", user_id).single().execute()
            if response.data:
                return response.data
        except Exception as e:
            # Subscription might not exist (trigger failed to create it)
            pass

        # Try to create subscription (in case trigger didn't run)
        try:
            create_response = self.client.table("user_subscriptions").insert({
                "user_id": user_id,
                "plan": "free",
                "storage_limit_bytes": 16106127360,  # 15 GB
                "ai_request_quota": 0,
            }).execute()
            
            if create_response.data and len(create_response.data) > 0:
                return create_response.data[0]
        except Exception:
            # Subscription might already exist (race condition), try to fetch again
            pass

        # Final attempt to fetch subscription
        try:
            response = self.client.table("user_subscriptions").select("*").eq("user_id", user_id).single().execute()
            if response.data:
                return response.data
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to retrieve or create user subscription.",
            ) from exc

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="User subscription not found and could not be created.",
        )


# Global instance for dependency injection
_auth_service = AuthService()


def get_auth_service() -> AuthService:
    """Get the global auth service instance."""
    return _auth_service
