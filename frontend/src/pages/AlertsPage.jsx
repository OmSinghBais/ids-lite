import React from 'react';
import { useIDSData } from '../hooks/useIDSData';
import { ShieldAlert, Clock, Globe, AlertTriangle } from 'lucide-react';

const SEV_ORDER = { high: 0, medium: 1, low: 2 };

export default function AlertsPage() {
  const { alerts } = useIDSData();

  const high   = alerts.filter(a => a.severity === 'high').length;
  const medium = alerts.filter(a => a.severity === 'medium').length;
  const low    = alerts.filter(a => a.severity === 'low').length;

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Security Alerts</h2>
          <p>Threats detected by signature and ML anomaly engine</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {[
            { label: 'High',   count: high,   color: 'var(--red)',    dim: 'rgba(255,68,102,0.12)'   },
            { label: 'Medium', count: medium, color: 'var(--orange)', dim: 'rgba(255,170,0,0.12)'    },
            { label: 'Low',    count: low,    color: 'var(--green)',  dim: 'rgba(0,229,160,0.1)'     },
          ].map(({ label, count, color, dim }) => (
            <div key={label} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: dim, border: `1px solid ${color}44`,
              borderRadius: 8, padding: '8px 16px',
            }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: color, boxShadow: `0 0 6px ${color}` }} />
              <span style={{ color, fontWeight: 700, fontSize: '0.9rem' }}>{count}</span>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
        {alerts.length === 0 ? (
          <div style={{
            padding: 64, textAlign: 'center', color: 'var(--text-muted)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
          }}>
            <ShieldAlert size={48} strokeWidth={1} style={{ opacity: 0.3 }} />
            <div>
              <div style={{ fontSize: '1.05rem', marginBottom: 4, color: 'var(--text-sub)' }}>No alerts detected</div>
              <div style={{ fontSize: '0.85rem' }}>System secure — monitoring active</div>
            </div>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th><div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Clock size={12} /> Time</div></th>
                <th><div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Globe size={12} /> Source IP</div></th>
                <th>Rule Triggered</th>
                <th>Severity</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {alerts.map((alert, i) => (
                <tr key={`${alert.id}-${i}`} style={{
                  borderLeft: alert.severity === 'high' ? '3px solid var(--red)' : '3px solid transparent',
                }}>
                  <td style={{ color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.8rem' }}>
                    {new Date(alert.timestamp * 1000).toLocaleTimeString()}
                  </td>
                  <td>
                    <span style={{
                      fontFamily: 'JetBrains Mono, monospace',
                      fontSize: '0.88rem',
                      color: 'var(--cyan)',
                      background: 'var(--cyan-dim)',
                      padding: '3px 8px',
                      borderRadius: 5,
                    }}>
                      {alert.source_ip}
                    </span>
                  </td>
                  <td>
                    <div style={{ fontWeight: 500, marginBottom: 3 }}>{alert.rule_name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
                      {alert.payload?.substring(0, 36)}…
                    </div>
                  </td>
                  <td>
                    <span className={`severity-badge severity-${alert.severity}`}>
                      {alert.severity}
                    </span>
                  </td>
                  <td>
                    <span className="chip"
                      style={{ color: alert.action === 'block' ? 'var(--red)' : 'var(--text-sub)' }}>
                      {alert.action}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}