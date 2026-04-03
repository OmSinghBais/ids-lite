"""
① Packet Analytics & Stats Tracker
Tracks real-time: protocol counts, top IPs, avg sizes, packets/sec.
"""
import time
from collections import defaultdict, deque
from typing import Dict, Any


class StatsTracker:
    ROLLING_WINDOW = 60  # seconds to keep in per-second history

    def __init__(self):
        # Protocol counts
        self.protocol_counts: Dict[str, int] = defaultdict(int)
        self.total_packets = 0

        # IP frequency maps
        self.top_sources: Dict[str, int] = defaultdict(int)
        self.top_destinations: Dict[str, int] = defaultdict(int)

        # Size / payload tracking (rolling last 500)
        self._sizes: deque = deque(maxlen=500)
        self._payload_lens: deque = deque(maxlen=500)

        # Per-second packet count for sparkline (last 60 seconds)
        self._per_second: deque = deque(maxlen=self.ROLLING_WINDOW)
        self._current_second: int = int(time.time())
        self._current_count: int = 0

        # Alert counts
        self.alert_counts: Dict[str, int] = {"high": 0, "medium": 0, "low": 0}

    # ── Recording ─────────────────────────────────────────────────────────────

    def record_packet(self, packet: Dict[str, Any]):
        """Call this for every packet received."""
        proto = packet.get("protocol", "UNKNOWN")
        self.protocol_counts[proto] += 1
        self.total_packets += 1

        src = packet.get("source_ip", "")
        dst = packet.get("destination_ip", "")
        if src:
            self.top_sources[src] += 1
        if dst:
            self.top_destinations[dst] += 1

        size = packet.get("size", 0)
        payload_len = len(packet.get("payload", ""))
        self._sizes.append(size)
        self._payload_lens.append(payload_len)

        # Update per-second bucket
        now_sec = int(time.time())
        if now_sec == self._current_second:
            self._current_count += 1
        else:
            # Flush old second
            self._per_second.append({
                "t": self._current_second,
                "count": self._current_count,
            })
            self._current_second = now_sec
            self._current_count = 1

    def record_alert(self, severity: str):
        key = severity.lower()
        if key in self.alert_counts:
            self.alert_counts[key] += 1

    # ── Summary ───────────────────────────────────────────────────────────────

    def get_summary(self) -> Dict[str, Any]:
        avg_size = (sum(self._sizes) / len(self._sizes)) if self._sizes else 0
        avg_payload = (sum(self._payload_lens) / len(self._payload_lens)) if self._payload_lens else 0

        # Per-second sparkline — flush current bucket first
        sparkline = list(self._per_second) + [{
            "t": self._current_second,
            "count": self._current_count,
        }]

        return {
            "total_packets": self.total_packets,
            "protocol_counts": dict(self.protocol_counts),
            "top_sources": sorted(
                self.top_sources.items(), key=lambda x: -x[1]
            )[:10],
            "top_destinations": sorted(
                self.top_destinations.items(), key=lambda x: -x[1]
            )[:5],
            "avg_packet_size": round(avg_size, 1),
            "avg_payload_length": round(avg_payload, 1),
            "packets_per_second": sparkline[-30:],   # last 30 seconds
            "alert_counts": self.alert_counts,
        }
