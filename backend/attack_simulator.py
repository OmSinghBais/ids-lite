"""
⑥  Simulated Attack Scenarios
Generates high-volume attack-like packets to test listeners / detection rules.
"""
import asyncio
import random
import uuid
import time
from typing import Callable, Coroutine

# ─── Attack Payloads ─────────────────────────────────────────────────────────

SYN_FLOOD_PAYLOADS = [
    "SYN",
    "SYN ACK RETRY",
    "GET / HTTP/1.1\r\nConnection: keep-alive",
]

ICMP_STORM_PAYLOADS = [
    "ICMP ECHO REQUEST",
    "ping -f target",
    "ICMP type=8 code=0",
]

MALFORMED_PAYLOADS = [
    "\x00" * 100,                          # null bytes
    "A" * 2048,                            # oversized payload
    "' OR '1'='1'; DROP TABLE users; --",  # SQLi
    "<img src=x onerror=alert(1)>",        # XSS variant
    "/../../../etc/shadow",                 # path traversal
    "\xff\xfe\xfd\xfc",                    # binary garbage
    "nmap -sS -O target_host",             # port scan
]

BRUTE_FORCE_PAYLOADS = [
    "POST /login HTTP/1.1\r\nContent-Type: application/json\r\n{\"user\":\"admin\",\"pass\":\"123456\"}",
    "POST /login HTTP/1.1\r\nContent-Type: application/json\r\n{\"user\":\"root\",\"pass\":\"password\"}",
    "POST /admin HTTP/1.1\r\nAuthorization: Basic YWRtaW46YWRtaW4=",
]


class AttackSimulator:
    """
    Inject synthetic attack packets into the IDS pipeline.
    Each scenario runs as an asyncio task and can be stopped independently.
    """

    SCENARIOS = {
        "syn_flood":    "High-volume TCP SYN flood (tests rate limiting & blocked IPs)",
        "icmp_storm":   "ICMP ping storm from a single source IP",
        "malformed":    "Malformed / oversized payloads testing payload sanitization",
        "brute_force":  "HTTP login brute-force attempts",
        "sql_inject":   "SQL injection payload burst",
    }

    def __init__(self):
        self._tasks: dict[str, asyncio.Task] = {}

    # ─── Scenario Generators ──────────────────────────────────────────────────

    async def _syn_flood(self, callback, rate: float):
        attacker_ip = f"10.{random.randint(1,254)}.{random.randint(1,254)}.{random.randint(1,254)}"
        while True:
            pkt = {
                "id": str(uuid.uuid4()),
                "timestamp": time.time(),
                "source_ip": attacker_ip,
                "destination_ip": "192.168.1.100",
                "port": 80,
                "payload": random.choice(SYN_FLOOD_PAYLOADS),
                "protocol": "TCP",
                "size": random.randint(40, 80),
                "attack": "syn_flood",
            }
            await callback(pkt)
            await asyncio.sleep(rate)

    async def _icmp_storm(self, callback, rate: float):
        attacker_ip = f"172.16.{random.randint(1,254)}.{random.randint(1,254)}"
        while True:
            pkt = {
                "id": str(uuid.uuid4()),
                "timestamp": time.time(),
                "source_ip": attacker_ip,
                "destination_ip": "192.168.1.100",
                "port": 0,
                "payload": random.choice(ICMP_STORM_PAYLOADS),
                "protocol": "ICMP",
                "size": 64,
                "attack": "icmp_storm",
            }
            await callback(pkt)
            await asyncio.sleep(rate)

    async def _malformed(self, callback, rate: float):
        while True:
            pkt = {
                "id": str(uuid.uuid4()),
                "timestamp": time.time(),
                "source_ip": f"{random.randint(1,254)}.{random.randint(0,254)}.{random.randint(0,254)}.{random.randint(1,254)}",
                "destination_ip": "192.168.1.100",
                "port": random.choice([80, 443, 22]),
                "payload": random.choice(MALFORMED_PAYLOADS),
                "protocol": "TCP",
                "size": random.randint(1500, 9000),
                "attack": "malformed",
            }
            await callback(pkt)
            await asyncio.sleep(rate)

    async def _brute_force(self, callback, rate: float):
        attacker_ip = f"185.{random.randint(1,254)}.{random.randint(1,254)}.{random.randint(1,254)}"
        while True:
            pkt = {
                "id": str(uuid.uuid4()),
                "timestamp": time.time(),
                "source_ip": attacker_ip,
                "destination_ip": "192.168.1.100",
                "port": 8080,
                "payload": random.choice(BRUTE_FORCE_PAYLOADS),
                "protocol": "TCP",
                "size": random.randint(200, 400),
                "attack": "brute_force",
            }
            await callback(pkt)
            await asyncio.sleep(rate)

    async def _sql_inject(self, callback, rate: float):
        sql_payloads = [
            "GET /api?id=1 UNION SELECT username, password FROM users HTTP/1.1",
            "POST /search HTTP/1.1\r\nbody: q=' OR 1=1 --",
            "GET /item?id=1;DROP TABLE orders-- HTTP/1.1",
        ]
        while True:
            pkt = {
                "id": str(uuid.uuid4()),
                "timestamp": time.time(),
                "source_ip": f"{random.randint(1,254)}.{random.randint(0,254)}.{random.randint(0,254)}.{random.randint(1,254)}",
                "destination_ip": "192.168.1.100",
                "port": 443,
                "payload": random.choice(sql_payloads),
                "protocol": "TCP",
                "size": random.randint(100, 300),
                "attack": "sql_inject",
            }
            await callback(pkt)
            await asyncio.sleep(rate)

    # ─── Public API ───────────────────────────────────────────────────────────

    def start(self, scenario: str, callback: Callable, packets_per_sec: float = 5.0):
        """Launch an attack scenario as a background asyncio task."""
        if scenario in self._tasks and not self._tasks[scenario].done():
            return {"ok": False, "error": f"Scenario '{scenario}' is already running"}

        rate = 1.0 / max(packets_per_sec, 0.1)
        generators = {
            "syn_flood":   self._syn_flood,
            "icmp_storm":  self._icmp_storm,
            "malformed":   self._malformed,
            "brute_force": self._brute_force,
            "sql_inject":  self._sql_inject,
        }
        if scenario not in generators:
            return {"ok": False, "error": f"Unknown scenario '{scenario}'"}

        task = asyncio.create_task(generators[scenario](callback, rate))
        self._tasks[scenario] = task
        return {"ok": True, "scenario": scenario, "packets_per_sec": packets_per_sec}

    def stop(self, scenario: str):
        """Cancel a running attack scenario."""
        task = self._tasks.get(scenario)
        if task and not task.done():
            task.cancel()
            return {"ok": True, "stopped": scenario}
        return {"ok": False, "error": f"Scenario '{scenario}' is not running"}

    def stop_all(self):
        stopped = []
        for name, task in self._tasks.items():
            if not task.done():
                task.cancel()
                stopped.append(name)
        self._tasks.clear()
        return {"ok": True, "stopped": stopped}

    def status(self):
        return {
            name: ("running" if not task.done() else "stopped")
            for name, task in self._tasks.items()
        }
