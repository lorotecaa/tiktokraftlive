function normalizeProjectUrl(value) {
  return String(value || "").trim().replace(/\/+$/, "").replace(/\/rest\/v1$/i, "");
}

const supabaseUrl = normalizeProjectUrl(process.env.SUPABASE_URL);
const supabaseSecretKey = String(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

export const userPointsStoreConfigured = Boolean(supabaseUrl && supabaseSecretKey);

function headers(extra = {}) {
  return { apikey: supabaseSecretKey, Authorization: `Bearer ${supabaseSecretKey}`, "Accept-Profile": "public", ...extra };
}

function safeIdentity(value) {
  return String(value || "").trim().replace(/^@/, "").toLocaleLowerCase().slice(0, 80);
}

function safeSearch(value) {
  return String(value || "").trim().replace(/[^\p{L}\p{N}_.-]/gu, "").slice(0, 80);
}

function normalizeEntry(row) {
  return {
    username: String(row?.username || "").slice(0, 80),
    nickname: String(row?.nickname || row?.username || "Espectador").slice(0, 80),
    avatarUrl: String(row?.avatar_url || "").slice(0, 2048),
    coins: Math.max(0, Number(row?.total_coins) || 0),
    firstGiftAt: row?.first_gift_at || null,
    lastGiftAt: row?.last_gift_at || null
  };
}

async function request(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const detail = await response.text();
    const error = new Error(`Supabase no pudo guardar Usuario y Puntos (${response.status})${detail ? `: ${detail}` : ""}`);
    error.status = response.status;
    error.detail = detail;
    throw error;
  }
  return response;
}

export async function listUserPoints({ query = "", limit = 100 } = {}) {
  if (!userPointsStoreConfigured) return [];
  const params = new URLSearchParams({ select: "username,nickname,avatar_url,total_coins,first_gift_at,last_gift_at", order: "total_coins.desc", limit: String(Math.max(1, Math.min(Number(limit) || 100, 500))) });
  const search = safeSearch(query);
  if (search) params.set("or", `(username.ilike.*${search}*,nickname.ilike.*${search}*)`);
  const response = await request(`${supabaseUrl}/rest/v1/tiktokraft_user_points?${params}`, { headers: headers() });
  return (await response.json()).map(normalizeEntry);
}

export async function addUserPoints(gift) {
  if (!userPointsStoreConfigured) return null;
  const username = safeIdentity(gift?.username || gift?.nickname);
  const coins = Math.max(0, Math.floor(Number(gift?.coins) || 0));
  if (!username || !coins) return null;
  const response = await request(`${supabaseUrl}/rest/v1/rpc/tiktokraft_add_user_points`, {
    method: "POST",
    headers: headers({ "Content-Type": "application/json", "Content-Profile": "public" }),
    body: JSON.stringify({
      p_username: username,
      p_nickname: String(gift?.nickname || username).trim().slice(0, 80),
      p_avatar_url: String(gift?.userAvatarUrl || "").trim().slice(0, 2048),
      p_coins: coins
    })
  });
  const rows = await response.json();
  return rows[0] ? normalizeEntry(rows[0]) : null;
}

export async function addManualUserPoints(input = {}) {
  if (!userPointsStoreConfigured) throw new Error("Configura Supabase para guardar transacciones manuales.");
  const username = safeIdentity(input.username);
  const coins = Math.trunc(Number(input.coins));
  if (!username) throw new Error("Indica un usuario para la transacción.");
  if (!Number.isFinite(coins) || !coins) throw new Error("Indica una cantidad de monedas distinta de cero.");
  if (Math.abs(coins) > 1_000_000_000) throw new Error("La cantidad de monedas es demasiado grande.");
  let response;
  try {
    response = await request(`${supabaseUrl}/rest/v1/rpc/tiktokraft_add_manual_user_points`, {
      method: "POST",
      headers: headers({ "Content-Type": "application/json", "Content-Profile": "public" }),
      body: JSON.stringify({
        p_username: username,
        p_nickname: String(input.nickname || input.username || username).trim().slice(0, 80),
        p_coins: coins,
        p_description: String(input.description || "").trim().slice(0, 280)
      })
    });
  } catch (error) {
    if (error.status === 404 && String(error.detail || "").includes("tiktokraft_add_manual_user_points")) {
      throw new Error("Falta aplicar la migración de transacciones manuales en Supabase. Ejecuta supabase/manual-transactions.sql una vez en SQL Editor.");
    }
    throw error;
  }
  const rows = await response.json();
  return rows[0] ? normalizeEntry(rows[0]) : null;
}

export async function listWorkspaceUserPoints(ownerId, { query = "", limit = 100 } = {}) {
  const params = new URLSearchParams({ select: "username,nickname,avatar_url,total_coins,first_gift_at,last_gift_at", owner_id: `eq.${ownerId}`, order: "total_coins.desc", limit: String(Math.max(1, Math.min(Number(limit) || 100, 500)) ) });
  const search = safeSearch(query);
  if (search) params.set("or", `(username.ilike.*${search}*,nickname.ilike.*${search}*)`);
  const response = await request(`${supabaseUrl}/rest/v1/tiktokraft_workspace_user_points?${params}`, { headers: headers() });
  return (await response.json()).map(normalizeEntry);
}

async function workspacePointsRpc(name, body) {
  const response = await request(`${supabaseUrl}/rest/v1/rpc/${name}`, { method: "POST", headers: headers({ "Content-Type": "application/json", "Content-Profile": "public" }), body: JSON.stringify(body) });
  const rows = await response.json();
  return rows[0] ? normalizeEntry(rows[0]) : null;
}

export function addWorkspaceUserPoints(ownerId, gift) {
  const username = safeIdentity(gift?.username || gift?.nickname);
  const coins = Math.max(0, Math.floor(Number(gift?.coins) || 0));
  if (!username || !coins) return Promise.resolve(null);
  return workspacePointsRpc("tiktokraft_workspace_add_user_points", { p_owner_id: ownerId, p_username: username, p_nickname: String(gift?.nickname || username).slice(0, 80), p_avatar_url: String(gift?.userAvatarUrl || "").slice(0, 2048), p_coins: coins });
}

export function addWorkspaceManualPoints(ownerId, input = {}) {
  const username = safeIdentity(input.username);
  const coins = Math.trunc(Number(input.coins));
  if (!username) return Promise.reject(new Error("Indica un usuario para la transacción."));
  if (!Number.isFinite(coins) || !coins) return Promise.reject(new Error("Indica una cantidad de monedas distinta de cero."));
  return workspacePointsRpc("tiktokraft_workspace_add_manual_points", { p_owner_id: ownerId, p_username: username, p_nickname: String(input.nickname || input.username || username).slice(0, 80), p_coins: coins, p_description: String(input.description || "").slice(0, 280) });
}
