import { useState, useEffect, useRef, useCallback } from 'react';

const API = 'http://localhost:8000';
const WS_TRAFFIC = 'ws://localhost:8000/ws/traffic';
const WS_STATS   = 'ws://localhost:8000/ws/stats';

export function useIDSData() {
  const [packets,       setPackets]       = useState([]);
  const [alerts,        setAlerts]        = useState([]);
  const [isConnected,   setIsConnected]   = useState(false);
  const [trafficVolume, setTrafficVolume] = useState([]);

  // ① Real-time stats from /ws/stats
  const [stats, setStats] = useState({
    total_packets: 0,
    protocol_counts: { TCP: 0, UDP: 0, ICMP: 0 },
    top_sources: [],
    top_destinations: [],
    avg_packet_size: 0,
    avg_payload_length: 0,
    packets_per_second: [],
    alert_counts: { high: 0, medium: 0, low: 0 },
  });

  const trafficWsRef = useRef(null);
  const statsWsRef   = useRef(null);

  // ─── Traffic WebSocket ──────────────────────────────────────────────────────
  useEffect(() => {
    const ws = new WebSocket(WS_TRAFFIC);
    trafficWsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
    };

    ws.onmessage = (e) => {
      const payload = JSON.parse(e.data);
      if (payload.type !== 'packet') return;

      // Packets ring-buffer (max 100)
      setPackets(prev => {
        const q = [payload.data, ...prev];
        if (q.length > 100) q.pop();
        return q;
      });

      // Traffic volume per second
      const now = new Date();
      const timeLabel = `${String(now.getHours()).padStart(2,'0')}:`
                      + `${String(now.getMinutes()).padStart(2,'0')}:`
                      + `${String(now.getSeconds()).padStart(2,'0')}`;
      setTrafficVolume(prev => {
        const last = prev[prev.length - 1];
        if (last && last.time === timeLabel) {
          const updated = [...prev];
          updated[updated.length - 1] = { ...last, count: last.count + 1 };
          return updated;
        }
        const next = [...prev, { time: timeLabel, count: 1 }];
        if (next.length > 30) next.shift();
        return next;
      });

      // Alerts
      if (payload.alert) {
        setAlerts(prev => {
          const next = [payload.alert, ...prev];
          if (next.length > 200) next.pop();
          return next;
        });
      }
    };

    ws.onclose = () => setIsConnected(false);
    ws.onerror = () => setIsConnected(false);

    return () => ws.close();
  }, []);

  // ─── Stats WebSocket ── ①  ─────────────────────────────────────────────────
  useEffect(() => {
    const ws = new WebSocket(WS_STATS);
    statsWsRef.current = ws;

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === 'stats') {
        setStats(msg.data);
      }
    };

    return () => ws.close();
  }, []);

  // ─── API Helpers ───────────────────────────────────────────────────────────

  // ⑥  Attack simulator controls
  const startAttack = useCallback(async (scenario, packets_per_sec = 5) => {
    const res = await fetch(`${API}/api/attack/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenario, packets_per_sec }),
    });
    return res.json();
  }, []);

  const stopAttack = useCallback(async (scenario) => {
    const res = await fetch(`${API}/api/attack/stop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenario, packets_per_sec: 0 }),
    });
    return res.json();
  }, []);

  const stopAllAttacks = useCallback(async () => {
    const res = await fetch(`${API}/api/attack/stop-all`, { method: 'POST' });
    return res.json();
  }, []);

  // Block / unblock
  const blockIp = useCallback(async (ip) => {
    const res = await fetch(`${API}/api/block-ip`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ip }),
    });
    return res.json();
  }, []);

  const unblockIp = useCallback(async (ip) => {
    const res = await fetch(`${API}/api/unblock-ip`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ip }),
    });
    return res.json();
  }, []);

  return {
    packets,
    alerts,
    isConnected,
    trafficVolume,
    stats,         // ①
    startAttack,   // ⑥
    stopAttack,
    stopAllAttacks,
    blockIp,
    unblockIp,
  };
}
