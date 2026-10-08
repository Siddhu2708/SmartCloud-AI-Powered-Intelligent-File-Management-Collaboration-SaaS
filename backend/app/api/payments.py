"""
SmartCloud Payments API — Razorpay TEST MODE
============================================

Endpoints
---------
POST /api/payments/create-order     Create a Razorpay order (server-side)
POST /api/payments/verify           Verify signature + activate subscription
GET  /api/payments/my-payments      List the authenticated user's payments
GET  /api/subscription              Get the authenticated user's subscription
POST /api/subscription/upgrade      Shortcut: create order for a plan upgrade

Security principles
-------------------
* The user_id is ALWAYS taken from the verified Supabase JWT — never trusted
  from the request body.
* Plan prices are defined server-side in PLAN_CATALOG — never accepted from
  the client.
* Razorpay signature is verified with HMAC-SHA256 before ANY subscription
  change is made.
* Duplicate payment protection: if a payment row already exists for a given
  razorpay_order_id, the verify endpoint is idempotent (returns success but
  does not double-upgrade).
"""

from __future__ import annotations

import hashlib
import hmac
import os
import uuid
from typing import Any

import razorpay
from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel, Field
from supabase import create_client, Client

from app.config import (
    SUPABASE_URL,
    SUPABASE_KEY,
    RAZORPAY_KEY_ID,
    get_razorpay_key_secret,
)

router = APIRouter(prefix="/api/payments", tags=["payments"])

# ── Plan catalogue (server-side only — never trust client prices) ─────────────
# Amounts are in paise (INR). 1 INR = 100 paise.
PLAN_CATALOG: dict[str, dict[str, Any]] = {
    "basic": {
        "display_name": "Basic",
        "amount": 29900,                    # ₹299 / month
        "currency": "INR",
        "storage_limit_bytes": 50 * 1024 ** 3,   # 50 GB
        "ai_request_quota": 50,
    },
    "pro": {
        "display_name": "Pro",
        "amount": 89900,                    # ₹899 / month
        "currency": "INR",
        "storage_limit_bytes": 100 * 1024 ** 3,  # 100 GB
        "ai_request_quota": 200,
    },
    "enterprise": {
        "display_name": "Enterprise",
        "amount": 289900,                   # ₹2 899 / month
        "currency": "INR",
        "storage_limit_bytes": 1024 ** 4,        # 1 TB
        "ai_request_quota": 0,                   # 0 = unlimited
    },
}

# ── Supabase admin client (uses service-role key for server-side writes) ──────
# We reuse the same key that the rest of the backend uses. In production you
# would use the SERVICE_ROLE key so server-side inserts bypass RLS.
def _get_supabase() -> Client:
    return create_client(SUPABASE_URL, SUPABASE_KEY)


# ── Razorpay client (lazy) ────────────────────────────────────────────────────
def _get_razorpay() -> razorpay.Client:
    secret = get_razorpay_key_secret()
    return razorpay.Client(auth=(RAZORPAY_KEY_ID, secret))


# ── JWT extraction helper ─────────────────────────────────────────────────────
async def get_current_user_id(authorization: str = Header(...)) -> str:
    """
    Extract and verify the Supabase user from the Authorization: Bearer <jwt>
    header. Raises 401 if the token is missing or invalid.

    We call supabase.auth.get_user(jwt) which validates the JWT against
    Supabase's own signing key — no local crypto needed.
    """
    if not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid Authorization header.",
        )
    token = authorization.removeprefix("Bearer ").strip()
    try:
        sb = _get_supabase()
        response = sb.auth.get_user(token)
        if not response or not response.user:
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


# ── Request / response models ─────────────────────────────────────────────────

class CreateOrderRequest(BaseModel):
    plan: str = Field(..., description="Plan key: basic | pro | enterprise")


class CreateOrderResponse(BaseModel):
    order_id: str
    amount: int
    currency: str
    key_id: str          # Razorpay public key — safe to send to frontend
    plan: str
    plan_display_name: str


class VerifyPaymentRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
    plan: str


class PaymentRecord(BaseModel):
    id: str
    plan_name: str
    amount: int
    currency: str
    razorpay_order_id: str
    razorpay_payment_id: str | None
    payment_status: str
    subscription_status: str
    created_at: str


# ── POST /api/payments/create-order ──────────────────────────────────────────

@router.post("/create-order", response_model=CreateOrderResponse)
def create_order(
    body: CreateOrderRequest,
    user_id: str = Depends(get_current_user_id),
):
    """
    1. Validate the requested plan against the server-side catalogue.
    2. Create a Razorpay order (amount is from the catalogue — NOT from the client).
    3. Persist a payment row with status='created'.
    4. Return the order details + public key_id for the frontend Checkout popup.
    """
    plan_key = body.plan.lower()
    plan = PLAN_CATALOG.get(plan_key)
    if not plan:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown plan '{plan_key}'. Valid options: {list(PLAN_CATALOG)}",
        )

    rz = _get_razorpay()
    sb = _get_supabase()

    # Create Razorpay order — amount from server-side catalogue only
    rz_order = rz.order.create(
        {
            "amount": plan["amount"],
            "currency": plan["currency"],
            "receipt": f"sc_{user_id[:8]}_{uuid.uuid4().hex[:8]}",
            "notes": {
                "user_id": user_id,
                "plan": plan_key,
                "app": "SmartCloud",
            },
        }
    )

    # Persist to payments table (status = 'created')
    sb.table("payments").insert(
        {
            "user_id": user_id,
            "plan_name": plan_key,
            "amount": plan["amount"],
            "currency": plan["currency"],
            "razorpay_order_id": rz_order["id"],
            "payment_status": "created",
            "subscription_status": "pending",
        }
    ).execute()

    return CreateOrderResponse(
        order_id=rz_order["id"],
        amount=plan["amount"],
        currency=plan["currency"],
        key_id=RAZORPAY_KEY_ID,   # public key — safe to expose
        plan=plan_key,
        plan_display_name=plan["display_name"],
    )


