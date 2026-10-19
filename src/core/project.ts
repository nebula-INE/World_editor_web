/** Shared .axral.json v1 project codec. Kept separate from React handlers for direct testing. */
import type { Effect, Event } from './events';
import { LAYER_HIERARCHY, SCHEMA_VERSION } from './models';

export const PROJECT_FORMAT = 'axral-world-project';
export const PROJECT_SCHEMA_VERSION = 1;

export interface GraphPosition {
  x: number;
  y: number;
}

export interface AxralProjectV1 {
  format: typeof PROJECT_FORMAT;
  schema_version: typeof PROJECT_SCHEMA_VERSION;
  text: string;
  events: Event[];
  graph_positions: Record<string, GraphPosition>;
  timeline: {
    mode: boolean;
    timestamp: number;
    visible_layers: string[];
  };
  ignored_candidates: [number, string, string, string][];
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isIgnoredSignature(value: unknown): value is [number, string, string, string] {
  return Array.isArray(value) && value.length === 4 &&
    Number.isInteger(value[0]) &&
    value.slice(1).every((part) => typeof part === 'string');
}

/** Normalize Event/Effect optional fields the same way as Desktop Event.from_dict. */
function normalizeEvent(value: unknown, index: number): Event {
  if (!isRecord(value) ||
      typeof value.id !== 'string' ||
      typeof value.timestamp !== 'number' || !Number.isFinite(value.timestamp) ||
      typeof value.type !== 'string') {
    throw new Error(`events[${index}]のid・timestamp・typeが不正です。`);
  }

  const participants = value.participants === undefined ? [] : value.participants;
  const effects = value.effects === undefined ? [] : value.effects;
  if (!Array.isArray(participants) || !participants.every((part) => typeof part === 'string')) {
    throw new Error(`events[${index}].participantsは文字列配列である必要があります。`);
  }
  if (!Array.isArray(effects)) {
    throw new Error(`events[${index}].effectsは配列である必要があります。`);
  }

  const normalizedEffects: Effect[] = effects.map((effect, effectIndex) => {
    if (!isRecord(effect) || typeof effect.kind !== 'string') {
      throw new Error(`events[${index}].effects[${effectIndex}].kindが不正です。`);
    }
    const targetId = effect.target_id === undefined ? null : effect.target_id;
    const payload = effect.payload === undefined ? {} : effect.payload;
    if (targetId !== null && typeof targetId !== 'string') {
      throw new Error(`events[${index}].effects[${effectIndex}].target_idが不正です。`);
    }
    if (!isRecord(payload)) {
      throw new Error(`events[${index}].effects[${effectIndex}].payloadはオブジェクトである必要があります。`);
    }
    return { kind: effect.kind, target_id: targetId, payload };
  });

  const isSnapshotPoint = value.is_snapshot_point === undefined ? false : value.is_snapshot_point;
  const schemaVersion = value.schema_version === undefined ? SCHEMA_VERSION : value.schema_version;
  const metadata = value.metadata === undefined ? {} : value.metadata;
  if (typeof isSnapshotPoint !== 'boolean' ||
      typeof schemaVersion !== 'number' || !Number.isInteger(schemaVersion) ||
      !isRecord(metadata)) {
    throw new Error(`events[${index}]の任意フィールドが不正です。`);
  }

  return {
    id: value.id,
    timestamp: value.timestamp,
    type: value.type,
    participants: [...participants],
    effects: normalizedEffects,
    is_snapshot_point: isSnapshotPoint,
    schema_version: schemaVersion,
    metadata,
  };
}

export function createProject(input: Omit<AxralProjectV1, 'format' | 'schema_version'>): AxralProjectV1 {
  return {
    format: PROJECT_FORMAT,
    schema_version: PROJECT_SCHEMA_VERSION,
    text: input.text,
    events: input.events,
    graph_positions: input.graph_positions,
    timeline: input.timeline,
    ignored_candidates: input.ignored_candidates.map((signature) => [...signature] as [number, string, string, string]),
  };
}

export function parseProject(value: unknown): AxralProjectV1 {
  if (!isRecord(value) || value.format !== PROJECT_FORMAT || value.schema_version !== PROJECT_SCHEMA_VERSION) {
    throw new Error('Axral World Project形式またはschema_versionが不正です。');
  }
  if (typeof value.text !== 'string' || !Array.isArray(value.events)) {
    throw new Error('textまたはeventsフィールドが不正です。');
  }
  const events = value.events.map((event, index) => normalizeEvent(event, index));

  const rawPositions = value.graph_positions === undefined ? {} : value.graph_positions;
  if (!isRecord(rawPositions)) throw new Error('graph_positionsはオブジェクトである必要があります。');
  const positions: Record<string, GraphPosition> = {};
  for (const [entityId, rawPoint] of Object.entries(rawPositions)) {
    if (!isRecord(rawPoint) ||
        typeof rawPoint.x !== 'number' || !Number.isFinite(rawPoint.x) ||
        typeof rawPoint.y !== 'number' || !Number.isFinite(rawPoint.y)) {
      throw new Error(`graph_positions.${entityId}の座標が不正です。`);
    }
    positions[entityId] = { x: rawPoint.x, y: rawPoint.y };
  }

  const rawTimeline = value.timeline === undefined ? {} : value.timeline;
  if (!isRecord(rawTimeline)) throw new Error('timelineはオブジェクトである必要があります。');
  const timeline = {
    mode: typeof rawTimeline.mode === 'boolean' ? rawTimeline.mode : false,
    timestamp: typeof rawTimeline.timestamp === 'number' && Number.isFinite(rawTimeline.timestamp)
      ? Math.trunc(rawTimeline.timestamp) : 0,
    visible_layers: Array.isArray(rawTimeline.visible_layers)
      ? rawTimeline.visible_layers.filter((layer: unknown): layer is string => typeof layer === 'string')
      : [...LAYER_HIERARCHY],
  };

  const rawIgnored = value.ignored_candidates === undefined ? [] : value.ignored_candidates;
  if (!Array.isArray(rawIgnored)) throw new Error('ignored_candidatesは配列である必要があります。');
  return {
    format: PROJECT_FORMAT,
    schema_version: PROJECT_SCHEMA_VERSION,
    text: value.text,
    events,
    graph_positions: positions,
    timeline,
    ignored_candidates: rawIgnored.filter(isIgnoredSignature).map((signature) => [...signature] as [number, string, string, string]),
  };
}
