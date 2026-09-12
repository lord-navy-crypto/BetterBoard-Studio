import type { ResearchBridgeEvent, ResearchKind, ResearchOrigin } from './ResearchBridge';

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

function boundedEvents(value: unknown): ResearchBridgeEvent[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is ResearchBridgeEvent => Boolean(
    item && typeof item === 'object' &&
    typeof (item as ResearchBridgeEvent).id === 'string' &&
    typeof (item as ResearchBridgeEvent).created_at_utc === 'string' &&
    typeof (item as ResearchBridgeEvent).origin === 'string' &&
    typeof (item as ResearchBridgeEvent).kind === 'string' &&
    typeof (item as ResearchBridgeEvent).text === 'string',
  )).slice(-500);
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
      notebook: boundedEvents(parsed.notebook),
      annotations: boundedEvents(parsed.annotations),
      lab_journey: boundedEvents(parsed.lab_journey),
      engineering_results: boundedEvents(parsed.engineering_results),
      ai_suggestions: boundedEvents(parsed.ai_suggestions),
    };
  } catch {
    return emptyResearchContext();
  }
}

export function saveResearchContext(sessionId: string, state: ResearchContextState) {
  if (!sessionId || typeof window === 'undefined') return;
  window.localStorage.setItem(PREFIX + sessionId, JSON.stringify({
    ...state,
    question: state.question.slice(0, 4000),
    hypothesis: state.hypothesis.slice(0, 4000),
    notebook: state.notebook.slice(-500),
    annotations: state.annotations.slice(-500),
    lab_journey: state.lab_journey.slice(-500),
    engineering_results: state.engineering_results.slice(-500),
    ai_suggestions: state.ai_suggestions.slice(-500),
  }));
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
    refs: refs?.filter(Boolean).slice(0, 20),
  };
}
