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
  if (!parameters.length) return <div className="hint">This recipe has no exposed compile-time parameters. Its canonical source remains unchanged.</div>;

  function setValue(key: string, value: string) { onChange({ ...values, [key]: value }); }
  return <div className="recipe-parameter-panel" style={{ marginTop: compact ? 8 : 12 }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
      <div><b style={{ display: 'flex', alignItems: 'center', gap: 6 }}><SlidersHorizontal size={15}/> Recipe settings</b><small className="muted">These values are validated and injected into the firmware before compile/upload.</small></div>
      <button className="ghost mini" onClick={() => onChange(recipeParameterDefaults(recipe))}><RotateCcw size={12}/> Defaults</button>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : 'repeat(auto-fit,minmax(220px,1fr))', gap: 10 }}>
      {parameters.map(spec => {
        const value = values[spec.key] ?? spec.default_value;
        if (spec.kind === 'select') return <label key={spec.key}>{spec.label}<select value={value} onChange={event => setValue(spec.key, event.target.value)}>{(spec.choices ?? []).map(choice => <option key={choice}>{choice}</option>)}</select></label>;
        const min = spec.min ?? undefined;
        const max = spec.max ?? undefined;
        const step = spec.step ?? (spec.kind === 'integer' ? 1 : 'any');
        return <div key={spec.key} style={{ border: '1px solid rgba(255,255,255,.07)', borderRadius: 10, padding: 10 }}>
          <label style={{ margin: 0 }}>{spec.label}<div style={{ display: 'grid', gridTemplateColumns: '1fr 92px auto', gap: 8, alignItems: 'center', marginTop: 6 }}>
            {min !== undefined && max !== undefined ? <input aria-label={`${spec.label} slider`} type="range" min={min} max={max} step={step} value={Number(value)} onChange={event => setValue(spec.key, event.target.value)} /> : <span/>}
            <input aria-label={`${spec.label} value`} type="number" min={min} max={max} step={step} value={value} onChange={event => setValue(spec.key, event.target.value)} />
            <small>{spec.unit ?? ''}</small>
          </div></label>
          <small className="muted" style={{ display: 'block', marginTop: 5 }}>{spec.macro_name} · default {spec.default_value}</small>
        </div>;
      })}
    </div>
  </div>;
}
