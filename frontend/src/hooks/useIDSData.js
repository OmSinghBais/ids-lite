import { useState, useEffect, useRef } from 'react';

export function useIDSData() {
  const [packets, setPackets] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [trafficVolume, setTrafficVolume] = useState([]);
  
  const wsRef = useRef(null);

  useEffect(() => {
    // Connect to FastAPI WebSocket
    const ws = new WebSocket('ws://localhost:8000/ws/traffic');
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      console.log('Connected to IDS backend');
    };

    ws.onmessage = (event) => {
      const payload = JSON.parse(event.data);
      if (payload.type === 'packet') {
        setPackets(prev => {
          const newQ = [payload.data, ...prev];
          if (newQ.length > 100) newQ.pop();
          return newQ;
        });
        
        // Update volume over time graph data
        const now = new Date();
        const timeLabel = `${now.getHours()}:${now.getMinutes()}:${now.getSeconds()}`;
        setTrafficVolume(prev => {
          const last = prev[prev.length - 1];
          if (last && last.time === timeLabel) {
            // increment current second
            const updated = [...prev];
            updated[updated.length - 1] = { ...last, count: last.count + 1 };
            return updated;
          } else {
            // add new second
            const newVol = [...prev, { time: timeLabel, count: 1 }];
            if (newVol.length > 20) newVol.shift();
            return newVol;
          }
        });

        if (payload.alert) {
          setAlerts(prev => {
            const newAlerts = [payload.alert, ...prev];
            if (newAlerts.length > 50) newAlerts.pop();
            return newAlerts;
          });
        }
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
    };

    return () => {
      ws.close();
    };
  }, []);

  return { packets, alerts, isConnected, trafficVolume };
}
