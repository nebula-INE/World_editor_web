import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { readFileSync, writeFileSync, rmSync } from "node:fs";

const out = ".tmp-story-file-test";
try {
  execFileSync("npx", ["tsc", "src/core/story.ts", "src/core/story-file.ts", "--target", "ES2020", "--module", "commonjs", "--lib", "ES2020,DOM", "--skipLibCheck", "--outDir", out], { stdio: "inherit" });
  writeFileSync(out + "/package.json", JSON.stringify({ type: "commonjs" }));
  const require = createRequire(import.meta.url);
  const { parseStoryFileText, serializeStoryFile, storyFilename, isStoryFilename, STORY_FILE_SUFFIX } = require("../" + out + "/story-file.js");
  const fixture = JSON.parse(readFileSync(new URL("../tests/fixtures/axral-story-v1.json", import.meta.url), "utf8"));
  const text = serializeStoryFile(fixture);
  assert.deepEqual(parseStoryFileText(text), fixture);
  assert.ok(text.endsWith("\n"), "serialized story file must end with a newline");
  assert.match(text, /夜。雨/);
  assert.equal(storyFilename("第一話 / 始まり"), "第一話 _ 始まり.axral-story.json");
  assert.equal(storyFilename("..."), "untitled.axral-story.json");
  assert.equal(storyFilename("😀".repeat(101)), "😀".repeat(100) + STORY_FILE_SUFFIX, "filename truncation must preserve complete Unicode code points");
  assert.ok(STORY_FILE_SUFFIX.endsWith(".axral-story.json"));
  assert.equal(isStoryFilename("story.axral-story.json"), true);
  assert.equal(isStoryFilename("STORY.AXRAL-STORY.JSON"), true);
  assert.equal(isStoryFilename("project.axral.json"), false);
  assert.equal(isStoryFilename("story.json"), false);
  assert.throws(() => parseStoryFileText("{broken"), /JSONを読み込めませんでした/);
  assert.throws(() => parseStoryFileText(JSON.stringify({ ...fixture, schema_version: 999 })), /未対応/);
  assert.throws(() => parseStoryFileText(JSON.stringify({ format: "axral-world-project", schema_version: 1 })), /Axral Story形式/);
  console.log("Story file-content round-trip and validation passed.");
} finally {
  rmSync(out, { recursive: true, force: true });
}
