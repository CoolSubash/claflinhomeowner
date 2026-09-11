"""
Minimal per-user, in-process rate limiter for the chat endpoint (Phase 8
section 26). Deliberately not distributed - a single in-memory sliding
window is enough for a single backend process (current Render deployment
target, CLAUDE.md section 3); moving to multiple instances would need a
shared store (e.g. Redis) instead, noted in docs/ai-architecture.md.
"""
from __future__ import annotations

import threading
import time
from collections import defaultdict, deque
from uuid import UUID

DEFAULT_MAX_REQUESTS = 20
DEFAULT_WINDOW_SECONDS = 60 * 60


class RateLimitExceeded(Exception):
    pass


class SlidingWindowRateLimiter:
    def __init__(self, *, max_requests: int = DEFAULT_MAX_REQUESTS, window_seconds: int = DEFAULT_WINDOW_SECONDS) -> None:
        self._max_requests = max_requests
        self._window_seconds = window_seconds
        self._lock = threading.Lock()
        self._requests: dict[UUID, deque[float]] = defaultdict(deque)

    def check_and_record(self, user_id: UUID) -> None:
        now = time.monotonic()
        with self._lock:
            bucket = self._requests[user_id]
            while bucket and now - bucket[0] > self._window_seconds:
                bucket.popleft()
            if len(bucket) >= self._max_requests:
                raise RateLimitExceeded()
            bucket.append(now)


# Process-wide singleton - the chat route depends on this instance directly
# rather than constructing a new limiter per request.
chat_rate_limiter = SlidingWindowRateLimiter()
