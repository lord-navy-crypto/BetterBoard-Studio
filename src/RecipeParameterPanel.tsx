import { RotateCcw, SlidersHorizontal } from 'lucide-react';

export type RecipeParameterSpec = {
  key: string;
  label: string;
  kind: 'integer' | 'number' | 'select';
  default_value: string;
  min?: number | null;
  max?: number | null;
  step?: number | null;
  unit?: string | null;
  macro_name: string;
  choices?: string[];
};

export type ParameterizedRecipe = {
  parameters?: RecipeParameterSpec[];
  parameter_values?: Record<string, string>;
};

export function recipeParameterDefaults(recipe?: ParameterizedRecipe | null): Record<string, string> {
  const values: Record<string, string> = {};
  for (const spec of recipe?.parameters ?? []) {
    values[spec.key] = recipe?.parameter_values?.[spec.key] ?? spec.default_value;
  }
  return values;
}

type Props = {
  recipe?: ParameterizedRecipe | null;
  values: Record<string, string>;
  onChange: (values: Record<string, string>) => void;
  compact?: boolean;
};

export default function RecipeParameterPanel({ recipe, values, onChange, compact = false }: Props) {
  const parameters = recipe?.parameters ?? [];
  if (!parameters.length) return <div className="hint">No setup is required for this recipe. It uses its canonical firmware settings.</div>;

  const defaults = recipeParameterDefaults(recipe);
  const changedCount = parameters.filter(spec => (values[spec.key] ?? spec.default_value) !== (defaults[spec.key] ?? spec.default_value)).length;

  function setValue(key: string, value: string) { onChange({ ...values, [key]: value }); }
  function resetValue(spec: RecipeParameterSpec) { setValue(spec.key, defaults[spec.key] ?? spec.default_value); }

  return <div className="recipe-parameter-panel" style={{ marginTop: compact ? 8 : 12 }}>
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
      <div>
        <b style={{ display: 'flex', alignItems: 'center', gap: 6 }}><SlidersHorizontal size={15}/> Recipe settings</b>
        <small className="muted">Tune the experiment before programming. Values are validated and injected into firmware at compile time.</small>
        <div className="schema-row" style={{ marginTop: 7 }}>
          <span>{parameters.length} setting{parameters.length === 1 ? '' : 's'}</span>
          <span>{changedCount ? `${changedCount} customized` : 'Using defaults'}</span>
          <span>Applied to firmware</span>
        </div>
      </div>
      <button className="ghost mini" disabled={!changedCount} onClick={() => onChange(defaults)}><RotateCcw size={12}/> Defaults</button>
    </div>

    <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : 'repeat(auto-fit,minmax(230px,1fr))', gap: 10 }}>
      {parameters.map(spec => {
        const value = values[spec.key] ?? spec.default_value;
        const defaultValue = defaults[spec.key] ?? spec.default_value;
        const changed = value !== defaultValue;

        if (spec.kind === 'select') return <div key={spec.key} style={{ border: `1px solid ${changed ? 'rgba(96,165,250,.34)' : 'rgba(255,255,255,.07)'}`, borderRadius: 10, padding: 10 }}>
          <label style={{ margin: 0 }}>{spec.label}<select value={value} onChange={event => setValue(spec.key, event.target.value)}>{(spec.choices ?? []).map(choice => <option key={choice}>{choice}</option>)}</select></label>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', marginTop: 6 }}>
            <small className="muted">{spec.macro_name} · default {defaultValue}</small>
            {changed && <button className="ghost mini" onClick={() => resetValue(spec)}><RotateCcw size={11}/> Reset</button>}
          </div>
        </div>;

        const min = spec.min ?? undefined;
        const max = spec.max ?? undefined;
        const step = spec.step ?? (spec.kind === 'integer' ? 1 : 'any');
        const hasRange = min !== undefined && max !== undefined;

        return <div key={spec.key} style={{ border: `1px solid ${changed ? 'rgba(96,165,250,.34)' : 'rgba(255,255,255,.07)'}`, borderRadius: 10, padding: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
            <b style={{ fontSize: 13 }}>{spec.label}</b>
            {changed && <span className="eyebrow">CUSTOM</span>}
          </div>
          <label style={{ margin: 0 }}>
            <div style={{ display: 'grid', gridTemplateColumns: hasRange ? '1fr 92px auto' : '1fr auto', gap: 8, alignItems: 'center', marginTop: 7 }}>
              {hasRange && <input aria-label={`${spec.label} slider`} type="range" min={min} max={max} step={step} value={Number(value)} onChange={event => setValue(spec.key, event.target.value)} />}
              <input aria-label={`${spec.label} value`} type="number" min={min} max={max} step={step} value={value} onChange={event => setValue(spec.key, event.target.value)} />
              <small>{spec.unit ?? ''}</small>
            </div>
          </label>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', marginTop: 6 }}>
            <small className="muted">{hasRange ? `${min}–${max}${spec.unit ? ` ${spec.unit}` : ''}` : 'Direct value'} · {spec.macro_name}</small>
            {changed && <button className="ghost mini" onClick={() => resetValue(spec)}><RotateCcw size={11}/> Reset</button>}
          </div>
        </div>;
      })}
    </div>
  </div>;
}
