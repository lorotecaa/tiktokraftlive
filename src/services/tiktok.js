import WebSocket from "ws";

const closeDetails = {
  4400: "Opciones de conexión inválidas.",
  4401: "La Euler Stream API Key no es válida para el WebSocket.",
  4403: "Tu API Key no tiene permiso para usar el WebSocket de Euler Stream.",
  4404: "@{username} no está en LIVE.",
  4429: "Se alcanzó el límite de conexiones Cloud WebSocket de tu plan.",
  4500: "TikTok cerró la conexión.",
  4555: "La conexión alcanzó su duración máxima y debe reconectarse.",
  4556: "Euler Stream no pudo recuperar los datos del LIVE.",
  4557: "Euler Stream no pudo obtener la información de la sala."
};
const giftConfirmationWindowMs = 5_000;
const maxPendingGiftOccurrences = 2_000;
const maxCommentLength = 220;

function normalizeText(value, fallback) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function normalizeGift(message) {
  const data = message?.data || message || {};
  const user = data.user || data.sender || data.fromUser || {};
  const gift = data.gift || data.giftInfo || {};
  const giftId = String(data.giftId ?? data.gift_id ?? gift.id ?? gift.giftId ?? "");

  return {
    giftId,
    giftName: normalizeText(data.giftName || data.gift_name || gift.name, giftId ? `Regalo #${giftId}` : "Regalo"),
    repeatCount: Math.max(1, Number(data.giftCount ?? data.gift_count ?? data.repeatCount ?? data.repeat_count ?? data.count) || 1),
    repeatEnd: data.repeatEnd ?? data.repeat_end,
    giftType: data.giftType ?? data.gift_type,
    username: normalizeText(user.uniqueId || user.unique_id || user.username || user.userId, "espectador"),
    nickname: normalizeText(user.nickname || user.displayName || user.display_name || user.uniqueId, "espectador")
  };
}

function isGiftMessage(message) {
  const type = String(message?.type || message?.eventType || message?.event || "").toLowerCase();
  return type === "webcastgiftmessage" || type === "gift" || type === "giftmessage";
}

function isCommentMessage(message) {
  const type = String(message?.type || message?.eventType || message?.event || "").toLowerCase();
  return type === "webcastchatmessage" || type === "chat" || type === "comment";
}

function normalizeComment(message) {
  const data = message?.data || message || {};
  const user = data.user || data.sender || data.fromUser || data;
  const text = data.comment ?? data.text ?? data.commentText ?? data.content;
  const badges = collectUserBadges(data, user);
  return {
    nickname: normalizeText(user.nickname || user.displayName || user.display_name || user.uniqueId || data.nickname, "espectador"),
    username: normalizeText(user.uniqueId || user.unique_id || user.username || user.displayId, ""),
    text: Array.from(normalizeText(text, "")).slice(0, maxCommentLength).join(""),
    isFollower: Boolean(data.isFollower ?? user.isFollower) || Number(data.followRole ?? data.followInfo?.followStatus ?? user.followStatus ?? user.followInfo?.followStatus) > 0,
    isSubscriber: Boolean(data.isSubscriber ?? user.isSubscriber ?? user.subscribeInfo ?? user.fansClubInfo ?? user.fansClub) || badges.some((badge) => badge.sceneType === 4 || badge.sceneType === 7 || badge.url.toLowerCase().includes("/sub_")),
    isModerator: Boolean(data.isModerator ?? user.isModerator) || badges.some((badge) => badge.sceneType === 1 || badge.type.toLowerCase().includes("moderator")),
    teamMemberLevel: Number(data.teamMemberLevel ?? user.teamMemberLevel ?? badges.find((badge) => badge.sceneType === 10)?.level) || 0,
    topGifterRank: Number(data.topGifterRank ?? user.topGifterRank ?? badges.find((badge) => badge.topGifterRank)?.topGifterRank) || 0
  };
}

function collectUserBadges(data, user) {
  const asArray = (value) => Array.isArray(value) ? value : [];
  const directBadges = [...asArray(data.userBadges), ...asArray(user.userBadges)].map((badge) => ({
    sceneType: Number(badge.badgeSceneType ?? badge.sceneType) || 0,
    type: String(badge.type || ""),
    url: String(badge.url || ""),
    level: Number(badge.level) || 0
  }));
  const badgeList = [...asArray(data.badgeList), ...asArray(user.badgeList)];
  for (const group of badgeList) {
    const sceneType = Number(group.badgeSceneType ?? group.sceneType) || 0;
    for (const badge of asArray(group.badges)) directBadges.push({ sceneType, type: String(badge.type || ""), url: String(badge.url || ""), level: Number(badge.level) || 0 });
    for (const badge of asArray(group.imageBadges)) directBadges.push({ sceneType, type: "image", url: String(badge.image?.url || badge.image?.urlList?.[0] || ""), level: 0 });
    if (group.privilegeLogExtra?.level) directBadges.push({ sceneType, type: "privilege", url: "", level: Number(group.privilegeLogExtra.level) || 0 });
  }
  return directBadges.map((badge) => ({
    ...badge,
    topGifterRank: Number(badge.url.match(/ranklist_top_gifter_(\d+)/)?.[1]) || 0
  }));
}

function normalizedIdentity(value) {
  return String(value || "").trim().replace(/^@/, "").toLocaleLowerCase();
}

