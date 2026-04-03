"""
② ⑦ ⑩  Modular Listener System with Filtering, Rate-Limiting & Safety
Each listener can filter by protocol, port, IP prefix, keyword, or size range.
All exceptions are caught and logged so one bad listener can't crash the system.
"""
import asyncio
import time
import re
import logging
from typing import Any, Callable, Coroutine, Optional, Set, List

logger = logging.getLogger("listener_manager")


class FilteredListener:
    """
    A single subscriber with optional filters and rate-limiting.

    Filters (all optional, all AND-combined):
      protocols  – {"TCP", "UDP", "ICMP"}
      ports      – {80, 443}
      ip_prefix  – "192.168."           (matched against source_ip)
      keywords   – ["SELECT", "script"] (any keyword in payload triggers)
      min_size   – 100
      max_size   – 1500
      rate_limit – max calls per second (default 200)
    """

    def __init__(
        self,
        callback: Callable[[dict], Coroutine],
        *,
        name: str = "unnamed",
        protocols: Optional[Set[str]] = None,
        ports: Optional[Set[int]] = None,
        ip_prefix: Optional[str] = None,
        keywords: Optional[List[str]] = None,
        min_size: Optional[int] = None,
        max_size: Optional[int] = None,
        rate_limit: int = 200,
    ):
        self.callback = callback
        self.name = name
        self.protocols = {p.upper() for p in protocols} if protocols else None
        self.ports = ports
        self.ip_prefix = ip_prefix
        self.keywords = [k.lower() for k in keywords] if keywords else None
        self.min_size = min_size
        self.max_size = max_size
        self.rate_limit = rate_limit

        # Rate-limit state
        self._calls_this_second = 0
        self._rate_window = int(time.time())
        self._dropped = 0

    # ─── Filter ───────────────────────────────────────────────────────────────

    def _matches(self, packet: dict) -> bool:
        # ① Protocol filter
        if self.protocols and packet.get("protocol", "").upper() not in self.protocols:
            return False

        # ② Port filter
        if self.ports and packet.get("port", 0) not in self.ports:
            return False

        # ③ IP prefix filter
        if self.ip_prefix and not packet.get("source_ip", "").startswith(self.ip_prefix):
            return False

        # ④ Keyword filter (any match)
        if self.keywords:
            payload_lower = packet.get("payload", "").lower()
            if not any(kw in payload_lower for kw in self.keywords):
                return False

        # ⑤ Size range filter
        size = packet.get("size", 0)
        if self.min_size is not None and size < self.min_size:
            return False
        if self.max_size is not None and size > self.max_size:
            return False

        return True

    # ─── Rate Limit ───────────────────────────────────────────────────────────

    def _check_rate(self) -> bool:
        now_sec = int(time.time())
        if now_sec != self._rate_window:
            self._rate_window = now_sec
            self._calls_this_second = 0
        if self._calls_this_second >= self.rate_limit:
            self._dropped += 1
            return False
        self._calls_this_second += 1
        return True

    # ─── Payload Sanitization ⑩ ──────────────────────────────────────────────

    @staticmethod
    def _sanitize(packet: dict) -> dict:
        """Truncate oversized payloads to prevent memory issues."""
        if len(packet.get("payload", "")) > 4096:
            packet = {**packet, "payload": packet["payload"][:4096] + "…[truncated]"}
        return packet

    # ─── Dispatch ─────────────────────────────────────────────────────────────

    async def dispatch(self, packet: dict):
        if not self._matches(packet):
            return
        if not self._check_rate():
            return
        packet = self._sanitize(packet)
        try:
            await self.callback(packet)
        except Exception as exc:
            logger.error(
                "Listener '%s' raised an exception: %s", self.name, exc
            )


class ListenerManager:
    """Registry for all FilteredListener instances."""

    def __init__(self):
        self._listeners: List[FilteredListener] = []

    def register(self, listener: FilteredListener):
        self._listeners.append(listener)
        logger.info("Registered listener: %s", listener.name)

    def unregister(self, name: str):
        self._listeners = [l for l in self._listeners if l.name != name]

    async def dispatch_all(self, packet: dict):
        """Fan-out the packet to every listener concurrently."""
        if self._listeners:
            await asyncio.gather(
                *(l.dispatch(packet) for l in self._listeners),
                return_exceptions=True,   # never raises
            )

    @property
    def names(self):
        return [l.name for l in self._listeners]
