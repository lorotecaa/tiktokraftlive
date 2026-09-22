function projectUrl(value) {
  return String(value || "").trim().replace(/\/+$/, "").replace(/\/rest\/v1$/i, "");
}

const url = projectUrl(process.env.SUPABASE_URL);
const key = String(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
const applicationUrl = String(process.env.APP_URL || process.env.RENDER_EXTERNAL_URL || "").trim().replace(/\/+$/, "");

export const authConfigured = Boolean(url && key);

function headers(extra = {}) {
  return { apikey: key, "Content-Type": "application/json", ...extra };
}

async function authRequest(path, options) {
  if (!authConfigured) throw new Error("La autenticación requiere SUPABASE_URL y SUPABASE_SECRET_KEY en Render.");
  const response = await fetch(`${url}/auth/v1/${path}`, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.msg || data.error_description || data.message || "No se pudo validar la cuenta.");
  return data;
}

export function signUp(email, password) {
  const redirect = applicationUrl ? `?redirect_to=${encodeURIComponent(applicationUrl)}` : "";
  return authRequest(`signup${redirect}`, { method: "POST", headers: headers(), body: JSON.stringify({ email, password }) });
}

export function signIn(email, password) {
  return authRequest("token?grant_type=password", { method: "POST", headers: headers(), body: JSON.stringify({ email, password }) });
}

export function refreshSession(refreshToken) {
  return authRequest("token?grant_type=refresh_token", { method: "POST", headers: headers(), body: JSON.stringify({ refresh_token: refreshToken }) });
}

export async function userFromAccessToken(token) {
  if (!token) throw new Error("Inicia sesión para continuar.");
  const user = await authRequest("user", { headers: headers({ Authorization: `Bearer ${token}` }) });
  if (!user?.id) throw new Error("La sesión no es válida.");
  return { id: user.id, email: user.email || "" };
}
