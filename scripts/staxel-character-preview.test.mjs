import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(root, "public", "third-party", "staxel_voxel_female", "source");
const tasklistPath = path.join(root, "docs", "staxel-import-animation-controller-tasklist.md");
const manifestPath = path.join(root, "public", "third-party", "staxel_voxel_female", "intake-manifest.json");

async function sha256(filePath) {
  return createHash("sha256").update(await readFile(filePath)).digest("hex").toUpperCase();
}

test("Staxel preview source retains required rig, clip, and license evidence", async () => {
  const gltf = JSON.parse(await readFile(path.join(source, "scene.gltf"), "utf8"));
  const license = await readFile(path.join(source, "license.txt"), "utf8");
  const attribution = await readFile(path.join(root, "public", "third-party", "staxel_voxel_female", "ATTRIBUTION.md"), "utf8");

  assert.equal(gltf.asset.version, "2.0");
  assert.ok(gltf.nodes.some((node) => node.name === "_rootJoint"));
  assert.equal(gltf.skins.length, 1);
  assert.equal(gltf.skins[0].joints.length, 21);
  assert.ok(gltf.animations.some((animation) => animation.name === "Take 001"));
  assert.match(license, /CC-BY-4\.0/);
  assert.match(license, /andruha1801/);
  assert.match(attribution, /andruha1801/);
  assert.match(attribution, /CC-BY-4\.0/);
});

test("Staxel intake manifest freezes source, rig, presentation exclusions, and unclassified animation evidence", async () => {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const gltf = JSON.parse(await readFile(path.join(source, "scene.gltf"), "utf8"));

  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.source.license, "CC-BY-4.0");
  assert.equal(manifest.source.modificationStatus, "unmodified-source");

  for (const file of manifest.files) {
    const filePath = path.join(root, "public", "third-party", "staxel_voxel_female", file.path);
    const bytes = await readFile(filePath);
    assert.equal(bytes.length, file.bytes, `${file.path} byte length drifted`);
    assert.equal(await sha256(filePath), file.sha256, `${file.path} hash drifted`);
  }

  const skin = gltf.skins[0];
  assert.deepEqual(skin.joints.map((nodeIndex) => gltf.nodes[nodeIndex].name), manifest.gltf.jointNames);
  assert.equal(gltf.nodes.filter((node) => Number.isInteger(node.mesh) && node.skin === 0).length, manifest.gltf.skinnedMeshCount);
  assert.equal(manifest.gltf.skinnedMeshCount, 14);
  assert.deepEqual(manifest.gltf.previewExcludedNodes, ["Plane001_Material #26_0"]);

  const animation = manifest.gltf.animations[0];
  const sourceAnimation = gltf.animations.find((candidate) => candidate.name === animation.sourceName);
  const animatedNodes = new Set(sourceAnimation.channels.map((channel) => channel.target.node));
  const paths = sourceAnimation.channels.reduce(
    (result, channel) => ({ ...result, [channel.target.path]: result[channel.target.path] + 1 }),
    { translation: 0, rotation: 0, scale: 0 },
  );
  assert.equal(animation.sourceName, "Take 001");
  assert.equal(sourceAnimation.channels.length, animation.channelCount);
  assert.equal(animatedNodes.size, animation.animatedJointCount);
  assert.deepEqual(paths, animation.paths);
  assert.deepEqual(new Set(sourceAnimation.samplers.map((sampler) => sampler.interpolation ?? "LINEAR")), new Set([animation.interpolation]));
  assert.equal(animation.semanticClassification, null);
  assert.equal(animation.approval, "preview-only");
  assert.deepEqual(manifest.controller.semanticAnimationBindings, {});
});

