function projectUrl(value) {
  return String(value || "").trim().replace(/\/+$/, "").replace(/\/rest\/v1$/i, "");
}

const url = projectUrl(process.env.SUPABASE_URL);
const key = String(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

function headers(extra = {}) {
  return { apikey: key, Authorization: `Bearer ${key}`, "Accept-Profile": "public", ...extra };
}

export function normalizeAccountEmail(value) {
  return String(value || "").trim().toLocaleLowerCase().slice(0, 320);
}

export function normalizeAccountRole(value) {
  const role = String(value || "").trim().toLocaleLowerCase();
  if (!["administrator", "pro"].includes(role)) throw new Error("El rol seleccionado no es válido.");
  return role;
}

function normalizeAuthorizedAccount(row) {
  return { userId: String(row?.user_id || ""), email: normalizeAccountEmail(row?.email), addedAt: row?.added_at || null };
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

async function registeredAccountByEmail(email) {
  const response = await fetch(`${url}/auth/v1/admin/users?page=1&per_page=1000`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` }
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Supabase no pudo consultar la cuenta (${response.status})${detail ? `: ${detail}` : ""}`);
  }
  const data = await response.json();
  const user = (Array.isArray(data) ? data : data?.users || []).find((entry) => normalizeAccountEmail(entry?.email) === email);
  if (!user?.id) throw new Error("No existe una cuenta registrada con ese correo.");
  return user;
}

export async function listAuthorizedAccounts() {
  const response = await request("tiktokraft_authorized_accounts?select=user_id,email,added_at&order=email.asc&limit=2000", { headers: headers() });
  return (await response.json()).map(normalizeAuthorizedAccount);
}

export async function isAccountAuthorized(userId) {
  const id = String(userId || "").trim();
  if (!id) return false;
  const response = await request(`tiktokraft_authorized_accounts?user_id=eq.${encodeURIComponent(id)}&select=user_id&limit=1`, { headers: headers() });
  return (await response.json()).length > 0;
}

export async function authorizeAccountEmail(value, addedBy) {
  const email = normalizeAccountEmail(value);
  if (!email || !email.includes("@")) throw new Error("Escribe el correo de una cuenta registrada.");
  const account = await registeredAccountByEmail(email);
  const response = await request("tiktokraft_authorized_accounts?on_conflict=user_id", {
    method: "POST",
    headers: headers({ "Content-Type": "application/json", "Content-Profile": "public", Prefer: "resolution=merge-duplicates,return=representation,missing=default" }),
    body: JSON.stringify({ user_id: account.id, email: normalizeAccountEmail(account.email), added_by: addedBy })
  });
  const [row] = await response.json();
  if (!row) throw new Error("No se pudo autorizar la cuenta.");
  return normalizeAuthorizedAccount(row);
}

export async function revokeAccountAuthorization(value) {
  const userId = String(value || "").trim();
  if (!userId) throw new Error("No se encontró la cuenta autorizada.");
  await request(`tiktokraft_authorized_accounts?user_id=eq.${encodeURIComponent(userId)}`, {
    method: "DELETE",
    headers: headers({ Prefer: "return=minimal" })
  });
  return { userId };
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
  const targetUser = await registeredAccountByEmail(normalizedEmail);
  const response = await request("tiktokraft_account_roles?on_conflict=user_id", {
    method: "POST",
    headers: headers({ "Content-Type": "application/json", "Content-Profile": "public", Prefer: "resolution=merge-duplicates,return=representation,missing=default" }),
    body: JSON.stringify({ user_id: targetUser.id, role: normalizedRole, assigned_by: assignedBy, updated_at: new Date().toISOString() })
  });
  const [row] = await response.json();
  if (!row) throw new Error("No se pudo guardar el rol.");
  return normalizeAccountRoleRow({ ...row, email: normalizedEmail });
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
