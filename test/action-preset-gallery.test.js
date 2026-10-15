import test from "node:test";
import assert from "node:assert/strict";
import { actionPresetCatalog, presetEffect } from "../src/action-preset-catalog.js";
import { WorkspaceRuntime } from "../src/workspace-runtime.js";
import { RuleEngine } from "../src/services/rule-engine.js";

function workspace() {
  return {
    config: { mappings: [] },
    async saveNow() {},
    async save(next) { this.config = next; },
    savePresetEffect: WorkspaceRuntime.prototype.savePresetEffect
  };
}

test("todos los paquetes usan opciones individuales con identificadores únicos", () => {
  assert.deepEqual(actionPresetCatalog.map((pack) => pack.id), ["survival", "world", "challenges"]);
  for (const pack of actionPresetCatalog) {
    const effects = pack.id === "survival" ? Array.from({ length: pack.optionCount }, (_, index) => index) : pack.effects;
    assert.ok(effects.length > 0);
    if (pack.effects) {
      assert.equal(new Set(pack.effects.map((effect) => effect.id)).size, pack.effects.length);
      for (const effect of pack.effects) assert.equal(presetEffect(pack.id, effect.id)?.effect.command, effect.command);
    }
  }
});

test("Mundo cambiante y Retos del LIVE guardan cada opción al asignar regalo", async () => {
  const runtime = workspace();
  for (const pack of actionPresetCatalog.filter((entry) => entry.id !== "survival")) {
    const first = pack.effects[0];
    const saved = await runtime.savePresetEffect({ packId: pack.id, effectId: first.id, giftId: `${pack.id}-1`, giftName: "Rosa" });
    assert.equal(saved.command, first.command);
    assert.equal(saved.presetEffectId, first.id);
    assert.equal(saved.presetGroupId, pack.id);
    assert.equal(runtime.config.mappings.filter((entry) => entry.presetPackId === pack.id).length, 1);
    const changed = await runtime.savePresetEffect({ packId: pack.id, effectId: first.id, giftId: `${pack.id}-2`, giftName: "Nuevo" });
    assert.equal(changed.id, saved.id);
    assert.equal(runtime.config.mappings.filter((entry) => entry.presetPackId === pack.id).length, 1);
    await assert.rejects(runtime.savePresetEffect({ packId: pack.id, effectId: pack.effects[1].id, giftId: `${pack.id}-2`, giftName: "Nuevo" }), /asignado/);
  }
  assert.equal(runtime.config.mappings.length, 2);
  const sent = [];
  const engine = new RuleEngine({ sendCommand: (command) => sent.push(command), onActivity() {} });
  for (const mapping of runtime.config.mappings) {
    assert.equal(engine.process({ giftId: mapping.giftId, giftName: mapping.giftName, repeatCount: 1 }, [mapping]).executed, 1);
  }
  assert.deepEqual(sent, [actionPresetCatalog[1].effects[0].command, actionPresetCatalog[2].effects[0].command]);
  await assert.rejects(runtime.savePresetEffect({ packId: "unknown", effectId: "day", giftId: "1" }), /no existe/);
});
