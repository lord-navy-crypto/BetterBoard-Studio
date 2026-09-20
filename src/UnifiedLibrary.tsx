import { useMemo, useState } from 'react';
import { BookOpen, Braces, Code2, Cpu, Play, Search, ShieldCheck, Upload } from 'lucide-react';
import { ALL_PROGRAM_ASSETS, PROGRAM_FAMILY_ORDER, loadProgramAsset, type ProgramAsset } from './ProgramLibraryCatalog';
import RecipeParameterPanel, { type RecipeParameterSpec } from './RecipeParameterPanel';

export type UnifiedRecipe = {
  id: string;
  title: string;
  category: string;
  description: string;
  sketch_name: string;
  capture_mode: 'none' | 'numeric' | 'text';
  baud: number;
  columns: string[];
  units: string[];
  required_libraries: string[];
  hardware: string[];
  physical_lab_targets: string[];
  boundary: string;
  parameters?: RecipeParameterSpec[];
  parameter_values?: Record<string, string>;
  user_defined?: boolean;
};

type LibraryKind = 'all' | 'recipe' | 'firmware' | 'analysis';
type SelectedItem =
  | { kind: 'recipe'; recipe: UnifiedRecipe }
  | { kind: 'asset'; asset: ProgramAsset };

type Props = {
  recipes: UnifiedRecipe[];
  selectedRecipeId?: string;
  parameterValues?: Record<string, string>;
  onParameterValuesChange?: (values: Record<string, string>) => void;
  onSelectRecipe?: (id: string) => void;
  onUseRecipe?: (id: string) => void;
  onOpenDeveloperTemplate?: (templateId: string) => void;
  onVerifyFirmware?: (asset: ProgramAsset) => void;
  onUploadFirmware?: (asset: ProgramAsset) => void;
  title?: string;
  subtitle?: string;
  showRecipeParameters?: boolean;
};

function recipeFamily(recipe: UnifiedRecipe) {
  if (recipe.user_defined) return 'My Library';
  if (recipe.id === 'blink' || recipe.id === 'i2c_scanner' || recipe.category === 'Verify' || recipe.category === 'Diagnose') return 'Verify & Diagnose';
  if (recipe.id.includes('numerical') || recipe.id === 'analog_a0' || recipe.id === 'synthetic') return 'Numerical & Measurement';
  if (recipe.id.includes('magnetic')) return 'Magnetism & Fields';
  if (recipe.id.includes('acceleration') || recipe.id.includes('photogate') || recipe.id.includes('encoder') || recipe.id.includes('rpm')) return 'Motion & Timing';
  if (recipe.id.includes('robot') || recipe.category === 'Control') return 'Control & Robotics';
  return 'Other';
}

