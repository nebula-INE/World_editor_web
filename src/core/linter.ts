/**
 * Axral Codex - Worldbuilding Linter (Phase 4, §15)
 * Ported faithfully from Python desktop version.
 */

import { IndexResult } from './indexer';
import { WorldModel } from './models';
import { ParseResult } from './parser';
import { WorldStateEngine } from './world_state';

export const DEAD_VALUES = new Set(["dead", "deceased", "destroyed", "died"]);

export type Severity = "warning" | "info";

export interface LintIssue {
  code: "PARSE" | "PATCH_CONFLICT" | "AMBIGUITY" | "TEMPORAL_CONTRADICTION" | "RELATION_DATE_CONTRADICTION" | "MISSING_REFERENCE" | string;
  severity: Severity;
  message: string;
  line?: number | null;
}

export function lint(
  parseResult: ParseResult,
  engine: WorldStateEngine,
  indexResult?: IndexResult | null
): LintIssue[] {
  const issues: LintIssue[] = [];
  issues.push(...parserIssues(parseResult));
  issues.push(...patchConflicts(parseResult));
  if (indexResult) {
    issues.push(...ambiguities(indexResult));
  }
  issues.push(...temporalContradictions(engine));
  issues.push(...relationDateInconsistencies(parseResult.model));
  issues.push(...missingReferencesOverTime(engine));
  return issues;
}

function parserIssues(parseResult: ParseResult): LintIssue[] {
  return parseResult.issues.map(i => ({
    code: "PARSE",
    severity: "warning",
    message: i.message,
    line: i.line,
  }));
}

function patchConflicts(parseResult: ParseResult): LintIssue[] {
  return parseResult.patch_conflicts.map(c => ({
    code: "PATCH_CONFLICT",
    severity: "warning",
    message: `「${c.ref_key}」の ${c.field} でConflict: Original="${c.text_value}" / Patch="${c.patch_value}" (Patch作成時のOriginal想定値="${c.expected_was}")`,
    line: c.line,
  }));
}

function ambiguities(indexResult: IndexResult): LintIssue[] {
  return indexResult.ambiguities.map(a => ({
    code: "AMBIGUITY",
    severity: "info",
    message: a.message,
    line: a.line,
  }));
}

function temporalContradictions(engine: WorldStateEngine): LintIssue[] {
  const issues: LintIssue[] = [];
  const events = engine.eventsSorted();

  const deathPeriods: Record<string, [number, number | null][]> = {};

  for (const event of events) {
    for (const effect of event.effects) {
      if (effect.kind !== "entity_existence" || !effect.target_id) {
        continue;
      }
      const entityId = effect.target_id;
      const existence = String(effect.payload?.existence || "").toLowerCase();
      if (!deathPeriods[entityId]) {
        deathPeriods[entityId] = [];
      }
      const periods = deathPeriods[entityId];

      if (DEAD_VALUES.has(existence)) {
        periods.push([event.timestamp, null]);
      } else {
        for (let i = periods.length - 1; i >= 0; i--) {
          if (periods[i][1] === null && periods[i][0] < event.timestamp) {
            periods[i][1] = event.timestamp;
            break;
          }
        }
      }
    }
  }

  for (const event of events) {
    for (const participantId of event.participants) {
      const periods = deathPeriods[participantId] || [];
      for (const [ts, end] of periods) {
        if (!(ts < event.timestamp && (end === null || event.timestamp < end))) {
          continue;
        }
        const isSelfExistenceChange = event.effects.some(
          eff => eff.kind === "entity_existence" && eff.target_id === participantId
        );
        if (isSelfExistenceChange) {
          continue;
        }
        const state = engine.stateAt(ts);
        const entity = state.entities[participantId];
        const name = entity ? entity.name : participantId;
        issues.push({
          code: "TEMPORAL_CONTRADICTION",
          severity: "warning",
          message: `${name} は t=${ts} で死亡状態になっていますが、t=${event.timestamp} の Event「${event.type}」に関与しています。`,
        });
      }
    }
  }

  return issues;
}

function relationDateInconsistencies(model: WorldModel): LintIssue[] {
  const issues: LintIssue[] = [];
  for (const relation of Object.values(model.relations)) {
    if (relation.valid_from === null || relation.valid_from === undefined ||
        relation.valid_to === null || relation.valid_to === undefined) {
      continue;
    }
    const vf = parseInt(String(relation.valid_from), 10);
    const vt = parseInt(String(relation.valid_to), 10);
    if (isNaN(vf) || isNaN(vt)) {
      continue;
    }
    if (vt < vf) {
      issues.push({
        code: "RELATION_DATE_CONTRADICTION",
        severity: "warning",
        message: `「${relation.ref_key || relation.id}」は valid_to (${vt}) が valid_from (${vf}) より前になっています。`,
      });
    }
  }
  return issues;
}

function missingReferencesOverTime(engine: WorldStateEngine): LintIssue[] {
  const issues: LintIssue[] = [];
  for (const event of engine.eventsSorted()) {
    for (const effect of event.effects) {
      if (effect.kind !== "relation_add") {
        continue;
      }
      const state = engine.stateAt(event.timestamp);
      const keys = ["source", "target"] as const;
      for (const key of keys) {
        const entityId = effect.payload?.[key];
        if (entityId && !state.entities[entityId]) {
          issues.push({
            code: "MISSING_REFERENCE",
            severity: "warning",
            message: `t=${event.timestamp} の relation_add Effectが存在しないEntity (${entityId}) を参照しています。`,
          });
        }
      }
    }
  }
  return issues;
}
