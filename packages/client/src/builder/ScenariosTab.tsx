import { useEffect, useMemo, useState } from 'react';
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

const layoutStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '240px 1fr',
  gap: 0,
  minHeight: 'calc(100vh - 120px)',
};

const sidebarStyle: React.CSSProperties = {
  borderRight: `1px solid ${theme.border}`,
  padding: '12px 8px',
  overflowY: 'auto',
  maxHeight: 'calc(100vh - 120px)',
};

const contentStyle: React.CSSProperties = {
  padding: '20px 24px',
  overflowY: 'auto',
  maxHeight: 'calc(100vh - 120px)',
};

const navButtonStyle = (active: boolean, built: boolean): React.CSSProperties => ({
  display: 'block',
  width: '100%',
  textAlign: 'left',
  padding: '6px 10px',
  marginBottom: 1,
  background: active ? theme.panelRaised : 'transparent',
  color: active ? theme.accent : built ? theme.text : theme.muted,
  border: 'none',
  borderRadius: 3,
  fontFamily: theme.font,
  fontSize: 13,
  cursor: 'pointer',
});

const headingStyle: React.CSSProperties = {
  color: theme.muted,
  fontSize: 11,
  textTransform: 'uppercase',
  letterSpacing: 1,
  margin: '4px 8px 8px',
  fontFamily: theme.headingFont,
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

export function ScenariosTab() {
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

  return (
    <div style={layoutStyle}>
      <aside style={sidebarStyle}>
        <div style={headingStyle}>Scenarios · 0–100</div>
        {SCENARIO_NUMBERS.map((n) => {
          const data = builtSet.has(n) ? getScenario(n) : null;
          return (
            <button
              key={n}
              style={navButtonStyle(n === selectedNumber, builtSet.has(n))}
              onClick={() => setSelectedNumber(n)}
            >
              <span style={{ color: theme.muted, marginRight: 8, fontVariantNumeric: 'tabular-nums' }}>
                {String(n).padStart(3, '0')}
              </span>
              {data?.name ?? <span style={{ fontStyle: 'italic', opacity: 0.7 }}>Unbuilt</span>}
              {builtSet.has(n) && (
                <span style={{ color: theme.good, marginLeft: 6 }}>●</span>
              )}
            </button>
          );
        })}
      </aside>

      <main style={contentStyle}>
        <ScenarioDetail
          number={selectedNumber}
          data={selectedData}
          onStart={handleStart}
          onRename={handleRename}
          onClear={handleClear}
          onChange={(next) => {
            saveScenario(next);
            refresh();
          }}
        />
      </main>
    </div>
  );
}

interface DetailProps {
  number: number;
  data: ScenarioData | null;
  onStart: () => void;
  onRename: (name: string) => void;
  onClear: () => void;
  onChange: (next: ScenarioData) => void;
}

function ScenarioDetail({ number, data, onStart, onRename, onClear, onChange }: DetailProps) {
  const savedRules = data?.specialRules ?? '';
  const [rulesDraft, setRulesDraft] = useState(savedRules);
  useEffect(() => {
    setRulesDraft(savedRules);
  }, [savedRules, number]);
  const rulesDirty = rulesDraft !== savedRules;

  if (!data) {
    return (
      <div>
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
          Scenario {String(number).padStart(3, '0')}
        </h2>
        <p style={{ color: theme.muted, marginBottom: 20 }}>
          Not built yet. Start it to add a name, place tiles, and add overlays.
        </p>
        <button style={btn.outline()} onClick={onStart}>
          Start building
        </button>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <h2
          style={{
            margin: 0,
            fontFamily: theme.headingFont,
            color: theme.accent,
            fontWeight: 500,
            fontSize: 26,
            letterSpacing: 0.5,
          }}
        >
          Scenario {String(number).padStart(3, '0')}
          {data.name ? <span style={{ color: theme.text }}> · {data.name}</span> : null}
        </h2>
        <button
          style={{ ...btn.ghost(), fontSize: 12, padding: '4px 10px' }}
          onClick={onClear}
        >
          Clear
        </button>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          {rulesDirty && (
            <button
              style={{ ...btn.ghost(), fontSize: 12, padding: '4px 10px' }}
              onClick={() => setRulesDraft(savedRules)}
            >
              Revert
            </button>
          )}
          <button
            style={btn.outline()}
            onClick={() => onChange({ ...data, specialRules: rulesDraft })}
            disabled={!rulesDirty}
          >
            Save
          </button>
        </div>
      </div>

      <div style={{ marginTop: 16, marginBottom: 24 }}>
        <label style={{ color: theme.muted, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>
          Name
        </label>
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <input
            value={data.name ?? ''}
            onChange={(e) => onRename(e.target.value)}
            placeholder="Untitled"
            style={{ ...inputStyle, flex: 1, maxWidth: 360 }}
          />
        </div>
      </div>

      <ScenarioEditor
        data={data}
        onChange={onChange}
        rulesDraft={rulesDraft}
        onRulesDraftChange={setRulesDraft}
      />
    </div>
  );
}
