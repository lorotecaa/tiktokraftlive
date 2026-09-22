import { randomUUID } from "node:crypto";
import { sanitizeConfig } from "./config-store.js";

function projectUrl(value) {
  return String(value || "").trim().replace(/\/+$/, "").replace(/\/rest\/v1$/i, "");
}

const url = projectUrl(process.env.SUPABASE_URL);
const key = String(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

function headers(extra = {}) {
  return { apikey: key, Authorization: `Bearer ${key}`, "Accept-Profile": "public", ...extra };
}

async function request(path, options = {}) {
  const response = await fetch(`${url}/rest/v1/${path}`, options);
  if (!response.ok) {
    const detail = await response.text();
    const error = new Error(`Supabase no pudo acceder al espacio de trabajo (${response.status}).`);
    error.status = response.status;
    error.detail = detail;
    throw error;
  }
  return response;
}

function hasMappings(config) {
  return Array.isArray(config?.mappings) && config.mappings.length > 0;
}

// Compatibilidad con instalaciones cuyo workspace de la primera cuenta se creó
// antes de que PostgREST expusiera la función de reparación. La copia solo se
// permite al propietario histórico y solo llena una lista de mappings vacía.
async function restoreLegacyMappings(ownerId, row) {
  if (hasMappings(row?.config)) return row;

  const stateResponse = await request("tiktokraft_multiuser_state?id=eq.true&select=legacy_owner_id", { headers: headers() });
  const state = (await stateResponse.json())[0];
  if (state?.legacy_owner_id !== ownerId) return row;

  const legacyResponse = await request("tiktokraft_config?id=eq.tiktokraft-live&select=config", { headers: headers() });
  const legacyConfig = (await legacyResponse.json())[0]?.config;
  if (!hasMappings(legacyConfig)) return row;

  const config = sanitizeConfig({ ...row.config, mappings: legacyConfig.mappings });
  await saveWorkspaceConfig(ownerId, config);
  return { ...row, config };
}

async function workspaceByOwnerId(ownerId) {
  const response = await request(`tiktokraft_workspaces?owner_id=eq.${encodeURIComponent(ownerId)}&select=owner_id,config,overlay_token&limit=1`, { headers: headers() });
  return (await response.json())[0] || null;
}

export async function claimWorkspace(ownerId) {
  // Un workspace existente ya es la fuente de verdad. Evitar el RPC aquí
  // impide que una función antigua o una caché de PostgREST reemplace la
  // configuración persistida al abrir una sesión.
  let existing = await workspaceByOwnerId(ownerId);
  if (existing) {
    try {
      existing = await restoreLegacyMappings(ownerId, existing);
    } catch (error) {
      console.warn(`No se pudo comprobar la recuperación de mappings heredados: ${error.message}`);
    }
    return { ownerId: existing.owner_id, config: sanitizeConfig(existing.config), overlayToken: existing.overlay_token };
  }

  const response = await request("rpc/tiktokraft_claim_workspace", {
    method: "POST",
    headers: headers({ "Content-Type": "application/json", "Content-Profile": "public" }),
    body: JSON.stringify({ p_owner_id: ownerId, p_default_config: sanitizeConfig({}), p_overlay_token: `${randomUUID()}${randomUUID()}`.replace(/-/g, "") })
  });
  let row = (await response.json())[0];
  if (!row?.owner_id) throw new Error("Supabase no pudo crear el espacio de trabajo.");
  // La reparación de mappings es una migración de compatibilidad. Nunca debe
  // impedir que una sesión abra su workspace si la función aún no está en la
  // caché de PostgREST durante un despliegue.
  try {
    const repaired = await request("rpc/tiktokraft_reclaim_legacy_mappings", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json", "Content-Profile": "public" }),
      body: JSON.stringify({ p_owner_id: ownerId })
    });
    const repairedConfig = await repaired.json();
    if (repairedConfig && typeof repairedConfig === "object") row = { ...row, config: repairedConfig };
  } catch (error) {
    console.warn(`No se pudo ejecutar la reparación opcional de mappings: ${error.message}`);
  }
  try {
    row = await restoreLegacyMappings(ownerId, row);
  } catch (error) {
    console.warn(`No se pudo comprobar la recuperación de mappings heredados: ${error.message}`);
  }
  // La tabla es la fuente definitiva. No dependemos del objeto devuelto por
  // la RPC, que puede corresponder a una versión anterior de la fila justo
  // después de una migración o una reparación de compatibilidad.
  try {
    row = (await workspaceByOwnerId(ownerId)) || row;
  } catch (error) {
    console.warn(`No se pudo recargar el espacio de trabajo persistido: ${error.message}`);
  }
  return { ownerId: row.owner_id, config: sanitizeConfig(row.config), overlayToken: row.overlay_token };
}

export async function saveWorkspaceConfig(ownerId, config) {
  const sanitized = sanitizeConfig(config);
  await request(`tiktokraft_workspaces?owner_id=eq.${encodeURIComponent(ownerId)}`, {
    method: "PATCH",
    headers: headers({ "Content-Type": "application/json", "Content-Profile": "public", Prefer: "return=minimal" }),
    body: JSON.stringify({ config: sanitized, updated_at: new Date().toISOString() })
  });
  return sanitized;
}

export async function workspaceByOverlayToken(token) {
  const response = await request(`tiktokraft_workspaces?overlay_token=eq.${encodeURIComponent(token)}&select=owner_id,config,overlay_token&limit=1`, { headers: headers() });
  const row = (await response.json())[0];
  return row ? { ownerId: row.owner_id, config: sanitizeConfig(row.config), overlayToken: row.overlay_token } : null;
}
