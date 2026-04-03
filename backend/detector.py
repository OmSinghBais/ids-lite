import json
import re
from typing import Dict, Any, List, Optional

from sklearn.ensemble import IsolationForest
import numpy as np


# ─── ML Anomaly Detector ──────────────────────────────────────────────────────
class AnomalyDetector:
    MIN_TRAIN_SAMPLES = 50

    def __init__(self):
        self.model = IsolationForest(contamination=0.1, random_state=42)
        self.trained = False
        self.buffer: List[List[float]] = []

    def extract_features(self, packet: Dict[str, Any]) -> List[float]:
        """Safe feature extraction — uses .get() to handle missing fields."""
        return [
            float(packet.get("port", 0)),
            float(len(packet.get("payload", ""))),
            float(hash(packet.get("source_ip", "")) % 1000),
            float(packet.get("size", 0)),
        ]

    def add_packet(self, packet: Dict[str, Any]):
        self.buffer.append(self.extract_features(packet))

        if len(self.buffer) >= self.MIN_TRAIN_SAMPLES and not self.trained:
            self.model.fit(np.array(self.buffer))
            self.trained = True
            print(f"✅ Anomaly model trained on {len(self.buffer)} samples")

    def is_anomalous(self, packet: Dict[str, Any]) -> bool:
        if not self.trained:
            return False
        features = np.array([self.extract_features(packet)])
        return bool(self.model.predict(features)[0] == -1)


# ─── Main Detector ────────────────────────────────────────────────────────────
class Detector:
    def __init__(self, rules_path: str = "rules.json"):
        self.rules = self._load_rules(rules_path)
        self.blocked_ips: set = set()
        self.anomaly_detector = AnomalyDetector()

    def _load_rules(self, path: str) -> List[Dict[str, Any]]:
        try:
            with open(path, "r") as f:
                return json.load(f)
        except Exception as e:
            print(f"⚠️  Failed to load rules: {e}")
            return []

    def get_rules(self) -> List[Dict[str, Any]]:
        return self.rules

    def get_blocked_ips(self) -> List[str]:
        return list(self.blocked_ips)

    def block_ip(self, ip: str):
        self.blocked_ips.add(ip)

    def unblock_ip(self, ip: str) -> bool:
        if ip in self.blocked_ips:
            self.blocked_ips.remove(ip)
            return True
        return False

    def analyze(self, packet: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        src_ip = packet.get("source_ip", "")
        dst_ip = packet.get("destination_ip", "")
        port   = packet.get("port", 0)
        payload = packet.get("payload", "")
        pkt_id  = packet.get("id", "")
        ts      = packet.get("timestamp", 0.0)

        # Step 1: Feed to ML model for training
        self.anomaly_detector.add_packet(packet)

        # Step 2: Blocked IP firewall check
        if src_ip in self.blocked_ips:
            return {
                "id": pkt_id,
                "timestamp": ts,
                "source_ip": src_ip,
                "destination_ip": dst_ip,
                "port": port,
                "rule_id": "FW001",
                "rule_name": "Traffic from Blocked IP",
                "severity": "high",
                "action": "blocked_by_firewall",
                "payload": payload,
            }

        # Step 3: Signature-based rules
        for rule in self.rules:
            if re.search(rule["pattern"], payload, re.IGNORECASE):
                alert = {
                    "id": pkt_id,
                    "timestamp": ts,
                    "source_ip": src_ip,
                    "destination_ip": dst_ip,
                    "port": port,
                    "rule_id": rule["id"],
                    "rule_name": rule["name"],
                    "severity": rule["severity"],
                    "action": rule["action"],
                    "payload": payload,
                }
                if rule["action"] == "block":
                    self.block_ip(src_ip)
                return alert

        # Step 4: ML anomaly detection (fires only after model is trained)
        if self.anomaly_detector.is_anomalous(packet):
            return {
                "id": pkt_id,
                "timestamp": ts,
                "source_ip": src_ip,
                "destination_ip": dst_ip,
                "port": port,
                "rule_id": "ML001",
                "rule_name": "Anomalous Traffic Detected",
                "severity": "medium",
                "action": "monitor",
                "payload": payload,
            }

        return None