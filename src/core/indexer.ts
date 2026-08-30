/**
 * Axral Codex - Secondary / Background Indexer (Phase 1.5)
 * Ported faithfully from Python desktop version.
 */

import { Entity } from './models';
import { NaturalLine } from './parser';

export const RELATION_KEYWORDS: Record<string, string> = {
  "所属していた": "所属",
  "所属する": "所属",
  "所属": "所属",
  "対立していた": "対立",
  "対立する": "対立",
  "対立": "対立",
  "敵対": "対立",
  "尊敬していた": "尊敬",
  "尊敬する": "尊敬",
  "尊敬": "尊敬",
  "師事": "師事",
  "同盟": "同盟",
  "友好": "友好",
  "協力": "協力",
  "裏切った": "裏切り",
  "裏切り": "裏切り",
  "殺した": "殺害",
  "殺害": "殺害",
  "婚姻": "婚姻",
  "結婚": "婚姻",
  "親子": "親子",
  "師弟": "師弟",
  "部下": "上下関係",
  "上司": "上下関係",
  "統治していた": "統治",
  "統治する": "統治",
  "統治": "統治",
};

const _NEGATION_PATTERNS = ["ない", "なかった", "ません", "ではない", "ではなかった"];
const _PRONOUNS = ["彼女", "彼", "それ", "その", "あの", "あいつ", "この者"];

const _HIGH = 0.75;
const _MEDIUM = 0.5;

export interface ConfidenceBreakdown {
  rule_signal: number;
  embedding_signal?: number | null;
  llm_signal?: number | null;
}

export function getTotalConfidence(breakdown: ConfidenceBreakdown): number {
  return Math.max(0.0, Math.min(1.0, breakdown.rule_signal));
}

export function getConfidenceLevel(total: number): "high" | "medium" | "low" {
  if (total >= _HIGH) return "high";
  if (total >= _MEDIUM) return "medium";
  return "low";
}

export interface Candidate {
  id: string;
  line: number;
  source_text: string;
  source_name: string;
  target_name: string;
  rel_type: string;
  breakdown: ConfidenceBreakdown;
  confidence: number;
  confidence_level: "high" | "medium" | "low";
  ambiguous: boolean;
}

export interface AmbiguityNote {
  line: number;
  message: string;
}

export interface IndexResult {
  candidates: Candidate[];
  ambiguities: AmbiguityNote[];
}

function findEntityMentions(line: string, entities: Entity[]): [number, number, Entity][] {
  const rawMatches: [number, number, Entity][] = [];

  for (const entity of entities) {
    const names = [entity.name, ...entity.aliases];
    for (const name of names) {
      if (!name) continue;
      let pos = 0;
      while (pos < line.length) {
        const found = line.indexOf(name, pos);
        if (found === -1) break;
        rawMatches.push([found, found + name.length, entity]);
        pos = found + 1;
      }
    }
  }

  // Sort by match length descending to prioritize longer matches
  rawMatches.sort((a, b) => (b[1] - b[0]) - (a[1] - a[0]));

  const accepted: [number, number, Entity][] = [];
  const occupied: [number, number][] = [];

  for (const [start, end, entity] of rawMatches) {
    const hasOverlap = occupied.some(([os, oe]) => !(end <= os || start >= oe));
    if (hasOverlap) continue;
    accepted.push([start, end, entity]);
    occupied.push([start, end]);
  }

  accepted.sort((a, b) => a[0] - b[0]);
  return accepted;
}

function findKeyword(line: string): [string, string, number] | null {
  let best: [string, string, number] | null = null;
  for (const [surface, relType] of Object.entries(RELATION_KEYWORDS)) {
    const idx = line.indexOf(surface);
    if (idx === -1) continue;
    if (best === null || surface.length > best[0].length) {
      best = [surface, relType, idx];
    }
  }
  return best;
}

function hasNegationNear(line: string, keywordIdx: number, keywordLen: number): boolean {
  const window = line.substring(keywordIdx, keywordIdx + keywordLen + 6);
  return _NEGATION_PATTERNS.some(neg => window.includes(neg));
}

export function indexNaturalLines(
  naturalLines: NaturalLine[],
  knownEntities: Entity[]
): IndexResult {
  const result: IndexResult = {
    candidates: [],
    ambiguities: [],
  };
  let counter = 0;

  for (const nl of naturalLines) {
    const line = nl.text;
    const mentions = findEntityMentions(line, knownEntities);
    const keyword = findKeyword(line);
    const pronounHit = _PRONOUNS.some(p => line.includes(p));

    if (!keyword) {
      continue;
    }

    const [surface, relType, kwIdx] = keyword;
    const negated = hasNegationNear(line, kwIdx, surface.length);

    if (pronounHit && mentions.length < 2) {
      result.ambiguities.push({
        line: nl.line,
        message: `未解決参照 (代名詞の指す先が特定できません): 「${line}」`,
      });
      continue;
    }

    if (mentions.length < 2) {
      continue;
    }

    const distinctEntities: Entity[] = [];
    const seenIds = new Set<string>();
    for (const [, , ent] of mentions) {
      if (!seenIds.has(ent.id)) {
        distinctEntities.push(ent);
        seenIds.add(ent.id);
      }
    }

    let pairs: [Entity, Entity][] = [];
    let ambiguous = false;

    if (distinctEntities.length > 2) {
      result.ambiguities.push({
        line: nl.line,
        message: `複数のEntityが1文に登場しており、関係の対応が曖昧です (${distinctEntities.map(e => e.name).join(', ')}): 「${line}」`,
      });
      for (let i = 0; i < distinctEntities.length - 1; i++) {
        pairs.push([distinctEntities[i], distinctEntities[i + 1]]);
      }
      ambiguous = true;
    } else {
      pairs = [[distinctEntities[0], distinctEntities[1]]];
      ambiguous = false;
    }

    for (const [sourceEnt, targetEnt] of pairs) {
      let rule = 0.3; // entity_match
      rule += 0.3; // keyword_match
      const firstTwoMaxStart = Math.max(...mentions.slice(0, 2).map(m => m[0]));
      if (kwIdx > firstTwoMaxStart) {
        rule += 0.2;
      }
      if (negated) {
        rule -= 0.35;
      }
      if (ambiguous) {
        rule -= 0.25;
      }

      const breakdown: ConfidenceBreakdown = {
        rule_signal: rule,
        embedding_signal: null,
        llm_signal: null,
      };

      const total = getTotalConfidence(breakdown);
      const level = getConfidenceLevel(total);

      counter++;
      result.candidates.push({
        id: `cand_${nl.line}_${counter}`,
        line: nl.line,
        source_text: line,
        source_name: sourceEnt.name,
        target_name: targetEnt.name,
        rel_type: relType,
        breakdown,
        confidence: total,
        confidence_level: level,
        ambiguous,
      });
    }
  }

  return result;
}
