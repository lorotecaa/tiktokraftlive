import test from "node:test";
import assert from "node:assert/strict";
import { WorkspaceRuntime } from "../src/workspace-runtime.js";
import { sanitizeConfig } from "../src/config-store.js";

function workspace(existing = []) {
  const runtime = {
    config: { mappings: existing },
    saved: null,
    async saveNow() {},
    async save(next) { this.saved = next; this.config = next; }
  };
  runtime.saveMappingsBatch = WorkspaceRuntime.prototype.saveMappingsBatch;
  runtime.deletePresetGroup = WorkspaceRuntime.prototype.deletePresetGroup;
  return runtime;
}

function action(giftId, command = "time set day") {
  return { triggerType: "gift", giftId, giftName: `Regalo ${giftId}`, command, enabled: true };
}

test("guarda un paquete sin reemplazar las acciones existentes", async () => {
  const original = { id: "original", triggerType: "gift", giftId: "1", giftName: "Rosa", command: "say hola" };
  const runtime = workspace([original]);
  const created = await runtime.saveMappingsBatch({ packId: "survival", mappings: [{ ...action("2"), presetEffectTitle: "Día" }, action("3", "weather clear")] });
  assert.equal(created.length, 2);
  assert.equal(runtime.saved.mappings.length, 3);
  assert.deepEqual(runtime.saved.mappings[0], original);
  assert.notEqual(created[0].id, created[1].id);
  assert.ok(created.every((item) => item.enabled && !item.audio && !item.video));
  assert.ok(created.every((item) => item.source === "preset" && item.presetPackId === "survival" && item.presetGroupId === created[0].presetGroupId));
  assert.equal(created[0].presetEffectTitle, "Día");
  assert.equal(sanitizeConfig({ mappings: runtime.saved.mappings }).mappings[1].presetGroupId, created[0].presetGroupId);
});

test("rechaza regalos repetidos antes de guardar", async () => {
  const runtime = workspace();
  await assert.rejects(runtime.saveMappingsBatch({ packId: "survival", mappings: [action("2"), action("2")] }), /distinto/);
  assert.equal(runtime.saved, null);
});

test("rechaza paquetes sin comando o sin regalo", async () => {
  const runtime = workspace();
  await assert.rejects(runtime.saveMappingsBatch({ packId: "survival", mappings: [action("2", "")] }), /comando/);
  await assert.rejects(runtime.saveMappingsBatch({ packId: "survival", mappings: [{ triggerType: "gift", command: "time set day" }] }), /regalo/);
  assert.equal(runtime.saved, null);
});

test("las acciones anteriores permanecen en Minecraft CMD y los paquetes no se mezclan", async () => {
  const runtime = workspace([{ ...action("1"), id: "old" }]);
  const first = await runtime.saveMappingsBatch({ packId: "survival", mappings: [action("2")] });
  const second = await runtime.saveMappingsBatch({ packId: "survival", mappings: [action("3")] });
  const restored = sanitizeConfig({ mappings: runtime.config.mappings }).mappings;
  assert.equal(restored[0].source, "command");
  assert.equal(restored.filter((mapping) => mapping.source === "preset").length, 2);
  assert.notEqual(first[0].presetGroupId, second[0].presetGroupId);
  await runtime.deletePresetGroup(first[0].presetGroupId);
  assert.deepEqual(runtime.config.mappings.map((mapping) => mapping.id), ["old", second[0].id]);
  await assert.rejects(runtime.deletePresetGroup(first[0].presetGroupId), /no existe/);
});