export default function UnifiedLibrary({
  recipes,
  selectedRecipeId,
  parameterValues = {},
  onParameterValuesChange,
  onSelectRecipe,
  onUseRecipe,
  onOpenDeveloperTemplate,
  onVerifyFirmware,
  onUploadFirmware,
  title = 'Library',
  subtitle = 'Recipes, firmware, and host analysis tools share one catalog, one search, and one inspector.',
  showRecipeParameters = true,
}: Props) {
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<LibraryKind>('all');
  const [family, setFamily] = useState('All');
  const [selectedKey, setSelectedKey] = useState(selectedRecipeId ? `recipe:${selectedRecipeId}` : '');
  const [assetSource, setAssetSource] = useState('');

  const families = useMemo(() => {
    const recipeFamilies: string[] = [...new Set(recipes.map(recipeFamily))];
    return ['All', ...recipeFamilies, ...PROGRAM_FAMILY_ORDER.filter(item => !recipeFamilies.includes(item))];
  }, [recipes]);

  const items = useMemo(() => {
    const recipeItems = recipes.map(recipe => ({
      key: `recipe:${recipe.id}`,
      kind: 'recipe' as const,
      family: recipeFamily(recipe),
      label: recipe.title,
      detail: `${recipe.user_defined ? 'USER PRESET' : recipe.category} · ${recipe.sketch_name}`,
      search: [recipe.title, recipe.description, recipe.category, recipe.sketch_name, ...recipe.hardware].join(' ').toLowerCase(),
      recipe,
    }));
    const assetItems = ALL_PROGRAM_ASSETS.map(asset => ({
      key: asset.key,
      kind: 'asset' as const,
      family: asset.family,
      label: asset.label,
      detail: `${asset.kind === 'firmware' ? 'FIRMWARE' : 'HOST ANALYSIS'} · ${asset.path}`,
      search: [asset.label, asset.path, asset.family, asset.kind].join(' ').toLowerCase(),
      asset,
    }));
    const needle = query.trim().toLowerCase();
    return [...recipeItems, ...assetItems].filter(item => {
      const itemKind = item.kind === 'recipe' ? 'recipe' : item.asset.kind;
      return (kind === 'all' || kind === itemKind) &&
        (family === 'All' || item.family === family) &&
        (!needle || item.search.includes(needle));
    });
  }, [recipes, query, kind, family]);

  const selected = useMemo<SelectedItem | null>(() => {
    if (selectedKey.startsWith('recipe:')) {
      const recipe = recipes.find(item => `recipe:${item.id}` === selectedKey);
      return recipe ? { kind: 'recipe', recipe } : null;
    }
    const asset = ALL_PROGRAM_ASSETS.find(item => item.key === selectedKey);
    return asset ? { kind: 'asset', asset } : null;
  }, [selectedKey, recipes]);

  function selectRecipe(recipe: UnifiedRecipe) {
    setSelectedKey(`recipe:${recipe.id}`);
    onSelectRecipe?.(recipe.id);
    setAssetSource('');
  }

  function selectAsset(asset: ProgramAsset) {
    setSelectedKey(asset.key);
    setAssetSource('');
  }

  return <section className="unified-library">
    <div className="panel unified-library-toolbar">
      <div>
        <div className="eyebrow">Single source of truth</div>
        <h2>{title}</h2>
        <p className="muted">{subtitle}</p>
      </div>
      <div className="unified-library-counts">
        <span><b>{recipes.length}</b> recipes</span>
        <span><b>{ALL_PROGRAM_ASSETS.filter(item => item.kind === 'firmware').length}</b> firmware</span>
        <span><b>{ALL_PROGRAM_ASSETS.filter(item => item.kind === 'analysis').length}</b> host tools</span>
      </div>
    </div>

    <div className="panel unified-library-filters">
      <label className="unified-library-search"><Search size={16}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search recipes, firmware, sensors, host tools, paths…"/></label>
      <div className="unified-library-kind">
        {([
          ['all', 'All'],
          ['recipe', 'Recipes'],
          ['firmware', 'Firmware'],
          ['analysis', 'Host tools'],
        ] as const).map(([id, label]) => <button key={id} className={kind === id ? 'active' : ''} onClick={() => setKind(id)}>{label}</button>)}
      </div>
      <label>Family<select value={family} onChange={event => setFamily(event.target.value)}>{families.map(item => <option key={item} value={item}>{item}</option>)}</select></label>
    </div>

    <div className="library-layout unified-library-layout">
      <div className="panel">
        <div className="panel-title"><BookOpen size={18}/> {items.length} matching items</div>
        <div className="recipe-list unified-library-list">
          {items.map(item => item.kind === 'recipe'
            ? <button key={item.key} className={`recipe-row ${selectedKey === item.key ? 'selected' : ''}`} onClick={() => selectRecipe(item.recipe)}>
                <BookOpen size={18}/><div><b>{item.label}</b><span>{item.family} · {item.detail}</span></div><small>RECIPE</small>
              </button>
            : <button key={item.key} className={`recipe-row ${selectedKey === item.key ? 'selected' : ''}`} onClick={() => selectAsset(item.asset)}>
                {item.asset.kind === 'firmware' ? <Cpu size={18}/> : <Code2 size={18}/>}<div><b>{item.label}</b><span>{item.family} · {item.detail}</span></div><small>{item.asset.kind === 'firmware' ? 'FIRMWARE' : 'HOST'}</small>
              </button>)}
        </div>
        {!items.length && <div className="empty compact">No library item matches these filters.</div>}
      </div>

      <div className="panel inspector unified-library-inspector">
        {!selected && <div className="empty">Select any recipe, firmware sketch, or host analysis tool.</div>}
        {selected?.kind === 'recipe' && <>
          <div className="eyebrow">{recipeFamily(selected.recipe)} · Recipe</div>
          <h2>{selected.recipe.title}</h2>
          <p className="muted">{selected.recipe.description}</p>
          <div className="info-section"><b>Hardware</b>{selected.recipe.hardware.length ? selected.recipe.hardware.map(v => <span key={v}>• {v}</span>) : <span>• Not specified</span>}</div>
          <div className="info-section"><b>Required libraries</b>{selected.recipe.required_libraries.length ? selected.recipe.required_libraries.map(v => <span key={v}>• {v}</span>) : <span>• None</span>}</div>
          <div className="info-section"><b>Data schema</b><span>{selected.recipe.columns.length ? selected.recipe.columns.map((c, i) => `${c} [${selected.recipe.units[i] ?? ''}]`).join(' · ') : 'No measurement schema'}</span></div>
          {showRecipeParameters && selectedRecipeId === selected.recipe.id && onParameterValuesChange && <RecipeParameterPanel compact recipe={selected.recipe} values={parameterValues} onChange={onParameterValuesChange}/>}
          <div className="boundary"><ShieldCheck size={15}/>{selected.recipe.boundary}</div>
          <div className="action-row">
            {onUseRecipe && <button className="primary" onClick={() => onUseRecipe(selected.recipe.id)}>Use recipe</button>}
            {onOpenDeveloperTemplate && <button className="ghost" onClick={() => onOpenDeveloperTemplate(`recipe:${selected.recipe.id}`)}><Braces size={15}/> Open in Developer</button>}
          </div>
        </>}
        {selected?.kind === 'asset' && <>
          <div className="eyebrow">{selected.asset.family} · {selected.asset.kind === 'firmware' ? 'Firmware' : 'Host analysis'}</div>
          <h2>{selected.asset.label}</h2>
          <p className="muted"><code>{selected.asset.path}</code></p>
          <div className="action-row">
            <button className="ghost" onClick={() => void loadProgramAsset(selected.asset).then(setAssetSource).catch(error => setAssetSource(`Load failed: ${error}`))}><Code2 size={15}/> View source</button>
            {selected.asset.kind === 'firmware' && onVerifyFirmware && <button className="ghost" onClick={() => onVerifyFirmware(selected.asset)}><Play size={15}/> Verify</button>}
            {selected.asset.kind === 'firmware' && onUploadFirmware && <button className="ghost" onClick={() => onUploadFirmware(selected.asset)}><Upload size={15}/> Upload</button>}
            {selected.asset.kind === 'firmware' && onOpenDeveloperTemplate && <button className="primary" onClick={() => onOpenDeveloperTemplate(selected.asset.key)}><Braces size={15}/> Open in Developer</button>}
          </div>
          {assetSource && <pre className="unified-library-source">{assetSource}</pre>}
        </>}
      </div>
    </div>
  </section>;
}
