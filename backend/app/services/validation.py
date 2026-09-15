"""Reusable Pydantic validation helpers for the Project Labs backend."""
import re
from datetime import date, datetime
from typing import Optional, Union
from pydantic_core import PydanticCustomError


def validate_name(v: str, max_length: int = 150) -> str:
    """Validate and trim a person/entity name."""
    v = v.strip()
    if not v:
        raise PydanticCustomError('value_error', 'Please enter a valid name.')
    if len(v) > max_length:
        raise PydanticCustomError('value_error', f'Name must be {max_length} characters or fewer.')
    if re.fullmatch(r'\d+', v):
        raise PydanticCustomError('value_error', 'Please enter a valid name (not just numbers).')
    return v


def validate_email_field(v: str) -> str:
    """Validate and normalize an email address."""
    v = v.strip().lower()
    if not v:
        raise PydanticCustomError('value_error', 'Please enter a valid email address.')
    if len(v) > 254:
        raise PydanticCustomError('value_error', 'Email must be 254 characters or fewer.')
    if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", v):
        raise PydanticCustomError('value_error', 'Please enter a valid email address.')
    return v


def validate_phone(v: str) -> str:
    """Validate a phone number."""
    v = v.strip()
    if not v:
        raise PydanticCustomError('value_error', 'Please enter a valid phone number.')
    if not re.fullmatch(r"[+]?[\d\s\-().]{7,20}", v):
        raise PydanticCustomError('value_error', 'Please enter a valid phone number.')
    return v


def validate_budget(v: Optional[str]) -> Optional[str]:
    """Validate a budget amount (INR, positive integer, no decimals)."""
    if not v or not v.strip():
        return None
    v = v.strip()
    if not re.fullmatch(r"[1-9]\d{0,10}", v):
        raise PydanticCustomError('value_error', 'Please enter a valid budget amount in INR.')
    num = int(v)
    if num < 1 or num > 99999999999:
        raise PydanticCustomError('value_error', 'Please enter a valid budget amount in INR.')
    return v


def validate_timeline(v: Optional[str]) -> Optional[str]:
    """Validate a timeline in months."""
    if not v or not v.strip():
        return None
    v = v.strip()
    if not re.fullmatch(r"[1-9]\d{0,2}", v):
        raise PydanticCustomError('value_error', 'Please enter a valid timeline in months.')
    num = int(v)
    if num < 1 or num > 120:
        raise PydanticCustomError('value_error', 'Please enter a valid timeline in months.')
    return v


def validate_non_negative_decimal(v: Optional[str]) -> Optional[str]:
    """Validate a non-negative decimal number (for monetary amounts)."""
    if not v or not v.strip():
        return None
    v = v.strip()
    if not re.fullmatch(r"\d+(\.\d{1,2})?", v):
        raise PydanticCustomError('value_error', 'Please enter a valid amount.')
    num = float(v)
    if num < 0 or num > 999999999:
        raise PydanticCustomError('value_error', 'Please enter a valid amount.')
    return v


def validate_positive_int(v: Optional[str], min_val: int = 1, max_val: int = 999999) -> Optional[str]:
    """Validate a positive integer."""
    if not v or not v.strip():
        return None
    v = v.strip()
    if not re.fullmatch(r"[1-9]\d{0,6}", v):
        raise PydanticCustomError('value_error', 'Please enter a valid number.')
    num = int(v)
    if num < min_val or num > max_val:
        raise PydanticCustomError('value_error', 'Please enter a valid number.')
    return v


def validate_url(v: Optional[str]) -> Optional[str]:
    """Validate a URL (http/https only)."""
    if not v or not v.strip():
        return None
    v = v.strip()
    if not re.fullmatch(r"https?://[^\s]+", v, re.IGNORECASE):
        raise PydanticCustomError('value_error', 'Please enter a valid URL.')
    return v


def validate_slug(v: str) -> str:
    """Validate a URL slug."""
    v = v.strip()
    if not v:
        raise PydanticCustomError('value_error', 'Slug must contain only lowercase letters, numbers, and hyphens.')
    if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", v):
        raise PydanticCustomError('value_error', 'Slug must contain only lowercase letters, numbers, and hyphens.')
    if len(v) > 200:
        raise PydanticCustomError('value_error', 'Slug must be 200 characters or fewer.')
    return v


def validate_optional_text(v: Optional[str], min_len: int = 1, max_len: int = 5000) -> Optional[str]:
    """Validate optional text: reject whitespace-only, enforce length."""
    if not v or not v.strip():
        return None
    v = v.strip()
    if len(v) < min_len:
        raise PydanticCustomError('value_error', 'Please enter a valid text.')
    if len(v) > max_len:
        raise PydanticCustomError('value_error', f'Text must be {max_len} characters or fewer.')
    return v


# ---------------------------------------------------------------------------
# Calendar / event dates (Phase 3 shared calendar)
# ---------------------------------------------------------------------------
#
# The admin calendar works with real calendar days, so the backend never trusts
# a client-supplied date. Every event date/time is re-validated here:
#   * the year must be written with exactly four digits (1900-2100),
#   * the month must be 01-12,
#   * the day must exist for that month and year (leap years included),
#   * the string form must be ISO-8601: YYYY-MM-DD or YYYY-MM-DDTHH:MM[:SS].
#
# Rejected: 234098-01-10, 2026-13-10, 2026-00-10, 2026-02-30, 2026-04-31...
# Accepted: 2026-01-01, 2026-09-15, 2026-02-28, 2024-02-29.

