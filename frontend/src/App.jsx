import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import { Shield, LayoutDashboard, AlertTriangle, ScrollText, Crosshair, Zap, Wifi } from 'lucide-react';
import Dashboard    from './pages/Dashboard';
import AlertsPage   from './pages/AlertsPage';
import LogsPage     from './pages/LogsPage';
import FirewallPage from './pages/FirewallPage';
import AttackPage   from './pages/AttackPage';
import './index.css';

const NAV = [
  { to: '/',        label: 'Dashboard',    icon: LayoutDashboard, end: true },
  { to: '/alerts',  label: 'Alerts',       icon: AlertTriangle },
  { to: '/logs',    label: 'Live Logs',    icon: ScrollText },
  { to: '/firewall',label: 'Firewall',     icon: Crosshair },
  { to: '/attack',  label: 'Attack Sim',   icon: Zap },
];

function Sidebar() {
  return (
    <nav className="sidebar">
      {/* Logo */}
      <div className="sidebar-header">
        <div className="sidebar-logo-icon">
          <Shield size={20} color="#000" strokeWidth={2.5} />
        </div>
        <h1>IDS&nbsp;<span style={{ fontWeight: 300, opacity: 0.7 }}>Lite</span></h1>
      </div>

      {/* Nav */}
      <div className="sidebar-section-label">Navigation</div>
      <div className="nav-links">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          >
            <Icon size={18} strokeWidth={1.8} />
            {label}
          </NavLink>
        ))}
      </div>

      {/* Footer */}
      <div className="sidebar-footer">
        <span className="sidebar-status-dot" />
        IDS Engine v2.0 · Synthetic
      </div>
    </nav>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="app-layout">
        <Sidebar />
        <main className="main-content">
          <Routes>
            <Route path="/"         element={<Dashboard />} />
            <Route path="/alerts"   element={<AlertsPage />} />
            <Route path="/logs"     element={<LogsPage />} />
            <Route path="/firewall" element={<FirewallPage />} />
            <Route path="/attack"   element={<AttackPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
