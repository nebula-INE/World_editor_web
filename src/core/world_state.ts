/**
 * Axral Codex - World State Engine (Phase 0b, §9)
 * Ported faithfully from Python desktop version.
 */

import { Event, triggersSnapshot } from './events';
import { Entity, Relation, WorldModel } from './models';

export const SNAPSHOT_INTERVAL = 20;

export class WorldState {
  timestamp: number;
  entities: Record<string, Entity>;
  relations: Record<string, Relation>;

  constructor(
    timestamp: number = 0,
    entities: Record<string, Entity> = {},
    relations: Record<string, Relation> = {}
  ) {
    this.timestamp = timestamp;
    this.entities = entities;
    this.relations = relations;
  }

  clone(): WorldState {
    const model = new WorldModel();
    model.entities = this.entities;
    model.relations = this.relations;
    const cloned = model.clone();
    return new WorldState(this.timestamp, cloned.entities, cloned.relations);
  }
}

export class WorldStateEngine {
  private _initial: WorldModel;
  private _events: Map<string, Event> = new Map();
  private _snapshots: Map<number, WorldState> = new Map();
  private _sortedCache: Event[] | null = null;

  constructor(initialModel: WorldModel) {
    this._initial = initialModel.clone();
  }

  setInitialModel(model: WorldModel): void {
    this._initial = model.clone();
    this._snapshots.clear();
  }

  addEvent(event: Event): void {
    this._events.set(event.id, event);
    this._invalidateFrom(event.timestamp);
    this._sortedCache = null;
  }

  removeEvent(eventId: string): void {
    const event = this._events.get(eventId);
    this._events.delete(eventId);
    this._sortedCache = null;
    if (event) {
      this._invalidateFrom(event.timestamp);
    }
  }

  updateEvent(event: Event): void {
    const old = this._events.get(event.id);
    this._events.set(event.id, event);
    this._sortedCache = null;
    const invalidateTs = old ? Math.min(old.timestamp, event.timestamp) : event.timestamp;
    this._invalidateFrom(invalidateTs);
  }

  eventsSorted(): Event[] {
    if (this._sortedCache === null) {
      this._sortedCache = Array.from(this._events.values()).sort(
        (a, b) => (a.timestamp - b.timestamp) || a.id.localeCompare(b.id)
      );
    }
    return this._sortedCache;
  }

  private _invalidateFrom(timestamp: number): void {
    for (const ts of Array.from(this._snapshots.keys())) {
      if (ts >= timestamp) {
        this._snapshots.delete(ts);
      }
    }
  }

  stateAt(timestamp: number): WorldState {
    const [baseTs, baseState] = this._nearestSnapshotAtOrBefore(timestamp);
    const events = this.eventsSorted().filter(e => baseTs < e.timestamp && e.timestamp <= timestamp);

    const state = baseState.clone();
    for (const event of events) {
      this._applyEvent(state, event);
      state.timestamp = event.timestamp;
      if (triggersSnapshot(event)) {
        this._snapshots.set(event.timestamp, state.clone());
      }
    }

    if (events.length >= SNAPSHOT_INTERVAL) {
      this._snapshots.set(timestamp, state.clone());
    }

    state.timestamp = timestamp;
    return state;
  }

  private _nearestSnapshotAtOrBefore(timestamp: number): [number, WorldState] {
    const candidates = Array.from(this._snapshots.keys()).filter(ts => ts <= timestamp);
    if (candidates.length === 0) {
      const initialCloned = this._initial.clone();
      const initialState = new WorldState(
        Number.NEGATIVE_INFINITY,
        initialCloned.entities,
        initialCloned.relations
      );
      return [Number.NEGATIVE_INFINITY, initialState];
    }
    const nearest = Math.max(...candidates);
    return [nearest, this._snapshots.get(nearest)!];
  }

  private _applyEvent(state: WorldState, event: Event): void {
    for (const effect of event.effects) {
      WorldStateEngine._applyEffect(state, effect);
    }
  }

  private static _applyEffect(state: WorldState, effect: any): void {
    if (effect.kind === "relation_add") {
      const payload = effect.payload || {};
      const relId = effect.target_id || `rel_${Object.keys(state.relations).length}_${payload.type || ''}`;
      state.relations[relId] = {
        id: relId,
        source: payload.source,
        target: payload.target,
        type: payload.type || "関連",
        status: payload.status || "confirmed",
        valid_from: payload.valid_from || null,
        valid_to: payload.valid_to || null,
        perspective: payload.perspective || "objective",
        ref_key: payload.ref_key || null,
        source_refs: [],
        schema_version: 1,
        metadata: {},
      };
    } else if (effect.kind === "relation_status") {
      const relation = state.relations[effect.target_id];
      if (relation) {
        relation.status = effect.payload.status ?? relation.status;
      }
    } else if (effect.kind === "relation_end") {
      const relation = state.relations[effect.target_id];
      if (relation) {
        relation.valid_to = effect.payload.valid_to ?? null;
      }
    } else if (effect.kind === "entity_attribute") {
      const entity = state.entities[effect.target_id];
      if (entity) {
        const key = effect.payload.key;
        if (key) {
          entity.attributes[key] = effect.payload.value;
        }
      }
    } else if (effect.kind === "entity_existence") {
      const entity = state.entities[effect.target_id];
      if (entity) {
        entity.existence = effect.payload.existence ?? entity.existence;
      }
    }
  }
}
