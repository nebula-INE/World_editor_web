import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { renameSync, rmSync } from "node:fs";

const outputDir = ".tmp-stable-id-test";
try {
  execFileSync("npx", [
    "tsc",
    "src/core/models.ts",
    "--target", "ES2020",
    "--module", "commonjs",
    "--lib", "ES2020,DOM",
    "--skipLibCheck",
    "--outDir", outputDir,
  ], { stdio: "inherit" });

  renameSync(outputDir + "/models.js", outputDir + "/models.cjs");
  const require = createRequire(import.meta.url);
  const { stableEntityId, stableRelationId, WorldModel } = require("../" + outputDir + "/models.cjs");
  const vectors = {
    A: "ent_6dcd4ce23d88",
    B: "ent_ae4f281df5a5",
    Alice: "ent_35318264c9a9",
    "東京": "ent_681ee300008e",
    "主人公": "ent_8f07c23f5f99",
    Axral: "ent_2e44e0745152",
  };
  for (const [name, expected] of Object.entries(vectors)) {
    assert.equal(stableEntityId(name), expected, `stableEntityId(${JSON.stringify(name)})`);
  }
  assert.notEqual(stableEntityId("é"), stableEntityId("e\u0301"));
  const sourceRef = { line: 1, text: "A -> B : 友好" };
  const modelA = new WorldModel();
  const a1 = modelA.getOrCreateEntity("A", null, sourceRef);
  const b1 = modelA.getOrCreateEntity("B", null, sourceRef);
  const relationA = modelA.addRelation(a1.id, b1.id, "友好", sourceRef);
  const modelB = new WorldModel();
  const a2 = modelB.getOrCreateEntity("A", null, sourceRef);
  const b2 = modelB.getOrCreateEntity("B", null, sourceRef);
  const relationB = modelB.addRelation(a2.id, b2.id, "友好", sourceRef);
  assert.equal(relationA.id, relationB.id);
  assert.equal(relationA.id, stableRelationId("A->B#0"));
  const duplicate = modelB.addRelation(a2.id, b2.id, "敵対", { line: 2, text: "A -> B : 敵対" });
  assert.notEqual(relationA.id, duplicate.id);
  console.log("Stable Entity and Relation ID vectors passed.");
} finally {
  rmSync(outputDir, { recursive: true, force: true });
}
