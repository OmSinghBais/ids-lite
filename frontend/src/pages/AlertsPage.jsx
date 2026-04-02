import React from 'react';
import { useIDSData } from '../hooks/useIDSData';
import { ShieldAlert } from 'lucide-react';

export default function AlertsPage() {
  const { alerts } = useIDSData();

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Security Alerts</h2>
          <p style={{color: 'var(--text-muted)'}}>Threats detected by the IDS signature engine.</p>
        </div>
        <div style={{
          display: 'flex', 
          alignItems: 'center', 
          gap: 12, 
          background: 'rgba(239, 68, 68, 0.1)', 
          padding: '12px 24px', 
          borderRadius: 8,
          border: '1px solid rgba(239, 68, 68, 0.3)'
        }}>
          <ShieldAlert color="var(--accent-red)" />
          <span style={{color: 'var(--text-main)', fontWeight: 600}}>
            {alerts.length} Total Alerts in session
          </span>
        </div>
      </div>

      <div className="glass-panel" style={{padding: 0, overflow: 'hidden'}}>
        {alerts.length === 0 ? (
          <div style={{padding: 48, textAlign: 'center', color: 'var(--text-muted)'}}>
            No security alerts detected yet. System secure.
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr style={{background: 'rgba(0,0,0,0.2)'}}>
                <th>Time</th>
                <th>Source IP</th>
                <th>Rule Triggered</th>
                <th>Severity</th>
                <th>Action Taken</th>
              </tr>
            </thead>
            <tbody>
              {alerts.map((alert, i) => (
                <tr key={`${alert.id}-${i}`}>
                  <td>{new Date(alert.timestamp * 1000).toLocaleTimeString()}</td>
                  <td style={{fontFamily: 'monospace', color: 'var(--accent-blue)'}}>{alert.source_ip}</td>
                  <td>{alert.rule_name} <br/><span style={{fontSize: '0.75rem', color: 'var(--text-muted)'}}>{alert.payload.substring(0,30)}...</span></td>
                  <td>
                    <span className={`severity-badge severity-${alert.severity}`}>
                      {alert.severity}
                    </span>
                  </td>
                  <td style={{textTransform: 'capitalize'}}>{alert.action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}