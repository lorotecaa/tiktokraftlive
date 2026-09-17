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
  constructor({ sendCommand, onActivity }) {
    this.sendCommand = sendCommand;
    this.onActivity = onActivity;
    this.cooldowns = new Map();
  }

  render(command, event) {
    const variables = {
      "{usuario}": placeholder(event.username),
      "{apodo}": placeholder(event.nickname),
      "{regalo}": placeholder(event.giftName),
      "{regalo_id}": placeholder(event.giftId),
      "{cantidad}": String(Math.max(1, Number(event.repeatCount) || 1))
    };
    return Object.entries(variables).reduce(
      (output, [token, value]) => output.replaceAll(token, value),
      command
    );
  }

  matches(mapping, event) {
    if (!mapping.enabled) return false;
    const idMatches = mapping.giftId && String(mapping.giftId) === String(event.giftId);
    const nameMatches = mapping.giftName && normalize(mapping.giftName) === normalize(event.giftName);
    return Boolean(idMatches || nameMatches);
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
        const command = this.render(mapping.command, actionEvent);
        this.sendCommand(command, { event: actionEvent, mappingId: mapping.id });
        executed += 1;
        this.onActivity({ type: "action", event: actionEvent, mapping, command, message: "Acción enviada a Minecraft" });
      }
    }
    return { matched: matches.length, executed };
  }
}