test("player presentation activates only for matching server-confirmed session, character, and admission", async () => {
  const contract = await import("../src/characters/playerPresentationContract.ts");
  const controllerSource = await readFile(path.join(root, "src", "characters", "CharacterControllerPreview.ts"), "utf8");
  const base = {
    schemaVersion: 1,
    sequence: 7,
    session: { lifecycle: "authenticated", sessionId: "session-1" },
    activeCharacter: { lifecycle: "active", characterId: "character-1" },
    worldAdmission: {
      lifecycle: "admitted",
      admissionId: "admission-1",
      worldId: "world-1",
      characterId: "character-1",
    },
  };

  assert.deepEqual(contract.derivePlayerPresentationReadiness(base), {
    schemaVersion: 1,
    sequence: 7,
    lifecycle: "ready",
    reason: null,
    worldReady: true,
    sessionId: "session-1",
    characterId: "character-1",
    worldId: "world-1",
    admissionId: "admission-1",
  });

  assert.equal(contract.derivePlayerPresentationReadiness({ ...base, sequence: 0 }).reason, "authority-snapshot-invalid");
  assert.equal(
    contract.derivePlayerPresentationReadiness({
      ...base,
      session: { lifecycle: "anonymous", sessionId: null },
    }).reason,
    "session-unavailable",
  );
  assert.equal(
    contract.derivePlayerPresentationReadiness({
      ...base,
      activeCharacter: { lifecycle: "none", characterId: null },
    }).reason,
    "active-character-unavailable",
  );
  assert.equal(
    contract.derivePlayerPresentationReadiness({
      ...base,
      worldAdmission: { ...base.worldAdmission, lifecycle: "pending" },
    }).reason,
    "world-not-admitted",
  );
  assert.equal(
    contract.derivePlayerPresentationReadiness({
      ...base,
      worldAdmission: { ...base.worldAdmission, characterId: "character-2" },
    }).reason,
    "admitted-character-mismatch",
  );

  const inactiveAuthorities = [
    { ...base, sequence: 0 },
    { ...base, session: { lifecycle: "expired", sessionId: null } },
    { ...base, activeCharacter: { lifecycle: "none", characterId: null } },
    { ...base, worldAdmission: { ...base.worldAdmission, lifecycle: "ended" } },
    { ...base, worldAdmission: { ...base.worldAdmission, characterId: "character-2" } },
  ];

  for (const authority of inactiveAuthorities) {
    const readiness = contract.derivePlayerPresentationReadiness(authority);
    assert.equal(readiness.lifecycle, "inactive");
  }

  // The source-level guard keeps the live factory from reaching the visual
  // controller construction until the derived readiness is ready. Node's
  // TypeScript test loader cannot resolve this Vite module's extensionless
  // Babylon imports, so the runtime matrix above validates the boundary and
  // this assertion validates the factory ordering.
  assert.match(
    controllerSource,
    /const readiness = derivePlayerPresentationReadiness\(authority\);\s+if \(readiness\.lifecycle !== "ready"\) return Object\.freeze\(\{ activated: false, readiness \}\);\s+return Object\.freeze\(\{ activated: true, readiness, presentation: createCharacterControllerPreview\(asset\) \}\);/s,
  );
});

test("the next controller slice preserves the client-only and attribution gates", async () => {
  const tasklist = await readFile(tasklistPath, "utf8");

  assert.match(tasklist, /CC-BY-4\.0/);
  assert.match(tasklist, /andruha1801/);
  assert.match(tasklist, /must not add an account binding, player command, network request, inventory\n+dependency, server contract, or gameplay authority/);
  assert.match(tasklist, /does not authorize\n+the controller to create or alter session, character, admission, input, world,/);
  assert.match(tasklist, /HUD and world consumers must treat the\n+snapshot as display data and dispose presentation on an inactive update/);
});

test("local Gamemaster presence creates one visual per admitted player and disposes stale presentation", async () => {
  const registryModule = await import("../src/characters/LocalGamemasterPlayerPresentationRegistry.ts");
  const spawned = [];
  const disposed = [];
  const registry = registryModule.createLocalGamemasterPlayerPresentationRegistry((presence) => {
    spawned.push(presence.presenceId);
    return { dispose: () => disposed.push(presence.presenceId) };
  });
  const snapshot = (sequence, players) => ({ schemaVersion: 1, sequence, worldId: "world-1", players });
  const ada = { lifecycle: "admitted", presenceId: "presence-ada", characterId: "character-ada", admissionId: "admission-ada" };
  const bo = { lifecycle: "admitted", presenceId: "presence-bo", characterId: "character-bo", admissionId: "admission-bo" };

  assert.deepEqual(registry.apply(snapshot(1, [ada, bo])), {
    applied: true,
    reason: "applied",
    activePresenceIds: ["presence-ada", "presence-bo"],
  });
  assert.deepEqual(spawned, ["presence-ada", "presence-bo"]);
  assert.deepEqual(registry.apply(snapshot(1, [])), {
    applied: false,
    reason: "stale-or-replayed",
    activePresenceIds: ["presence-ada", "presence-bo"],
  });

  assert.deepEqual(registry.apply(snapshot(2, [ada, { lifecycle: "left", presenceId: "presence-bo", characterId: null, admissionId: null }])), {
    applied: true,
    reason: "applied",
    activePresenceIds: ["presence-ada"],
  });
  assert.deepEqual(disposed, ["presence-bo"]);

  assert.deepEqual(registry.apply(snapshot(3, [ada, { ...ada }])), {
    applied: false,
    reason: "snapshot-invalid",
    activePresenceIds: [],
  });
  assert.deepEqual(disposed, ["presence-bo", "presence-ada"]);
  registry.dispose();
  assert.deepEqual(disposed, ["presence-bo", "presence-ada"]);
});