MIN_CALENDAR_YEAR = 1900
MAX_CALENDAR_YEAR = 2100

_DATE_KEY_RE = re.compile(r"^(\d{4})-(\d{2})-(\d{2})$")

# Strict ISO-8601 date or date-time, always with an exactly 4-digit year:
#   2026-09-15
#   2026-09-15T09:30
#   2026-09-15T09:30:00
#   2026-09-15T09:30:00.000Z
#   2026-09-15T09:30:00+05:30
_DATE_TIME_RE = re.compile(
    r"^(\d{4})-(\d{2})-(\d{2})"
    r"(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,6}))?)?)?"
    r"(?:Z|[+-]\d{2}:\d{2})?$"
)


def is_leap_year(year: int) -> bool:
    """Gregorian leap-year rule."""
    return (year % 4 == 0 and year % 100 != 0) or (year % 400 == 0)


def days_in_month(year: int, month: int) -> int:
    """Number of days in a 1-based month, leap years included."""
    if month == 2:
        return 29 if is_leap_year(year) else 28
    if month in (4, 6, 9, 11):
        return 30
    return 31


def validate_calendar_date_parts(year: int, month: int, day: int, field: str = "date") -> date:
    """Validate a 4-digit year / 1-12 month / real day and return the date."""
    if year < MIN_CALENDAR_YEAR or year > MAX_CALENDAR_YEAR:
        raise PydanticCustomError(
            'value_error',
            f'Please enter a valid calendar date ({field}: year must be a 4-digit year '
            f'between {MIN_CALENDAR_YEAR} and {MAX_CALENDAR_YEAR}).',
        )
    if month < 1 or month > 12:
        raise PydanticCustomError(
            'value_error',
            f'Please enter a valid calendar date ({field}: month must be between 01 and 12).',
        )
    if day < 1 or day > days_in_month(year, month):
        raise PydanticCustomError(
            'value_error',
            f'Please enter a valid calendar date ({field}: day must be valid for the selected month).',
        )
    return date(year, month, day)


def validate_calendar_date_string(v: str, field: str = "date") -> str:
    """Strictly validate a `YYYY-MM-DD` date string (exactly 4-digit year)."""
    if not isinstance(v, str) or not v.strip():
        raise PydanticCustomError('value_error', f'Please enter a valid calendar date ({field} is required).')
    v = v.strip()
    match = _DATE_KEY_RE.match(v)
    if match is None:
        raise PydanticCustomError(
            'value_error',
            f'Please enter a valid calendar date ({field} must use the YYYY-MM-DD format).',
        )
    validate_calendar_date_parts(int(match.group(1)), int(match.group(2)), int(match.group(3)), field)
    return v


def validate_calendar_datetime(
    v: Union[str, datetime, date, None],
    field: str = "date",
    required: bool = True,
) -> Union[str, datetime, date, None]:
    """Validate a calendar date / datetime value and return it unchanged.

    Used as a Pydantic `mode="before"` validator so the strict calendar rules
    (4-digit year, real month/day, leap years) are enforced before Pydantic
    coerces the value to `datetime` — giving admins a readable error instead of
    a raw parsing trace. `None` is allowed when `required` is False.
    """
    if v is None:
        # `null` is only meaningful for optional fields (e.g. clearing the
        # event end date). A blank string is always malformed input.
        if required:
            raise PydanticCustomError('value_error', f'Please enter a valid calendar date ({field} is required).')
        return None
    if isinstance(v, str) and not v.strip():
        raise PydanticCustomError(
            'value_error',
            f'Please enter a valid calendar date ({field} must use the YYYY-MM-DD format '
            'with an exactly 4-digit year).',
        )

    # `datetime` is a subclass of `date`, so test it first.
    if isinstance(v, datetime):
        validate_calendar_date_parts(v.year, v.month, v.day, field)
        return v
    if isinstance(v, date):
        validate_calendar_date_parts(v.year, v.month, v.day, field)
        return v

    if isinstance(v, str):
        value = v.strip()
        match = _DATE_TIME_RE.match(value)
        if match is None:
            raise PydanticCustomError(
                'value_error',
                f'Please enter a valid calendar date ({field} must use the YYYY-MM-DD format '
                'with an exactly 4-digit year).',
            )
        year, month, day = int(match.group(1)), int(match.group(2)), int(match.group(3))
        validate_calendar_date_parts(year, month, day, field)
        if match.group(4) is not None:
            hour, minute = int(match.group(4)), int(match.group(5))
            second = int(match.group(6)) if match.group(6) is not None else 0
            if hour > 23 or minute > 59 or second > 59:
                raise PydanticCustomError(
                    'value_error',
                    f'Please enter a valid calendar date ({field}: time must be a valid 24-hour time).',
                )
        return value

    raise PydanticCustomError('value_error', f'Please enter a valid calendar date ({field} must be a valid date).')


def validate_event_title(v: str, max_len: int = 200) -> str:
    """Validate an admin calendar event title."""
    v = (v or "").strip()
    if not v:
        raise PydanticCustomError('value_error', 'Please enter a valid event title.')
    if len(v) > max_len:
        raise PydanticCustomError('value_error', f'Event title must be {max_len} characters or fewer.')
    return v
