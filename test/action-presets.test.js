import test from "node:test";
import assert from "node:assert/strict";
import { WorkspaceRuntime } from "../src/workspace-runtime.js";

function workspace(existing = []) {
  const runtime = {
    config: { mappings: existing },
    saved: null,
    async saveNow() {},
    async save(next) { this.saved = next; this.config = next; }
  };
  runtime.saveMappingsBatch = WorkspaceRuntime.prototype.saveMappingsBatch;
  return runtime;
}

function action(giftId, command = "time set day") {
  return { triggerType: "gift", giftId, giftName: `Regalo ${giftId}`, command, enabled: true };
}

test("guarda un paquete sin reemplazar las acciones existentes", async () => {
  const original = { id: "original", triggerType: "gift", giftId: "1", giftName: "Rosa", command: "say hola" };
  const runtime = workspace([original]);
  const created = await runtime.saveMappingsBatch([action("2"), action("3", "weather clear")]);
  assert.equal(created.length, 2);
  assert.equal(runtime.saved.mappings.length, 3);
  assert.deepEqual(runtime.saved.mappings[0], original);
  assert.notEqual(created[0].id, created[1].id);
  assert.ok(created.every((item) => item.enabled && !item.audio && !item.video));
});

test("rechaza regalos repetidos antes de guardar", async () => {
  const runtime = workspace();
  await assert.rejects(runtime.saveMappingsBatch([action("2"), action("2")]), /distinto/);
  assert.equal(runtime.saved, null);
});

test("rechaza paquetes sin comando o sin regalo", async () => {
  const runtime = workspace();
  await assert.rejects(runtime.saveMappingsBatch([action("2", "")]), /comando/);
  await assert.rejects(runtime.saveMappingsBatch([{ triggerType: "gift", command: "time set day" }]), /regalo/);
  assert.equal(runtime.saved, null);
});
