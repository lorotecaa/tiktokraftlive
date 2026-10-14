import { survivalCommands } from "../survival-preset.js";

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
  constructor({ sendCommand, onActivity, getMinecraftVersion = () => "" }) {
    this.sendCommand = sendCommand;
    this.onActivity = onActivity;
    this.getMinecraftVersion = getMinecraftVersion;
    this.cooldowns = new Map();
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
    const rawCommands = mapping.source === "preset" && mapping.presetPackId === "survival" && mapping.presetEffectId
      ? survivalCommands(mapping.presetEffectId, this.getMinecraftVersion())
      : mapping.command ? [mapping.command] : [];
    const commands = rawCommands.map((raw) => this.render(raw, event));
    for (const command of commands) this.sendCommand(command, { event, mappingId: mapping.id, ...context });
    const command = commands.join(" | ");
    this.onActivity({ type: "action", event, mapping, command, message });
    return command;
  }

  executeSelected(mapping, event, options = {}) {
    if (!mapping?.enabled) throw new Error("La acción seleccionada está desactivada.");
    if (!mapping.command && !mapping.audio && !mapping.video) throw new Error("La acción seleccionada no tiene ninguna salida configurada.");
    const actionEvent = { ...event, repeatCount: 1 };
    const command = this.execute(mapping, actionEvent, options);
    return { executed: 1, command };
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
          this.execute(mapping, actionEvent, { message: "Acción de regalo ejecutada" });
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
