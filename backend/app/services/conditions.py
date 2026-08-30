"""Automation condition evaluation layer.

Evaluates rule conditions against event payloads. Conditions are stored as
JSON objects with the structure:
    {"field": "payload.field.path", "op": "operator", "value": comparison_value}

Supported operators: eq, neq, gt, lt, gte, lte, in, not_in, contains,
starts_with, ends_with, is_empty, is_not_empty.

Multiple conditions can be combined with "and" / "or" logic:
    {"and": [condition1, condition2]}
    {"or": [condition1, condition2]}
"""
from typing import Any, Optional


OPERATORS = {
    "eq": lambda a, b: a == b,
    "neq": lambda a, b: a != b,
    "gt": lambda a, b: float(a) > float(b),
    "lt": lambda a, b: float(a) < float(b),
    "gte": lambda a, b: float(a) >= float(b),
    "lte": lambda a, b: float(a) <= float(b),
    "in": lambda a, b: a in b if isinstance(b, (list, str)) else False,
    "not_in": lambda a, b: a not in b if isinstance(b, (list, str)) else True,
    "contains": lambda a, b: b in a if isinstance(a, (list, str)) else False,
    "starts_with": lambda a, b: str(a).startswith(str(b)),
    "ends_with": lambda a, b: str(a).endswith(str(b)),
    "is_empty": lambda a, b: not a,
    "is_not_empty": lambda a, b: bool(a),
}


def _resolve_field(field_path: str, payload: dict) -> Any:
    """Resolve a dotted field path against the payload dict.

    Supports nested access like "invoice.amount" or "lead.contact.email".
    """
    if not field_path:
        return None
    parts = field_path.split(".")
    current = payload
    for part in parts:
        if isinstance(current, dict):
            current = current.get(part)
        else:
            return None
    return current


def evaluate(condition: Optional[dict], payload: dict) -> bool:
    """Evaluate a condition against an event payload.

    Returns True if no condition is set (pass-through).
    """
    if not condition:
        return True

    # Handle logical combinators
    if "and" in condition:
        return all(evaluate(c, payload) for c in condition["and"])
    if "or" in condition:
        return any(evaluate(c, payload) for c in condition["or"])

    # Single condition: {field, op, value}
    field_path = condition.get("field")
    op_name = condition.get("op")
    expected = condition.get("value")

    if not op_name:
        return True

    actual = _resolve_field(field_path, payload)

    op_fn = OPERATORS.get(op_name)
    if not op_fn:
        return False

    try:
        return op_fn(actual, expected)
    except (TypeError, ValueError, KeyError):
        return False
