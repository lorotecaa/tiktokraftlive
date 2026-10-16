import { normalizeAccountEmail } from "./access-store.js";

function projectUrl(value) { return String(value || "").trim().replace(/\/+$/, "").replace(/\/rest\/v1$/i, ""); }
const url = projectUrl(process.env.SUPABASE_URL);
const key = String(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
const headers = (extra = {}) => ({ apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", "Content-Profile": "public", "Accept-Profile": "public", ...extra });

async function request(path, options = {}) {
  if (!url || !key) throw new Error("Falta configurar Supabase para las solicitudes de pago.");
  const response = await fetch(`${url}/rest/v1/${path}`, { ...options, headers: headers(options.headers) });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`No se pudo gestionar la solicitud de pago (${response.status})${detail ? `: ${detail}` : ""}`);
  }
  return response.json();
}

function normalize(row) {
  return row ? {
    id: String(row.id || ""), userId: String(row.user_id || ""), email: normalizeAccountEmail(row.account_email),
    status: String(row.status || ""), createdAt: row.created_at || null,
    reviewedAt: row.reviewed_at || null, transactionReference: row.transaction_reference || null
  } : null;
}

export async function startManualProRequest(user) {
  const rows = await request("rpc/tiktokraft_start_manual_pro_request", {
    method: "POST", body: JSON.stringify({ p_user_id: user.id, p_email: user.email })
  });
  if (!rows?.[0]) throw new Error("No se pudo guardar la solicitud de pago.");
  return normalize(rows[0]);
}

export async function latestManualProRequest(userId) {
  const rows = await request(`tiktokraft_manual_pro_requests?user_id=eq.${encodeURIComponent(userId)}&select=id,user_id,account_email,status,created_at,reviewed_at,transaction_reference&order=created_at.desc&limit=1`);
  return normalize(rows?.[0]);
}

export async function listPendingManualProRequests() {
  const rows = await request("tiktokraft_manual_pro_requests?status=eq.pending&select=id,user_id,account_email,status,created_at&order=created_at.asc&limit=500");
  return rows.map(normalize);
}

export async function reviewManualProRequest(id, adminId, decision, transactionReference = "") {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(id || ""))) {
    throw new Error("La solicitud seleccionada no es válida.");
  }
  if (!["approved", "rejected"].includes(decision)) throw new Error("La decisión no es válida.");
  const reference = String(transactionReference || "").trim();
  if (decision === "approved" && (reference.length < 4 || reference.length > 128)) {
    throw new Error("Escribe una referencia de transacción válida antes de activar Pro.");
  }
  const rows = await request("rpc/tiktokraft_review_manual_pro_request", {
    method: "POST", body: JSON.stringify({ p_id: id, p_admin_id: adminId, p_decision: decision, p_transaction_reference: reference || null })
  });
  if (!rows?.[0]) throw new Error("No se pudo revisar la solicitud.");
  return normalize(rows[0]);
}
