import React from 'react';
import {
  AreaChart, Area, BarChart, Bar,
  PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { Activity, ShieldAlert, Cpu, TrendingUp, Wifi, Database } from 'lucide-react';
import { useIDSData } from '../hooks/useIDSData';

const PROTO_COLORS = {
  TCP:     '#00d4ff',
  UDP:     '#00e5a0',
  ICMP:    '#ffaa00',
  UNKNOWN: '#5a5a7a',
};

const CHART_TOOLTIP = {
  contentStyle: {
    background: '#0e0e16',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 10,
    color: '#f0f0f8',
    fontSize: 13,
    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
  },
};

// Each card gets its own CSS accent variable
const CARDS = [
  {
    key: 'alerts',
    label: 'Active Alerts',
    icon: ShieldAlert,
    accentVar: '--red',
    accentDimVar: '--red-dim',
    getValue: (data) => data.alerts.length,
    getSub:   (data) => `${data.alerts.filter(a => a.severity === 'high').length} High Severity`,
  },
  {
    key: 'packets',
    label: 'Total Packets',
    icon: Activity,
    accentVar: '--cyan',
    accentDimVar: '--cyan-dim',
    getValue: (data) => data.stats.total_packets.toLocaleString(),
    getSub:   () => 'Since startup',
  },
  {
    key: 'size',
    label: 'Avg Packet Size',
    icon: TrendingUp,
    accentVar: '--green',
    accentDimVar: '--green-dim',
    getValue: (data) => `${data.stats.avg_packet_size}`,
    getSub:   (data) => `Avg payload ${data.stats.avg_payload_length} B`,
    unit: 'B',
  },
  {
    key: 'engine',
    label: 'Engine',
    icon: Cpu,
    accentVar: '--orange',
    accentDimVar: '--orange-dim',
    getValue: (data) => data.isConnected ? 'Active' : 'Halted',
    getSub:   () => 'FastAPI · WebSocket',
  },
];

export default function Dashboard() {
  const { alerts, isConnected, trafficVolume, stats } = useIDSData();
  const data = { alerts, isConnected, stats };

  const pieData = Object.entries(stats.protocol_counts)
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({ name, value }));

  const topSrcData = (stats.top_sources || []).slice(0, 7).map(([ip, count]) => ({
    ip: ip.length > 15 ? ip.substring(0, 13) + '…' : ip,
    count,
  }));

  const ppsData = (stats.packets_per_second || []).map((d, i) => ({ t: i, pps: d.count }));

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h2>System Overview</h2>
          <p>Real-time intrusion detection monitoring</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10,
          background: isConnected ? 'rgba(0,229,160,0.08)' : 'rgba(255,255,255,0.04)',
          border: `1px solid ${isConnected ? 'rgba(0,229,160,0.25)' : 'rgba(255,255,255,0.07)'}`,
          padding: '8px 18px', borderRadius: 8,
        }}>
          <div className={`alert-indicator${isConnected ? ' pulsing' : ''}`}
            style={{ background: isConnected ? 'var(--green)' : 'var(--text-muted)' }} />
          <span style={{ fontWeight: 600, fontSize: '0.88rem',
            color: isConnected ? 'var(--green)' : 'var(--text-muted)' }}>
            {isConnected ? 'ONLINE' : 'OFFLINE'}
          </span>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="dashboard-grid">
        {CARDS.map(({ key, label, icon: Icon, accentVar, accentDimVar, getValue, getSub, unit }) => (
          <div
            key={key}
            className="glass-panel stat-card"
            style={{ '--card-accent': `var(${accentVar})`, '--card-accent-dim': `var(${accentDimVar})` }}
          >
            <div className="stat-header">
              <span>{label}</span>
              <div className="stat-icon-wrap">
                <Icon size={16} color={`var(${accentVar})`} strokeWidth={2} />
              </div>
            </div>
            <div className="stat-value" style={{ color: key === 'engine' && !isConnected ? 'var(--red)' : undefined }}>
              {getValue(data)}
              {unit && <span style={{ fontSize: '1rem', fontWeight: 400, color: 'var(--text-sub)', marginLeft: 3 }}>{unit}</span>}
            </div>
            <div className="stat-sub">{getSub(data)}</div>
          </div>
        ))}
      </div>

      {/* Top row charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, marginBottom: 20 }}>
        <div className="glass-panel" style={{ height: 290 }}>
          <div className="section-title"><Wifi size={13} /> Live Traffic Volume</div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={trafficVolume}>
              <defs>
                <linearGradient id="cgA" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="var(--cyan)" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="var(--cyan)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="time" hide />
              <Tooltip {...CHART_TOOLTIP} />
              <Area type="monotone" dataKey="count" stroke="var(--cyan)"
                strokeWidth={2} fill="url(#cgA)" isAnimationActive={false} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="glass-panel" style={{ height: 290 }}>
          <div className="section-title">Protocol Mix</div>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="45%" innerRadius={58} outerRadius={82}
                  dataKey="value" paddingAngle={4} strokeWidth={0}>
                  {pieData.map((entry) => (
                    <Cell key={entry.name} fill={PROTO_COLORS[entry.name] || '#888'} />
                  ))}
                </Pie>
                <Tooltip {...CHART_TOOLTIP} />
                <Legend formatter={(v) => <span style={{ color: 'var(--text-sub)', fontSize: '0.78rem' }}>{v}</span>} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ color: 'var(--text-muted)', textAlign: 'center', paddingTop: 60, fontSize: '0.85rem' }}>
              Collecting data…
            </div>
          )}
        </div>
      </div>

      {/* Bottom row charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div className="glass-panel" style={{ height: 270 }}>
          <div className="section-title">Top Source IPs</div>
          {topSrcData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={topSrcData} layout="vertical" barSize={6}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="ip" width={115}
                  tick={{ fontSize: 10.5, fill: 'var(--text-sub)', fontFamily: 'JetBrains Mono, monospace' }} />
                <Tooltip {...CHART_TOOLTIP} />
                <Bar dataKey="count" fill="var(--cyan)" radius={[0, 4, 4, 0]}
                  background={{ fill: 'rgba(255,255,255,0.02)', radius: 4 }} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ color: 'var(--text-muted)', textAlign: 'center', paddingTop: 50, fontSize: '0.85rem' }}>Collecting…</div>
          )}
        </div>

        <div className="glass-panel" style={{ height: 270 }}>
          <div className="section-title"><Database size={13} /> Packets / Second</div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={ppsData}>
              <defs>
                <linearGradient id="ppsG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="var(--green)" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="var(--green)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="t" hide />
              <Tooltip {...CHART_TOOLTIP} />
              <Area type="monotone" dataKey="pps" stroke="var(--green)"
                strokeWidth={2} fill="url(#ppsG)" isAnimationActive={false} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}