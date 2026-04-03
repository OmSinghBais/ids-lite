import React, { useState, useEffect } from 'react';
import { Zap, Square, AlertTriangle, Shield, Activity, RefreshCw } from 'lucide-react';
import { useIDSData } from '../hooks/useIDSData';

const SCENARIOS = {
  syn_flood:   { label: 'SYN Flood',        color: 'var(--accent-red)',    icon: '🌊', desc: 'High-volume TCP SYN flood from a single IP.' },
  icmp_storm:  { label: 'ICMP Storm',        color: 'var(--accent-orange)', icon: '⛈️', desc: 'ICMP ping storm — overwhelms ICMP stack.' },
  malformed:   { label: 'Malformed Payloads',color: 'var(--accent-cyan)',   icon: '💣', desc: 'Oversized / binary / null-byte payloads.' },
  brute_force: { label: 'Brute Force Login', color: '#a855f7',              icon: '🔑', desc: 'HTTP login brute-force from a single IP.' },
  sql_inject:  { label: 'SQL Injection Burst', color: 'var(--accent-green)',icon: '💉', desc: 'Rapid SQL injection payloads to API endpoints.' },
};

export default function AttackPage() {
  const { startAttack, stopAttack, stopAllAttacks } = useIDSData();
  const [running,   setRunning]   = useState({});
  const [pps,       setPps]       = useState({ syn_flood: 10, icmp_storm: 20, malformed: 5, brute_force: 8, sql_inject: 6 });
  const [feedback,  setFeedback]  = useState('');

  // Poll status every 3s
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch('http://localhost:8000/api/attack/status');
        const data = await res.json();
        setRunning(data.status || {});
      } catch {}
    };
    poll();
    const id = setInterval(poll, 3000);
    return () => clearInterval(id);
  }, []);

  const handleStart = async (scenario) => {
    const res = await startAttack(scenario, pps[scenario]);
    if (res.ok) {
      setRunning(r => ({ ...r, [scenario]: 'running' }));
      setFeedback(`✅ ${SCENARIOS[scenario].label} started at ${pps[scenario]} pkt/s`);
    } else {
      setFeedback(`❌ ${res.error}`);
    }
  };

  const handleStop = async (scenario) => {
    await stopAttack(scenario);
    setRunning(r => ({ ...r, [scenario]: 'stopped' }));
    setFeedback(`🛑 ${SCENARIOS[scenario].label} stopped`);
  };

  const handleStopAll = async () => {
    await stopAllAttacks();
    setRunning({});
    setFeedback('🛑 All attack scenarios stopped');
  };

  const activeCount = Object.values(running).filter(v => v === 'running').length;

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Attack Simulator</h2>
          <p style={{ color: 'var(--text-muted)' }}>
            Inject synthetic attack traffic to test detection rules and rate-limiting.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {activeCount > 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 8, padding: '8px 16px',
            }}>
              <div className="alert-indicator" />
              <span style={{ color: 'var(--accent-red)', fontWeight: 600 }}>{activeCount} active</span>
            </div>
          )}
          <button className="btn btn-danger" onClick={handleStopAll} disabled={activeCount === 0}>
            <Square size={14} /> Stop All
          </button>
        </div>
      </div>

      {feedback && (
        <div style={{
          marginBottom: 24, padding: '12px 20px', borderRadius: 8,
          background: 'rgba(6,182,212,0.08)', border: '1px solid rgba(6,182,212,0.2)',
          color: 'var(--text-main)', fontSize: '0.9rem',
        }}>
          {feedback}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 24 }}>
        {Object.entries(SCENARIOS).map(([key, meta]) => {
          const isRunning = running[key] === 'running';
          return (
            <div key={key} className="glass-panel" style={{
              borderColor: isRunning ? meta.color : 'var(--glass-border)',
              boxShadow: isRunning ? `0 0 20px ${meta.color}33` : 'none',
              transition: 'all 0.3s',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: '1.5rem', marginBottom: 4 }}>{meta.icon}</div>
                  <h3 style={{ fontWeight: 600, color: meta.color }}>{meta.label}</h3>
                </div>
                {isRunning && (
                  <span style={{
                    background: `${meta.color}22`, border: `1px solid ${meta.color}55`,
                    borderRadius: 99, padding: '4px 12px', fontSize: '0.75rem',
                    color: meta.color, fontWeight: 600,
                    animation: 'pulse 2s infinite',
                  }}>LIVE</span>
                )}
              </div>

              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: 20 }}>
                {meta.desc}
              </p>

              {/* Rate slider */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Packets / sec</span>
                  <span style={{ fontSize: '0.8rem', color: meta.color, fontWeight: 600 }}>{pps[key]}</span>
                </div>
                <input
                  type="range" min={1} max={50} value={pps[key]}
                  onChange={e => setPps(p => ({ ...p, [key]: Number(e.target.value) }))}
                  style={{ width: '100%', accentColor: meta.color }}
                  disabled={isRunning}
                />
              </div>

              <button
                className="btn"
                style={{
                  width: '100%',
                  background: isRunning ? 'rgba(239,68,68,0.1)' : `${meta.color}22`,
                  color: isRunning ? 'var(--accent-red)' : meta.color,
                  border: `1px solid ${isRunning ? 'rgba(239,68,68,0.3)' : meta.color + '55'}`,
                  justifyContent: 'center',
                }}
                onClick={() => isRunning ? handleStop(key) : handleStart(key)}
              >
                {isRunning ? <><Square size={14} /> Stop Attack</> : <><Zap size={14} /> Launch Attack</>}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