export function isAllowedTtsUser(comment, allowed = {}) {
  if (allowed.allUsers !== false) return true;
  if (allowed.followers && comment.isFollower) return true;
  if (allowed.subscribers && comment.isSubscriber) return true;
  if (allowed.moderators && comment.isModerator) return true;
  if (allowed.teamMembers && comment.teamMemberLevel >= (Number(allowed.teamMembersMinLevel) || 1)) return true;
  if (allowed.topGifters && comment.topGifterRank > 0 && comment.topGifterRank <= (Number(allowed.topGiftersTop) || 3)) return true;
  if (allowed.listEnabled) {
    const usernames = new Set((allowed.usernames || []).map(normalizedIdentity));
    return usernames.has(normalizedIdentity(comment.username)) || usernames.has(normalizedIdentity(comment.nickname));
  }
  return false;
}

function giftOccurrenceKey(gift) {
  return [
    gift.username,
    gift.giftId || gift.giftName
  ].map((value) => String(value || "").trim()).join("\0");
}

export class TikTokClient {
  constructor({ onState, onGift, onComment, shouldReadComment = () => true, onError }) {
    this.onState = onState;
    this.onGift = onGift;
    this.onComment = onComment;
    this.shouldReadComment = shouldReadComment;
    this.onError = onError;
    this.socket = null;
    this.status = "disconnected";
    this.username = "";
    this.pendingGiftOccurrences = new Map();
  }

  emitState(status, detail = "") {
    this.status = status;
    this.onState({ status, detail });
  }

  buildUrl(username, apiKey) {
    const url = new URL("wss://ws.eulerstream.com");
    url.searchParams.set("apiKey", apiKey);
    url.searchParams.set("uniqueId", username);
    url.searchParams.set("schemaVersion", "v1");
    url.searchParams.set("features.bundleEvents", "true");
    url.searchParams.set("features.normalizeUniqueId", "true");
    url.searchParams.set("features.rawMessages", "false");
    return url;
  }

  isFirstGiftOccurrence(gift) {
    const now = Date.now();
    for (const [key, firstSeenAt] of this.pendingGiftOccurrences) {
      if (now - firstSeenAt > giftConfirmationWindowMs) this.pendingGiftOccurrences.delete(key);
      else break;
    }
    const key = giftOccurrenceKey(gift);
    if (this.pendingGiftOccurrences.has(key)) return false;
    this.pendingGiftOccurrences.set(key, now);
    if (this.pendingGiftOccurrences.size > maxPendingGiftOccurrences) {
      this.pendingGiftOccurrences.delete(this.pendingGiftOccurrences.keys().next().value);
    }
    return true;
  }

  handleMessage(raw) {
    let frame;
    try {
      frame = JSON.parse(raw.toString());
    } catch {
      this.onError("Euler Stream envió un mensaje que no se pudo interpretar.");
      return;
    }

    if (frame.error || frame.message?.error) {
      this.onError(`Euler Stream: ${frame.error?.message || frame.message?.error || "error remoto"}`);
      return;
    }

    const messages = Array.isArray(frame.messages) ? frame.messages : [frame];
    for (const message of messages) {
      if (isCommentMessage(message)) {
        const comment = normalizeComment(message);
        if (comment.text && !comment.text.startsWith("!") && this.shouldReadComment(comment)) this.onComment(comment);
        continue;
      }
      if (!isGiftMessage(message)) continue;
      const gift = normalizeGift(message);
      // Los regalos de racha envían actualizaciones; solo ejecutamos al finalizar la racha.
      if (Number(gift.giftType) === 1 && gift.repeatEnd !== true) continue;
      // TikTok reentrega cada regalo una segunda vez poco después. Procesamos solo la primera lectura.
      if (!this.isFirstGiftOccurrence(gift)) continue;
      this.onGift(gift);
    }
  }

  async connect(username, eulerStreamApiKey) {
    this.disconnect("Reconectando");
    if (!username) throw new Error("Escribe el usuario de un TikTok LIVE activo.");
    if (!eulerStreamApiKey) throw new Error("Añade una Euler Stream API Key.");

    this.username = username.replace(/^@/, "").trim();
    this.pendingGiftOccurrences.clear();
    this.emitState("connecting", `Conectando a @${this.username} mediante Euler Stream…`);
    const socket = new WebSocket(this.buildUrl(this.username, eulerStreamApiKey));
    this.socket = socket;

    socket.on("message", (data) => this.handleMessage(data));
    socket.on("error", (error) => this.onError(`Euler Stream: ${error.message}`));
    socket.on("close", (code, reason) => {
      if (this.socket !== socket) return;
      this.socket = null;
      const detail = closeDetails[code]?.replace("{username}", this.username) || reason.toString() || `Conexión cerrada (${code}).`;
      this.emitState(code === 1000 ? "disconnected" : "error", detail);
    });

    try {
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("Euler Stream tardó demasiado en responder.")), 10_000);
        socket.once("open", () => {
          clearTimeout(timeout);
          resolve();
        });
        socket.once("error", (error) => {
          clearTimeout(timeout);
          reject(error);
        });
        socket.once("close", (code, reason) => {
          clearTimeout(timeout);
          reject(new Error(closeDetails[code]?.replace("{username}", this.username) || reason.toString() || `Conexión cerrada (${code}).`));
        });
      });
      this.emitState("connected", `LIVE de @${this.username} conectado vía Euler Stream`);
      return { isConnected: true, roomId: null };
    } catch (error) {
      if (this.socket === socket) this.socket = null;
      socket.close();
      this.emitState("error", error.message);
      throw error;
    }
  }

  disconnect(detail = "Desconectado") {
    if (this.socket) {
      const socket = this.socket;
      this.socket = null;
      socket.removeAllListeners();
      socket.close();
    }
    this.pendingGiftOccurrences.clear();
    this.emitState("disconnected", detail);
  }
}
