import { normalizeAccountEmail } from "./access-store.js";

function projectUrl(value) { return String(value || "").trim().replace(/\/+$/, "").replace(/\/rest\/v1$/i, ""); }
const url = projectUrl(process.env.SUPABASE_URL);
const key = String(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", "Content-Profile": "public", "Accept-Profile": "public" };

async function request(path, options = {}) {
  if (!url || !key) throw new Error("Falta configurar Supabase para las solicitudes del exterior.");
  const response = await fetch(`${url}/rest/v1/${path}`, { ...options, headers: { ...headers, ...options.headers } });
  if (!response.ok) throw new Error(`No se pudo gestionar la solicitud del exterior (${response.status}).`);
  return response.json();
}

function normalize(row) {
  return row ? {
    id: String(row.id || ""), userId: String(row.user_id || ""), email: normalizeAccountEmail(row.account_email),
    country: String(row.country || ""), phone: String(row.phone || ""), status: String(row.status || ""),
    createdAt: row.created_at || null, updatedAt: row.updated_at || null, contactedAt: row.contacted_at || null
  } : null;
}

export function validateInternationalContact(country, phone) {
  const cleanCountry = String(country || "").trim().replace(/\s+/g, " ");
  const cleanPhone = String(phone || "").trim().replace(/\s+/g, " ");
  if (cleanCountry.length < 2 || cleanCountry.length > 80 || /[\x00-\x1f\x7f]/.test(cleanCountry)) {
    throw new Error("Escribe un país de pago válido.");
  }
  if (!/^\+?[\d ().-]+$/.test(cleanPhone) || !/^\+?\d/.test(cleanPhone) || !/\d$/.test(cleanPhone) ||
      cleanPhone.replace(/\D/g, "").length < 7 || cleanPhone.replace(/\D/g, "").length > 15) {
    throw new Error("Escribe un número de teléfono válido con indicativo de país.");
  }
  return { country: cleanCountry, phone: cleanPhone };
}

export async function startInternationalPaymentRequest(user, country, phone) {
  const contact = validateInternationalContact(country, phone);
  const rows = await request("rpc/tiktokraft_start_international_payment_request", {
    method: "POST", body: JSON.stringify({ p_user_id: user.id, p_email: user.email, p_country: contact.country, p_phone: contact.phone })
  });
  if (!rows?.[0]) throw new Error("No se pudo guardar tu solicitud de contacto.");
  return normalize(rows[0]);
}

export async function latestInternationalPaymentRequest(userId) {
  const rows = await request(`tiktokraft_international_payment_requests?user_id=eq.${encodeURIComponent(userId)}&select=id,user_id,account_email,country,phone,status,created_at,updated_at,contacted_at&order=created_at.desc&limit=1`);
  return normalize(rows?.[0]);
}

export async function listPendingInternationalPaymentRequests() {
  const rows = await request("tiktokraft_international_payment_requests?status=eq.pending&select=id,user_id,account_email,country,phone,status,created_at,updated_at,contacted_at&order=created_at.asc&limit=500");
  return rows.map(normalize);
}

export async function markInternationalPaymentRequestContacted(id, adminId) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(id || ""))) {
    throw new Error("La solicitud seleccionada no es válida.");
  }
  const rows = await request("rpc/tiktokraft_mark_international_payment_contacted", {
    method: "POST", body: JSON.stringify({ p_id: id, p_admin_id: adminId })
  });
  if (!rows?.[0]) throw new Error("No se pudo actualizar la solicitud de contacto.");
  return normalize(rows[0]);
}
