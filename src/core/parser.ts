/**
 * Axral Codex - Primary Parser (Phase 1 / Phase 2: Deterministic Codex Parser + Patch)
 * Ported faithfully from Python desktop version.
 */

import { isValidLayer, LAYER_HIERARCHY, SourceRef, WorldModel } from './models';

// [名前:型] または [名前:型:Layer]
const _ENTITY_DECL_RE = /^\[([^\]:]+):([^\]:]+)(?::([^\]]+))?\]$/;

// [A:型] -> [B:型] : 関係   （関係名は省略可）
const _EXPLICIT_RELATION_RE = /^\[([^\]:]+):([^\]]+)\]\s*->\s*\[([^\]:]+):([^\]]+)\](?:\s*:\s*(.+))?$/;

// A -> B : 関係  （型指定なしのshorthand。関係名は必須）
const _SHORTHAND_RELATION_RE = /^([^\[\]:>]+?)\s*->\s*([^\[\]:>]+?)\s*:\s*(.+)$/;

// PATCH SourceName->TargetName#0:
const _PATCH_HEADING_RE = /^PATCH\s+(.+?)\s*:$/;

// key = "value"  [# was: "was_value"]
const _PATCH_FIELD_RE = /^([A-Za-z_]+)\s*=\s*"([^"]*)"(?:\s*#\s*was:\s*"([^"]*)")?\s*$/;

export interface ParseIssue {
  line: number;
  message: string;
}

export interface NaturalLine {
  line: number;
  text: string;
}

export interface PatchConflict {
  ref_key: string;
  field: string;
  line: number;
  text_value: string;
  patch_value: string;
  expected_was: string;
}

export interface ParseResult {
  model: WorldModel;
  issues: ParseIssue[];
  natural_lines: NaturalLine[];
  patch_conflicts: PatchConflict[];
}

export function extractRelationType(line: string): string | null {
  const trimmed = line.trim();
  const em = _EXPLICIT_RELATION_RE.exec(trimmed);
  if (em) {
    return (em[5] || "").trim() || "関連";
  }
  const sm = _SHORTHAND_RELATION_RE.exec(trimmed);
  if (sm) {
    return sm[3].trim();
  }
  return null;
}

export function parseCodexSyntax(text: string): ParseResult {
  const model = new WorldModel();
  const issues: ParseIssue[] = [];
  const natural_lines: NaturalLine[] = [];

  const pending_patches: Record<string, Record<string, [string, string | null]>> = {};
  const pending_patch_lines: Record<string, number> = {};

  let in_patch_block = false;
  let current_patch_ref: string | null = null;

  const rawLines = text.split('\n');

  for (let idx = 0; idx < rawLines.length; idx++) {
    const lineno = idx + 1;
    const line = rawLines[idx].trim();

    if (in_patch_block && current_patch_ref) {
      if (line) {
        const fm = _PATCH_FIELD_RE.exec(line);
        if (fm) {
          const key = fm[1];
          const val = fm[2];
          const was = fm[3] ?? null;
          if (!pending_patches[current_patch_ref]) {
            pending_patches[current_patch_ref] = {};
          }
          pending_patches[current_patch_ref][key] = [val, was];
          continue;
        }
      }
      in_patch_block = false;
      current_patch_ref = null;
    }

    if (!line) {
      continue;
    }

    if (line.startsWith("#") || line.startsWith("```")) {
      continue;
    }

    const pm = _PATCH_HEADING_RE.exec(line);
    if (pm) {
      in_patch_block = true;
      current_patch_ref = pm[1].trim();
      pending_patch_lines[current_patch_ref] = lineno;
      continue;
    }

    const ref: SourceRef = { line: lineno, text: line };

    const edm = _ENTITY_DECL_RE.exec(line);
    if (edm) {
      const name = edm[1].trim();
      const declared_type = edm[2].trim();
      const layer = (edm[3] || "").trim() || null;

      const existing = model.resolve(name);
      if (existing !== null && existing.type !== "Unknown" && existing.type !== declared_type) {
        issues.push({
          line: lineno,
          message: `Duplicate Entity宣言: 「${name}」は既に型 '${existing.type}' として宣言されています (この行の型 '${declared_type}' は無視されました)`,
        });
      }

      const entity = model.getOrCreateEntity(name, declared_type, ref);
      if (layer) {
        if (isValidLayer(layer)) {
          if (!entity.layer) {
            entity.layer = layer;
          }
        } else {
          issues.push({
            line: lineno,
            message: `未知のLayer '${layer}' (有効値: ${LAYER_HIERARCHY.join(', ')})`,
          });
        }
      }
      continue;
    }

    const erm = _EXPLICIT_RELATION_RE.exec(line);
    if (erm) {
      const source = model.getOrCreateEntity(erm[1].trim(), erm[2].trim(), ref);
      const target = model.getOrCreateEntity(erm[3].trim(), erm[4].trim(), ref);
      const rtype = (erm[5] || "").trim() || "関連";
      model.addRelation(source.id, target.id, rtype, ref);
      continue;
    }

    const srm = _SHORTHAND_RELATION_RE.exec(line);
    if (srm) {
      const source = model.getOrCreateEntity(srm[1].trim(), null, ref);
      const target = model.getOrCreateEntity(srm[2].trim(), null, ref);
      const rtype = srm[3].trim();
      model.addRelation(source.id, target.id, rtype, ref);
      continue;
    }

    natural_lines.push({ line: lineno, text: line });
  }

  const patch_conflicts = applyPatches(model, pending_patches, pending_patch_lines, issues);

  return {
    model,
    issues,
    natural_lines,
    patch_conflicts,
  };
}

function applyPatches(
  model: WorldModel,
  pending_patches: Record<string, Record<string, [string, string | null]>>,
  pending_patch_lines: Record<string, number>,
  issues: ParseIssue[]
): PatchConflict[] {
  const conflicts: PatchConflict[] = [];

  for (const [ref_key, fields] of Object.entries(pending_patches)) {
    const relation = model.findByRefKey(ref_key);
    const line_no = pending_patch_lines[ref_key] || 0;

    if (!relation) {
      issues.push({
        line: line_no,
        message: `Patch対象のRelationが見つかりません (ref=${ref_key})`,
      });
      continue;
    }

    for (const [key, [value, was]] of Object.entries(fields)) {
      let current: string;
      if (key === "type") {
        current = relation.type;
      } else if (key === "status") {
        current = relation.status;
      } else {
        issues.push({
          line: line_no,
          message: `未対応のPatchフィールド: ${key}`,
        });
        continue;
      }

      if (was !== null && was !== current) {
        conflicts.push({
          ref_key,
          field: key,
          line: line_no,
          text_value: current,
          patch_value: value,
          expected_was: was,
        });
        continue;
      }

      if (key === "type") {
        relation.type = value;
      } else if (key === "status") {
        relation.status = value;
      }
    }
  }

  return conflicts;
}
