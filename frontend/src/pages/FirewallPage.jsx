import React, { useState, useEffect } from 'react';
import { Shield, Unlock } from 'lucide-react';

export default function FirewallPage() {
  const [rules, setRules] = useState([]);
  const [blockedIps, setBlockedIps] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchFirewallData = async () => {
    try {
      const [rulesRes, ipsRes] = await Promise.all([
        fetch('http://localhost:8000/api/rules'),
        fetch('http://localhost:8000/api/blocked-ips')
      ]);
      const rulesData = await rulesRes.json();
      const ipsData = await ipsRes.json();
      setRules(rulesData.rules || []);
      setBlockedIps(ipsData.blocked_ips || []);
    } catch (err) {
      console.error("Failed to fetch firewall info", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFirewallData();
    // Poll for blocked IPs every 5 seconds
    const interval = setInterval(fetchFirewallData, 5000);
    return () => clearInterval(interval);
  }, []);

  const unblockIp = async (ip) => {
    try {
      await fetch('http://localhost:8000/api/unblock-ip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip })
      });
      fetchFirewallData(); // refresh list
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Firewall Configuration</h2>
          <p style={{color: 'var(--text-muted)'}}>Manage signatures and blocked intruders.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        {/* Active Rules List */}
        <div className="glass-panel">
          <div style={{display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24}}>
            <Shield color="var(--accent-cyan)" />
            <h3 style={{fontWeight: 500}}>Active Signatures</h3>
          </div>
          {loading ? <p>Loading...</p> : (
            <div style={{display: 'flex', flexDirection: 'column', gap: 16}}>
              {rules.map((rule) => (
                <div key={rule.id} style={{
                  padding: 16, 
                  borderRadius: 8, 
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid var(--glass-border)'
                }}>
                  <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: 8}}>
                    <strong>{rule.name}</strong>
                    <span className={`severity-badge severity-${rule.severity}`}>{rule.severity}</span>
                  </div>
                  <div style={{fontSize: '0.85rem', color: 'var(--text-muted)', fontFamily: 'monospace'}}>
                    Pattern: {rule.pattern}
                  </div>
                  <div style={{fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 4}}>
                    Action: <span style={{color: 'var(--text-main)', textTransform: 'capitalize'}}>{rule.action}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Blocked IPs List */}
        <div className="glass-panel">
          <div style={{display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24}}>
            <Unlock color="var(--accent-red)" />
            <h3 style={{fontWeight: 500}}>Blocked IP Addresses</h3>
          </div>
          {loading ? <p>Loading...</p> : blockedIps.length === 0 ? (
            <p style={{color: 'var(--text-muted)'}}>No IPs are currently blocked.</p>
          ) : (
            <div style={{display: 'flex', flexDirection: 'column', gap: 12}}>
              {blockedIps.map((ip) => (
                <div key={ip} style={{
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  padding: '12px 16px',
                  background: 'rgba(239, 68, 68, 0.05)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  borderRadius: 8
                }}>
                  <span style={{fontFamily: 'monospace', fontSize: '1.1rem'}}>{ip}</span>
                  <button onClick={() => unblockIp(ip)} className="btn btn-danger" style={{fontSize: '0.8rem'}}>
                    Unblock
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