/**
 * Axral Codex - Canonical Data Model (Phase 0a/0b: Entity / Relation / Reference System)
 * Ported faithfully from Python desktop version.
 */

export const SCHEMA_VERSION = 1;

export const LAYER_HIERARCHY: string[] = ["Su-ken", "Kan-ken", "An-ken", "Ki-ken"];

export function isValidLayer(layer: string | null | undefined): boolean {
  return layer === null || layer === undefined || LAYER_HIERARCHY.includes(layer);
}

export function newId(prefix: string): string {
  const hex = Math.random().toString(16).substring(2, 14);
  return `${prefix}_${hex}`;
}

/**
 * Deterministic Stable Entity ID derived from entity name (SHA-1 prefix equivalent).
 */
export function stableEntityId(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    const char = name.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  const hex = Math.abs(hash).toString(16).padStart(8, '0') + Math.abs((hash * 31) | 0).toString(16).padStart(4, '0');
  return `ent_${hex.substring(0, 12)}`;
}

export interface SourceRef {
  line: number;
  text: string;
}

export interface Entity {
  id: string;
  type: string;
  name: string;
  aliases: string[];
  layer?: string | null;
  attributes: Record<string, any>;
  existence: string; // 'confirmed' | 'hypothetical' | 'rumor' | 'dead' | etc.
  source_refs: SourceRef[];
  schema_version: number;
  metadata: Record<string, any>;
}

export interface Relation {
  id: string;
  source: string; // Entity.id
  target: string; // Entity.id
  type: string;
  status: string; // 'confirmed' | 'hypothetical' | 'rumor'
  valid_from?: string | null;
  valid_to?: string | null;
  perspective: string; // 'objective'
  ref_key?: string | null; // "SourceName->TargetName#n"
  source_refs: SourceRef[];
  schema_version: number;
  metadata: Record<string, any>;
}

export class WorldModel {
  entities: Record<string, Entity> = {};
  relations: Record<string, Relation> = {};
  _name_index: Map<string, string> = new Map();
  _alias_index: Map<string, string> = new Map();
  _pair_occurrence: Map<string, number> = new Map();
  _ref_key_index: Map<string, string> = new Map();

  getOrCreateEntity(name: string, type: string | null | undefined, sourceRef: SourceRef): Entity {
    const existingId = this._name_index.get(name);
    if (existingId !== undefined && this.entities[existingId]) {
      const entity = this.entities[existingId];
      if (type && entity.type === "Unknown") {
        entity.type = type;
      }
      entity.source_refs.push(sourceRef);
      return entity;
    }

    const entity: Entity = {
      id: stableEntityId(name),
      type: type || "Unknown",
      name,
      aliases: [],
      layer: null,
      attributes: {},
      existence: "confirmed",
      source_refs: [sourceRef],
      schema_version: SCHEMA_VERSION,
      metadata: {},
    };

    this.entities[entity.id] = entity;
    this._name_index.set(name, entity.id);
    return entity;
  }

  addAlias(entityId: string, alias: string): void {
    const entity = this.entities[entityId];
    if (!entity) return;
    if (this._alias_index.has(alias) && this._alias_index.get(alias) !== entityId) {
      return;
    }
    if (!entity.aliases.includes(alias)) {
      entity.aliases.push(alias);
    }
    this._alias_index.set(alias, entityId);
  }

  resolve(nameOrAlias: string): Entity | null {
    const entityId = this._name_index.get(nameOrAlias) || this._alias_index.get(nameOrAlias);
    if (!entityId) return null;
    return this.entities[entityId] || null;
  }

  addRelation(sourceId: string, targetId: string, relType: string, sourceRef: SourceRef): Relation {
    const pairKey = `${sourceId}->${targetId}`;
    const n = this._pair_occurrence.get(pairKey) || 0;
    this._pair_occurrence.set(pairKey, n + 1);

    const sourceName = this.entities[sourceId] ? this.entities[sourceId].name : sourceId;
    const targetName = this.entities[targetId] ? this.entities[targetId].name : targetId;
    const refKey = `${sourceName}->${targetName}#${n}`;

    const relation: Relation = {
      id: newId("rel"),
      source: sourceId,
      target: targetId,
      type: relType,
      status: "confirmed",
      valid_from: null,
      valid_to: null,
      perspective: "objective",
      ref_key: refKey,
      source_refs: [sourceRef],
      schema_version: SCHEMA_VERSION,
      metadata: {},
    };

    this.relations[relation.id] = relation;
    this._ref_key_index.set(refKey, relation.id);
    return relation;
  }

  findByRefKey(refKey: string): Relation | null {
    const relationId = this._ref_key_index.get(refKey);
    if (!relationId) return null;
    return this.relations[relationId] || null;
  }

  toJson(): string {
    const payload = {
      schema_version: SCHEMA_VERSION,
      entities: Object.values(this.entities),
      relations: Object.values(this.relations),
    };
    return JSON.stringify(payload, null, 2);
  }

  static fromJson(text: string): WorldModel {
    const payload = JSON.parse(text);
    const model = new WorldModel();
    for (const ed of payload.entities || []) {
      const entity: Entity = {
        ...ed,
        aliases: ed.aliases || [],
        attributes: ed.attributes || {},
        source_refs: ed.source_refs || [],
        metadata: ed.metadata || {},
      };
      model.entities[entity.id] = entity;
      model._name_index.set(entity.name, entity.id);
      for (const alias of entity.aliases) {
        model._alias_index.set(alias, entity.id);
      }
    }
    for (const rd of payload.relations || []) {
      const relation: Relation = {
        ...rd,
        perspective: rd.perspective || "objective",
        source_refs: rd.source_refs || [],
        metadata: rd.metadata || {},
      };
      model.relations[relation.id] = relation;
      if (relation.ref_key) {
        model._ref_key_index.set(relation.ref_key, relation.id);
      }
      const pairKey = `${relation.source}->${relation.target}`;
      model._pair_occurrence.set(pairKey, (model._pair_occurrence.get(pairKey) || 0) + 1);
    }
    return model;
  }

  clear(): void {
    this.entities = {};
    this.relations = {};
    this._name_index.clear();
    this._alias_index.clear();
    this._pair_occurrence.clear();
    this._ref_key_index.clear();
  }

  clone(): WorldModel {
    return WorldModel.fromJson(this.toJson());
  }
}
