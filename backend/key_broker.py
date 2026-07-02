import time
import structlog
import threading
from threading import Lock
from typing import List, Optional, Dict, Any

log = structlog.get_logger(__name__)

class APIKeyBroker:
    def __init__(self, keys: List[str], rate_limit_window: float = 0.6):
        """
        Thread-safe key manager that load-balances key usage and tracks failures.
        
        Args:
            keys: List of raw API key strings.
            rate_limit_window: Minimum seconds to wait before reusing the same key.
        """
        self.keys = [
            {"key": k.strip(), "last_used": 0.0, "cooldown_until": 0.0}
            for k in keys if k.strip()
        ]
        self.rate_limit_window = rate_limit_window
        self.lock = Lock()
        self.local_data = threading.local()

    def get_key(self) -> str:
        """
        Thread-safe checkout of the next available healthy key.
        Blocks until a key becomes eligible or raises an error if all are in cooldown.
        """
        if not self.keys:
            raise ValueError("No API keys configured in the broker.")
            
        start_time = time.time()
        while True:
            with self.lock:
                now = time.time()
                
                # Check if all keys are currently in cooldown. If so, don't wait
                any_active = any(k["cooldown_until"] <= now for k in self.keys)
                if not any_active:
                    min_cooldown_remaining = min(k["cooldown_until"] - now for k in self.keys)
                    raise ValueError(f"All API keys are in cooldown. Minimum wait: {min_cooldown_remaining:.1f}s")
                
                # Find keys that are out of cooldown AND satisfy rate limit spacing
                eligible = [
                    k for k in self.keys
                    if now >= k["cooldown_until"] and (now - k["last_used"]) >= self.rate_limit_window
                ]
                
                if eligible:
                    # Pick the one least recently used to balance load
                    best = min(eligible, key=lambda x: x["last_used"])
                    best["last_used"] = now
                    self.local_data.last_key = best["key"]
                    return best["key"]
                    
            if time.time() - start_time > 5.0:
                raise TimeoutError("Timeout waiting for an eligible API key due to rate limit spacing.")
                
            # Wait briefly to check again
            time.sleep(0.1)

    def report_failure(self, key: str, is_quota_exhausted: bool = False):
        """
        Stall an API key if it fails.
        """
        with self.lock:
            for k in self.keys:
                if k["key"] == key:
                    now = time.time()
                    if is_quota_exhausted:
                        # lock out key for 1 hour
                        k["cooldown_until"] = now + 3600
                        log.warning("api_key_quota_exhausted_cooldown", key_suffix=key[-6:], cooldown_seconds=3600)
                    else:
                        # lock out for 30s for general api drops/transient rate limits
                        k["cooldown_until"] = now + 30
                        log.warning("api_key_transient_failure_cooldown", key_suffix=key[-6:], cooldown_seconds=30)

    def report_last_key_failure(self, is_quota_exhausted: bool = False):
        """
        Report failure on the key that was last checked out in the current thread.
        """
        key = getattr(self.local_data, "last_key", None)
        if key:
            self.report_failure(key, is_quota_exhausted)
