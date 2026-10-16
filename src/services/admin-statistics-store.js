function projectUrl(value) {
  return String(value || "").trim().replace(/\/+$/, "").replace(/\/rest\/v1$/i, "");
}

const url = projectUrl(process.env.SUPABASE_URL);
const key = String(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

function headers(extra = {}) {
  return { apikey: key, Authorization: `Bearer ${key}`, "Accept-Profile": "public", ...extra };
}

function normalize(row, authUser) {
  const emailConfirmedAt = authUser?.email_confirmed_at || null;
  return {
    userId: String(row?.user_id || ""),
    email: String(row?.email || "").trim().toLocaleLowerCase(),
    emailVerified: Boolean(emailConfirmedAt),
    emailConfirmedAt,
    registeredAt: row?.registered_at || null,
    lastSignInAt: row?.last_sign_in_at || null,
    workspaceUpdatedAt: row?.workspace_updated_at || null,
    tiktokUsername: String(row?.tiktok_username || "").trim().replace(/^@/, "")
  };
}

async function listAuthUsers() {
  const response = await fetch(`${url}/auth/v1/admin/users?page=1&per_page=1000`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` }
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Supabase no pudo consultar la verificación de correos (${response.status})${detail ? `: ${detail}` : ""}`);
  }
  const data = await response.json();
  return Array.isArray(data) ? data : data?.users || [];
}

export async function listRegisteredAccounts() {
  const [response, authUsers] = await Promise.all([
    fetch(`${url}/rest/v1/rpc/tiktokraft_list_registered_accounts`, {
      method: "POST",
      headers: headers({ "Content-Type": "application/json", "Content-Profile": "public" }),
      body: "{}"
    }),
    listAuthUsers()
  ]);
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Supabase no pudo cargar las estadísticas (${response.status})${detail ? `: ${detail}` : ""}`);
  }
  const authUsersById = new Map(authUsers.map((user) => [String(user?.id || ""), user]));
  return (await response.json()).map((row) => normalize(row, authUsersById.get(String(row?.user_id || ""))));
}

export async function deleteRegisteredAccount(userId) {
  const id = String(userId || "").trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    throw new Error("La cuenta seleccionada no es válida.");
  }
  const response = await fetch(`${url}/auth/v1/admin/users/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { apikey: key, Authorization: `Bearer ${key}` }
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Supabase no pudo eliminar la cuenta (${response.status})${detail ? `: ${detail}` : ""}`);
  }
  return { userId: id };
}
