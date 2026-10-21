/** File-content helpers for the separate *.axral-story.json format. */
import { parseStory, serializeStory, type AxralStoryV1 } from './story';

export const STORY_FILE_SUFFIX = '.axral-story.json';

/** Match the dedicated story extension case-insensitively, as Desktop does. */
export function isStoryFilename(filename: string): boolean {
  return filename.toLowerCase().endsWith(STORY_FILE_SUFFIX);
}

/** Parse user-selected story-file text; malformed or unknown versions fail closed. */
export function parseStoryFileText(text: string): AxralStoryV1 {
  if (typeof text !== 'string') throw new Error('物語ファイルの内容は文字列である必要があります。');
  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error('物語ファイルのJSONを読み込めませんでした: ' + detail);
  }
  return parseStory(payload);
}

/** Serialize a validated story for download, preserving Unicode and a final newline. */
export function serializeStoryFile(value: unknown): string {
  return serializeStory(value);
}

/** Return a safe download name with the dedicated story extension. */
export function storyFilename(title: string): string {
  const cleaned = Array.from(
    title.trim()
      .replace(/[<>:"\/\\|?*\u0000-\u001f]/g, '_')
      .replace(/[. ]+$/g, ''),
  )
    .slice(0, 100)
    .join('')
    .replace(/[. ]+$/g, '');
  return (cleaned || 'untitled') + STORY_FILE_SUFFIX;
}
