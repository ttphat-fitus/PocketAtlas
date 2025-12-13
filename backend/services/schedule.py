"""Schedule helpers for trip plans."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Optional


@dataclass(frozen=True)
class ParsedTimeRange:
    start_min: int
    end_min: int

    @property
    def duration_min(self) -> int:
        return max(0, self.end_min - self.start_min)


def _parse_hhmm(text: str) -> Optional[int]:
    text = (text or "").strip()
    if not text:
        return None
    # Accept HH:MM
    if ":" not in text:
        return None
    hh, mm = text.split(":", 1)
    try:
        h = int(hh)
        m = int(mm)
    except ValueError:
        return None
    if h < 0 or h > 23 or m < 0 or m > 59:
        return None
    return h * 60 + m


def parse_time_range(time_text: str) -> Optional[ParsedTimeRange]:
    """Parse strings like '08:00 - 10:00' into minute ranges."""
    s = (time_text or "").strip()
    if not s:
        return None

    # Normalize separators
    s = s.replace("–", "-").replace("—", "-")

    # Support '08:00-10:00' or '08:00 - 10:00'
    parts = [p.strip() for p in s.split("-") if p.strip()]
    if len(parts) < 2:
        return None

    start = _parse_hhmm(parts[0])
    end = _parse_hhmm(parts[1])
    if start is None or end is None:
        return None

    # If AI outputs reversed times, fix ordering
    if end < start:
        start, end = end, start

    return ParsedTimeRange(start_min=start, end_min=end)


def format_time_range(start_min: int, end_min: int) -> str:
    start_min = max(0, int(start_min))
    end_min = max(0, int(end_min))
    sh, sm = divmod(start_min, 60)
    eh, em = divmod(end_min, 60)
    return f"{sh:02d}:{sm:02d} - {eh:02d}:{em:02d}"


def buffer_minutes_for_mode(travel_mode: Optional[str]) -> int:
    mode = (travel_mode or "").strip().lower()
    if not mode:
        return 20

    if "đi bộ" in mode or "di bo" in mode:
        return 15
    if "xe đạp" in mode or "xe dap" in mode:
        return 20
    if "xe máy" in mode or "xe may" in mode:
        return 25
    if "ô tô" in mode or "oto" in mode or "o to" in mode:
        return 30
    if "công cộng" in mode or "cong cong" in mode:
        return 30

    return 20


def apply_time_buffers(trip_plan: dict[str, Any], *,
                       active_time_start: Optional[int],
                       active_time_end: Optional[int],
                       travel_mode: Optional[str]) -> dict[str, Any]:
    """Ensure consecutive activities include a buffer time between them.

    This adjusts times deterministically (preserving each activity duration when parseable),
    shifting later activities forward when needed.

    If activity time strings are unparseable, they are left as-is.
    """

    buffer_min = buffer_minutes_for_mode(travel_mode)

    start_floor = None
    if isinstance(active_time_start, int) and 0 <= active_time_start <= 23:
        start_floor = active_time_start * 60

    end_cap = None
    if isinstance(active_time_end, int) and 0 <= active_time_end <= 23:
        end_cap = active_time_end * 60

    days = trip_plan.get("days")
    if not isinstance(days, list):
        return trip_plan

    for day in days:
        activities = day.get("activities") if isinstance(day, dict) else None
        if not isinstance(activities, list) or len(activities) == 0:
            continue

        current_end = None

        for idx, activity in enumerate(activities):
            if not isinstance(activity, dict):
                continue

            parsed = parse_time_range(str(activity.get("time", "")))
            if parsed is None:
                continue

            duration = max(30, parsed.duration_min)  # never shorter than 30min

            if idx == 0:
                start = parsed.start_min
                if start_floor is not None:
                    start = max(start, start_floor)
                end = start + duration
                activity["time"] = format_time_range(start, end)
                current_end = end
                continue

            if current_end is None:
                current_end = parsed.end_min

            # Enforce buffer between previous end and next start
            desired_start = current_end + buffer_min
            start = max(parsed.start_min, desired_start)
            end = start + duration

            if end_cap is not None:
                # We do not try to squeeze earlier activities; only cap extreme overflow.
                end = min(end, end_cap)
                start = min(start, end)

            activity["time"] = format_time_range(start, end)
            current_end = end

    return trip_plan
