import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { btn, theme } from '../theme.js';
import {
  type ScenarioData,
  SCENARIO_NUMBERS,
  clearScenario,
  getScenario,
  isBuilt,
  saveScenario,
} from './scenarios.js';
import { ScenarioEditor } from './ScenarioEditor.js';

const shellStyle: React.CSSProperties = {
  background: theme.bg,
  color: theme.text,
  height: '100vh',
  overflow: 'hidden',
  fontFamily: theme.font,
  display: 'flex',
  flexDirection: 'column',
};

const headerStyle: React.CSSProperties = {
  padding: '14px 24px',
  borderBottom: `1px solid ${theme.border}`,
  flexShrink: 0,
};

const h1Style: React.CSSProperties = {
  margin: 0,
  fontFamily: theme.headingFont,
  fontWeight: 500,
  color: theme.accent,
  letterSpacing: 0.5,
  fontSize: 22,
  whiteSpace: 'nowrap',
};

const selectStyle: React.CSSProperties = {
  fontSize: 14,
  padding: '6px 10px',
  background: theme.panel,
  color: theme.text,
  border: `1px solid ${theme.border}`,
  borderRadius: 3,
  fontFamily: theme.font,
};

const inputStyle: React.CSSProperties = {
  fontSize: 14,
  padding: '6px 10px',
  background: theme.panel,
  color: theme.text,
  border: `1px solid ${theme.border}`,
  borderRadius: 3,
  fontFamily: theme.font,
};

/** Download a scenario's authored layout as JSON, ready to commit into the
 *  repo under packages/shared/src/scenarios/data/. */
function exportScenario(number: number, data: ScenarioData) {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `scenario-${String(number).padStart(3, '0')}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function BuilderScreen() {
  const [version, setVersion] = useState(0);
  const [selectedNumber, setSelectedNumber] = useState<number>(0);

  const selectedData: ScenarioData | null = useMemo(() => {
    void version;
    return getScenario(selectedNumber);
  }, [selectedNumber, version]);

  // Snapshot of which numbers have data — re-read whenever version bumps.
  const builtSet = useMemo(() => {
    void version;
    const set = new Set<number>();
    for (const n of SCENARIO_NUMBERS) if (isBuilt(n)) set.add(n);
    return set;
  }, [version]);

  function refresh() {
    setVersion((v) => v + 1);
  }

  function handleStart() {
    saveScenario({ number: selectedNumber });
    refresh();
  }

  function handleRename(name: string) {
    if (!selectedData) return;
    const next: ScenarioData = { ...selectedData };
    if (name) next.name = name;
    else delete next.name;
    saveScenario(next);
    refresh();
  }

  function handleClear() {
    if (!confirm(`Clear scenario ${selectedNumber}? This removes all data for it.`)) return;
    clearScenario(selectedNumber);
    refresh();
  }

  function handleChange(next: ScenarioData) {
    saveScenario(next);
    refresh();
  }

  // Special-rules draft, kept here so Save/Revert survive editor re-renders.
  const savedRules = selectedData?.specialRules ?? '';
  const [rulesDraft, setRulesDraft] = useState(savedRules);
  useEffect(() => {
    setRulesDraft(savedRules);
  }, [savedRules, selectedNumber]);

  return (
    <div style={shellStyle}>
      <div style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <Link
            to="/"
            style={{ color: theme.muted, fontSize: 13, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}
          >
            <ChevronLeft size={14} /> back to host
          </Link>
          <h1 style={h1Style}>Scenario Builder</h1>

          <select
            value={selectedNumber}
            onChange={(e) => setSelectedNumber(Number(e.target.value))}
            style={{ ...selectStyle, maxWidth: 280 }}
          >
            {SCENARIO_NUMBERS.map((n) => {
              const data = builtSet.has(n) ? getScenario(n) : null;
              const label = `${String(n).padStart(3, '0')} · ${data?.name ?? 'Unbuilt'}`;
              return (
                <option key={n} value={n}>
                  {label}
                </option>
              );
            })}
          </select>

          {selectedData && (
            <input
              value={selectedData.name ?? ''}
              onChange={(e) => handleRename(e.target.value)}
              placeholder="Untitled"
              style={{ ...inputStyle, flex: '0 1 240px' }}
            />
          )}

          {selectedData && (
            <>
              <button
                style={{ ...btn.ghost(), fontSize: 12, padding: '6px 12px' }}
                onClick={() => exportScenario(selectedNumber, selectedData)}
              >
                Export JSON
              </button>
              <button
                style={{ ...btn.ghost(), fontSize: 12, padding: '6px 12px' }}
                onClick={handleClear}
              >
                Clear
              </button>
            </>
          )}

          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 14 }}>
            <Link to="/builder/tiles" style={{ ...btn.outline(), textDecoration: 'none' }}>
              Tiles →
            </Link>
          </div>
        </div>
      </div>

      {selectedData ? (
        <ScenarioEditor
          data={selectedData}
          onChange={handleChange}
          rulesDraft={rulesDraft}
          onRulesDraftChange={setRulesDraft}
        />
      ) : (
        <div style={{ padding: '32px 24px' }}>
          <h2
            style={{
              margin: '0 0 8px',
              fontFamily: theme.headingFont,
              color: theme.accent,
              fontWeight: 500,
              fontSize: 26,
              letterSpacing: 0.5,
            }}
          >
            Scenario {String(selectedNumber).padStart(3, '0')}
          </h2>
          <p style={{ color: theme.muted, marginBottom: 20 }}>
            Not built yet. Start it to add a name, place tiles, and add overlays.
          </p>
          <button style={btn.outline()} onClick={handleStart}>
            Start building
          </button>
        </div>
      )}
    </div>
  );
}
