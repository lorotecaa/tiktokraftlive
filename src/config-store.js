import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const directory = path.dirname(fileURLToPath(import.meta.url));
const dataDirectory = path.resolve(directory, "../data");
const settingsPath = path.join(dataDirectory, "settings.json");
const soundsDirectory = path.join(directory, "public", "sounds");
const audioExtensions = new Set([".aac", ".m4a", ".mp3", ".ogg", ".wav", ".webm"]);
const ttsLanguages = new Set(["es-CO", "es-ES", "en-US", "pt-BR"]);

const defaultConfig = {
  tiktokUsername: "",
  eulerStreamApiKey: "",
  serverTap: {
    url: "http://127.0.0.1:4567",
    key: ""
  },
  tts: {
    enabled: false,
    language: "es-CO",
    volume: 1,
    allowedUsers: {
      allUsers: true,
      followers: false,
      subscribers: false,
      moderators: false,
      teamMembers: false,
      teamMembersMinLevel: 1,
      topGifters: false,
      topGiftersTop: 3,
      listEnabled: false,
      usernames: []
    }
  },
  mappings: [
    {
      id: "rose",
      enabled: true,
      giftId: "5655",
      giftName: "Rosa",
      command: "say Gracias {usuario} por {cantidad} {regalo}!",
      audio: "",
      cooldownMs: 0
    },
    {
      id: "heart-me",
      enabled: false,
      giftId: "",
      giftName: "Corazón",
      command: "effect give @a minecraft:regeneration 5 1 true",
      audio: "",
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
  const audio = stringOrEmpty(mapping?.audio).replace(/[\\/\0]/g, "").slice(0, 160);
  return {
    id: stringOrEmpty(mapping?.id) || `rule-${Date.now()}-${index}`,
    enabled: mapping?.enabled !== false,
    giftId: stringOrEmpty(mapping?.giftId),
    giftName: stringOrEmpty(mapping?.giftName),
    command: command.slice(0, 256),
    audio,
    cooldownMs: Math.max(0, Math.min(Number(mapping?.cooldownMs) || 0, 3_600_000))
  };
}

function normalizeTts(raw) {
  const language = stringOrEmpty(raw?.language);
  const volume = Number(raw?.volume);
  const allowed = raw?.allowedUsers || {};
  const usernames = Array.isArray(allowed.usernames) ? allowed.usernames : [];
  return {
    enabled: raw?.enabled === true,
    language: ttsLanguages.has(language) ? language : defaultConfig.tts.language,
    volume: Number.isFinite(volume) ? Math.max(0, Math.min(volume, 1)) : defaultConfig.tts.volume,
    allowedUsers: {
      allUsers: allowed.allUsers !== false,
      followers: allowed.followers === true,
      subscribers: allowed.subscribers === true,
      moderators: allowed.moderators === true,
      teamMembers: allowed.teamMembers === true,
      teamMembersMinLevel: Math.max(1, Math.min(Number(allowed.teamMembersMinLevel) || 1, 100)),
      topGifters: allowed.topGifters === true,
      topGiftersTop: Math.max(1, Math.min(Number(allowed.topGiftersTop) || 3, 100)),
      listEnabled: allowed.listEnabled === true,
      usernames: [...new Set(usernames
        .map((value) => stringOrEmpty(value).replace(/^@/, "").toLocaleLowerCase())
        .filter(Boolean))].slice(0, 500)
    }
  };
}

export async function listAvailableSounds() {
  try {
    const entries = await fs.readdir(soundsDirectory, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && audioExtensions.has(path.extname(entry.name).toLowerCase()))
      .map((entry) => entry.name)
      .sort((left, right) => left.localeCompare(right, "es"));
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
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
    tts: normalizeTts(raw.tts),
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
