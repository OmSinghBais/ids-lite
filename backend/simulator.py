import asyncio
import random
import time
import uuid
from typing import Dict, Any, Callable

# A small set of sample payloads for our fake traffic
PAYLOADS = [
    "GET /index.html HTTP/1.1\\r\\nHost: example.com",
    "POST /login HTTP/1.1\\r\\nUser-Agent: curl/7.68.0",
    "GET /api/v1/health HTTP/1.1\\r\\nAccept: */*",
    # Malicious payloads (matches rules.json)
    "GET /search?q=' OR 1=1 -- HTTP/1.1",
    "GET /admin UNION SELECT username, password FROM users HTTP/1.1",
    "GET /vulnerable.php?file=../../../../etc/passwd HTTP/1.1",
    "<script>alert('XSS')</script>",
    "GET / HTTP/1.1\\r\\nUser-Agent: nmap tool",
]

class Simulator:
    def __init__(self):
        self.running = False
        self.listeners = []

    def add_listener(self, callback: Callable[[Dict[str, Any]], None]):
        self.listeners.append(callback)

    def _generate_packet(self) -> Dict[str, Any]:
        """Generates a random network packet."""
        is_malicious = random.random() < 0.3  # 30% chance for a malicious packet
        if is_malicious:
            payload = random.choice(PAYLOADS[3:])
        else:
            payload = random.choice(PAYLOADS[:3])
            
        src_ip = f"{random.randint(1, 255)}.{random.randint(1, 255)}.{random.randint(1, 255)}.{random.randint(1, 255)}"
        
        return {
            "id": str(uuid.uuid4()),
            "timestamp": time.time(),
            "source_ip": src_ip,
            "destination_ip": "192.168.1.100",  # Dashboard server
            "port": random.choice([80, 443, 22, 8080]),
            "payload": payload,
            "protocol": "TCP"
        }

    async def run(self):
        """Infinite loop generating packets."""
        self.running = True
        while self.running:
            packet = self._generate_packet()
            
            # Broadcast to all listeners
            for listener in self.listeners:
                if asyncio.iscoroutinefunction(listener):
                    await listener(packet)
                else:
                    listener(packet)
                    
            # Wait for 0.5 - 2 seconds before next packet
            await asyncio.sleep(random.uniform(0.5, 2.0))
            
    def stop(self):
        self.running = False