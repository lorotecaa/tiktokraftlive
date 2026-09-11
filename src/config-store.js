import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const directory = path.dirname(fileURLToPath(import.meta.url));
const dataDirectory = path.resolve(directory, "../data");
const settingsPath = path.join(dataDirectory, "settings.json");

const defaultConfig = {
  tiktokUsername: "",
  eulerStreamApiKey: "",
  serverTap: {
    url: "http://127.0.0.1:4567",
    key: ""
  },
  mappings: [
    {
      id: "rose",
      enabled: true,
      giftId: "5655",
      giftName: "Rosa",
      command: "say Gracias {usuario} por {cantidad} {regalo}!",
      cooldownMs: 0
    },
    {
      id: "heart-me",
      enabled: false,
      giftId: "",
      giftName: "Corazón",
      command: "effect give @a minecraft:regeneration 5 1 true",
      cooldownMs: 3000
    }
  ]
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function stringOrEmpty(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeMapping(mapping, index) {
  const command = stringOrEmpty(mapping?.command).replace(/[\r\n\0]/g, "");
  return {
    id: stringOrEmpty(mapping?.id) || `rule-${Date.now()}-${index}`,
    enabled: mapping?.enabled !== false,
    giftId: stringOrEmpty(mapping?.giftId),
    giftName: stringOrEmpty(mapping?.giftName),
    command: command.slice(0, 256),
    cooldownMs: Math.max(0, Math.min(Number(mapping?.cooldownMs) || 0, 3_600_000))
  };
}

export function sanitizeConfig(raw = {}) {
  const mappings = Array.isArray(raw.mappings) ? raw.mappings : defaultConfig.mappings;
  return {
    tiktokUsername: stringOrEmpty(raw.tiktokUsername).replace(/^@/, "").slice(0, 80),
    eulerStreamApiKey: stringOrEmpty(raw.eulerStreamApiKey),
    serverTap: {
      url: stringOrEmpty(raw.serverTap?.url || defaultConfig.serverTap.url).replace(/\/$/, ""),
      key: stringOrEmpty(raw.serverTap?.key)
    },
    mappings: mappings.map(normalizeMapping).filter((mapping) => mapping.command)
  };
}

export function publicConfig(config) {
  const { eulerStreamApiKey, ...safeConfig } = clone(config);
  return {
    ...safeConfig,
    eulerStreamApiKeyPresent: Boolean(eulerStreamApiKey),
    serverTap: {
      url: config.serverTap.url,
      keyPresent: Boolean(config.serverTap.key)
    }
  };
}

export async function loadConfig() {
  try {
    return sanitizeConfig(JSON.parse(await fs.readFile(settingsPath, "utf8")));
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.warn("No se pudo leer la configuración; se usarán valores iniciales.", error.message);
    }
    return clone(defaultConfig);
  }
}

export async function saveConfig(config) {
  const sanitized = sanitizeConfig(config);
  await fs.mkdir(dataDirectory, { recursive: true });
  const temporaryPath = `${settingsPath}.tmp`;
  await fs.writeFile(temporaryPath, `${JSON.stringify(sanitized, null, 2)}\n`, "utf8");
  await fs.rename(temporaryPath, settingsPath);
  return sanitized;
}
