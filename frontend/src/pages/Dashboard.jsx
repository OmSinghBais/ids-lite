import React from 'react';
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Activity, ShieldAlert, Cpu } from 'lucide-react';
import { useIDSData } from '../hooks/useIDSData';

export default function Dashboard() {
  const { packets, alerts, isConnected, trafficVolume } = useIDSData();

  const getHighSeverityCount = () => alerts.filter(a => a.severity === 'high').length;

  return (
    <div>
      <div className="page-header">
        <h2>System Overview</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>Status:</span>
          <span style={{ 
            color: isConnected ? 'var(--accent-green)' : 'var(--text-muted)',
            fontWeight: 500
          }}>
            {isConnected ? 'ONLINE' : 'OFFLINE'}
          </span>
          {isConnected && <div className="alert-indicator" style={{backgroundColor: 'var(--accent-green)', animation: 'none'}}></div>}
        </div>
      </div>

      <div className="dashboard-grid">
         <div className="glass-panel stat-card">
           <div className="stat-header">
             <span>Active Alerts</span>
             <ShieldAlert size={18} color="var(--accent-cyan)" />
           </div>
           <div className="stat-value">
             {alerts.length}
           </div>
           <div style={{color: 'var(--text-muted)', fontSize: '0.85rem'}}>
             {getHighSeverityCount()} High Severity
           </div>
         </div>

         <div className="glass-panel stat-card">
           <div className="stat-header">
             <span>Traffic Analyzed</span>
             <Activity size={18} color="var(--accent-green)" />
           </div>
           <div className="stat-value">
             {packets.length}
           </div>
           <div style={{color: 'var(--text-muted)', fontSize: '0.85rem'}}>
             Recent Packets Streamed
           </div>
         </div>

         <div className="glass-panel stat-card">
           <div className="stat-header">
             <span>Status Engine</span>
             <Cpu size={18} color="var(--accent-orange)" />
           </div>
           <div className="stat-value">
             {isConnected ? "Active" : "Halted"}
           </div>
           <div style={{color: 'var(--text-muted)', fontSize: '0.85rem'}}>
             FastAPI backend connection
           </div>
         </div>
      </div>

      <div className="glass-panel" style={{ height: 400, display: 'flex', flexDirection: 'column' }}>
        <h3 style={{marginBottom: 20, fontWeight: 500, color: 'var(--text-muted)'}}>Live Traffic Volume</h3>
        <div style={{ flex: 1 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trafficVolume} margin={{top: 10, right: 0, left: 0, bottom: 0}}>
              <defs>
                <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--accent-cyan)" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="var(--accent-cyan)" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="time" hide={true} />
              <Tooltip 
                contentStyle={{ backgroundColor: 'var(--bg-panel)', border: '1px solid var(--glass-border)', borderRadius: 8, color: '#fff' }}
              />
              <Area type="monotone" dataKey="count" stroke="var(--accent-cyan)" fillOpacity={1} fill="url(#colorCount)" isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}