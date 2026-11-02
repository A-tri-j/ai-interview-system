# Simple in-memory limiter. Server restart korle reset hoy ar ekta server-er jonno kaj kore.
# Ekhon-er jonno thik ache, pore dorkar hole Redis-e nibo.
import time
from collections import defaultdict, deque

from fastapi import HTTPException


class RateLimiter:
    def __init__(self, max_attempts: int, window_seconds: int):
        self.max = max_attempts
        self.window = window_seconds
        self.hits: dict[str, deque] = defaultdict(deque)

    def check(self, key: str) -> None:
        now = time.time()
        q = self.hits[key]
        while q and now - q[0] > self.window:
            q.popleft()
        if len(q) >= self.max:
            raise HTTPException(429, "Too many attempts. Please try again later.")

    def record(self, key: str) -> None:
        self.hits[key].append(time.time())

    def reset(self, key: str) -> None:
        self.hits.pop(key, None)


# 15 minute-e maximum 5 bar vul login
login_limiter = RateLimiter(max_attempts=5, window_seconds=900)

# 15 minute-e maximum 3 bar OTP chaoa
otp_limiter = RateLimiter(max_attempts=3, window_seconds=900)

# 15 minute-e maximum 10 bar reset submit
reset_limiter = RateLimiter(max_attempts=10, window_seconds=900)

