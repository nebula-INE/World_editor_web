import { AxralStoryV1 } from './story';

/**
 * Japanese standard screenplay format (日本標準脚本形式)
 * - 柱: 〇シーンタイトル
 * - ト書き: 3字下げ（全角スペース3つ）
 * - セリフ: 話者名「セリフ本文」
 * - 演出: （SE / BGM指示）
 */
export function formatAsStandardScreenplay(story: AxralStoryV1): string {
  const lines: string[] = [];

  // Title header
  lines.push(`『${story.title || '無題'}』`);
  lines.push('');

  // Extract distinct characters for cast summary
  const characterNames = new Set<string>();
  story.chapters.forEach(c => {
    c.scenes.forEach(s => {
      s.blocks.forEach(b => {
        if (b.type === 'dialogue') {
          const name = b.character_id || (b as any).character_name || (b as any).speaker;
          if (name) characterNames.add(name);
        }
      });
    });
  });

  if (characterNames.size > 0) {
    lines.push('【登場人物】');
    Array.from(characterNames).forEach(name => {
      lines.push(`　・${name}`);
    });
    lines.push('');
    lines.push('--------------------------------------------------');
    lines.push('');
  }

  // Iterate chapters & scenes
  story.chapters.forEach((chapter, cIdx) => {
    if (story.chapters.length > 1) {
      lines.push(`◆ 第${cIdx + 1}幕 / ${chapter.title}`);
      lines.push('');
    }

    chapter.scenes.forEach(scene => {
      const timeStr = typeof (scene as any).timestamp === 'number' ? ` (t=${(scene as any).timestamp})` : '';
      lines.push(`〇${scene.title}${timeStr}`);
      lines.push('');

      scene.blocks.forEach(block => {
        if (block.type === 'direction' || block.type === 'narration' || block.type === 'prose') {
          // 柱・ト書きは3字下げ
          const text = block.text || '';
          if (text.startsWith('〇') || text.startsWith('○')) {
            // Already a scene heading
            lines.push(text);
          } else if (text.startsWith('【SE') || text.startsWith('【BGM') || text.startsWith('（SE') || text.startsWith('（BGM')) {
            lines.push(`　　　${text}`);
          } else {
            lines.push(`　　　${text}`);
          }
        } else if (block.type === 'dialogue') {
          const speaker = block.character_id || (block as any).character_name || (block as any).speaker || '話者';
          const dialogueText = block.text || '';
          if (dialogueText.startsWith('「') && dialogueText.endsWith('」')) {
            lines.push(`${speaker}${dialogueText}`);
          } else {
            lines.push(`${speaker}「${dialogueText}」`);
          }
        } else if (block.type === 'note') {
          lines.push(`　　※ [注釈] ${block.text}`);
        }
      });

      lines.push('');
    });
  });

  return lines.join('\n');
}

/**
 * Standard Japanese Novel format (縦書き・横書き兼用原稿テキスト)
 * - 段落頭1字下げ
 * - かぎ括弧付きセリフは字下げなし
 */
export function formatAsNovelText(story: AxralStoryV1): string {
  const lines: string[] = [];

  lines.push(story.title || '無題');
  lines.push('');

  story.chapters.forEach((chapter, cIdx) => {
    lines.push(`第${cIdx + 1}章　${chapter.title}`);
    lines.push('');

    chapter.scenes.forEach(scene => {
      if (scene.title && scene.title !== 'シーン1' && scene.title !== 'Scene 1') {
        lines.push(`　＊　${scene.title}　＊`);
        lines.push('');
      }

      scene.blocks.forEach(block => {
        const text = (block.text || '').trim();
        if (!text) return;

        if (block.type === 'dialogue') {
          const speaker = block.character_id || (block as any).character_name || (block as any).speaker;
          if (speaker && !text.startsWith('「')) {
            lines.push(`「${text}」`);
          } else if (text.startsWith('「')) {
            lines.push(text);
          } else {
            lines.push(`「${text}」`);
          }
        } else if (block.type === 'prose' || block.type === 'narration') {
          // If already indented with full-width space, preserve, otherwise add 1 space
          const indented = text.startsWith('　') ? text : `　${text}`;
          lines.push(indented);
        } else if (block.type === 'direction') {
          lines.push(`　（${text}）`);
        } else {
          lines.push(`　${text}`);
        }
      });

      lines.push('');
    });
  });

  return lines.join('\n');
}

/**
 * CSV Export for game scenarios, voice script recording sheets, and murder mysteries.
 */
export function exportStoryAsCsv(story: AxralStoryV1): string {
  const headers = ['Chapter', 'Scene', 'Order', 'Type', 'Character', 'Text', 'Timestamp'];
  const rows: string[][] = [headers];

  const escapeCsv = (str: string) => {
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  story.chapters.forEach(c => {
    c.scenes.forEach(s => {
      const timestamp = (s as any).timestamp !== undefined ? String((s as any).timestamp) : '';
      s.blocks.forEach(b => {
        const char = b.character_id || (b as any).character_name || '';
        rows.push([
          escapeCsv(c.title),
          escapeCsv(s.title),
          String(b.order),
          escapeCsv(b.type),
          escapeCsv(char),
          escapeCsv(b.text),
          escapeCsv(timestamp),
        ]);
      });
    });
  });

  return rows.map(r => r.join(',')).join('\n');
}

/**
 * Downloads a text string as a client file.
 */
export function triggerFileDownload(filename: string, content: string, mimeType = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
