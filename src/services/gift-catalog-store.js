function projectUrl(value) {
  return String(value || "").trim().replace(/\/+$/, "").replace(/\/rest\/v1$/i, "");
}

const url = projectUrl(process.env.SUPABASE_URL);
const key = String(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

function headers(extra = {}) {
  return { apikey: key, Authorization: `Bearer ${key}`, "Accept-Profile": "public", ...extra };
}

function value(value, length) {
  return String(value || "").trim().slice(0, length);
}

function number(value) {
  return Math.max(0, Math.min(Math.floor(Number(value) || 0), 1_000_000_000));
}

function normalize(row) {
  return {
    giftId: value(row?.gift_id, 80),
    giftName: value(row?.gift_name, 80) || "Regalo",
    coinValue: number(row?.coin_value),
    giftImageUrl: value(row?.image_url, 2_048),
    lastSeenAt: row?.last_seen_at || null
  };
}

async function request(path, options = {}) {
  const response = await fetch(`${url}/rest/v1/${path}`, options);
  if (!response.ok) {
    const detail = await response.text();
    const error = new Error(`Supabase no pudo guardar el catálogo de regalos (${response.status})${detail ? `: ${detail}` : ""}`);
    error.status = response.status;
    error.detail = detail;
    throw error;
  }
  return response;
}

export async function listWorkspaceGiftCatalog(ownerId, limit = 2_000) {
  const params = new URLSearchParams({
    owner_id: `eq.${ownerId}`,
    select: "gift_id,gift_name,coin_value,image_url,last_seen_at",
    order: "last_seen_at.desc",
    limit: String(Math.max(1, Math.min(Number(limit) || 2_000, 2_000)))
  });
  const response = await request(`tiktokraft_workspace_gift_catalog?${params}`, { headers: headers() });
  return (await response.json()).map(normalize);
}

export async function upsertWorkspaceGiftCatalog(ownerId, gift) {
  const giftId = value(gift?.giftId, 80);
  if (!giftId) return null;
  let response;
  try {
    response = await request("rpc/tiktokraft_workspace_upsert_gift_catalog", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json", "Content-Profile": "public" }),
      body: JSON.stringify({
        p_owner_id: ownerId,
        p_gift_id: giftId,
        p_gift_name: value(gift?.giftName, 80),
        p_coin_value: number(gift?.coinValue),
        p_image_url: value(gift?.giftImageUrl, 2_048)
      })
    });
  } catch (error) {
    if (error.status === 404 && String(error.detail || "").includes("tiktokraft_workspace_upsert_gift_catalog")) {
      throw new Error("Falta aplicar la migración del catálogo de regalos en Supabase. Ejecuta supabase/gift-catalog.sql una vez en SQL Editor.");
    }
    throw error;
  }
  const rows = await response.json();
  return rows[0] ? normalize(rows[0]) : null;
}
