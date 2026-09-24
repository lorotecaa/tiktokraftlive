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

export function normalizeAccountEmail(value) {
  return String(value || "").trim().toLocaleLowerCase().slice(0, 320);
}

export function normalizeAccountRole(value) {
  const role = String(value || "").trim().toLocaleLowerCase();
  if (role !== "administrator") throw new Error("El rol seleccionado no es válido.");
  return role;
}

function normalize(row) {
  return { username: normalizeTikTokUsername(row?.username), addedAt: row?.added_at || null };
}

function normalizeAccountRoleRow(row) {
  return {
    userId: String(row?.user_id || ""),
    email: normalizeAccountEmail(row?.email),
    role: String(row?.role || "").trim().toLocaleLowerCase(),
    assignedAt: row?.assigned_at || null,
    updatedAt: row?.updated_at || null
  };
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

export async function getAccountRole(userId) {
  const id = String(userId || "").trim();
  if (!id) return null;
  const response = await request(`tiktokraft_account_roles?user_id=eq.${encodeURIComponent(id)}&select=role&limit=1`, { headers: headers() });
  const [row] = await response.json();
  return row?.role ? String(row.role).trim().toLocaleLowerCase() : null;
}

export async function listAccountRoles() {
  const response = await request("rpc/tiktokraft_list_account_roles", {
    method: "POST",
    headers: headers({ "Content-Type": "application/json", "Content-Profile": "public" }),
    body: "{}"
  });
  return (await response.json()).map(normalizeAccountRoleRow);
}

export async function assignAccountRole(email, role, assignedBy) {
  const normalizedEmail = normalizeAccountEmail(email);
  const normalizedRole = normalizeAccountRole(role);
  if (!normalizedEmail || !normalizedEmail.includes("@")) throw new Error("Escribe un correo válido.");
  const response = await request("rpc/tiktokraft_assign_account_role", {
    method: "POST",
    headers: headers({ "Content-Type": "application/json", "Content-Profile": "public" }),
    body: JSON.stringify({ p_email: normalizedEmail, p_role: normalizedRole, p_assigned_by: assignedBy })
  });
  const [row] = await response.json();
  if (!row) throw new Error("No se pudo guardar el rol.");
  return normalizeAccountRoleRow(row);
}

export async function removeAccountRole(email) {
  const normalizedEmail = normalizeAccountEmail(email);
  if (!normalizedEmail) throw new Error("No se encontró la cuenta.");
  await request("rpc/tiktokraft_remove_account_role", {
    method: "POST",
    headers: headers({ "Content-Type": "application/json", "Content-Profile": "public" }),
    body: JSON.stringify({ p_email: normalizedEmail })
  });
  return { email: normalizedEmail };
}
