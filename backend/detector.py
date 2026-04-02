import json
import re
from typing import Dict, Any, List

class Detector:
    def __init__(self, rules_path: str = "rules.json"):
        self.rules = self.load_rules(rules_path)
        self.blocked_ips = set()

    def load_rules(self, path: str) -> List[Dict[str, Any]]:
        try:
            with open(path, "r") as f:
                return json.load(f)
        except Exception as e:
            print(f"Failed to load rules: {e}")
            return []

    def get_rules(self) -> List[Dict[str, Any]]:
        return self.rules

    def get_blocked_ips(self) -> List[str]:
        return list(self.blocked_ips)

    def unblock_ip(self, ip: str) -> bool:
        if ip in self.blocked_ips:
            self.blocked_ips.remove(ip)
            return True
        return False

    def block_ip(self, ip: str):
        self.blocked_ips.add(ip)

    def analyze(self, packet: Dict[str, Any]) -> Dict[str, Any]:
        """
        Analyzes a simulated packet against the loaded rules.
        Returns None if clean, or an Alert dictionary if malicious.
        """
        src_ip = packet.get("source_ip", "")
        payload = packet.get("payload", "")

        # Check if IP is already blocked
        if src_ip in self.blocked_ips:
            return {
                "id": packet["id"],
                "timestamp": packet["timestamp"],
                "source_ip": src_ip,
                "destination_ip": packet["destination_ip"],
                "port": packet["port"],
                "rule_id": "FW001",
                "rule_name": "Traffic from Blocked IP",
                "severity": "high",
                "action": "blocked_by_firewall",
                "payload": payload
            }

        # Analyze payload against signature rules
        for rule in self.rules:
            if re.search(rule["pattern"], payload, re.IGNORECASE):
                # Triggered!
                alert = {
                    "id": packet["id"],
                    "timestamp": packet["timestamp"],
                    "source_ip": src_ip,
                    "destination_ip": packet["destination_ip"],
                    "port": packet["port"],
                    "rule_id": rule["id"],
                    "rule_name": rule["name"],
                    "severity": rule["severity"],
                    "action": rule["action"],
                    "payload": payload
                }
                if rule["action"] == "block":
                    self.block_ip(src_ip)
                return alert
        
        return None