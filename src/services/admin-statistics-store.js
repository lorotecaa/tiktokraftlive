function projectUrl(value) {
  return String(value || "").trim().replace(/\/+$/, "").replace(/\/rest\/v1$/i, "");
}

const url = projectUrl(process.env.SUPABASE_URL);
const key = String(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

function headers(extra = {}) {
  return { apikey: key, Authorization: `Bearer ${key}`, "Accept-Profile": "public", ...extra };
}

function normalize(row) {
  return {
    userId: String(row?.user_id || ""),
    email: String(row?.email || "").trim().toLocaleLowerCase(),
    registeredAt: row?.registered_at || null,
    lastSignInAt: row?.last_sign_in_at || null,
    workspaceUpdatedAt: row?.workspace_updated_at || null,
    tiktokUsername: String(row?.tiktok_username || "").trim().replace(/^@/, "")
  };
}

export async function listRegisteredAccounts() {
  const response = await fetch(`${url}/rest/v1/rpc/tiktokraft_list_registered_accounts`, {
    method: "POST",
    headers: headers({ "Content-Type": "application/json", "Content-Profile": "public" }),
    body: "{}"
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Supabase no pudo cargar las estadísticas (${response.status})${detail ? `: ${detail}` : ""}`);
  }
  return (await response.json()).map(normalize);
}
