import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const directory = path.dirname(fileURLToPath(import.meta.url));
// En producción se puede dirigir la configuración a un disco persistente sin
// cambiar la ruta utilizada durante el desarrollo local.
const configuredDataDirectory = String(process.env.TIKTOKRAFT_DATA_DIR || "").trim();
const dataDirectory = configuredDataDirectory
  ? path.resolve(configuredDataDirectory)
  : path.resolve(directory, "../data");
const settingsPath = path.join(dataDirectory, "settings.json");
function normalizeSupabaseProjectUrl(value) {
  return String(value || "")
    .trim()
    .replace(/\/+$/, "")
    .replace(/\/rest\/v1$/i, "");
}

const supabaseUrl = normalizeSupabaseProjectUrl(process.env.SUPABASE_URL);
const supabaseSecretKey = String(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
const isSupabaseConfigured = Boolean(supabaseUrl && supabaseSecretKey);
const hasPartialSupabaseConfig = Boolean(supabaseUrl || supabaseSecretKey) && !isSupabaseConfigured;
const supabaseConfigId = "tiktokraft-live";
const supabaseConfigTable = "tiktokraft_config";
const soundsDirectory = path.join(directory, "public", "sounds");
const audioExtensions = new Set([".aac", ".m4a", ".mp3", ".ogg", ".wav", ".webm"]);
const ttsLanguages = new Set(["es-CO", "es-ES", "en-US", "pt-BR"]);
const goalTypes = new Set(["likes", "follows", "coins"]);
const overlayFonts = new Set(["Space Grotesk", "DM Mono", "Press Start 2P"]);
const overlayEffects = new Set(["none", "shadow", "glow"]);
let configWriteQueue = Promise.resolve();

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
    speed: 60,
    pitch: 70,
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
  giftOverlays: {
    resetOnNewLive: false,
    bestGift: null,
    bestStreak: null
  },
  overlayCustomizations: {},
  goals: [],
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
  const speed = Number(raw?.speed);
  const pitch = Number(raw?.pitch);
  const allowed = raw?.allowedUsers || {};
  const usernames = Array.isArray(allowed.usernames) ? allowed.usernames : [];
  return {
    enabled: raw?.enabled === true,
    language: ttsLanguages.has(language) ? language : defaultConfig.tts.language,
    volume: Number.isFinite(volume) ? Math.max(0, Math.min(volume, 1)) : defaultConfig.tts.volume,
    speed: Number.isFinite(speed) ? Math.max(1, Math.min(Math.round(speed), 100)) : defaultConfig.tts.speed,
    pitch: Number.isFinite(pitch) ? Math.max(1, Math.min(Math.round(pitch), 100)) : defaultConfig.tts.pitch,
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

function normalizeGoal(goal, index) {
  const type = stringOrEmpty(goal?.type).toLocaleLowerCase();
  if (!goalTypes.has(type)) return null;
  const requestedTarget = Math.floor(Number(goal?.target) || 0);
  if (requestedTarget < 1) return null;
  const target = Math.min(requestedTarget, 1_000_000_000);
  return {
    id: stringOrEmpty(goal?.id).replace(/[^a-zA-Z0-9-]/g, "").slice(0, 80) || `goal-${type}-${Date.now()}-${index}`,
    type,
    name: stringOrEmpty(goal?.name).slice(0, 80) || ({ likes: "Likes", follows: "Follows", coins: "Coins Earned" })[type],
    target,
    current: Math.max(0, Math.min(Math.floor(Number(goal?.current) || 0), 1_000_000_000)),
    enabled: goal?.enabled !== false
  };
}

function normalizeGiftOverlayRecord(record) {
  if (!record || typeof record !== "object") return null;
  const giftName = stringOrEmpty(record.giftName).slice(0, 80);
  if (!giftName) return null;
  return {
    giftId: stringOrEmpty(record.giftId).slice(0, 80),
    giftName,
    giftImageUrl: stringOrEmpty(record.giftImageUrl).slice(0, 2_048),
    username: stringOrEmpty(record.username).slice(0, 80),
    nickname: stringOrEmpty(record.nickname).slice(0, 80),
    coins: Math.max(0, Math.min(Math.floor(Number(record.coins) || 0), 1_000_000_000)),
    repeatCount: Math.max(1, Math.min(Math.floor(Number(record.repeatCount) || 1), 1_000_000)),
    at: Math.max(0, Math.floor(Number(record.at) || 0))
  };
}

function normalizeGiftOverlays(raw) {
  return {
    resetOnNewLive: raw?.resetOnNewLive === true,
    bestGift: normalizeGiftOverlayRecord(raw?.bestGift),
    bestStreak: normalizeGiftOverlayRecord(raw?.bestStreak)
  };
}

function normalizeColor(value, fallback) {
  const color = stringOrEmpty(value);
  return /^#[0-9a-f]{6}$/i.test(color) ? color : fallback;
}

function normalizeOverlayCustomization(raw = {}) {
  const fontFamily = stringOrEmpty(raw.fontFamily);
  const textEffect = stringOrEmpty(raw.textEffect);
  const letterSpacing = Number(raw.letterSpacing);
  const giftImageOpacity = Number(raw.giftImageOpacity);
  return {
    fontFamily: overlayFonts.has(fontFamily) ? fontFamily : "Space Grotesk",
    fontSize: Math.max(40, Math.min(Math.round(Number(raw.fontSize) || 75), 150)),
    lineSpacing: Math.max(30, Math.min(Math.round(Number(raw.lineSpacing) || 55), 100)),
    letterSpacing: Number.isFinite(letterSpacing) ? Math.max(0, Math.min(Math.round(letterSpacing), 100)) : 50,
    textColor: normalizeColor(raw.textColor, "#d9d9d9"),
    valueColor: normalizeColor(raw.valueColor, "#ffd84a"),
    rankColor: normalizeColor(raw.rankColor, "#d9d9d9"),
    textEffect: overlayEffects.has(textEffect) ? textEffect : "none",
    waveAnimation: raw.waveAnimation === true,
    showBackground: raw.showBackground === true,
    backgroundColor: stringOrEmpty(raw.backgroundColor).slice(0, 80) || "rgba(33, 33, 33, 0.4)",
    showRank: raw.showRank !== false,
    showValue: raw.showValue !== false,
    alignRight: raw.alignRight === true,
    showCrown: raw.showCrown !== false,
    title: stringOrEmpty(raw.title).slice(0, 80),
    titleSize: Math.max(12, Math.min(Math.round(Number(raw.titleSize) || 32), 100)),
    titleColor: normalizeColor(raw.titleColor, "#d9d9d9"),
    usernameColor: normalizeColor(raw.usernameColor, "#ffffff"),
    usernameSize: Math.max(12, Math.min(Math.round(Number(raw.usernameSize) || 40), 120)),
    titleVerticalOffset: Math.max(-200, Math.min(Math.round(Number(raw.titleVerticalOffset) || 0), 200)),
    giftVerticalOffset: Math.max(-200, Math.min(Math.round(Number(raw.giftVerticalOffset) || 0), 200)),
    usernameVerticalOffset: Math.max(-200, Math.min(Math.round(Number(raw.usernameVerticalOffset) || 0), 200)),
    coinsVerticalOffset: Math.max(-200, Math.min(Math.round(Number(raw.coinsVerticalOffset) || 0), 200)),
    enableFontBorder: raw.enableFontBorder === true,
    borderColor: normalizeColor(raw.borderColor, "#242424"),
    giftImageVisible: raw.giftImageVisible !== false,
    giftImageOpacity: Number.isFinite(giftImageOpacity) ? Math.max(0, Math.min(Math.round(giftImageOpacity), 100)) : 90,
    titleTextEffect: overlayEffects.has(stringOrEmpty(raw.titleTextEffect)) ? stringOrEmpty(raw.titleTextEffect) : "none",
    titleWaveAnimation: raw.titleWaveAnimation === true,
    usernameTextEffect: overlayEffects.has(stringOrEmpty(raw.usernameTextEffect)) ? stringOrEmpty(raw.usernameTextEffect) : "none",
    usernameWaveAnimation: raw.usernameWaveAnimation === true,
    coinsAlias: stringOrEmpty(raw.coinsAlias).slice(0, 30) || "coins"
  };
}

function normalizeOverlayCustomizations(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return Object.fromEntries(Object.entries(raw)
    .filter(([key]) => /^(gift:(best-gift|best-streak)|ranking:top-donors|goal:[a-zA-Z0-9-]{1,80})$/.test(key))
    .slice(0, 100)
    .map(([key, value]) => [key, normalizeOverlayCustomization(value)]));
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
  const goals = Array.isArray(raw.goals) ? raw.goals : defaultConfig.goals;
  const normalizedGoals = goals.map(normalizeGoal).filter(Boolean);
  return {
    tiktokUsername: stringOrEmpty(raw.tiktokUsername).replace(/^@/, "").slice(0, 80),
    eulerStreamApiKey: stringOrEmpty(raw.eulerStreamApiKey),
    serverTap: {
      url: stringOrEmpty(raw.serverTap?.url || defaultConfig.serverTap.url).replace(/\/$/, ""),
      key: stringOrEmpty(raw.serverTap?.key)
    },
    tts: normalizeTts(raw.tts),
    giftOverlays: normalizeGiftOverlays(raw.giftOverlays),
    overlayCustomizations: normalizeOverlayCustomizations(raw.overlayCustomizations),
    goals: normalizedGoals.filter((goal, index) => normalizedGoals.findIndex((item) => item.type === goal.type) === index),
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

async function loadFileConfig() {
  try {
    return JSON.parse(await fs.readFile(settingsPath, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.warn("No se pudo leer la configuración; se usarán valores iniciales.", error.message);
    }
    return null;
  }
}

async function saveFileConfig(content) {
  await fs.mkdir(dataDirectory, { recursive: true });
  const temporaryPath = `${settingsPath}.${process.pid}.tmp`;
  const handle = await fs.open(temporaryPath, "w");
  try {
    await handle.writeFile(content, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
  await fs.rename(temporaryPath, settingsPath);
}

function supabaseHeaders(extra = {}) {
  return {
    apikey: supabaseSecretKey,
    Authorization: `Bearer ${supabaseSecretKey}`,
    "Accept-Profile": "public",
    ...extra
  };
}

async function loadSupabaseConfig() {
  const endpoint = `${supabaseUrl}/rest/v1/${supabaseConfigTable}?id=eq.${encodeURIComponent(supabaseConfigId)}&select=config`;
  const response = await fetch(endpoint, { headers: supabaseHeaders() });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Supabase no pudo cargar la configuración (${response.status})${detail ? `: ${detail}` : ""}`);
  }
  const rows = await response.json();
  return rows[0]?.config && typeof rows[0].config === "object" ? rows[0].config : null;
}

async function saveSupabaseConfig(config) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${supabaseConfigTable}?on_conflict=id`, {
    method: "POST",
    headers: supabaseHeaders({
      "Content-Type": "application/json",
      "Content-Profile": "public",
      Prefer: "resolution=merge-duplicates,return=minimal"
    }),
    body: JSON.stringify({ id: supabaseConfigId, config, updated_at: new Date().toISOString() })
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Supabase no pudo guardar la configuración (${response.status})${detail ? `: ${detail}` : ""}`);
  }
}

export async function loadConfig() {
  if (hasPartialSupabaseConfig) {
    throw new Error("Configura SUPABASE_URL y SUPABASE_SECRET_KEY juntos, o elimina ambas variables.");
  }
  if (isSupabaseConfigured) {
    const remoteConfig = await loadSupabaseConfig();
    if (remoteConfig) return sanitizeConfig(remoteConfig);

    // Migra automáticamente la configuración que exista en la instancia al
    // activar Supabase por primera vez.
    const localConfig = await loadFileConfig();
    if (localConfig) {
      const sanitized = sanitizeConfig(localConfig);
      await saveSupabaseConfig(sanitized);
      return sanitized;
    }
    return clone(defaultConfig);
  }

  const localConfig = await loadFileConfig();
  return localConfig ? sanitizeConfig(localConfig) : clone(defaultConfig);
}

export async function saveConfig(config) {
  const sanitized = sanitizeConfig(config);
  const write = configWriteQueue.then(async () => {
    if (isSupabaseConfigured) {
      await saveSupabaseConfig(sanitized);
      return;
    }
    await saveFileConfig(`${JSON.stringify(sanitized, null, 2)}\n`);
  });
  // Mantiene la cola utilizable después de un error, pero propaga el error al
  // botón Guardar para que no confirme una edición que no se escribió.
  configWriteQueue = write.catch(() => {});
  await write;
  return sanitized;
}
