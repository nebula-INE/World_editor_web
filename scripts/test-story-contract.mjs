import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { readFileSync, writeFileSync, rmSync } from "node:fs";
const out=".tmp-story-contract-test";
try {
 execFileSync("npx",["tsc","src/core/story.ts","--target","ES2020","--module","commonjs","--lib","ES2020,DOM","--skipLibCheck","--outDir",out],{stdio:"inherit"});
 writeFileSync(out+"/package.json",JSON.stringify({type:"commonjs"}));
 const require=createRequire(import.meta.url),{parseStory,serializeStory,validateStoryReferences}=require("../"+out+"/story.js");
 const fixture=JSON.parse(readFileSync(new URL("../tests/fixtures/axral-story-v1.json",import.meta.url),"utf8"));
 assert.deepEqual(JSON.parse(serializeStory(parseStory(fixture))),fixture);
 assert.ok(fixture.chapters[0].scenes[0].blocks[2].text.includes("\n"));
 assert.throws(()=>parseStory({...fixture,schema_version:99}),/未対応/);
 assert.throws(()=>parseStory({...fixture,schema_version:true}),/未対応/);
 assert.throws(()=>parseStory({...fixture,schema_version:"1"}),/未対応/);
 const duplicate=structuredClone(fixture);duplicate.chapters[0].scenes[0].blocks[1].id="block_001";assert.throws(()=>parseStory(duplicate),/重複/);
 const known=new Set(["ent_8f07c23f5f99"]);
 assert.deepEqual(validateStoryReferences(fixture,known).map(x=>x.entity_id),["ent_681ee300008e"]);
 const emptySpeaker=structuredClone(fixture);emptySpeaker.chapters[0].scenes[0].blocks[3].character_id="";
 assert.deepEqual(validateStoryReferences(emptySpeaker,known),validateStoryReferences(fixture,known));
 console.log("Axral Story v1 codec contract passed.");
} finally {rmSync(out,{recursive:true,force:true})}
