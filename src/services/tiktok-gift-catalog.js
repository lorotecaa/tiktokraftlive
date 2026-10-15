import { TikTokLiveConnection } from "tiktok-live-connector";

function imageUrl(gift) {
  const image = gift?.image || gift?.icon || gift?.gift_image || gift?.giftImage || {};
  const candidates = [
    ...(Array.isArray(image.url_list) ? image.url_list : []),
    ...(Array.isArray(image.urlList) ? image.urlList : []),
    image.url,
    gift?.giftPictureUrl,
    gift?.giftImageUrl
  ];
  for (const candidate of candidates) {
    try {
      const url = new URL(String(candidate || ""));
      if (url.protocol === "https:") return url.href.slice(0, 2_048);
    } catch { /* TikTok también devuelve campos de imagen vacíos. */ }
  }
  return "";
}

export function normalizeRoomGifts(gifts) {
  if (!Array.isArray(gifts)) throw new Error("TikTok no devolvió una lista de regalos válida.");
  const byId = new Map();
  for (const gift of gifts) {
    const giftId = String(gift?.id ?? gift?.gift_id ?? gift?.giftId ?? "").trim();
    if (!/^\d{1,20}$/.test(giftId)) continue;
    const previous = byId.get(giftId);
    byId.set(giftId, {
      giftId,
      giftName: String(gift?.name || gift?.gift_name || gift?.giftName || previous?.giftName || `Regalo #${giftId}`).trim().slice(0, 80),
      coinValue: Math.max(0, Math.floor(Number(gift?.diamond_count ?? gift?.diamondCount ?? gift?.coinValue) || 0)) || previous?.coinValue || 0,
      giftImageUrl: imageUrl(gift) || previous?.giftImageUrl || ""
    });
  }
  return [...byId.values()];
}

export async function fetchLiveRoomGifts(username, apiKey) {
  const uniqueId = String(username || "").trim().replace(/^@/, "");
  if (!uniqueId || !apiKey) throw new Error("Primero configura el usuario de TikTok y conecta tu LIVE.");
  // Solo consulta el catálogo de la sala en TikTok. No usa la ruta de catálogo
  // histórico de Euler Stream, que puede requerir un complemento de pago.
  const connection = new TikTokLiveConnection(uniqueId, { signApiKey: apiKey });
  await connection.fetchRoomId();
  return normalizeRoomGifts(await connection.fetchAvailableGifts());
}
