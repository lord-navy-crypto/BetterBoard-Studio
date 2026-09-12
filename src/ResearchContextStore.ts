import type { ResearchBridgeEvent, ResearchKind, ResearchOrigin } from './ResearchBridge';
import { validateResearchEvent } from './ResearchBridgeInterop';

export type ResearchContextState = {
  question: string;
  hypothesis: string;
  notebook: ResearchBridgeEvent[];
  annotations: ResearchBridgeEvent[];
  lab_journey: ResearchBridgeEvent[];
  engineering_results: ResearchBridgeEvent[];
  ai_suggestions: ResearchBridgeEvent[];
};

const PREFIX = 'betterboard.research-context.v1:';
const MAX_EVENTS_PER_LANE = 500;

export function emptyResearchContext(): ResearchContextState {
  return {
    question: '',
    hypothesis: '',
    notebook: [],
    annotations: [],
    lab_journey: [],
    engineering_results: [],
    ai_suggestions: [],
  };
}

function boundedEvents(value: unknown, allowedOrigins?: ResearchOrigin[], allowedKinds?: ResearchKind[]): ResearchBridgeEvent[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const result: ResearchBridgeEvent[] = [];
  for (const raw of value) {
    const event = validateResearchEvent(raw);
    if (!event || seen.has(event.id)) continue;
    if (allowedOrigins && !allowedOrigins.includes(event.origin)) continue;
    if (allowedKinds && !allowedKinds.includes(event.kind)) continue;
    seen.add(event.id);
    result.push(event);
  }
  return result.slice(-MAX_EVENTS_PER_LANE);
}

export function loadResearchContext(sessionId: string): ResearchContextState {
  if (!sessionId || typeof window === 'undefined') return emptyResearchContext();
  try {
    const raw = window.localStorage.getItem(PREFIX + sessionId);
    if (!raw) return emptyResearchContext();
    const parsed = JSON.parse(raw) as Partial<ResearchContextState>;
    return {
      question: typeof parsed.question === 'string' ? parsed.question.slice(0, 4000) : '',
      hypothesis: typeof parsed.hypothesis === 'string' ? parsed.hypothesis.slice(0, 4000) : '',
      notebook: boundedEvents(parsed.notebook, ['human'], ['observation', 'hypothesis', 'decision']),
      annotations: boundedEvents(parsed.annotations, ['human'], ['annotation', 'warning', 'observation']),
      lab_journey: boundedEvents(parsed.lab_journey, ['human', 'betterboard', 'engineering-lab', 'openguin']),
      engineering_results: boundedEvents(parsed.engineering_results, ['engineering-lab'], ['analysis', 'warning', 'decision']),
      ai_suggestions: boundedEvents(parsed.ai_suggestions, ['openguin'], ['suggestion', 'warning']),
    };
  } catch {
    return emptyResearchContext();
  }
}

export function saveResearchContext(sessionId: string, state: ResearchContextState) {
  if (!sessionId || typeof window === 'undefined') return;
  const normalized: ResearchContextState = {
    question: state.question.slice(0, 4000),
    hypothesis: state.hypothesis.slice(0, 4000),
    notebook: boundedEvents(state.notebook, ['human'], ['observation', 'hypothesis', 'decision']),
    annotations: boundedEvents(state.annotations, ['human'], ['annotation', 'warning', 'observation']),
    lab_journey: boundedEvents(state.lab_journey, ['human', 'betterboard', 'engineering-lab', 'openguin']),
    engineering_results: boundedEvents(state.engineering_results, ['engineering-lab'], ['analysis', 'warning', 'decision']),
    ai_suggestions: boundedEvents(state.ai_suggestions, ['openguin'], ['suggestion', 'warning']),
  };
  try {
    window.localStorage.setItem(PREFIX + sessionId, JSON.stringify(normalized));
  } catch {
    // A full or unavailable local store must not corrupt the in-memory experiment context.
  }
}

export function mergeResearchEvents(existing: ResearchBridgeEvent[], incoming: ResearchBridgeEvent[]) {
  const byId = new Map(existing.map(event => [event.id, event]));
  for (const event of incoming) if (!byId.has(event.id)) byId.set(event.id, event);
  return [...byId.values()].sort((a, b) => a.created_at_utc.localeCompare(b.created_at_utc)).slice(-MAX_EVENTS_PER_LANE);
}

export function makeResearchEvent(origin: ResearchOrigin, kind: ResearchKind, text: string, refs?: string[]): ResearchBridgeEvent {
  const created = new Date().toISOString();
  const entropy = Math.random().toString(36).slice(2, 9);
  return {
    id: `${origin}:${kind}:${Date.now()}:${entropy}`,
    created_at_utc: created,
    origin,
    kind,
    text: text.trim().slice(0, 12_000),
    refs: refs?.filter(Boolean).map(ref => ref.slice(0, 2_000)).slice(0, 20),
  };
}
