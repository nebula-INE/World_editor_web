/** Shared .axral.json v1 project codec. Kept separate from React handlers for direct testing. */
import type { Event } from './events';
import { LAYER_HIERARCHY } from './models';

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
      ? rawTimeline.timestamp : 0,
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
    events: value.events as Event[],
    graph_positions: positions,
    timeline,
    ignored_candidates: rawIgnored.filter(isIgnoredSignature).map((signature) => [...signature] as [number, string, string, string]),
  };
}
