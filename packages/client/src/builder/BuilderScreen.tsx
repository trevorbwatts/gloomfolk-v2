import { useState } from 'react';
import { Link } from 'react-router-dom';
import { theme } from '../theme.js';
import { TilesTab } from './TilesTab.js';
import { ScenariosTab } from './ScenariosTab.js';

type Tab = 'scenarios' | 'tiles';

const shellStyle: React.CSSProperties = {
  background: theme.bg,
  color: theme.text,
  minHeight: '100vh',
  fontFamily: theme.font,
};

const headerStyle: React.CSSProperties = {
  padding: '16px 24px 0',
  borderBottom: `1px solid ${theme.border}`,
};

const h1Style: React.CSSProperties = {
  margin: 0,
  fontFamily: theme.headingFont,
  fontWeight: 500,
  color: theme.accent,
  letterSpacing: 0.5,
  fontSize: 22,
};

const tabsRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: 4,
  marginTop: 12,
};

const tabStyle = (active: boolean): React.CSSProperties => ({
  padding: '8px 16px',
  background: active ? theme.panelRaised : 'transparent',
  color: active ? theme.accent : theme.muted,
  border: 'none',
  borderBottom: active
    ? `2px solid ${theme.accent}`
    : '2px solid transparent',
  fontFamily: theme.headingFont,
  letterSpacing: 1,
  textTransform: 'uppercase',
  fontSize: 12,
  cursor: 'pointer',
  marginBottom: -1,
});

export function BuilderScreen() {
  const [tab, setTab] = useState<Tab>('scenarios');

  return (
    <div style={shellStyle}>
      <div style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <h1 style={h1Style}>Scenario Builder</h1>
          <Link to="/" style={{ color: theme.muted, fontSize: 13, textDecoration: 'none' }}>
            ← back to host
          </Link>
        </div>
        <div style={tabsRowStyle}>
          <button style={tabStyle(tab === 'scenarios')} onClick={() => setTab('scenarios')}>
            Scenarios
          </button>
          <button style={tabStyle(tab === 'tiles')} onClick={() => setTab('tiles')}>
            Tiles
          </button>
        </div>
      </div>

      {tab === 'scenarios' ? <ScenariosTab /> : <TilesTab />}
    </div>
  );
}
