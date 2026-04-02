import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import { Shield, LayoutDashboard, AlertTriangle, ScrollText, Crosshair } from 'lucide-react';
import Dashboard from './pages/Dashboard';
import AlertsPage from './pages/AlertsPage';
import LogsPage from './pages/LogsPage';
import FirewallPage from './pages/FirewallPage';
import './index.css';

function Sidebar() {
  return (
    <nav className="sidebar">
      <div className="sidebar-header">
        <Shield size={32} color="var(--accent-cyan)" />
        <h1>IDS <span style={{color: 'var(--text-main)', fontWeight: 300}}>Lite</span></h1>
      </div>
      <div className="nav-links">
        <NavLink to="/" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
          <LayoutDashboard size={20} />
          Dashboard
        </NavLink>
        <NavLink to="/alerts" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
          <AlertTriangle size={20} />
          Alerts
        </NavLink>
        <NavLink to="/logs" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
          <ScrollText size={20} />
          Live Logs
        </NavLink>
        <NavLink to="/firewall" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
          <Crosshair size={20} />
          Firewall
        </NavLink>
      </div>
    </nav>
  );
}

function App() {
  return (
    <BrowserRouter>
      <div className="app-layout">
        <Sidebar />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/alerts" element={<AlertsPage />} />
            <Route path="/logs" element={<LogsPage />} />
            <Route path="/firewall" element={<FirewallPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
