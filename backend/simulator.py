"""
⑧ ⑨  Simulator — multi-interface, sampling, graceful stop, replay mode.
Kept backward-compatible: app.py calls sim.run() with no args → synthetic mode.
"""
import asyncio
import json
import random
import uuid
import time
import logging
from pathlib import Path
from typing import Optional

logger = logging.getLogger("simulator")

# ─── Synthetic Payloads ───────────────────────────────────────────────────────

CLEAN_PAYLOADS = [
    "GET /index.html HTTP/1.1\r\nHost: example.com",
    "POST /login HTTP/1.1\r\nUser-Agent: Mozilla/5.0",
    "GET /api/v1/health HTTP/1.1\r\nAccept: */*",
    "GET /dashboard HTTP/1.1\r\nAccept: text/html",
    "POST /api/data HTTP/1.1\r\nContent-Type: application/json",
]

MALICIOUS_PAYLOADS = [
    "GET /search?q=' OR 1=1 -- HTTP/1.1",
    "GET /admin UNION SELECT username, password FROM users HTTP/1.1",
    "GET /vulnerable.php?file=../../../../etc/passwd HTTP/1.1",
    "<script>alert('XSS')</script>",
    "GET / HTTP/1.1\r\nUser-Agent: nmap tool",
    "GET /wp-admin HTTP/1.1\r\nUser-Agent: python-requests/2.28",
]


