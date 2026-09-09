export type DeveloperDraft = {
  version: 1;
  source: string;
  sketchName: string;
  projectDir: string;
  projectFileName: string;
  savedDir: string;
  templateId: string;
  recipeId: string;
  updatedAt: number;
};

const DRAFT_KEY = 'betterboard.developer.draft.v1';
const MAX_SOURCE_CHARS = 2_000_000;

export function loadDeveloperDraft(): DeveloperDraft | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DeveloperDraft>;
    if (parsed.version !== 1 || typeof parsed.source !== 'string' || parsed.source.length > MAX_SOURCE_CHARS) return null;
    return {
      version: 1,
      source: parsed.source,
      sketchName: typeof parsed.sketchName === 'string' ? parsed.sketchName : 'BetterBoardSketch',
      projectDir: typeof parsed.projectDir === 'string' ? parsed.projectDir : '',
      projectFileName: typeof parsed.projectFileName === 'string' ? parsed.projectFileName : '',
      savedDir: typeof parsed.savedDir === 'string' ? parsed.savedDir : '',
      templateId: typeof parsed.templateId === 'string' ? parsed.templateId : '',
      recipeId: typeof parsed.recipeId === 'string' ? parsed.recipeId : '',
      updatedAt: Number.isFinite(parsed.updatedAt) ? Number(parsed.updatedAt) : Date.now(),
    };
  } catch {
    return null;
  }
}

export function saveDeveloperDraft(draft: Omit<DeveloperDraft, 'version' | 'updatedAt'>) {
  if (typeof window === 'undefined' || draft.source.length > MAX_SOURCE_CHARS) return;
  const payload: DeveloperDraft = { ...draft, version: 1, updatedAt: Date.now() };
  try {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
  } catch {
    // Draft recovery is best-effort and must never break editing.
  }
}

export function clearDeveloperDraft() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(DRAFT_KEY);
  } catch {
    // Ignore storage failures; explicit saves still remain authoritative.
  }
}
