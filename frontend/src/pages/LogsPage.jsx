import React, { useEffect, useRef } from 'react';
import { useIDSData } from '../hooks/useIDSData';

export default function LogsPage() {
  const { packets } = useIDSData();
  const logsEndRef = useRef(null);

  // Auto-scroll to bottom of logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [packets]);

  return (
    <div>
      <div className="page-header">
        <h2>Live Traffic Logs</h2>
        <p style={{color: 'var(--text-muted)'}}>Real-time stream directly from the simulation engine.</p>
      </div>

      <div className="log-container">
        {packets.length === 0 ? (
          <div style={{color: 'var(--text-muted)', fontStyle: 'italic'}}>Waiting for traffic...</div>
        ) : (
          packets.slice().reverse().map((pkt) => {
            // is it malicious based on our hook? Wait, the hook doesn't attach 'malicious' flag to packets, 
            // but we can check if it has a suspicious payload. For simplicity, just display raw.
            const isSuspicious = pkt.payload.includes('SELECT') || pkt.payload.includes('script') || pkt.payload.includes('../');

            return (
              <div key={pkt.id} className={`log-line ${isSuspicious ? 'malicious' : ''}`}>
                <span style={{color: '#6b7280'}}>[{new Date(pkt.timestamp * 1000).toLocaleTimeString()}]</span>{' '}
                <span style={{color: 'var(--accent-blue)'}}>{pkt.source_ip}:{pkt.port}</span>{' '}
                {'->'} {pkt.destination_ip}{' '}
                | <span style={{color: isSuspicious ? 'var(--accent-red)' : '#fcd34d'}}>{pkt.protocol}</span>{' '}
                | {pkt.payload}
              </div>
            );
          })
        )}
        <div ref={logsEndRef} />
      </div>
    </div>
  );
}