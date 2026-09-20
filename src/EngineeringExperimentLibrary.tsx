import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { CapabilityTarget } from './CapabilityLauncher';
import { useHardwareSession } from './HardwareSession';
import { loadProgramAsset, type ProgramAsset } from './ProgramLibraryCatalog';
import UnifiedLibrary, { type UnifiedRecipe } from './UnifiedLibrary';

type Props = {
  onNavigate?: (target: CapabilityTarget) => void;
};

export default function EngineeringExperimentLibrary({ onNavigate }: Props) {
  const { fqbn, selectedPort, diagnosis } = useHardwareSession();
  const [recipes, setRecipes] = useState<UnifiedRecipe[]>([]);
  const [status, setStatus] = useState('Library ready.');
  const [selectedRecipeId, setSelectedRecipeId] = useState('');

  useEffect(() => {
    void invoke<UnifiedRecipe[]>('recipe_catalog')
      .then(rows => {
        setRecipes(rows);
        if (!selectedRecipeId && rows[0]) setSelectedRecipeId(rows[0].id);
      })
      .catch(error => setStatus(`Recipe catalog unavailable: ${error}`));
  }, []);

  async function verifyFirmware(asset: ProgramAsset) {
    if (asset.kind !== 'firmware' || !asset.sketchName) return;
    if (!diagnosis.canCompile) {
      setStatus(`Verify blocked by Hardware Doctor · ${diagnosis.title}`);
      return;
    }
    try {
      setStatus(`Loading and compiling ${asset.label}…`);
      const source = await loadProgramAsset(asset);
      const sketchDir = await invoke<string>('developer_sketch_save', { sketchName: asset.sketchName, source });
      const result = await invoke<string>('compile_sketch', { sketchDir, fqbn });
      setStatus(result.trim() || `Verify succeeded · ${asset.label}`);
    } catch (error) {
      setStatus(`Verify failed: ${error}`);
    }
  }

  async function uploadFirmware(asset: ProgramAsset) {
    if (asset.kind !== 'firmware' || !asset.sketchName) return;
    if (!selectedPort || !diagnosis.canUpload) {
      setStatus(`Upload blocked · ${selectedPort ? diagnosis.title : 'select a connected board first'}`);
      return;
    }
    try {
      setStatus(`Compile → upload ${asset.label} to ${selectedPort}…`);
      const source = await loadProgramAsset(asset);
      const sketchDir = await invoke<string>('developer_sketch_save', { sketchName: asset.sketchName, source });
      await invoke<string>('compile_sketch', { sketchDir, fqbn });
      const result = await invoke<string>('upload_sketch', { sketchDir, fqbn, port: selectedPort });
      setStatus(result.trim() || `Upload succeeded · ${asset.label}`);
    } catch (error) {
      setStatus(`Upload failed: ${error}`);
    }
  }

  function openDeveloper(templateId: string) {
    try {
      sessionStorage.setItem('betterboard.developer.template-request', templateId);
    } catch {
      // Navigation still works; Developer will open without the handoff if storage is unavailable.
    }
    onNavigate?.('studio:developer');
  }

  return <section>
    <div className="boundary compact" style={{ maxWidth: 1420, margin: '0 auto 10px' }}>{status}</div>
    <UnifiedLibrary
      recipes={recipes}
      selectedRecipeId={selectedRecipeId}
      onSelectRecipe={setSelectedRecipeId}
      onUseRecipe={id => {
        try { sessionStorage.setItem('betterboard.library.recipe-request', id); } catch {}
        onNavigate?.('studio:hardware');
      }}
      onOpenDeveloperTemplate={openDeveloper}
      onVerifyFirmware={asset => void verifyFirmware(asset)}
      onUploadFirmware={asset => void uploadFirmware(asset)}
      title="Experiment Library"
      subtitle="This is the same unified Library used by Studio: recipes, repository firmware, sensor-suite sketches, and host analysis tools share one catalog."
      showRecipeParameters={false}
    />
  </section>;
}
