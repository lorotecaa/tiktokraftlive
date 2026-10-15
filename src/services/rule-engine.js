import { presetCommands, presetEffect } from "../action-preset-catalog.js";

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

function placeholder(value) {
  return String(value || "")
    .replace(/[\r\n\0]/g, " ")
    .replace(/[{}]/g, "")
    .slice(0, 80);
}

export class RuleEngine {
  constructor({ sendCommand, onActivity, getMinecraftVersion = () => "", isMappingActive = () => true }) {
    this.sendCommand = sendCommand;
    this.onActivity = onActivity;
    this.getMinecraftVersion = getMinecraftVersion;
    this.isMappingActive = isMappingActive;
    this.cooldowns = new Map();
    this.scheduled = new Set();
    this.activePulses = new Set();
  }

  dispose() {
    for (const timer of this.scheduled) clearTimeout(timer);
    this.scheduled.clear();
    this.activePulses.clear();
  }

  schedulePresetPulses(mapping, event, effect, context) {
    const { durationMs, pulseMs, pulseCommands } = effect;
    if (!Array.isArray(pulseCommands) || !pulseCommands.length || !Number.isInteger(durationMs) || !Number.isInteger(pulseMs) || durationMs <= pulseMs || pulseMs < 100) return;
    const startedAt = Date.now();
    const total = Math.min(40, Math.ceil(durationMs / pulseMs));
    this.activePulses.add(mapping.id);
    const schedule = (index) => {
      if (index >= total) { this.activePulses.delete(mapping.id); return; }
      const timer = setTimeout(() => {
        this.scheduled.delete(timer);
        if (!this.isMappingActive(mapping)) { this.activePulses.delete(mapping.id); return; }
        const step = Math.max(index, Math.floor((Date.now() - startedAt) / pulseMs));
        if (step >= total) { this.activePulses.delete(mapping.id); return; }
        const command = this.render(pulseCommands[step % pulseCommands.length], event);
        try {
          this.sendCommand(command, { event, mappingId: mapping.id, ...context });
          schedule(step + 1);
        } catch (error) {
          this.activePulses.delete(mapping.id);
          this.onActivity({ type: "error", event, mapping, message: `Preajuste interrumpido: ${error.message}` });
        }
      }, Math.max(0, startedAt + index * pulseMs - Date.now()));
      timer.unref?.();
      this.scheduled.add(timer);
    };
    schedule(1);
  }

  render(command, event) {
    const variables = {
      "{usuario}": placeholder(event.username),
      "{apodo}": placeholder(event.nickname),
      "{regalo}": placeholder(event.giftName),
      "{regalo_id}": placeholder(event.giftId),
      "{cantidad}": String(Math.max(1, Number(event.repeatCount) || 1)),
      "{evento}": placeholder(event.eventName || event.triggerType || "regalo")
    };
    return Object.entries(variables).reduce(
      (output, [token, value]) => output.replaceAll(token, value),
      command
    );
  }

  matches(mapping, event) {
    if (!mapping.enabled || (mapping.triggerType || "gift") !== "gift") return false;
    const idMatches = mapping.giftId && String(mapping.giftId) === String(event.giftId);
    const nameMatches = mapping.giftName && normalize(mapping.giftName) === normalize(event.giftName);
    return Boolean(idMatches || nameMatches);
  }

  execute(mapping, event, { context = {}, message = "Acción ejecutada" } = {}) {
    const selected = mapping.source === "preset" && mapping.presetEffectId ? presetEffect(mapping.presetPackId, mapping.presetEffectId) : null;
    if (selected?.effect.pulseCommands?.length && this.activePulses.has(mapping.id)) return null;
    const rawCommands = selected
      ? presetCommands(mapping.presetPackId, mapping.presetEffectId, this.getMinecraftVersion())
      : mapping.command ? [mapping.command] : [];
    const commands = rawCommands.map((raw) => this.render(raw, event));
    for (const command of commands) this.sendCommand(command, { event, mappingId: mapping.id, ...context });
    if (selected) this.schedulePresetPulses(mapping, event, selected.effect, context);
    const command = commands.join(" | ");
    this.onActivity({ type: "action", event, mapping, command, message });
    return command;
  }

  executeSelected(mapping, event, options = {}) {
    if (!mapping?.enabled) throw new Error("La acción seleccionada está desactivada.");
    if (!mapping.command && !mapping.audio && !mapping.video) throw new Error("La acción seleccionada no tiene ninguna salida configurada.");
    const actionEvent = { ...event, repeatCount: 1 };
    const command = this.execute(mapping, actionEvent, options);
    return { executed: command === null ? 0 : 1, command: command || "" };
  }

  processInteraction(triggerType, event, mappings) {
    const now = Date.now();
    const matches = mappings.filter((mapping) => mapping.enabled && mapping.triggerType === triggerType);
    let executed = 0;
    for (const mapping of matches) {
      const lastRun = this.cooldowns.get(mapping.id) || 0;
      if (now - lastRun < mapping.cooldownMs) {
        this.onActivity({ type: "cooldown", event, mapping, message: "Acción omitida por enfriamiento" });
        continue;
      }
      this.cooldowns.set(mapping.id, now);
      this.execute(mapping, event, { message: "Acción de interacción ejecutada" });
      executed += 1;
    }
    return { matched: matches.length, executed };
  }

  process(event, mappings) {
    const now = Date.now();
    const matches = mappings.filter((mapping) => this.matches(mapping, event));
    if (matches.length === 0) {
      this.onActivity({ type: "gift-unmapped", event, message: "Regalo recibido, sin acción asignada" });
      return { matched: 0, executed: 0 };
    }

    let executed = 0;
    const units = Math.max(1, Number(event.repeatCount) || 1);
    for (const mapping of matches) {
      const lastRun = this.cooldowns.get(mapping.id) || 0;
      if (now - lastRun < mapping.cooldownMs) {
        this.onActivity({ type: "cooldown", event, mapping, message: "Acción omitida por enfriamiento" });
        continue;
      }
      this.cooldowns.set(mapping.id, now);
      for (let unit = 0; unit < units; unit += 1) {
        const actionEvent = units === 1 ? event : { ...event, repeatCount: 1 };
        try {
          const command = this.execute(mapping, actionEvent, { message: "Acción de regalo ejecutada" });
          if (command === null) continue;
        } catch (error) {
          if (mapping.source !== "preset") throw error;
          this.onActivity({ type: "error", event: actionEvent, mapping, message: `Preajuste omitido: ${error.message}` });
          break;
        }
        executed += 1;
      }
    }
    return { matched: matches.length, executed };
  }
}
