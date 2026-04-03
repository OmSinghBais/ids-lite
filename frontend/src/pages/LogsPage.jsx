import React, { useEffect, useRef } from 'react';
import { useIDSData } from '../hooks/useIDSData';
import { Terminal, Circle } from 'lucide-react';

export default function LogsPage() {
  const { packets } = useIDSData();
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [packets]);

  const isMalicious = (pkt) =>
    /SELECT|UNION|DROP TABLE|script|\.\.\/|\bOR\s+1=1\b|nmap|masscan/i.test(pkt.payload || '');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 72px)' }}>
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div>
          <h2>Live Traffic Logs</h2>
          <p>Real-time packet stream from the detection engine</p>
        </div>
        <div style={{ display: 'flex', align: 'center', gap: 12 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'rgba(0,229,160,0.08)', border: '1px solid rgba(0,229,160,0.2)',
            borderRadius: 8, padding: '8px 16px',
          }}>
            <Terminal size={14} color="var(--green)" />
            <span style={{ color: 'var(--green)', fontWeight: 600, fontSize: '0.85rem' }}>
              {packets.length} packets
            </span>
          </div>
        </div>
      </div>

      <div className="log-container" style={{ flex: 1 }}>
        {/* Fake terminal header */}
        <div style={{
          display: 'flex', gap: 6, marginBottom: 16, paddingBottom: 12,
          borderBottom: '1px solid rgba(0,229,160,0.1)',
        }}>
          {['#ff5f57', '#ffbd2e', '#28c840'].map((c, i) => (
            <div key={i} style={{ width: 10, height: 10, borderRadius: '50%', background: c }} />
          ))}
          <span style={{ marginLeft: 8, color: 'rgba(0,229,160,0.4)', fontSize: '0.78rem' }}>
            ids-lite • live packet capture • synthetic mode
          </span>
        </div>

        {packets.length === 0 ? (
          <div style={{ color: 'rgba(0,229,160,0.3)', fontStyle: 'italic' }}>
            Waiting for traffic stream…
          </div>
        ) : (
          packets.slice().reverse().map((pkt) => {
            const mal = isMalicious(pkt);
            return (
              <div key={pkt.id} className={`log-line${mal ? ' malicious' : ''}`}>
                <span style={{ color: 'rgba(255,255,255,0.25)' }}>
                  [{new Date(pkt.timestamp * 1000).toLocaleTimeString()}]
                </span>{' '}
                <span style={{ color: mal ? 'var(--red)' : 'var(--cyan)' }}>
                  {pkt.source_ip}:{pkt.port}
                </span>{' '}
                <span style={{ color: 'rgba(255,255,255,0.3)' }}>→</span>{' '}
                <span style={{ color: 'rgba(255,255,255,0.5)' }}>{pkt.destination_ip}</span>{' '}
                <span style={{
                  color: pkt.protocol === 'TCP' ? 'var(--cyan)' : pkt.protocol === 'UDP' ? 'var(--green)' : 'var(--orange)',
                  fontWeight: 600,
                }}>
                  [{pkt.protocol}]
                </span>{' '}
                <span style={{ opacity: 0.7 }}>{pkt.size}B</span>{' '}
                <span style={{ color: mal ? 'var(--red)' : 'rgba(0,229,160,0.7)' }}>
                  {pkt.payload}
                </span>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}