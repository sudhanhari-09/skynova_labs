"""Payment gateway service: real Stripe/PayPal when configured, simulated otherwise.

Payments are always recorded in the payments table (status SUCCEEDED for
successful charges, FAILED with error captured otherwise). The gateway
provider is controlled by PAYMENT_GATEWAY env var: "simulated" (default),
"stripe", or "paypal".
"""
import json
import urllib.request
import urllib.error
from datetime import datetime
from decimal import Decimal
from typing import Optional, Tuple

from app.core.config import settings


def create_payment(
    amount: float,
    currency: str,
    customer_name: Optional[str] = None,
    customer_email: Optional[str] = None,
    description: Optional[str] = None,
    metadata: Optional[dict] = None,
) -> Tuple[str, str, Optional[str]]:
    """Attempt a payment via the configured gateway.

    Returns (status, provider, gateway_reference):
      - status: "SUCCEEDED", "FAILED", or "SIMULATED"
      - provider: "stripe", "paypal", or "simulated"
      - gateway_reference: external payment ID (or None)
    """
    gateway = settings.payment_gateway.lower()

    if gateway == "stripe":
        return _stripe_charge(amount, currency, customer_name, customer_email, description, metadata)
    elif gateway == "paypal":
        return _paypal_charge(amount, currency, customer_name, customer_email, description, metadata)
    else:
        return ("SIMULATED", "simulated", None)


def _stripe_charge(
    amount: float,
    currency: str,
    customer_name: Optional[str],
    customer_email: Optional[str],
    description: Optional[str],
    metadata: Optional[dict],
) -> Tuple[str, str, Optional[str]]:
    """Create a Stripe PaymentIntent (test mode)."""
    if not settings.stripe_secret_key:
        return ("SIMULATED", "simulated", None)
    try:
        data = json.dumps({
            "amount": int(round(amount * 100)),
            "currency": currency.lower(),
            "description": description or f"Payment from {customer_name or 'customer'}",
            "metadata": metadata or {},
            "payment_method_types": ["card"],
            "confirm": True,
        }).encode("utf-8")
        req = urllib.request.Request(
            "https://api.stripe.com/v1/payment_intents",
            data=data,
            headers={
                "Authorization": f"Bearer {settings.stripe_secret_key}",
                "Content-Type": "application/json",
            },
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=15) as resp:
            body = json.loads(resp.read())
            if body.get("status") == "succeeded":
                return ("SUCCEEDED", "stripe", body.get("id"))
            return ("FAILED", "stripe", body.get("id"))
    except (urllib.error.URLError, OSError, json.JSONDecodeError) as exc:
        return ("FAILED", "stripe", str(exc)[:120])


def _paypal_charge(
    amount: float,
    currency: str,
    customer_name: Optional[str],
    customer_email: Optional[str],
    description: Optional[str],
    metadata: Optional[dict],
) -> Tuple[str, str, Optional[str]]:
    """Create a PayPal payment (sandbox REST API v2)."""
    if not settings.paypal_client_id or not settings.paypal_client_secret:
        return ("SIMULATED", "simulated", None)
    try:
        base = "https://api-m.sandbox.paypal.com" if settings.paypal_mode == "sandbox" else "https://api-m.paypal.com"

        # Step 1: get access token
        token_data = json.dumps({"grant_type": "client_credentials"}).encode("utf-8")
        token_req = urllib.request.Request(
            f"{base}/v1/oauth2/token",
            data=token_data,
            headers={
                "Accept": "application/json",
                "Accept-Language": "en_US",
                "Authorization": "Basic " + __import__("base64").b64encode(
                    f"{settings.paypal_client_id}:{settings.paypal_client_secret}".encode()
                ).decode(),
            },
            method="POST",
        )
        with urllib.request.urlopen(token_req, timeout=15) as tok_resp:
            token_body = json.loads(tok_resp.read())
            access_token = token_body["access_token"]

        # Step 2: create order
        order_data = json.dumps({
            "intent": "CAPTURE",
            "purchase_units": [{
                "amount": {"currency_code": currency, "value": f"{amount:.2f}"},
                "description": description or "Payment",
            }],
        }).encode("utf-8")
        order_req = urllib.request.Request(
            f"{base}/v2/checkout/orders",
            data=order_data,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {access_token}",
            },
            method="POST",
        )
        with urllib.request.urlopen(order_req, timeout=15) as order_resp:
            body = json.loads(order_resp.read())
            order_id = body.get("id")
            status = body.get("status")

            # Step 3: capture if APPROVED
            if status == "APPROVED":
                cap_req = urllib.request.Request(
                    f"{base}/v2/checkout/orders/{order_id}/capture",
                    headers={
                        "Content-Type": "application/json",
                        "Authorization": f"Bearer {access_token}",
                    },
                    method="POST",
                )
                with urllib.request.urlopen(cap_req, timeout=15) as cap_resp:
                    cap_body = json.loads(cap_resp.read())
                    if cap_body.get("status") == "COMPLETED":
                        return ("SUCCEEDED", "paypal", order_id)
                return ("FAILED", "paypal", order_id)
            return ("FAILED", "paypal", order_id)
    except (urllib.error.URLError, OSError, json.JSONDecodeError, KeyError) as exc:
        return ("FAILED", "paypal", str(exc)[:120])
