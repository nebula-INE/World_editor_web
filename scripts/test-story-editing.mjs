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
 console.log("Axral Story editing operations passed.");
} finally {rmSync(out,{recursive:true,force:true})}
