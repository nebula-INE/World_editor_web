import React from 'react';
import type { AxralStoryV1, StoryBlock } from './story';
import type { WorldModel } from './models';
import type { WorldState } from './world_state';

/**
 * Parses Japanese novel ruby notation:
 * `|漢字《かんじ》` or `｜漢字《かんじ》`
 * and converts to React elements (<ruby>)
 */
export function renderRubyText(text: string): React.ReactNode[] {
  if (!text) return [];

  // Match |base《ruby》 or ｜base《ruby》
  const rubyRegex = /[|｜]([^《]+)《([^》]+)》/g;
  const elements: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = rubyRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      elements.push(text.slice(lastIndex, match.index));
    }
    const baseText = match[1];
    const rubyText = match[2];
    elements.push(
      <ruby key={`ruby-${match.index}`} className="ruby-text">
        {baseText}
        <rp>(</rp>
        <rt className="text-[0.6em] text-indigo-300 font-normal">{rubyText}</rt>
        <rp>)</rp>
      </ruby>
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    elements.push(text.slice(lastIndex));
  }

  return elements.length > 0 ? elements : [text];
}

/**
 * Strips ruby syntax for character counts or plain text export
 */
export function stripRubyNotation(text: string): string {
  return text.replace(/[|｜]([^《]+)《[^》]+》/g, '$1');
}

/**
 * Calculates story metrics
 */
export function calculateStoryStats(story: AxralStoryV1) {
  let charCount = 0;
  let blockCount = 0;
  let sceneCount = 0;
  let dialogueCount = 0;
  let directionCount = 0;

  for (const ch of story.chapters) {
    sceneCount += ch.scenes.length;
    for (const sc of ch.scenes) {
      blockCount += sc.blocks.length;
      for (const blk of sc.blocks) {
        const cleanText = stripRubyNotation(blk.text);
        charCount += cleanText.length;
        if (blk.type === 'dialogue') dialogueCount++;
        if (blk.type === 'direction') directionCount++;
      }
    }
  }

  return {
    charCount,
    blockCount,
    sceneCount,
    chapterCount: story.chapters.length,
    dialogueCount,
    directionCount
  };
}

/**
 * Formats full story into standard screenplay text
 */
export function formatAsScreenplayText(story: AxralStoryV1): string {
  const lines: string[] = [];
  lines.push(`『${story.title}』`);
  lines.push(`種別: ${story.kind}`);
  lines.push('========================================================\n');

  for (const ch of story.chapters) {
    lines.push(`【${ch.title}】\n`);
    for (const sc of ch.scenes) {
      lines.push(`▼ ${sc.title}`);
      for (const blk of sc.blocks) {
        if (blk.type === 'direction') {
          // If block begins with 〇 (slugline)
          if (blk.text.trim().startsWith('〇')) {
            lines.push(`\n${blk.text.trim()}\n`);
          } else {
            lines.push(`　　${blk.text.trim().replace(/\n/g, '\n　　')}`);
          }
        } else if (blk.type === 'dialogue') {
          const speaker = blk.character_id ? `${blk.character_id}` : '';
          const body = blk.text.trim();
          if (speaker) {
            lines.push(`${speaker}「${body.replace(/^「|」$/g, '')}」`);
          } else {
            lines.push(body.startsWith('「') ? body : `「${body}」`);
          }
        } else if (blk.type === 'narration') {
          lines.push(`（N）「${blk.text.trim().replace(/^「|」$/g, '')}」`);
        } else if (blk.type === 'note') {
          lines.push(`/* ${blk.text.trim()} */`);
        } else {
          // prose
          lines.push(`　${blk.text.trim().replace(/\n/g, '\n　')}`);
        }
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}

export interface CharacterConsistencyItem {
  characterName: string;
  foundInStory: boolean;
  blockCount: number;
  inWorldCode: boolean;
  entityId?: string;
  entityType?: string;
  entityLayer?: string | null;
  existenceStatus?: string; // 'confirmed' | 'dead' | 'unconfirmed'
  warning?: string;
}

/**
 * Analyzes consistency between characters referenced in the story and the WorldCode model
 */
export function inspectStoryCharacterConsistency(
  story: AxralStoryV1,
  worldModel?: WorldModel | WorldState
): CharacterConsistencyItem[] {
  const charMap = new Map<string, { blockCount: number }>();

  // Collect character references from story
  for (const ch of story.chapters) {
    for (const sc of ch.scenes) {
      for (const blk of sc.blocks) {
        if (blk.character_id && blk.character_id.trim()) {
          const name = blk.character_id.trim();
          const cur = charMap.get(name) || { blockCount: 0 };
          cur.blockCount++;
          charMap.set(name, cur);
        }
        if (Array.isArray(blk.entity_refs)) {
          for (const ref of blk.entity_refs) {
            if (ref && ref.trim()) {
              const cur = charMap.get(ref.trim()) || { blockCount: 0 };
              cur.blockCount++;
              charMap.set(ref.trim(), cur);
            }
          }
        }
      }
    }
  }

  const result: CharacterConsistencyItem[] = [];

  charMap.forEach((info, name) => {
    let matchedEntity = undefined;
    if (worldModel?.entities) {
      // Find by id or by name
      for (const [id, ent] of Object.entries(worldModel.entities)) {
        if (id === name || ent.name.toLowerCase() === name.toLowerCase()) {
          matchedEntity = ent;
          break;
        }
      }
    }

    if (matchedEntity) {
      let warning: string | undefined = undefined;
      const exist = (matchedEntity as any).existence || 'confirmed';
      if (exist === 'dead' || exist === 'deceased') {
        warning = `世界設定上で「死亡・消滅（${exist}）」として記録されています。タイムライン上の生存状態をご確認ください。`;
      } else if (exist === 'unconfirmed') {
        warning = `世界設定上で「未確定（unconfirmed）」ステータスです。`;
      }

      result.push({
        characterName: matchedEntity.name || name,
        foundInStory: true,
        blockCount: info.blockCount,
        inWorldCode: true,
        entityId: matchedEntity.id,
        entityType: matchedEntity.type,
        entityLayer: matchedEntity.layer,
        existenceStatus: exist,
        warning
      });
    } else {
      result.push({
        characterName: name,
        foundInStory: true,
        blockCount: info.blockCount,
        inWorldCode: false,
        warning: 'WorldCodeの世界設定に登録されていないキャラクターです。ワンクリックで追加できます。'
      });
    }
  });

  return result;
}
