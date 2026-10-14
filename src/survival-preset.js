import { readFileSync } from "node:fs";

export const survivalPreset = Object.freeze(JSON.parse(readFileSync(new URL("./public/survival-preset.json", import.meta.url), "utf8")));

export function survivalEffect(effectId) {
  return survivalPreset.effects.find((effect) => effect.id === effectId) || null;
}

export function parseMinecraftVersion(value) {
  const raw = String(value || "");
  const match = raw.match(/\bMC:\s*(\d+)\.(\d+)(?:\.(\d+))?\b/i) || raw.match(/\b(\d+)\.(\d+)(?:\.(\d+))?\b/);
  return match ? [Number(match[1]), Number(match[2]), Number(match[3] || 0)] : null;
}

export function minecraftVersionAtLeast(version, major, minor, patch = 0) {
  const parts = parseMinecraftVersion(version);
  if (!parts) return false;
  return parts[0] > major || (parts[0] === major && (parts[1] > minor || (parts[1] === minor && parts[2] >= patch)));
}

export function survivalCommands(effectId, version, random = Math.random) {
  const effect = survivalEffect(effectId);
  if (!effect) return [];
  if (effect.minimumVersion) {
    const [major, minor, patch] = parseMinecraftVersion(effect.minimumVersion);
    if (!minecraftVersionAtLeast(version, major, minor, patch)) throw new Error(`${effect.title} requiere Minecraft Java ${effect.minimumVersion} o posterior.`);
  }
  if (effectId === "infinity-bow") {
    if (!parseMinecraftVersion(version)) throw new Error("No se pudo detectar la versión de Minecraft desde ServerTap para crear el Arco Infinito.");
    if (!minecraftVersionAtLeast(version, 1, 20, 5)) return ['give @a minecraft:bow{Enchantments:[{id:"minecraft:infinity",lvl:1s}]} 1'];
  }
  let variants = effect.variants;
  if (["random-sword", "random-armor"].includes(effectId) && !minecraftVersionAtLeast(version, 1, 16)) variants = variants.slice(0, 2);
  if (effectId === "random-boss") variants = variants.filter((variant) =>
    (!variant.some((command) => command.includes("minecraft:warden")) || minecraftVersionAtLeast(version, 1, 19)) &&
    (!variant.some((command) => command.includes("minecraft:ravager")) || minecraftVersionAtLeast(version, 1, 14))
  );
  const index = Math.min(variants.length - 1, Math.max(0, Math.floor(random() * variants.length)));
  return variants[index] || [];
}
