import type { CSSProperties } from 'react';

export type Theme = {
  bg: string;
  bgSolid: string;
  panel: string;
  panelRaised: string;
  text: string;
  muted: string;
  accent: string;
  accentInk: string;
  border: string;
  good: string;
  warn: string;
  bad: string;
  font: string;
  headingFont: string;
};

export const gloomwood: Theme = {
  bg: 'radial-gradient(ellipse at top, #1d2a23 0%, #0e1612 70%)',
  bgSolid: '#0e1612',
  panel: '#16201a',
  panelRaised: '#1c2820',
  text: '#e7e2cf',
  muted: '#8a9388',
  accent: '#d9a441',
  accentInk: '#0e1612',
  border: '#2a3a30',
  good: '#7bb96b',
  warn: '#c79a4a',
  bad: '#c2645a',
  font: '"Iowan Old Style", "Palatino Linotype", Georgia, serif',
  headingFont: '"Iowan Old Style", "Palatino Linotype", Georgia, serif',
};

export const theme = gloomwood;

export const btn = {
  primary: (disabled = false): CSSProperties => ({
    fontSize: 14,
    padding: '8px 16px',
    background: disabled ? theme.border : theme.accent,
    color: disabled ? theme.muted : theme.accentInk,
    border: 'none',
    borderRadius: 3,
    fontFamily: theme.headingFont,
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
  }),
  ghost: (): CSSProperties => ({
    fontSize: 13,
    padding: '8px 14px',
    background: 'transparent',
    color: theme.text,
    border: `1px solid ${theme.border}`,
    borderRadius: 3,
    fontFamily: theme.font,
    cursor: 'pointer',
  }),
  outline: (): CSSProperties => ({
    fontSize: 13,
    padding: '8px 14px',
    background: 'transparent',
    color: theme.accent,
    border: `1px solid ${theme.accent}`,
    borderRadius: 3,
    fontFamily: theme.headingFont,
    letterSpacing: 1,
    textTransform: 'uppercase',
    cursor: 'pointer',
  }),
};
