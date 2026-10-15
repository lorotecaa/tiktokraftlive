import { readFileSync } from "node:fs";
import { minecraftVersionAtLeast, parseMinecraftVersion, survivalCommands } from "./survival-preset.js";
export const actionPresetCatalog = Object.freeze(JSON.parse(readFileSync(new URL("./public/action-preset-catalog.json", import.meta.url), "utf8")));
const presetDetails = new Map(actionPresetCatalog.filter((pack) => pack.effectsPath).map((pack) => [pack.id, JSON.parse(readFileSync(new URL(`./public${pack.effectsPath}`, import.meta.url), "utf8"))]));

export function presetEffect(packId, effectId) {
  const pack = actionPresetCatalog.find((entry) => entry.id === packId);
  if (!pack) return null;
  const effects = presetDetails.get(pack.id)?.effects || pack.effects;
  const effect = effects?.find((entry) => entry.id === effectId);
  return effect ? { pack, effect } : null;
}

export function presetCommands(packId, effectId, version, random = Math.random) {
  if (packId === "survival") return survivalCommands(effectId, version, random);
  const selected = presetEffect(packId, effectId);
  if (!selected) return [];
  const { pack, effect } = selected;
  const minimumVersion = effect.minimumVersion || pack.minimumVersion;
  if (minimumVersion) {
    const minimum = parseMinecraftVersion(minimumVersion);
    if (!parseMinecraftVersion(version)) throw new Error(`No se pudo detectar la versión de Minecraft desde ServerTap para ${effect.title}.`);
    if (!minimum || !minecraftVersionAtLeast(version, ...minimum)) throw new Error(`${effect.title} requiere Minecraft Java ${minimumVersion} o posterior.`);
  }
  if (effect.pulseCommands?.length) return [effect.pulseCommands[0]];
  const variants = effect.variants || [effect.commands || [effect.command]];
  const index = Math.min(variants.length - 1, Math.max(0, Math.floor(random() * variants.length)));
  return variants[index] || [];
}
