import { readFileSync } from "node:fs";
export const actionPresetCatalog = Object.freeze(JSON.parse(readFileSync(new URL("./public/action-preset-catalog.json", import.meta.url), "utf8")));
const presetDetails = new Map(actionPresetCatalog.filter((pack) => pack.effectsPath).map((pack) => [pack.id, JSON.parse(readFileSync(new URL(`./public${pack.effectsPath}`, import.meta.url), "utf8"))]));

export function presetEffect(packId, effectId) {
  const pack = actionPresetCatalog.find((entry) => entry.id === packId);
  if (!pack) return null;
  const effects = presetDetails.get(pack.id)?.effects || pack.effects;
  const effect = effects?.find((entry) => entry.id === effectId);
  return effect ? { pack, effect } : null;
}
