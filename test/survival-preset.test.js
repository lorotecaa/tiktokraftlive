import test from "node:test";
import assert from "node:assert/strict";
import { survivalPreset, survivalEffect, survivalCommands, parseMinecraftVersion } from "../src/survival-preset.js";
import { RuleEngine } from "../src/services/rule-engine.js";
import { WorkspaceRuntime } from "../src/workspace-runtime.js";
import { sanitizeConfig } from "../src/config-store.js";

test("las 24 opciones de supervivencia tienen comandos seguros y nombres únicos", () => {
  assert.equal(survivalPreset.effects.length, 24);
  assert.equal(new Set(survivalPreset.effects.map((effect) => effect.id)).size, 24);
  for (const effect of survivalPreset.effects) {
    assert.ok(effect.title && effect.variants.length);
    assert.ok(survivalCommands(effect.id, "1.21.5").length);
    for (const variant of effect.variants) for (const command of variant) {
      assert.ok(command.length > 0 && command.length <= 256);
      assert.doesNotMatch(command, /[\r\n\0]/);
    }
  }
});

test("ServerTap determina la sintaxis del arco y evita entidades inexistentes", () => {
  assert.deepEqual(parseMinecraftVersion("git-Paper-89 (MC: 1.20.4)"), [1, 20, 4]);
  assert.match(survivalCommands("infinity-bow", "1.20.4")[0], /Enchantments:/);
  assert.match(survivalCommands("infinity-bow", "1.20.5")[0], /\[minecraft:enchantments=/);
  assert.match(survivalCommands("infinity-bow", "1.21.5")[0], /\[minecraft:enchantments=/);
  assert.throws(() => survivalCommands("warden", "1.18.2"), /1\.19/);
  assert.match(survivalCommands("warden", "1.19.4")[0], /minecraft:warden/);
  assert.ok(!survivalCommands("random-boss", "1.18.2", () => 0.5).some((command) => command.includes("minecraft:warden")));
});

test("cada disparo elige una variante aleatoria y ejecuta secuencias completas", () => {
  const sent = [];
  const engine = new RuleEngine({ sendCommand: (command) => sent.push(command), onActivity: () => {}, getMinecraftVersion: () => "1.21.5" });
  const mapping = { id: "bees", enabled: true, source: "preset", presetPackId: "survival", presetEffectId: "bees", command: survivalEffect("bees").variants[0][0] };
  engine.executeSelected(mapping, { giftName: "Rosa", repeatCount: 1 });
  assert.equal(sent.length, 3);
  assert.ok(sent.every((command) => command.includes("minecraft:bee")));
});

test("un efecto incompatible no interrumpe otras acciones asignadas al mismo regalo", () => {
  const sent = [];
  const activity = [];
  const engine = new RuleEngine({ sendCommand: (command) => sent.push(command), onActivity: (entry) => activity.push(entry), getMinecraftVersion: () => "1.18.2" });
  const gift = { giftId: "1", giftName: "Rosa", repeatCount: 1 };
  const result = engine.process(gift, [
    { id: "warden", enabled: true, triggerType: "gift", giftId: "1", giftName: "Rosa", source: "preset", presetPackId: "survival", presetEffectId: "warden", command: "summon minecraft:warden ~ ~ ~", cooldownMs: 0 },
    { id: "cmd", enabled: true, triggerType: "gift", giftId: "1", giftName: "Rosa", source: "command", command: "say hola", cooldownMs: 0 }
  ]);
  assert.equal(result.executed, 1);
  assert.deepEqual(sent, ["say hola"]);
  assert.ok(activity.some((entry) => entry.type === "error" && entry.message.includes("1.19")));
});

test("asignar un regalo activa solo esa opción, sin crear las otras 23", async () => {
  const runtime = {
    config: { mappings: [{ id: "cmd", source: "command", command: "say hola" }] },
    async saveNow() {},
    async save(next) { this.config = next; }
  };
  runtime.saveSurvivalEffect = WorkspaceRuntime.prototype.saveSurvivalEffect;
  const first = await runtime.saveSurvivalEffect({ effectId: "creeper", giftId: "5655", giftName: "Rosa" });
  assert.equal(runtime.config.mappings.length, 2);
  assert.equal(first.source, "preset");
  assert.equal(first.presetEffectId, "creeper");
  assert.equal(sanitizeConfig({ mappings: runtime.config.mappings }).mappings[1].presetEffectId, "creeper");
  const changed = await runtime.saveSurvivalEffect({ effectId: "creeper", giftId: "999", giftName: "Nuevo" });
  assert.equal(runtime.config.mappings.length, 2);
  assert.equal(changed.id, first.id);
  assert.equal(changed.giftId, "999");
  await assert.rejects(runtime.saveSurvivalEffect({ effectId: "inexistente", giftId: "1" }), /no existe/);
});