class Simulator:
    def __init__(self):
        self._listeners = []          # raw list kept for backward compat
        self.running = False
        self.loop: Optional[asyncio.AbstractEventLoop] = None

        # ⑨ Replay buffer
        self._replay_buffer: list = []

    # ── Backward-compat listener API ──────────────────────────────────────────

    def set_loop(self, loop: asyncio.AbstractEventLoop):
        self.loop = loop

    def add_listener(self, listener):
        self._listeners.append(listener)
        logger.info("Listener registered (total: %d)", len(self._listeners))

    def remove_listener(self, listener):
        if listener in self._listeners:
            self._listeners.remove(listener)

    def stop(self):
        """⑧ Graceful stop — signals all run loops to exit."""
        self.running = False
        logger.info("Simulator stop requested")

    # ── Dispatch ─────────────────────────────────────────────────────────────

    async def _dispatch(self, packet: dict):
        """Fan-out packet to all registered listeners."""
        for listener in list(self._listeners):
            try:
                await listener(packet)
            except Exception as exc:
                logger.error("Listener raised: %s", exc)

    # ── ① Synthetic Mode ──────────────────────────────────────────────────────

    async def generate_packets(self, sample_rate: float = 1.0):
        """
        ⑧ sample_rate: 0.0–1.0 fraction of packets to actually dispatch.
        1.0 = all packets (default), 0.5 = 50% sampled.
        """
        self.running = True
        logger.info("Synthetic mode started (sample_rate=%.2f)", sample_rate)
        while self.running:
            is_malicious = random.random() < 0.3
            payload = (
                random.choice(MALICIOUS_PAYLOADS)
                if is_malicious
                else random.choice(CLEAN_PAYLOADS)
            )
            packet = {
                "id": str(uuid.uuid4()),
                "timestamp": time.time(),
                "source_ip": (
                    f"{random.randint(1,255)}.{random.randint(0,255)}"
                    f".{random.randint(0,255)}.{random.randint(1,254)}"
                ),
                "destination_ip": "192.168.1.100",
                "port": random.choice([80, 443, 22, 8080, 3306, 5432]),
                "payload": payload,
                "protocol": random.choice(["TCP", "UDP"]),
                "size": random.randint(40, 1500),
            }

            # ⑧ Packet sampling
            if sample_rate >= 1.0 or random.random() < sample_rate:
                await self._dispatch(packet)

            await asyncio.sleep(random.uniform(0.5, 2.0))

    # ── Real Capture Mode ─────────────────────────────────────────────────────

    def _packet_handler(self, pkt):
        """⑧ Handles real scapy packets — runs in a thread executor."""
        try:
            from scapy.all import IP, TCP, UDP, Raw
        except ImportError:
            return

        if IP not in pkt:
            return

        payload = ""
        if Raw in pkt:
            try:
                payload = pkt[Raw].load.decode("utf-8", errors="ignore")
            except Exception:
                payload = repr(pkt[Raw].load)

        packet = {
            "id": str(uuid.uuid4()),
            "timestamp": time.time(),
            "source_ip": pkt[IP].src,
            "destination_ip": pkt[IP].dst,
            "port": pkt[TCP].dport if TCP in pkt else (pkt[UDP].dport if UDP in pkt else 0),
            "payload": payload,
            "protocol": "TCP" if TCP in pkt else ("UDP" if UDP in pkt else "ICMP"),
            "size": len(pkt),
        }

        if self.loop:
            for listener in list(self._listeners):
                asyncio.run_coroutine_threadsafe(listener(packet), self.loop)

    async def sniff_packets(self, iface=None, sample_rate: float = 1.0):
        """⑧ Runs scapy sniff in a thread so asyncio isn't blocked."""
        try:
            from scapy.all import sniff
        except ImportError:
            logger.warning("scapy not installed — falling back to synthetic mode")
            await self.generate_packets(sample_rate)
            return

        loop = asyncio.get_running_loop()
        self.loop = loop
        self.running = True
        logger.info("Real capture started on interface: %s", iface or "default")

        # sniff with BPF filter support and stop_filter for graceful stop
        await loop.run_in_executor(
            None,
            lambda: sniff(
                iface=iface,
                prn=self._packet_handler,
                store=False,
                stop_filter=lambda _: not self.running,  # ⑧ graceful stop
            ),
        )

    # ─ ⑧ Multi-interface sniff ───────────────────────────────────────────────

    async def sniff_multi_interface(self, ifaces: list, sample_rate: float = 1.0):
        """Sniff on multiple interfaces concurrently."""
        await asyncio.gather(
            *[self.sniff_packets(iface, sample_rate) for iface in ifaces]
        )

    # ── ⑨ Replay Mode ────────────────────────────────────────────────────────

    def save_packet(self, packet: dict, filepath: str = "replay.json"):
        """⑨ Append packet to a JSON Lines replay file."""
        with open(filepath, "a") as f:
            f.write(json.dumps(packet) + "\n")

    async def replay_packets(self, filepath: str = "replay.json", speed: float = 1.0):
        """⑨ Replay saved packets preserving original timing, scaled by speed."""
        path = Path(filepath)
        if not path.exists():
            logger.error("Replay file not found: %s", filepath)
            return

        packets = []
        with open(path) as f:
            for line in f:
                line = line.strip()
                if line:
                    try:
                        packets.append(json.loads(line))
                    except json.JSONDecodeError:
                        pass

        if not packets:
            logger.warning("Replay file is empty")
            return

        logger.info("Replaying %d packets at %.1fx speed", len(packets), speed)
        self.running = True

        for i, packet in enumerate(packets):
            if not self.running:
                break
            # Re-stamp with current time
            packet = {**packet, "timestamp": time.time(), "replayed": True}
            await self._dispatch(packet)

            # Preserve inter-packet delay (with speed scaling)
            if i < len(packets) - 1:
                next_ts = packets[i + 1].get("timestamp", 0)
                curr_ts = packets[i].get("timestamp", 0)
                delay = max(0, (next_ts - curr_ts) / max(speed, 0.1))
                delay = min(delay, 5.0)   # cap at 5s
                await asyncio.sleep(delay)

        logger.info("Replay finished")

    # ── Entry Point ───────────────────────────────────────────────────────────

    async def run(
        self,
        iface=None,
        use_synthetic: bool = True,
        sample_rate: float = 1.0,
    ):
        """
        Main entry point (backward-compatible).
        use_synthetic=True  → safe fake traffic (default)
        use_synthetic=False → real scapy capture (needs sudo/privileged)
        sample_rate         → 0.0–1.0 fraction of packets to dispatch
        """
        if use_synthetic:
            logger.info("Simulator: SYNTHETIC mode")
            await self.generate_packets(sample_rate)
        else:
            logger.info("Simulator: REAL CAPTURE mode")
            await self.sniff_packets(iface, sample_rate)