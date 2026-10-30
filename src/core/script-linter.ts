/**
 * Axral Codex - Script Inconsistency Linter
 * Real-time consistency verification between script scenes/dialogue and world state.
 * Detects unknown characters, cross-layer discrepancies, and timeline demise/status conflicts.
 */

import type { AxralStoryV1, StoryScene, StoryBlock } from './story';
import type { WorldModel, Entity } from './models';
import type { WorldState, WorldStateEngine } from './world_state';

export interface ScriptLintIssue {
  id: string;
  chapterIndex: number;
  sceneIndex: number;
  blockIndex: number;
  blockId: string;
  severity: 'error' | 'warning' | 'info';
  title: string;
  message: string;
  characterName?: string;
  suggestedAction?: {
    type: 'add_entity' | 'sync_layer' | 'sync_timestamp';
    label: string;
    targetName?: string;
    targetLayer?: string;
    targetTimestamp?: number;
  };
}

/**
 * Finds matching entity in world by exact name or alias.
 */
export function findEntityByNameOrAlias(
  name: string,
  entities: Record<string, Entity>
): Entity | undefined {
  const trimmed = name.trim();
  if (!trimmed) return undefined;

  // Direct ID or name match
  for (const ent of Object.values(entities)) {
    if (ent.id === trimmed || ent.name.toLowerCase() === trimmed.toLowerCase()) {
      return ent;
    }
    if (ent.aliases && ent.aliases.some(a => a.toLowerCase() === trimmed.toLowerCase())) {
      return ent;
    }
  }
  return undefined;
}

export interface LintScriptOptions {
  story: AxralStoryV1;
  worldModel: WorldModel | WorldState;
  engine?: WorldStateEngine | null;
  allLayers?: string[];
}

/**
 * Lints a story against the world model & timeline engine.
 */
export function lintScriptConsistency(options: LintScriptOptions): ScriptLintIssue[] {
  const { story, worldModel, engine } = options;
  const issues: ScriptLintIssue[] = [];

  const baseEntities = worldModel.entities || {};

  story.chapters.forEach((chapter, ci) => {
    chapter.scenes.forEach((scene, si) => {
      // Determine scene timestamp (either specified or inferred)
      const sceneTimestamp = typeof (scene as any).timestamp === 'number'
        ? (scene as any).timestamp
        : 0;

      // Determine scene layer
      const sceneLayer = typeof (scene as any).layer === 'string' && (scene as any).layer.trim().length > 0
        ? (scene as any).layer.trim()
        : null;

      // If engine is present, query state at scene timestamp
      let stateEntities = baseEntities;
      if (engine) {
        try {
          const snapshot = engine.stateAt(sceneTimestamp);
          if (snapshot && snapshot.entities) {
            stateEntities = snapshot.entities;
          }
        } catch {
          stateEntities = baseEntities;
        }
      }

      scene.blocks.forEach((block, bi) => {
        // Check dialogue speakers
        if (block.type === 'dialogue') {
          const speakerName = (block.character_id || '').trim();
          if (!speakerName) {
            issues.push({
              id: `issue_${block.id}_no_speaker`,
              chapterIndex: ci,
              sceneIndex: si,
              blockIndex: bi,
              blockId: block.id,
              severity: 'info',
              title: '話者が未指定',
              message: 'セリフの話者（キャラクター名）が指定されていません。'
            });
            return;
          }

          // Look up character
          const entity = findEntityByNameOrAlias(speakerName, stateEntities);

          if (!entity) {
            // Check if entity existed in base model (maybe absent at timestamp)
            const baseEntity = findEntityByNameOrAlias(speakerName, baseEntities);
            if (baseEntity) {
              // Existed at another time, but not at this timestamp!
              issues.push({
                id: `issue_${block.id}_timeline_demise`,
                chapterIndex: ci,
                sceneIndex: si,
                blockIndex: bi,
                blockId: block.id,
                severity: 'error',
                title: 'タイムライン存在矛盾',
                message: `「${speakerName}」は時点 t=${sceneTimestamp} では世界に存在していないか退場済みです（現在のステータス: ${baseEntity.existence || '不明'}）。`,
                characterName: speakerName,
                suggestedAction: {
                  type: 'sync_timestamp',
                  label: `シーンの時点を調整`,
                  targetTimestamp: 0
                }
              });
            } else {
              // Completely unregistered in world
              issues.push({
                id: `issue_${block.id}_unregistered`,
                chapterIndex: ci,
                sceneIndex: si,
                blockIndex: bi,
                blockId: block.id,
                severity: 'warning',
                title: '未登録キャラクター',
                message: `「${speakerName}」は世界観（WorldCode）に登録されていません。`,
                characterName: speakerName,
                suggestedAction: {
                  type: 'add_entity',
                  label: `WorldCodeに「${speakerName}」を追加`,
                  targetName: speakerName,
                  targetLayer: sceneLayer || 'Su-ken'
                }
              });
            }
          } else {
            // Character exists! Now check layer consistency
            const charLayer = entity.layer || 'Su-ken';

            if (sceneLayer && sceneLayer !== charLayer) {
              // Layer mismatch warning: scene is in another layer
              issues.push({
                id: `issue_${block.id}_layer_mismatch`,
                chapterIndex: ci,
                sceneIndex: si,
                blockIndex: bi,
                blockId: block.id,
                severity: 'warning',
                title: '所属レイヤー不整合',
                message: `「${speakerName}」の所属は【${charLayer}】ですが、このシーンの舞台は【${sceneLayer}】です。越境・界渡り設定を確認してください。`,
                characterName: speakerName,
                suggestedAction: {
                  type: 'sync_layer',
                  label: `所属レイヤーを【${sceneLayer}】に変更`,
                  targetName: speakerName,
                  targetLayer: sceneLayer
                }
              });
            }

            // Check existence status (dead, erased, sealed)
            const existence = (entity.existence || '').toLowerCase();
            if (['dead', 'deceased', 'erased', 'sealed', 'lost', '死亡', '封印', '消滅'].includes(existence)) {
              issues.push({
                id: `issue_${block.id}_status_dead`,
                chapterIndex: ci,
                sceneIndex: si,
                blockIndex: bi,
                blockId: block.id,
                severity: 'error',
                title: '死亡・封印キャラクターの発言',
                message: `「${speakerName}」はステータスが「${entity.existence}」として記録されています。通常のセリフを発することはできません。`,
                characterName: speakerName
              });
            }
          }
        }

        // Check explicit entity_refs
        if (block.entity_refs && block.entity_refs.length > 0) {
          block.entity_refs.forEach(ref => {
            const ent = findEntityByNameOrAlias(ref, stateEntities);
            if (!ent) {
              issues.push({
                id: `issue_${block.id}_ref_${ref}`,
                chapterIndex: ci,
                sceneIndex: si,
                blockIndex: bi,
                blockId: block.id,
                severity: 'info',
                title: '未定義エンティティの参照',
                message: `本文内で言及された「${ref}」は世界観に登録されていません。`,
                characterName: ref,
                suggestedAction: {
                  type: 'add_entity',
                  label: `設定に「${ref}」を追加`,
                  targetName: ref
                }
              });
            }
          });
        }
      });
    });
  });

  return issues;
}
