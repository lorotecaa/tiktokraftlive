function projectUrl(value) {
  return String(value || "").trim().replace(/\/+$/, "").replace(/\/rest\/v1$/i, "");
}

const url = projectUrl(process.env.SUPABASE_URL);
const key = String(process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
const applicationUrl = String(process.env.APP_URL || process.env.RENDER_EXTERNAL_URL || "").trim().replace(/\/+$/, "");

export const authConfigured = Boolean(url && key);

function credentials(email, password) {
  const normalizedEmail = normalizeEmail(email);
  const normalizedPassword = String(password || "");
  if (normalizedPassword.length < 6) throw new Error("La contraseña debe tener al menos 6 caracteres.");
  return { email: normalizedEmail, password: normalizedPassword };
}

function normalizeEmail(value) {
  const email = String(value || "").trim().toLocaleLowerCase();
  if (!email || !email.includes("@")) throw new Error("Escribe un correo electrónico válido.");
  return email;
}

function headers(extra = {}) {
  return { apikey: key, "Content-Type": "application/json", ...extra };
}

async function authRequest(path, options) {
  if (!authConfigured) throw new Error("La autenticación requiere SUPABASE_URL y SUPABASE_SECRET_KEY en Render.");
  const response = await fetch(`${url}/auth/v1/${path}`, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = data.msg || data.error_description || data.message || "No se pudo validar la cuenta.";
    if (response.status === 429 && /email rate limit|over_email_send_rate_limit/i.test(`${data.code || ""} ${detail}`)) {
      throw new Error("Se alcanzó temporalmente el límite de correos. Espera hasta una hora antes de solicitar otro mensaje.");
    }
    if (/invalid login credentials/i.test(detail)) throw new Error("El correo o la contraseña son incorrectos.");
    throw new Error(detail);
  }
  return data;
}

export function signUp(email, password) {
  const redirect = applicationUrl ? `?redirect_to=${encodeURIComponent(applicationUrl)}` : "";
  return authRequest(`signup${redirect}`, { method: "POST", headers: headers(), body: JSON.stringify(credentials(email, password)) });
}

export function signIn(email, password) {
  return authRequest("token?grant_type=password", { method: "POST", headers: headers(), body: JSON.stringify(credentials(email, password)) });
}

export function requestPasswordReset(email) {
  const redirect = applicationUrl ? `?redirect_to=${encodeURIComponent(applicationUrl)}` : "";
  return authRequest(`recover${redirect}`, { method: "POST", headers: headers(), body: JSON.stringify({ email: normalizeEmail(email) }) });
}

export function refreshSession(refreshToken) {
  return authRequest("token?grant_type=refresh_token", { method: "POST", headers: headers(), body: JSON.stringify({ refresh_token: refreshToken }) });
}

export async function changePassword(accessToken, password) {
  if (String(password || "").length < 6) throw new Error("La contraseña debe tener al menos 6 caracteres.");
  await authRequest("user", { method: "PUT", headers: headers({ Authorization: `Bearer ${accessToken}` }), body: JSON.stringify({ password }) });
}

export async function userFromAccessToken(token) {
  if (!token) throw new Error("Inicia sesión para continuar.");
  const user = await authRequest("user", { headers: headers({ Authorization: `Bearer ${token}` }) });
  if (!user?.id) throw new Error("La sesión no es válida.");
  return { id: user.id, email: user.email || "" };
}
