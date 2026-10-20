import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseStoryFileText, serializeStoryFile, storyFilename, STORY_FILE_SUFFIX } from '../src/core/story-file.ts';

const fixture = JSON.parse(await readFile('tests/fixtures/axral-story-v1.json', 'utf8'));
const text = serializeStoryFile(fixture);
assert.equal(parseStoryFileText(text), fixture);
assert.ok(text.endsWith('\n'), 'serialized story file must end with a newline');
assert.match(text, /日本語/);
assert.equal(storyFilename('第一話 / 始まり'), '第一話 _ 始まり.axral-story.json');
assert.equal(storyFilename('...'), 'untitled.axral-story.json');
assert.ok(STORY_FILE_SUFFIX.endsWith('.axral-story.json'));

assert.throws(() => parseStoryFileText('{broken'), /JSONを読み込めませんでした/);
assert.throws(() => parseStoryFileText(JSON.stringify({ ...fixture, schema_version: 999 })), /未対応/);
assert.throws(() => parseStoryFileText(JSON.stringify({ format: 'axral-world-project', schema_version: 1 })), /Axral Story形式/);

console.log('Story file-content round-trip and validation passed.');
