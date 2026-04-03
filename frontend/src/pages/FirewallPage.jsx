
import React, { useState, useEffect } from 'react';
import { Shield, Unlock, ShieldOff, Lock, RefreshCw, Plus } from 'lucide-react';

const API = 'http://localhost:8000';

export default function FirewallPage() {
  const [rules,      setRules]      = useState([]);
  const [blockedIps, setBlockedIps] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [newIp,      setNewIp]      = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const SEV_META = {
    high:   { color: 'var(--red)',    icon: '🔴' },
    medium: { color: 'var(--orange)', icon: '🟠' },
    low:    { color: 'var(--green)',  icon: '🟢' },
  };

  const fetch_data = async () => {
    setRefreshing(true);
    try {
      const [r, i] = await Promise.all([
        fetch(`${API}/api/rules`).then(x => x.json()),
        fetch(`${API}/api/blocked-ips`).then(x => x.json()),
      ]);
      setRules(r.rules || []);
      setBlockedIps(i.blocked_ips || []);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => {
    fetch_data();
    const id = setInterval(fetch_data, 8000);
    return () => clearInterval(id);
  }, []);

  const unblockIp = async (ip) => {
    await fetch(`${API}/api/unblock-ip`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ip }),
    });
    fetch_data();
  };

  const blockIp = async () => {
    if (!newIp.trim()) return;
    await fetch(`${API}/api/block-ip`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ip: newIp.trim() }),
    });
    setNewIp('');
    fetch_data();
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Firewall</h2>
          <p>Active detection signatures and blocked intruders</p>
        </div>
        <button className="btn btn-ghost" onClick={fetch_data} disabled={refreshing}>
          <RefreshCw size={14} className={refreshing ? 'spin' : ''} />
          Refresh
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>

        {/* Detection Rules */}
        <div>
          <div className="section-title"><Shield size={13} color="var(--cyan)" /> Active Signatures ({rules.length})</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="glass-panel" style={{ height: 90, opacity: 0.4 }} />
              ))
            ) : rules.map((rule) => {
              const sev = SEV_META[rule.severity] || SEV_META.low;
              return (
                <div key={rule.id} className="glass-panel" style={{
                  padding: '18px 20px',
                  borderLeft: `3px solid ${sev.color}`,
                  gap: 0,
                  transition: 'all 0.2s',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: '1rem' }}>{sev.icon}</span>
                      <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{rule.name}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <span className={`severity-badge severity-${rule.severity}`}>{rule.severity}</span>
                      <span className="chip">{rule.action}</span>
                    </div>
                  </div>
                  <div style={{
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: '0.78rem',
                    color: 'var(--text-muted)',
                    background: 'rgba(255,255,255,0.03)',
                    padding: '6px 10px',
                    borderRadius: 6,
                    border: '1px solid var(--glass-border)',
                  }}>
                    {rule.pattern}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Blocked IPs */}
        <div>
          <div className="section-title"><ShieldOff size={13} color="var(--red)" /> Blocked IPs ({blockedIps.length})</div>

          {/* Block new IP */}
          <div className="glass-panel" style={{
            marginBottom: 16, padding: '16px 20px',
            borderColor: 'rgba(0,212,255,0.15)',
          }}>
            <div style={{ display: 'flex', gap: 10 }}>
              <input
                type="text"
                value={newIp}
                onChange={e => setNewIp(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && blockIp()}
                placeholder="Enter IP to block…"
                style={{ flex: 1 }}
              />
              <button
                className="btn btn-primary"
                onClick={blockIp}
                disabled={!newIp.trim()}
              >
                <Lock size={14} /> Block
              </button>
            </div>
          </div>

          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="glass-panel" style={{ height: 56, opacity: 0.4, marginBottom: 10 }} />
            ))
          ) : blockedIps.length === 0 ? (
            <div className="glass-panel" style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-muted)' }}>
              <Shield size={36} strokeWidth={1} style={{ opacity: 0.25, marginBottom: 12, display: 'block', margin: '0 auto 12px' }} />
              No IPs currently blocked
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {blockedIps.map((ip) => (
                <div key={ip} className="glass-panel" style={{
                  padding: '14px 18px',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  borderColor: 'rgba(255,68,102,0.15)',
                  background: 'rgba(255,68,102,0.04)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: 'var(--red)', boxShadow: '0 0 6px var(--red-glow)',
                    }} />
                    <span style={{
                      fontFamily: 'JetBrains Mono, monospace',
                      fontSize: '0.92rem', color: 'var(--text-main)',
                    }}>{ip}</span>
                  </div>
                  <button onClick={() => unblockIp(ip)} className="btn btn-ghost" style={{
                    color: 'var(--text-muted)', fontSize: '0.78rem', padding: '6px 12px',
                  }}>
                    <Unlock size={12} /> Unblock
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}