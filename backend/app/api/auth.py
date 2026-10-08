"""
Authentication endpoints for SmartCloud.

These endpoints provide:
- /auth/me: Get current authenticated user's profile
- Status checks for the frontend

Note: Most authentication is handled by Supabase directly on the frontend.
These endpoints are for backend-side operations that need user context.
"""

from fastapi import APIRouter, Depends, HTTPException, status

from app.services.auth_service import get_auth_service, AuthService


router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/me")
async def get_current_user(
    user_id: str = Depends(get_auth_service().get_current_user_id),
    auth_service: AuthService = Depends(get_auth_service),
):
    """
    Get the current authenticated user's profile.

    Returns:
        User profile with id, email, full_name, avatar_url, created_at, updated_at

    Raises:
        401: If not authenticated
        404: If user profile not found
    """
    try:
        profile = await auth_service.get_user_profile(user_id)
        return {
            "user_id": user_id,
            "profile": profile,
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve user profile.",
        ) from exc


@router.get("/me/subscription")
async def get_my_subscription(
    user_id: str = Depends(get_auth_service().get_current_user_id),
    auth_service: AuthService = Depends(get_auth_service),
):
    """
    Get the current authenticated user's subscription details.

    Returns:
        Subscription with plan, storage_limit_bytes, ai_request_quota, etc.

    Raises:
        401: If not authenticated
        404: If subscription not found
    """
    try:
        subscription = await auth_service.get_user_subscription(user_id)
        return {
            "user_id": user_id,
            "subscription": subscription,
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve subscription.",
        ) from exc


@router.post("/register")
def register():
    """
    Registration is handled by Supabase frontend.

    This endpoint is a placeholder for potential backend-side registration
    logic (email verification, custom onboarding, etc.).
    """
    return {
        "message": "Registration is handled by Supabase on the frontend.",
        "docs": "Use supabase.auth.signUp() on the frontend to register.",
    }


@router.post("/login")
def login():
    """
    Login is handled by Supabase frontend.

    This endpoint is a placeholder for potential backend-side login logic.
    """
    return {
        "message": "Login is handled by Supabase on the frontend.",
        "docs": "Use supabase.auth.signInWithPassword() on the frontend to login.",
    }


@router.post("/logout")
def logout():
    """
    Logout is handled by Supabase frontend.

    This endpoint is a placeholder for potential backend-side logout logic
    (session cleanup, audit logging, etc.).
    """
    return {
        "message": "Logout is handled by Supabase on the frontend.",
        "docs": "Use supabase.auth.signOut() on the frontend to logout.",
    }

