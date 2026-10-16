import { PRO_CURRENCY, PRO_PRICE_CENTS } from "./wompi-pro.js";

function projectUrl(value) { return String(value || "").trim().replace(/\/+$/, "").replace(/\/rest\/v1$/i, ""); }
const url = projectUrl(process.env.SUPABASE_URL);
const key = String(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
const headers = (extra = {}) => ({ apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", "Content-Profile": "public", ...extra });

async function request(path, options) {
  if (!url || !key) throw new Error("Falta configurar Supabase para registrar los pagos.");
  const response = await fetch(`${url}/rest/v1/${path}`, options);
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`No se pudo guardar el pago (${response.status})${detail ? `: ${detail}` : ""}`);
  }
  return response;
}

export async function createProOrder(user, reference) {
  const response = await request("tiktokraft_pro_orders", {
    method: "POST",
    headers: headers({ Prefer: "return=representation" }),
    body: JSON.stringify({ reference, user_id: user.id, account_email: user.email, amount_in_cents: PRO_PRICE_CENTS, currency: PRO_CURRENCY })
  });
  const [row] = await response.json();
  if (!row || row.reference !== reference) throw new Error("No se pudo registrar el pago.");
  return row;
}

export async function latestProOrder(userId) {
  const response = await request(`tiktokraft_pro_orders?user_id=eq.${encodeURIComponent(userId)}&select=reference,status,created_at,paid_at&order=created_at.desc&limit=1`, {
    headers: headers()
  });
  return (await response.json())[0] || null;
}

export async function completeProOrder(transaction) {
  const response = await request("rpc/tiktokraft_complete_pro_order", {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      p_reference: transaction.reference,
      p_transaction_id: transaction.id,
      p_amount_in_cents: transaction.amountInCents,
      p_currency: transaction.currency
    })
  });
  return (await response.json())[0] || null;
}
