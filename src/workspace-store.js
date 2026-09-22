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

export async function claimWorkspace(ownerId) {
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
    const missingMigration = error.status === 404 && String(error.detail || "").includes("tiktokraft_reclaim_legacy_mappings");
    if (!missingMigration) throw error;
    console.warn("La reparación de mappings aún no está disponible en Supabase; se abrirá el workspace sin bloquear la sesión.");
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
