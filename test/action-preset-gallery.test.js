import test from "node:test";
import assert from "node:assert/strict";
import { actionPresetCatalog, presetCommands, presetEffect } from "../src/action-preset-catalog.js";
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
  assert.deepEqual(actionPresetCatalog.map((pack) => pack.id), ["survival", "diamond-challenge", "challenges"]);
  for (const pack of actionPresetCatalog) {
    const effects = pack.effects || (pack.id === "diamond-challenge" ? diamondEffects() : Array.from({ length: pack.optionCount }, (_, index) => index));
    assert.ok(effects.length > 0);
    if (pack.effects || pack.id === "diamond-challenge") {
      assert.equal(new Set(effects.map((effect) => effect.id)).size, effects.length);
      for (const effect of effects) assert.equal(presetEffect(pack.id, effect.id)?.effect.command, effect.command);
    }
  }
});

function diamondEffects() {
  return ["give-5", "give-20", "give-100", "give-1500", "ore-rain-3", "ore-rain-10", "remove-15", "remove-120", "remove-500", "remove-1500", "remove-3000", "remove-9999", "death-ray", "tnt-rain", "creeper", "zombie", "skeleton", "spider", "wither-skeleton", "ravager", "guardian", "elder-guardian", "wither-boss", "immortal-boss"].map((id) => presetEffect("diamond-challenge", id)?.effect);
}

test("DIAMOND CHALLENGE contiene las 24 acciones de la referencia y respeta ServerTap", () => {
  const effects = diamondEffects();
  assert.equal(effects.length, 24);
  assert.ok(effects.every(Boolean));
  for (const effect of effects) {
    assert.ok(effect.command && effect.command.length <= 256);
    assert.doesNotMatch(effect.command, /[\r\n\0]/);
    assert.ok(presetCommands("diamond-challenge", effect.id, "1.21.5").length);
  }
  assert.throws(() => presetCommands("diamond-challenge", "give-5", "1.12.2"), /1\.13/);
  assert.throws(() => presetCommands("diamond-challenge", "give-5", ""), /detectar la versión/);
  assert.throws(() => presetCommands("diamond-challenge", "ravager", "1.13.2"), /1\.14/);
  assert.match(presetCommands("diamond-challenge", "immortal-boss", "26.3")[0], /Invulnerable:1b/);
  assert.equal(presetEffect("diamond-challenge", "ore-rain-3").effect.durationMs, 3000);
  assert.equal(presetEffect("diamond-challenge", "ore-rain-10").effect.durationMs, 10000);
});

test("DIAMOND CHALLENGE y Retos del LIVE guardan cada opción al asignar regalo", async () => {
  const runtime = workspace();
  for (const pack of actionPresetCatalog.filter((entry) => entry.id !== "survival")) {
    const entries = pack.effects || diamondEffects();
    const first = entries[0];
    const saved = await runtime.savePresetEffect({ packId: pack.id, effectId: first.id, giftId: `${pack.id}-1`, giftName: "Rosa" });
    assert.equal(saved.command, first.command);
    assert.equal(saved.presetEffectId, first.id);
    assert.equal(saved.presetGroupId, pack.id);
    assert.equal(runtime.config.mappings.filter((entry) => entry.presetPackId === pack.id).length, 1);
    const changed = await runtime.savePresetEffect({ packId: pack.id, effectId: first.id, giftId: `${pack.id}-2`, giftName: "Nuevo" });
    assert.equal(changed.id, saved.id);
    assert.equal(runtime.config.mappings.filter((entry) => entry.presetPackId === pack.id).length, 1);
    await assert.rejects(runtime.savePresetEffect({ packId: pack.id, effectId: entries[1].id, giftId: `${pack.id}-2`, giftName: "Nuevo" }), /asignado/);
  }
  assert.equal(runtime.config.mappings.length, 2);
  const sent = [];
  const engine = new RuleEngine({ sendCommand: (command) => sent.push(command), onActivity() {}, getMinecraftVersion: () => "1.21.5" });
  for (const mapping of runtime.config.mappings) {
    assert.equal(engine.process({ giftId: mapping.giftId, giftName: mapping.giftName, repeatCount: 1 }, [mapping]).executed, 1);
  }
  assert.deepEqual(sent, [diamondEffects()[0].command, actionPresetCatalog[2].effects[0].command]);
  await assert.rejects(runtime.savePresetEffect({ packId: "unknown", effectId: "day", giftId: "1" }), /no existe/);
});

test("las lluvias se programan en el servidor y se cancelan al cerrar la sesión", async () => {
  const runtime = workspace();
  const mapping = await runtime.savePresetEffect({ packId: "diamond-challenge", effectId: "ore-rain-3", giftId: "100", giftName: "Rosa" });
  const sent = [];
  const engine = new RuleEngine({ sendCommand: (command) => sent.push(command), onActivity() {}, getMinecraftVersion: () => "1.21.5" });
  engine.executeSelected(mapping, { giftId: "100", giftName: "Rosa" });
  assert.equal(sent.length, 1);
  assert.equal(engine.scheduled.size, 1);
  assert.equal(engine.executeSelected(mapping, { giftId: "100", giftName: "Rosa" }).executed, 0);
  assert.equal(sent.length, 1);
  engine.dispose();
  assert.equal(engine.scheduled.size, 0);
  assert.equal(engine.activePulses.size, 0);
});
