function projectUrl(value) {
  return String(value || "").trim().replace(/\/+$/, "").replace(/\/rest\/v1$/i, "");
}

const url = projectUrl(process.env.SUPABASE_URL);
const key = String(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

function headers(extra = {}) {
  return { apikey: key, Authorization: `Bearer ${key}`, "Accept-Profile": "public", ...extra };
}

export function normalizeTikTokUsername(value) {
  return String(value || "").trim().replace(/^@/, "").toLocaleLowerCase().slice(0, 80);
}

function normalize(row) {
  return { username: normalizeTikTokUsername(row?.username), addedAt: row?.added_at || null };
}

async function request(path, options = {}) {
  const response = await fetch(`${url}/rest/v1/${path}`, options);
  if (!response.ok) {
    const detail = await response.text();
    const error = new Error(`Supabase no pudo gestionar los accesos (${response.status})${detail ? `: ${detail}` : ""}`);
    error.status = response.status;
    error.detail = detail;
    throw error;
  }
  return response;
}

export async function listAuthorizedTikTokUsers() {
  const response = await request("tiktokraft_authorized_tiktok_users?select=username,added_at&order=username.asc&limit=2000", { headers: headers() });
  return (await response.json()).map(normalize);
}

export async function isTikTokUsernameAuthorized(value) {
  const username = normalizeTikTokUsername(value);
  if (!username) return false;
  const response = await request(`tiktokraft_authorized_tiktok_users?username=eq.${encodeURIComponent(username)}&select=username&limit=1`, { headers: headers() });
  return (await response.json()).length > 0;
}

export async function authorizeTikTokUsername(value, addedBy) {
  const username = normalizeTikTokUsername(value);
  if (!username) throw new Error("Escribe un nombre de usuario de TikTok válido.");
  const response = await request("rpc/tiktokraft_authorize_tiktok_username", {
    method: "POST",
    headers: headers({ "Content-Type": "application/json", "Content-Profile": "public" }),
    body: JSON.stringify({ p_username: username, p_added_by: addedBy })
  });
  const rows = await response.json();
  return rows[0] ? normalize(rows[0]) : { username, addedAt: null };
}

export async function revokeTikTokUsername(value) {
  const username = normalizeTikTokUsername(value);
  if (!username) throw new Error("No se encontró el usuario de TikTok.");
  await request(`tiktokraft_authorized_tiktok_users?username=eq.${encodeURIComponent(username)}`, {
    method: "DELETE",
    headers: headers({ Prefer: "return=minimal" })
  });
  return { username };
}
