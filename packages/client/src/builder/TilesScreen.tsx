import { Link } from 'react-router-dom';
import { theme } from '../theme.js';
import { TilesTab } from './TilesTab.js';

const shellStyle: React.CSSProperties = {
  background: theme.bg,
  color: theme.text,
  minHeight: '100vh',
  fontFamily: theme.font,
};

const headerStyle: React.CSSProperties = {
  padding: '16px 24px',
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

export function TilesScreen() {
  return (
    <div style={shellStyle}>
      <div style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Link
            to="/builder"
            style={{ color: theme.muted, fontSize: 13, textDecoration: 'none' }}
          >
            ← back to builder
          </Link>
          <h1 style={h1Style}>Tiles</h1>
        </div>
      </div>
      <TilesTab />
    </div>
  );
}
