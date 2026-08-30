/**
 * Axral Codex - Event Schema (Phase 0b, §8)
 * Ported faithfully from Python desktop version.
 */

import { SCHEMA_VERSION, newId } from './models';

export const AUTO_SNAPSHOT_TYPES: Set<string> = new Set(["Tear", "Chapter", "MajorEvent"]);

export interface Effect {
  kind: "relation_add" | "relation_status" | "relation_end" | "entity_attribute" | "entity_existence" | string;
  target_id?: string | null;
  payload: Record<string, any>;
}

export interface Event {
  id: string;
  timestamp: number;
  type: string;
  participants: string[];
  effects: Effect[];
  is_snapshot_point: boolean;
  schema_version: number;
  metadata: Record<string, any>;
}

export function triggersSnapshot(event: Event): boolean {
  return event.is_snapshot_point || AUTO_SNAPSHOT_TYPES.has(event.type);
}

export function newEvent(
  timestamp: number,
  type: string,
  participants: string[] = [],
  effects: Effect[] = [],
  isSnapshotPoint: boolean = false,
  metadata: Record<string, any> = {}
): Event {
  return {
    id: newId("evt"),
    timestamp,
    type,
    participants: [...participants],
    effects: effects.map(e => ({ ...e, payload: { ...e.payload } })),
    is_snapshot_point: isSnapshotPoint,
    schema_version: SCHEMA_VERSION,
    metadata: { ...metadata },
  };
}