# ── POST /api/payments/verify ─────────────────────────────────────────────────

@router.post("/verify")
def verify_payment(
    body: VerifyPaymentRequest,
    user_id: str = Depends(get_current_user_id),
):
    """
    1. Verify the Razorpay HMAC-SHA256 signature server-side.
    2. Confirm the payment row belongs to the authenticated user.
    3. Only after verification: update payment status + activate subscription.

    The user's plan is NEVER upgraded based on a frontend-supplied status.
    """
    # ── Step 1: Signature verification ──────────────────────────────────────
    secret = get_razorpay_key_secret()
    expected = hmac.new(
        secret.encode("utf-8"),
        f"{body.razorpay_order_id}|{body.razorpay_payment_id}".encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(expected, body.razorpay_signature):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Payment signature verification failed.",
        )

    sb = _get_supabase()
    plan_key = body.plan.lower()
    plan = PLAN_CATALOG.get(plan_key)
    if not plan:
        raise HTTPException(status_code=400, detail=f"Unknown plan '{plan_key}'.")

    # ── Step 2: Ownership check ───────────────────────────────────────────────
    existing = (
        sb.table("payments")
        .select("*")
        .eq("razorpay_order_id", body.razorpay_order_id)
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )

    existing_data = existing.data if existing else None
    if not existing_data:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Payment order not found for this user.",
        )

    # ── Idempotency: already paid? ────────────────────────────────────────────
    if existing_data.get("payment_status") == "paid":
        return {
            "success": True,
            "message": "Payment already recorded.",
            "plan": plan_key,
        }

    # ── Step 3: Mark payment as paid ─────────────────────────────────────────
    sb.table("payments").update(
        {
            "razorpay_payment_id": body.razorpay_payment_id,
            "razorpay_signature": body.razorpay_signature,
            "payment_status": "paid",
            "subscription_status": "active",
        }
    ).eq("razorpay_order_id", body.razorpay_order_id).eq("user_id", user_id).execute()

    # ── Step 4: Activate subscription (upsert) ───────────────────────────────
    from datetime import datetime, timezone, timedelta

    now = datetime.now(timezone.utc)
    cycle_end = now + timedelta(days=30)

    sb.table("user_subscriptions").upsert(
        {
            "user_id": user_id,
            "plan": plan_key,
            "storage_limit_bytes": plan["storage_limit_bytes"],
            "ai_request_quota": plan["ai_request_quota"],
            "billing_cycle_start": now.isoformat(),
            "billing_cycle_end": cycle_end.isoformat(),
            "razorpay_payment_id": body.razorpay_payment_id,   # last payment
            "razorpay_subscription_id": body.razorpay_order_id,
            "auto_renew": True,
        },
        on_conflict="user_id",
    ).execute()

    return {
        "success": True,
        "message": f"Payment verified. Your plan has been upgraded to {plan['display_name']}.",
        "plan": plan_key,
        "plan_display_name": plan["display_name"],
    }


# ── GET /api/payments/my-payments ─────────────────────────────────────────────

@router.get("/my-payments")
def my_payments(user_id: str = Depends(get_current_user_id)):
    """
    Return the authenticated user's payment history.
    All rows are filtered by user_id — no other user's data is accessible.
    """
    sb = _get_supabase()
    result = (
        sb.table("payments")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(50)
        .execute()
    )
    return {"payments": result.data or []}


# ── Subscription sub-router ───────────────────────────────────────────────────
# Mounted on /api/subscription (see main.py)

subscription_router = APIRouter(prefix="/api/subscription", tags=["subscription"])


@subscription_router.get("")
def get_subscription(user_id: str = Depends(get_current_user_id)):
    """Return the authenticated user's current subscription."""
    sb = _get_supabase()
    result = (
        sb.table("user_subscriptions")
        .select("*")
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )
    data = result.data if result else None
    if not data:
        # Return free plan defaults when no subscription row exists yet
        return {
            "user_id": user_id,
            "plan": "free",
            "storage_limit_bytes": 15 * 1024 ** 3,
            "ai_request_quota": 10,
            "ai_requests_used": 0,
            "billing_cycle_start": None,
            "billing_cycle_end": None,
        }
    return data


@subscription_router.post("/upgrade")
def initiate_upgrade(
    body: CreateOrderRequest,
    user_id: str = Depends(get_current_user_id),
):
    """
    Convenience endpoint: validate plan + create Razorpay order in one call.
    Delegates to create_order internally.
    """
    return create_order(body=body, user_id=user_id)
