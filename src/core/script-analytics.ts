/**
 * Axral Codex - Script & Cast Analytics Engine
 * Calculates writing volume, dialogue ratios, cast appearance shares,
 * and scene-by-character occurrence matrices.
 */

import type { AxralStoryV1 } from './story';

export interface SpeakerStat {
  name: string;
  lineCount: number;
  charCount: number;
  percentage: number; // 0 - 100
  scenesCount: number;
  sceneIds: string[];
}

export interface SceneMatrixRow {
  chapterIndex: number;
  sceneIndex: number;
  sceneId: string;
  chapterTitle: string;
  sceneTitle: string;
  layer: string;
  timestamp: number;
  totalChars: number;
  dialogueChars: number;
  dialogueDensity: number; // 0 - 100%
  speakers: Set<string>;
}

export interface ScriptAnalyticsResult {
  totalCharsWithSpaces: number;
  totalCharsNoSpaces: number;
  totalLines: number;
  totalBlocks: number;
  totalChapters: number;
  totalScenes: number;

  dialogueChars: number;
  directionChars: number;
  proseChars: number;
  otherChars: number;
  dialogueRatio: number; // 0 - 100%

  speakers: SpeakerStat[];
  sceneMatrix: SceneMatrixRow[];
  uniqueSpeakersList: string[];
  layerBreakdown: Record<string, number>;
}

export function computeScriptAnalytics(story: AxralStoryV1): ScriptAnalyticsResult {
  let totalCharsWithSpaces = 0;
  let totalCharsNoSpaces = 0;
  let totalLines = 0;
  let totalBlocks = 0;
  let dialogueChars = 0;
  let directionChars = 0;
  let proseChars = 0;
  let otherChars = 0;

  const speakerLinesMap: Record<string, number> = {};
  const speakerCharsMap: Record<string, number> = {};
  const speakerScenesMap: Record<string, Set<string>> = {};

  const sceneMatrix: SceneMatrixRow[] = [];
  const layerCounts: Record<string, number> = {};

  let totalScenesCount = 0;

  story.chapters.forEach((chapter, ci) => {
    chapter.scenes.forEach((scene, si) => {
      totalScenesCount++;
      const sceneLayer = typeof (scene as any).layer === 'string' && (scene as any).layer.trim().length > 0
        ? (scene as any).layer.trim()
        : 'Su-ken';
      const sceneTimestamp = typeof (scene as any).timestamp === 'number'
        ? (scene as any).timestamp
        : 0;

      layerCounts[sceneLayer] = (layerCounts[sceneLayer] || 0) + 1;

      let sceneTotalChars = 0;
      let sceneDialogueChars = 0;
      const sceneSpeakers = new Set<string>();

      scene.blocks.forEach(block => {
        totalBlocks++;
        const text = block.text || '';
        const lenWith = text.length;
        const lenNo = text.replace(/\s+/g, '').length;
        const lines = text ? text.split('\n').length : 1;

        totalCharsWithSpaces += lenWith;
        totalCharsNoSpaces += lenNo;
        totalLines += lines;
        sceneTotalChars += lenNo;

        if (block.type === 'dialogue') {
          dialogueChars += lenNo;
          sceneDialogueChars += lenNo;
          const speaker = (block.character_id || '（未指定）').trim();
          sceneSpeakers.add(speaker);

          speakerLinesMap[speaker] = (speakerLinesMap[speaker] || 0) + 1;
          speakerCharsMap[speaker] = (speakerCharsMap[speaker] || 0) + lenNo;
          if (!speakerScenesMap[speaker]) {
            speakerScenesMap[speaker] = new Set();
          }
          speakerScenesMap[speaker].add(scene.id);
        } else if (block.type === 'direction') {
          directionChars += lenNo;
        } else if (block.type === 'prose') {
          proseChars += lenNo;
        } else {
          otherChars += lenNo;
        }
      });

      const density = sceneTotalChars > 0 ? (sceneDialogueChars / sceneTotalChars) * 100 : 0;

      sceneMatrix.push({
        chapterIndex: ci,
        sceneIndex: si,
        sceneId: scene.id,
        chapterTitle: chapter.title || `第${ci + 1}幕`,
        sceneTitle: scene.title || `シーン${si + 1}`,
        layer: sceneLayer,
        timestamp: sceneTimestamp,
        totalChars: sceneTotalChars,
        dialogueChars: sceneDialogueChars,
        dialogueDensity: Math.round(density),
        speakers: sceneSpeakers
      });
    });
  });

  const totalContentChars = totalCharsNoSpaces || 1;
  const dialogueRatio = Math.round((dialogueChars / totalContentChars) * 100);

  // Compute speaker stats and percentage share
  const speakers: SpeakerStat[] = Object.keys(speakerCharsMap).map(name => {
    const chars = speakerCharsMap[name] || 0;
    const lines = speakerLinesMap[name] || 0;
    const sceneIds = Array.from(speakerScenesMap[name] || []);
    const pct = dialogueChars > 0 ? (chars / dialogueChars) * 100 : 0;

    return {
      name,
      lineCount: lines,
      charCount: chars,
      percentage: Math.round(pct * 10) / 10,
      scenesCount: sceneIds.length,
      sceneIds
    };
  });

  // Sort speakers by charCount descending
  speakers.sort((a, b) => b.charCount - a.charCount);

  const uniqueSpeakersList = speakers.map(s => s.name);

  return {
    totalCharsWithSpaces,
    totalCharsNoSpaces,
    totalLines,
    totalBlocks,
    totalChapters: story.chapters.length,
    totalScenes: totalScenesCount,
    dialogueChars,
    directionChars,
    proseChars,
    otherChars,
    dialogueRatio,
    speakers,
    sceneMatrix,
    uniqueSpeakersList,
    layerBreakdown: layerCounts
  };
}
