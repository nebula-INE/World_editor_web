import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { readFileSync, rmSync, writeFileSync } from "node:fs";

const outputDir = ".tmp-stable-id-test";
try {
  execFileSync("npx", [
    "tsc",
    "src/core/models.ts",
    "src/core/events.ts",
    "src/core/project.ts",
    "--target", "ES2020",
    "--module", "commonjs",
    "--lib", "ES2020,DOM",
    "--skipLibCheck",
    "--outDir", outputDir,
  ], { stdio: "inherit" });

  writeFileSync(outputDir + "/package.json", JSON.stringify({ type: "commonjs" }));
  const require = createRequire(import.meta.url);
  const { stableEntityId, stableRelationId, WorldModel } = require("../" + outputDir + "/models.js");
  const { createProject, parseProject } = require("../" + outputDir + "/project.js");
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
  assert.notEqual(stableEntityId("é"), stableEntityId("e\\u0301"));
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

  // Read the same committed JSON fixture as the Desktop codec contract test.
  const golden = JSON.parse(readFileSync(new URL("../tests/fixtures/axral-project-v1.json", import.meta.url), "utf8"));
  const goldenRestored = parseProject(golden);
  assert.equal(goldenRestored.text, golden.text);
  assert.deepEqual(goldenRestored.events, golden.events);
  assert.equal(goldenRestored.events[0].effects[0].target_id, stableRelationId("主人公->東京#0"));
  assert.deepEqual(goldenRestored.graph_positions, golden.graph_positions);
  assert.deepEqual(goldenRestored.timeline, golden.timeline);
  assert.deepEqual(goldenRestored.ignored_candidates, golden.ignored_candidates);

  // Independently exercise the web create/parse round-trip and validation.
  const project = {
    format: "axral-world-project",
    schema_version: 1,
    text: "[主人公:Character]\\n[東京:Location]\\n主人公 -> 東京 : 移動",
    events: [{
      id: "evt_contract_001",
      timestamp: 42,
      type: "移動",
      participants: [stableEntityId("主人公")],
      effects: [{
        kind: "relation_status",
        target_id: stableRelationId("主人公->東京#0"),
        payload: { status: "hypothetical" },
      }],
      is_snapshot_point: true,
      schema_version: 1,
      metadata: { note: "日本語のEvent" },
    }],
    graph_positions: {
      [stableEntityId("主人公")]: { x: 123.5, y: -40 },
      [stableEntityId("東京")]: { x: 600, y: 240 },
    },
    timeline: { mode: true, timestamp: 42, visible_layers: ["Su-ken", "Kan-ken"] },
    ignored_candidates: [[3, "主人公", "東京", "移動"]],
  };
  const restored = parseProject(JSON.parse(JSON.stringify(createProject({
    text: project.text,
    events: project.events,
    graph_positions: project.graph_positions,
    timeline: project.timeline,
    ignored_candidates: project.ignored_candidates,
  }))));
  assert.equal(restored.format, "axral-world-project");
  assert.equal(restored.schema_version, 1);
  assert.equal(restored.text, project.text);
  assert.deepEqual(restored.events, project.events);
  assert.equal(restored.events[0].effects[0].target_id, stableRelationId("主人公->東京#0"));
  assert.deepEqual(restored.graph_positions, project.graph_positions);
  assert.deepEqual(restored.timeline, project.timeline);
  assert.deepEqual(restored.ignored_candidates, project.ignored_candidates);
  assert.throws(() => parseProject({ ...project, schema_version: 2 }));
  assert.throws(() => parseProject({
    ...project,
    graph_positions: { [stableEntityId("主人公")]: { x: Number.NaN, y: 0 } },
  }));
  console.log("Stable IDs and shared Axral project v1 fixture passed.");
} finally {
  rmSync(outputDir, { recursive: true, force: true });
}
