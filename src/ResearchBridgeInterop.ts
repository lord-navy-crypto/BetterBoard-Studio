import type { ResearchBridgeEvent, ResearchBridgeV1 } from './ResearchBridge';

export const RESEARCH_BRIDGE_SCHEMA = 'betterboard.research-bridge/1.0' as const;
export const ENGINEERING_RESULT_SCHEMA = 'engineering-lab.result/1.0' as const;
export const OPENPENGUIN_CONTEXT_SCHEMA = 'betterboard.openguin-context/1.0' as const;

export const BRIDGE_CAPABILITIES = {
  producer: 'BetterBoard Studio',
  bridge_schema: RESEARCH_BRIDGE_SCHEMA,
  accepts_engineering_result_schema: ENGINEERING_RESULT_SCHEMA,
  openguin_context_schema: OPENPENGUIN_CONTEXT_SCHEMA,
  features: [
    'measurement-evidence',
    'notebook',
    'annotations',
    'lab-journey',
    'engineering-result-import',
    'openguin-advisory-context',
    'append-only-provenance',
  ],
} as const;

export type EngineeringLabArtifactRef = {
  id: string;
  kind: string;
  path?: string;
  uri?: string;
  sha256?: string;
};

export type EngineeringLabResultEnvelopeV1 = {
  schema: typeof ENGINEERING_RESULT_SCHEMA;
  source_bridge_schema: typeof RESEARCH_BRIDGE_SCHEMA;
  session_id: string;
  created_at_utc: string;
  producer: string;
  results: ResearchBridgeEvent[];
  artifacts?: EngineeringLabArtifactRef[];
  warnings?: string[];
};

const origins = new Set(['human', 'betterboard', 'engineering-lab', 'openguin']);
const kinds = new Set(['observation', 'measurement', 'analysis', 'annotation', 'hypothesis', 'suggestion', 'warning', 'decision']);
const engineeringKinds = new Set(['analysis', 'warning', 'decision']);

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function validIsoDate(value: unknown) {
  return typeof value === 'string' && value.length <= 80 && Number.isFinite(Date.parse(value));
}

export function validateResearchEvent(value: unknown): ResearchBridgeEvent | null {
  const item = record(value);
  if (!item) return null;
  if (typeof item.id !== 'string' || !item.id.trim() || item.id.length > 300) return null;
  if (!validIsoDate(item.created_at_utc)) return null;
  if (typeof item.origin !== 'string' || !origins.has(item.origin)) return null;
  if (typeof item.kind !== 'string' || !kinds.has(item.kind)) return null;
  if (typeof item.text !== 'string' || !item.text.trim() || item.text.length > 12_000) return null;
  const refs = Array.isArray(item.refs)
    ? item.refs.filter((ref): ref is string => typeof ref === 'string' && ref.length > 0 && ref.length <= 2_000).slice(0, 20)
    : undefined;
  return {
    id: item.id.trim(),
    created_at_utc: item.created_at_utc as string,
    origin: item.origin as ResearchBridgeEvent['origin'],
    kind: item.kind as ResearchBridgeEvent['kind'],
    text: item.text.trim(),
    refs,
  };
}

export function parseEngineeringLabResultEnvelope(raw: string, expectedSessionId: string): EngineeringLabResultEnvelopeV1 {
  if (!raw.trim()) throw new Error('Engineering Lab result envelope is empty.');
  if (raw.length > 1_000_000) throw new Error('Engineering Lab result envelope exceeds the 1 MB import limit.');
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { throw new Error('Engineering Lab result envelope is not valid JSON.'); }
  const value = record(parsed);
  if (!value) throw new Error('Engineering Lab result envelope must be a JSON object.');
  if (value.schema !== ENGINEERING_RESULT_SCHEMA) throw new Error(`Unsupported Engineering Lab result schema: ${String(value.schema ?? 'missing')}`);
  if (value.source_bridge_schema !== RESEARCH_BRIDGE_SCHEMA) throw new Error('Engineering Lab result was not produced for the supported BetterBoard bridge schema.');
  if (typeof value.session_id !== 'string' || value.session_id !== expectedSessionId) throw new Error('Engineering Lab result belongs to a different research session.');
  if (!validIsoDate(value.created_at_utc)) throw new Error('Engineering Lab result has an invalid created_at_utc timestamp.');
  if (typeof value.producer !== 'string' || !value.producer.trim() || value.producer.length > 200) throw new Error('Engineering Lab result producer is invalid.');
  if (!Array.isArray(value.results) || value.results.length === 0 || value.results.length > 500) throw new Error('Engineering Lab result must contain 1..500 result events.');

  const results = value.results.map((entry, index) => {
    const event = validateResearchEvent(entry);
    if (!event) throw new Error(`Engineering Lab result event ${index + 1} is invalid.`);
    if (event.origin !== 'engineering-lab') throw new Error(`Engineering Lab result event ${index + 1} must use origin=engineering-lab.`);
    if (!engineeringKinds.has(event.kind)) throw new Error(`Engineering Lab result event ${index + 1} cannot masquerade as raw measurement or human/AI context.`);
    return event;
  });

  const artifacts: EngineeringLabArtifactRef[] | undefined = Array.isArray(value.artifacts) ? value.artifacts.slice(0, 100).map((entry, index) => {
    const artifact = record(entry);
    if (!artifact || typeof artifact.id !== 'string' || !artifact.id.trim() || typeof artifact.kind !== 'string' || !artifact.kind.trim()) throw new Error(`Engineering Lab artifact ${index + 1} is invalid.`);
    const result: EngineeringLabArtifactRef = { id: artifact.id.trim().slice(0, 300), kind: artifact.kind.trim().slice(0, 120) };
    if (typeof artifact.path === 'string') result.path = artifact.path.slice(0, 2_000);
    if (typeof artifact.uri === 'string') result.uri = artifact.uri.slice(0, 2_000);
    if (typeof artifact.sha256 === 'string') result.sha256 = artifact.sha256.slice(0, 128);
    return result;
  }) : undefined;

  const warnings = Array.isArray(value.warnings)
    ? value.warnings.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).map(item => item.trim().slice(0, 2_000)).slice(0, 100)
    : undefined;

  return {
    schema: ENGINEERING_RESULT_SCHEMA,
    source_bridge_schema: RESEARCH_BRIDGE_SCHEMA,
    session_id: expectedSessionId,
    created_at_utc: value.created_at_utc as string,
    producer: (value.producer as string).trim(),
    results,
    artifacts,
    warnings,
  };
}

export function bridgeCapabilityManifest(bridge?: ResearchBridgeV1) {
  return {
    ...BRIDGE_CAPABILITIES,
    session_id: bridge?.session_id ?? null,
    generated_at_utc: new Date().toISOString(),
    policies: {
      raw_measurement_immutable: true,
      engineering_results_append_only: true,
      ai_output_advisory_only: true,
      session_match_required_for_result_import: true,
    },
  };
}
