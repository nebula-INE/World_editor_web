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
 * SHA-1 of UTF-8 bytes, returned as lowercase hexadecimal.
 *
 * This small synchronous implementation keeps stableEntityId synchronous in
 * both browser and desktop code. It intentionally mirrors Python's
 * hashlib.sha1(name.encode("utf-8")).hexdigest().
 */
function sha1HexUtf8(value: string): string {
  const bytes = Array.from(new TextEncoder().encode(value));
  const bitLength = bytes.length * 8;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);

  const high = Math.floor(bitLength / 0x100000000);
  const low = bitLength >>> 0;
  for (let shift = 24; shift >= 0; shift -= 8) bytes.push((high >>> shift) & 0xff);
  for (let shift = 24; shift >= 0; shift -= 8) bytes.push((low >>> shift) & 0xff);

  let h0 = 0x67452301;
  let h1 = 0xefcdab89;
  let h2 = 0x98badcfe;
  let h3 = 0x10325476;
  let h4 = 0xc3d2e1f0;

  for (let offset = 0; offset < bytes.length; offset += 64) {
    const w = new Array<number>(80);
    for (let i = 0; i < 16; i++) {
      const j = offset + i * 4;
      w[i] = ((bytes[j] << 24) | (bytes[j + 1] << 16) | (bytes[j + 2] << 8) | bytes[j + 3]) >>> 0;
    }
    for (let i = 16; i < 80; i++) {
      const v = w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16];
      w[i] = ((v << 1) | (v >>> 31)) >>> 0;
    }

    let a = h0, b = h1, c = h2, d = h3, e = h4;
    for (let i = 0; i < 80; i++) {
      let f: number, k: number;
      if (i < 20) {
        f = (b & c) | (~b & d);
        k = 0x5a827999;
      } else if (i < 40) {
        f = b ^ c ^ d;
        k = 0x6ed9eba1;
      } else if (i < 60) {
        f = (b & c) | (b & d) | (c & d);
        k = 0x8f1bbcdc;
      } else {
        f = b ^ c ^ d;
        k = 0xca62c1d6;
      }
      const rotateA = ((a << 5) | (a >>> 27)) >>> 0;
      const temp = (rotateA + f + e + k + w[i]) >>> 0;
      e = d;
      d = c;
      c = ((b << 30) | (b >>> 2)) >>> 0;
      b = a;
      a = temp;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
  }

  return [h0, h1, h2, h3, h4].map(v => v.toString(16).padStart(8, "0")).join("");
}

/**
 * Deterministic Entity ID shared with the Python implementation:
 * "ent_" + SHA-1(UTF-8(name)).hexdigest()[:12].
 *
 * Keep this function synchronous and preserve the exact UTF-8 byte semantics;
 * project graph positions and Event references use these IDs.
 */
export function stableEntityId(name: string): string {
  return `ent_${sha1HexUtf8(name).slice(0, 12)}`;
}

/** Relation identity follows the stable, pair-occurrence ref_key shared by both parsers. */
export function stableRelationId(refKey: string): string {
  return `rel_${sha1HexUtf8(refKey).slice(0, 12)}`;
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
      id: stableRelationId(refKey),
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
