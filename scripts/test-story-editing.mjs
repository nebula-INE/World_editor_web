import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { readFileSync, writeFileSync, rmSync } from "node:fs";
const out=".tmp-story-editing-test";
try {
 execFileSync("npx",["tsc","src/core/story.ts","src/core/story-editing.ts","--target","ES2020","--module","commonjs","--lib","ES2020,DOM","--skipLibCheck","--outDir",out],{stdio:"inherit"});
 writeFileSync(out+"/package.json",JSON.stringify({type:"commonjs"}));
 const require=createRequire(import.meta.url),e=require("../"+out+"/story-editing.js");
 const fixture=JSON.parse(readFileSync(new URL("../tests/fixtures/axral-story-v1.json",import.meta.url),"utf8"));
 const added=e.addChapter(fixture,"chapter_002","第二章");
 assert.equal(added.chapters.length,2);assert.equal(fixture.chapters.length,1);
 const renamed=e.renameChapter(added,"chapter_002","第二章・改");
 assert.equal(renamed.chapters[1].title,"第二章・改");
 const reordered=e.reorderChapter(renamed,"chapter_002",0);
 assert.deepEqual(reordered.chapters.map(x=>[x.id,x.order]),[["chapter_002",0],["chapter_001",1]]);
 const withScene=e.addScene(added,"chapter_002","scene_002","雨上がり");
 const withBlock=e.addBlock(withScene,"scene_002",{id:"block_005",type:"prose",text:"空が明るくなる。"});
 const updated=e.updateBlock(withBlock,"block_005",{text:"空が少しずつ明るくなる。"});
 assert.equal(updated.chapters[1].scenes[0].blocks[0].text,"空が少しずつ明るくなる。");
 assert.equal(e.deleteBlock(updated,"block_005").chapters[1].scenes[0].blocks.length,0);
 assert.equal(e.deleteScene(withScene,"scene_002").chapters[1].scenes.length,0);
 assert.equal(e.deleteChapter(added,"chapter_002").chapters.length,1);
 assert.throws(()=>e.addChapter(fixture,"chapter_001","重複ID"),/重複/);
 assert.throws(()=>e.reorderChapter(fixture,"chapter_001",3),/範囲外/);

 // Sequential edit -> reorder -> delete -> codec round-trip regression.
 const { serializeStory, parseStory } = require("../" + out + "/story.js");
 const originalIds = fixture.chapters[0].scenes[0].blocks.map(b => b.id);
 const firstId = originalIds[0], secondId = originalIds[1];
 let sequential = e.updateBlock(fixture, firstId, {
   type: "dialogue",
   text: "「こんにちは。\\nまた会えたね。」",
   character_id: "char_mio"
 });
 sequential = e.reorderBlock(sequential, firstId, sequential.chapters[0].scenes[0].blocks.length - 1);
 sequential = e.deleteBlock(sequential, secondId);
 const roundTripped = parseStory(JSON.parse(serializeStory(sequential)));
 const roundTripScene = roundTripped.chapters[0].scenes[0];
 const edited = roundTripScene.blocks.find(b => b.id === firstId);
 assert.equal(edited.type, "dialogue");
 assert.equal(edited.text, "「こんにちは。\\nまた会えたね。」");
 assert.equal(edited.character_id, "char_mio");
 assert.ok(!roundTripScene.blocks.some(b => b.id === secondId));
 assert.deepEqual(roundTripScene.blocks.map(b => b.order), roundTripScene.blocks.map((_, i) => i));
 assert.deepEqual(fixture.chapters[0].scenes[0].blocks.map(b => b.id), originalIds);
 let deleted = e.addChapter(fixture, "chapter_002", "削除対象");
 deleted = e.addScene(deleted, "chapter_002", "scene_002", "削除対象シーン");
 deleted = e.addBlock(deleted, "scene_002", {id:"block_999",type:"prose",text:"一時的な本文"});
 deleted = e.deleteBlock(deleted, "block_999");
 deleted = e.deleteScene(deleted, "scene_002");
 deleted = e.deleteChapter(deleted, "chapter_002");
 assert.deepEqual(deleted, fixture);
 assert.throws(() => e.reorderBlock(fixture, originalIds[0], true), /範囲外/);

 console.log("Axral Story editing operations and sequential regressions passed.");
} finally {rmSync(out,{recursive:true,force:true})}
