export type ResearchOrigin = 'human' | 'betterboard' | 'engineering-lab' | 'openguin';
export type ResearchKind = 'observation' | 'measurement' | 'analysis' | 'annotation' | 'hypothesis' | 'suggestion' | 'warning' | 'decision';

export type ResearchBridgeEvent = {
  id: string;
  created_at_utc: string;
  origin: ResearchOrigin;
  kind: ResearchKind;
  text: string;
  refs?: string[];
};

export type ResearchContextForBridge = {
  question?: string;
  hypothesis?: string;
  notebook?: ResearchBridgeEvent[];
  annotations?: ResearchBridgeEvent[];
  lab_journey?: ResearchBridgeEvent[];
  engineering_results?: ResearchBridgeEvent[];
  ai_suggestions?: ResearchBridgeEvent[];
};

export type MeasurementSessionForBridge = {
  directory: string;
  created_at_utc: string;
  recipe_title: string;
  recipe_id?: string;
  sample_count: number;
  csv_path: string;
  metadata_path: string;
  physical_lab_csv_path: string;
  physical_lab_bridge_path: string;
  board_profile?: string;
  port?: string;
  acquisition_mode?: string;
};

export type ResearchBridgeV1 = {
  schema: 'betterboard.research-bridge/1.0';
  session_id: string;
  created_at_utc: string;
  producer: 'BetterBoard Studio';
  experiment: {
    title: string;
    question: string | null;
    hypothesis: string | null;
  };
  hardware: {
    board_profile: string | null;
    port: string | null;
  };
  evidence: {
    sample_count: number;
    data_csv: string;
    metadata_json: string;
    engineering_lab_compatibility_csv: string;
    legacy_bridge_json: string;
  };
  research_context: {
    notebook: ResearchBridgeEvent[];
    annotations: ResearchBridgeEvent[];
    lab_journey: ResearchBridgeEvent[];
  };
  engineering_lab: {
    imports: ResearchBridgeEvent[];
    results: ResearchBridgeEvent[];
    policy: string;
  };
  ai: {
    provider: 'OpenPenguin';
    suggestions: ResearchBridgeEvent[];
    policy: string;
  };
  provenance: ResearchBridgeEvent[];
};

export function researchSessionId(session: MeasurementSessionForBridge) {
  const tail = session.directory.split(/[\\/]/).filter(Boolean).pop();
  return tail || `session-${Date.parse(session.created_at_utc) || Date.now()}`;
}

export function buildResearchBridge(session: MeasurementSessionForBridge, context: ResearchContextForBridge = {}): ResearchBridgeV1 {
  const created = new Date().toISOString();
  const id = researchSessionId(session);
  const notebook = context.notebook ?? [];
  const annotations = context.annotations ?? [];
  const journey = context.lab_journey ?? [];
  const engineeringResults = context.engineering_results ?? [];
  const aiSuggestions = context.ai_suggestions ?? [];
  const contextualEvents = [...notebook, ...annotations, ...journey, ...engineeringResults, ...aiSuggestions];
  return {
    schema: 'betterboard.research-bridge/1.0',
    session_id: id,
    created_at_utc: created,
    producer: 'BetterBoard Studio',
    experiment: {
      title: session.recipe_title,
      question: context.question?.trim() || null,
      hypothesis: context.hypothesis?.trim() || null,
    },
    hardware: {
      board_profile: session.board_profile || null,
      port: session.port || null,
    },
    evidence: {
      sample_count: session.sample_count,
      data_csv: session.csv_path,
      metadata_json: session.metadata_path,
      engineering_lab_compatibility_csv: session.physical_lab_csv_path,
      legacy_bridge_json: session.physical_lab_bridge_path,
    },
    research_context: {
      notebook,
      annotations,
      lab_journey: journey,
    },
    engineering_lab: {
      imports: [],
      results: engineeringResults,
      policy: 'Engineering Lab may append derived analysis but must not replace BetterBoard raw measurement evidence.',
    },
    ai: {
      provider: 'OpenPenguin',
      suggestions: aiSuggestions,
      policy: 'OpenPenguin output is advisory and must remain distinguishable from measurements, calibration, and validated engineering results.',
    },
    provenance: [{
      id: `${id}:measurement-package`,
      created_at_utc: session.created_at_utc,
      origin: 'betterboard',
      kind: 'measurement',
      text: `${session.recipe_title} measurement package · ${session.sample_count} samples`,
      refs: [session.csv_path, session.metadata_path],
    }, ...contextualEvents],
  };
}

export function bridgeForOpenPenguin(bridge: ResearchBridgeV1) {
  return JSON.stringify({
    schema: bridge.schema,
    session_id: bridge.session_id,
    experiment: bridge.experiment,
    hardware: bridge.hardware,
    evidence: bridge.evidence,
    research_context: bridge.research_context,
    engineering_lab: bridge.engineering_lab,
    provenance: bridge.provenance,
    instruction: 'Keep raw measurement, human notes, Engineering Lab derived results, and AI suggestions distinct. Do not claim calibration or validation that is not present in the evidence.',
  }, null, 2);
}
