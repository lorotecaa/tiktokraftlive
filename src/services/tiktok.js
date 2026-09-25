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
const incompleteStreakGraceMs = 1_500;
const maxPendingGiftOccurrences = 2_000;
const maxCommentLength = 220;
const maxRememberedCommentIds = 10_000;
const commentReplayQuietMs = 3_000;
const reconnectDelaysMs = [3_000, 6_000, 12_000, 24_000, 30_000];
const nonRetryableCloseCodes = new Set([4400, 4401, 4403, 4404]);

function normalizeText(value, fallback) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function normalizeBoolean(value) {
  return value === true || value === 1 || value === "1" || value === "true";
}

function firstUrl(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function firstPositiveNumber(...values) {
  for (const value of values) {
    const number = Number(value);
    if (Number.isFinite(number) && number > 0) return number;
  }
  return 0;
}

function messageIdentifier(...values) {
  for (const value of values) {
    if (value === undefined || value === null) continue;
    const identifier = String(value).trim();
    if (identifier) return identifier.slice(0, 256);
  }
  return "";
}

function giftImageUrl(data, gift) {
  const image = data.giftImage || data.gift_image || gift.giftImage || gift.gift_image || gift.image || {};
  return firstUrl(
    data.giftPictureUrl,
    data.gift_picture_url,
    data.giftImageUrl,
    data.gift_image_url,
    gift.giftPictureUrl,
    gift.gift_picture_url,
    gift.giftImageUrl,
    gift.gift_image_url,
    image.giftPictureUrl,
    image.gift_picture_url,
    image.url,
    image.urlList?.[0],
    image.url_list?.[0]
  );
}

function normalizeGift(message) {
  const data = message?.data || message || {};
  const user = data.user || data.sender || data.fromUser || {};
  const gift = { ...data.giftDetails, ...data.giftInfo, ...data.gift };
  const giftId = String(data.giftId ?? data.gift_id ?? gift.id ?? gift.giftId ?? gift.gift_id ?? "");

  const repeatCount = Math.max(1, Number(data.repeatCount ?? data.repeat_count ?? data.comboCount ?? data.combo_count ?? gift.repeatCount ?? gift.repeat_count ?? data.giftCount ?? data.gift_count ?? data.count) || 1);
  // En algunos regalos TikTok deja diamondCount/coinCount en 0, aunque el
  // detalle del regalo sí contiene su precio real. Ignorar los ceros aquí
  // permite conservar el valor individual correcto para Mejor Regalo.
  const coinValue = firstPositiveNumber(
    data.diamondCount, data.diamond_count, data.coinCount, data.coin_count,
    gift.diamondCount, gift.diamond_count, gift.coinCount, gift.coin_count,
    gift.price, data.price
  );

  return {
    giftId,
    giftName: normalizeText(data.giftName || data.gift_name || gift.giftName || gift.gift_name || gift.name, giftId ? `Regalo #${giftId}` : "Regalo"),
    repeatCount,
    repeatEnd: normalizeBoolean(data.repeatEnd ?? data.repeat_end ?? gift.repeatEnd ?? gift.repeat_end),
    giftType: data.giftType ?? data.gift_type ?? gift.giftType ?? gift.gift_type,
    coinValue,
    coins: coinValue * repeatCount,
    giftImageUrl: giftImageUrl(data, gift),
    groupId: normalizeText(data.groupId || data.group_id || gift.groupId || gift.group_id, ""),
    messageId: normalizeText(data.msgId || data.msg_id || data.messageId || data.message_id, ""),
    username: normalizeText(user.uniqueId || user.unique_id || user.username || user.userId, "espectador"),
    nickname: normalizeText(user.nickname || user.displayName || user.display_name || user.uniqueId, "espectador"),
    userAvatarUrl: firstUrl(
      user.avatarThumb?.urlList?.[0], user.avatar_thumb?.url_list?.[0],
      user.avatarMedium?.urlList?.[0], user.avatar_medium?.url_list?.[0],
      user.avatarLarger?.urlList?.[0], user.avatar_larger?.url_list?.[0],
      user.avatarUrl, user.avatar_url
    )
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

function isLikeMessage(message) {
  const type = String(message?.type || message?.eventType || message?.event || "").toLowerCase();
  return type === "webcastlikemessage" || type === "like" || type === "likemessage";
}

function isFollowMessage(message) {
  const type = String(message?.type || message?.eventType || message?.event || "").toLowerCase();
  const data = message?.data || message || {};
  const action = String(data.action || data.actionType || data.displayType || "").toLowerCase();
  return type === "follow" || type === "webcastfollowmessage" || ((type === "webcastsocialmessage" || type === "social") && action.includes("follow"));
}

function metricAmount(message, fields, fallback = 1) {
  const data = message?.data || message || {};
  for (const field of fields) {
    const value = Number(data[field]);
    if (Number.isFinite(value) && value > 0) return value;
  }
  return fallback;
}

function normalizeComment(message) {
  const data = message?.data || message || {};
  const user = data.user || data.sender || data.fromUser || data;
  const common = data.common || data.webcastMessage?.common || message?.common || {};
  const text = data.comment ?? data.text ?? data.commentText ?? data.content;
  const badges = collectUserBadges(data, user);
  const username = normalizeText(user.uniqueId || user.unique_id || user.username || user.displayId, "");
  const eventId = messageIdentifier(
    data.msgId, data.msg_id, data.messageId, data.message_id, data.logId, data.log_id, data.eventId, data.event_id,
    data.webcastMessage?.msgId, data.webcastMessage?.msg_id, data.webcastMessage?.messageId, data.webcastMessage?.message_id,
    common.msgId, common.msg_id, common.messageId, common.message_id, common.logId, common.log_id,
    message?.msgId, message?.msg_id, message?.messageId, message?.message_id, message?.logId, message?.log_id, message?.eventId, message?.event_id
  );
  // Algunos esquemas normalizados de Euler no exponen msgId, pero sí la marca
  // de creación original. Se conserva solo como apoyo para duplicados reales.
  const createdAt = messageIdentifier(data.createTime, data.create_time, data.createdAt, data.created_at, data.eventTime, data.event_time, data.timestampMs, data.timestamp_ms, common.createTime, common.create_time, common.createdAt, common.created_at, common.eventTime, common.event_time);
  return {
    // Dos mensajes idénticos nuevos siguen teniendo un ID o momento de evento
    // distinto. Si Euler no entrega ninguno, no se deduplica para no silenciar
    // mensajes legítimos.
    messageId: eventId || (createdAt ? `chat:${username}:${createdAt}:${String(text || "")}` : ""),
    nickname: normalizeText(user.nickname || user.displayName || user.display_name || user.uniqueId || data.nickname, "espectador"),
    username,
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
  const eventId = gift.groupId || gift.messageId;
  if (eventId) return `event:${eventId}`;
  return [
    gift.username,
    gift.giftId || gift.giftName
  ].map((value) => String(value || "").trim()).join("\0");
}

export class TikTokClient {
  constructor({ onState, onGift, onGiftProgress = () => {}, onComment, onMetric = () => {}, shouldReadComment = () => true, readCommentIds = null, onError }) {
    this.onState = onState;
    this.onGift = onGift;
    this.onGiftProgress = onGiftProgress;
    this.onComment = onComment;
    this.onMetric = onMetric;
    this.shouldReadComment = shouldReadComment;
    this.onError = onError;
    this.socket = null;
    this.status = "disconnected";
    this.username = "";
    this.lastLiveUsername = "";
    this.hasOpenedLiveConnection = false;
    this.connectionSettings = null;
    this.reconnectEnabled = false;
    this.reconnectAttempt = 0;
    this.reconnectTimer = null;
    this.connectingPromise = null;
    this.connectingSocket = null;
    this.connectingReject = null;
    this.pendingGiftOccurrences = new Map();
    // El WorkspaceRuntime entrega este Map para que la memoria esté ligada al
    // LIVE actual, no al WebSocket que Euler puede reemplazar al reconectar.
    this.readCommentIds = readCommentIds instanceof Map ? readCommentIds : new Map();
    this.commentReplayBarrier = null;
    this.pendingIncompleteStreaks = new Map();
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

  clearReconnectTimer() {
    if (!this.reconnectTimer) return;
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }

  clearCommentReplayBarrier(socket = null) {
    const barrier = this.commentReplayBarrier;
    if (!barrier || (socket && barrier.socket !== socket)) return;
    if (barrier.timer) clearTimeout(barrier.timer);
    this.commentReplayBarrier = null;
  }

  armCommentReplayBarrier(barrier) {
    if (this.commentReplayBarrier !== barrier) return;
    if (barrier.timer) clearTimeout(barrier.timer);
    barrier.timer = setTimeout(() => {
      if (this.commentReplayBarrier !== barrier) return;
      barrier.timer = null;
      barrier.accepting = true;
    }, commentReplayQuietMs);
    barrier.timer.unref?.();
  }

  beginCommentReplayBarrier(socket) {
    this.clearCommentReplayBarrier();
    const barrier = { socket, accepting: false, timer: null };
    this.commentReplayBarrier = barrier;
    // Si Euler no entrega historial, el punto cero queda listo tras la misma
    // pausa corta que se usa para separar el bloque de repetición.
    this.armCommentReplayBarrier(barrier);
  }

  closeCurrentSocket() {
    if (!this.socket) return;
    const socket = this.socket;
    this.socket = null;
    this.clearCommentReplayBarrier(socket);
    if (this.connectingSocket === socket) {
      const reject = this.connectingReject;
      this.connectingSocket = null;
      this.connectingPromise = null;
      this.connectingReject = null;
      reject?.(new Error("La conexión fue reemplazada."));
    }
    socket.removeAllListeners();
    socket.close();
  }

  closeDetail(code, reason) {
    return closeDetails[code]?.replace("{username}", this.username) || reason?.toString() || `Conexión cerrada (${code}).`;
  }

  scheduleReconnect(detail) {
    if (!this.reconnectEnabled || !this.connectionSettings || this.reconnectTimer) return;
    const attempt = ++this.reconnectAttempt;
    const delay = reconnectDelaysMs[Math.min(attempt - 1, reconnectDelaysMs.length - 1)];
    this.emitState("reconnecting", `${detail} Reintentando en ${Math.ceil(delay / 1_000)} s (intento ${attempt})…`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.reconnectEnabled || !this.connectionSettings || this.socket || this.connectingPromise) return;
      this.openConnection({ reconnecting: true }).catch(() => {
        // El cierre del socket programa el siguiente intento. Si el error no
        // generó cierre, el catch de openConnection lo agenda una sola vez.
      });
    }, delay);
    this.reconnectTimer.unref?.();
  }

  handleSocketClose(socket, code, reason) {
    if (this.socket !== socket) return;
    this.socket = null;
    this.clearCommentReplayBarrier(socket);
    if (this.connectingSocket === socket) {
      this.connectingSocket = null;
      this.connectingPromise = null;
      this.connectingReject = null;
    }
    this.clearAllIncompleteStreaks();
    const detail = this.closeDetail(code, reason);
    if (!this.reconnectEnabled) {
      this.emitState("disconnected", detail);
      return;
    }
    if (nonRetryableCloseCodes.has(code)) {
      this.reconnectEnabled = false;
      this.clearReconnectTimer();
      this.emitState("error", detail);
      return;
    }
    this.scheduleReconnect(detail);
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

  isFirstReadComment(comment) {
    // Si Euler no proporciona un ID estable, no intentamos adivinarlo usando
    // texto/usuario: así un mensaje nuevo e idéntico nunca se descarta.
    if (!comment.messageId) return true;
    if (this.readCommentIds.has(comment.messageId)) return false;
    this.readCommentIds.set(comment.messageId, Date.now());
    if (this.readCommentIds.size > maxRememberedCommentIds) {
      this.readCommentIds.delete(this.readCommentIds.keys().next().value);
    }
    return true;
  }

  shouldDiscardReplayedComment(comment, sourceSocket) {
    const barrier = this.commentReplayBarrier;
    if (!barrier || barrier.socket !== sourceSocket) return false;
    if (barrier.accepting) return false;
    // Cada comentario inicial extiende la fase de descarte. Al completarse el
    // bloque de historial y quedar el stream en silencio, se fija el punto
    // cero y los siguientes comentarios pasan al TTS.
    this.armCommentReplayBarrier(barrier);
    return true;
  }

  incompleteStreakKey(gift) {
    return gift.groupId || [gift.username, gift.giftId || gift.giftName].map((value) => String(value || "").trim()).join("\0");
  }

  clearIncompleteStreak(key) {
    const pending = this.pendingIncompleteStreaks.get(key);
    if (!pending) return;
    clearTimeout(pending.timer);
    this.pendingIncompleteStreaks.delete(key);
  }

  clearAllIncompleteStreaks() {
    for (const { timer } of this.pendingIncompleteStreaks.values()) clearTimeout(timer);
    this.pendingIncompleteStreaks.clear();
  }

  deliverGift(gift) {
    if (!this.isFirstGiftOccurrence(gift)) return;
    if (gift.coins) this.onMetric("coins", gift.coins);
    this.onGift(gift);
  }

  deferIncompleteStreak(gift) {
    const key = this.incompleteStreakKey(gift);
    this.clearIncompleteStreak(key);
    const timer = setTimeout(() => {
      this.pendingIncompleteStreaks.delete(key);
      this.deliverGift(gift);
    }, incompleteStreakGraceMs);
    timer.unref?.();
    this.pendingIncompleteStreaks.set(key, { timer });
  }

  handleMessage(raw, sourceSocket = this.socket) {
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
      if (isLikeMessage(message)) {
        this.onMetric("likes", metricAmount(message, ["likeCount", "like_count", "count", "total"]));
        continue;
      }
      if (isFollowMessage(message)) {
        this.onMetric("follows", 1);
        continue;
      }
      if (isCommentMessage(message)) {
        const comment = normalizeComment(message);
        if (comment.text && !comment.text.startsWith("!") && !this.shouldDiscardReplayedComment(comment, sourceSocket) && this.shouldReadComment(comment) && this.isFirstReadComment(comment)) this.onComment(comment);
        continue;
      }
      if (!isGiftMessage(message)) continue;
      const gift = normalizeGift(message);
      // Los regalos de racha envían actualizaciones; solo ejecutamos al finalizar la racha.
      if (Number(gift.giftType) === 1) {
        // El contador del combo puede crecer durante varios eventos antes de
        // repeatEnd. El overlay escucha cada progreso, pero la acción sigue
        // procesándose solo una vez mediante deliverGift.
        this.onGiftProgress(gift);
        if (!gift.repeatEnd) {
          this.deferIncompleteStreak(gift);
          continue;
        }
        this.clearIncompleteStreak(this.incompleteStreakKey(gift));
      }
      // TikTok reentrega cada regalo una segunda vez poco después. Procesamos solo la primera lectura.
      this.deliverGift(gift);
    }
  }

  async connect(username, eulerStreamApiKey) {
    if (!username) throw new Error("Escribe el usuario de un TikTok LIVE activo.");
    if (!eulerStreamApiKey) throw new Error("Añade una Euler Stream API Key.");

    const connectionSettings = { username: username.replace(/^@/, "").trim(), eulerStreamApiKey };
    if (this.socket && this.status === "connected" && this.connectionSettings?.username === connectionSettings.username && this.connectionSettings?.eulerStreamApiKey === connectionSettings.eulerStreamApiKey) return { isConnected: true, roomId: null };
    // Solo un LIVE distinto inicia una memoria nueva. Volver a abrir el mismo
    // usuario, incluso mediante el botón Conectar, sigue siendo reconexión.
    if (this.lastLiveUsername !== connectionSettings.username) {
      this.lastLiveUsername = connectionSettings.username;
      this.hasOpenedLiveConnection = false;
      this.readCommentIds.clear();
    }
    this.reconnectEnabled = true;
    this.connectionSettings = connectionSettings;
    this.reconnectAttempt = 0;
    this.clearReconnectTimer();
    this.closeCurrentSocket();
    this.pendingGiftOccurrences.clear();
    this.clearCommentReplayBarrier();
    this.clearAllIncompleteStreaks();
    return this.openConnection();
  }

  async openConnection({ reconnecting = false } = {}) {
    if (!this.reconnectEnabled || !this.connectionSettings) throw new Error("La reconexión fue cancelada.");
    if (this.connectingPromise) return this.connectingPromise;
    if (this.socket && this.status === "connected") return { isConnected: true, roomId: null };

    this.username = this.connectionSettings.username;
    this.emitState(reconnecting ? "reconnecting" : "connecting", reconnecting ? `Reconectando a @${this.username} mediante Euler Stream…` : `Conectando a @${this.username} mediante Euler Stream…`);
    const socket = new WebSocket(this.buildUrl(this.username, this.connectionSettings.eulerStreamApiKey));
    this.socket = socket;

    socket.on("message", (data) => this.handleMessage(data, socket));
    socket.on("error", (error) => this.onError(`Euler Stream: ${error.message}`));
    socket.on("close", (code, reason) => this.handleSocketClose(socket, code, reason));

    let rejectOpening;
    const opening = new Promise((resolve, reject) => {
      rejectOpening = reject;
      const timeout = setTimeout(() => reject(new Error("Euler Stream tardó demasiado en responder.")), 10_000);
      socket.once("open", () => {
        clearTimeout(timeout);
        // La primera apertura de este LIVE acepta su historial. Todas las
        // siguientes, sin importar si son automáticas o manuales, descartan
        // el bloque inicial que Euler reenvía.
        if (this.hasOpenedLiveConnection) this.beginCommentReplayBarrier(socket);
        else this.clearCommentReplayBarrier();
        this.hasOpenedLiveConnection = true;
        resolve();
      });
      socket.once("error", (error) => {
        clearTimeout(timeout);
        reject(error);
      });
      socket.once("close", (code, reason) => {
        clearTimeout(timeout);
        reject(new Error(this.closeDetail(code, reason)));
      });
    });
    this.connectingSocket = socket;
    this.connectingPromise = opening;
    this.connectingReject = rejectOpening;

    try {
      await opening;
      if (this.socket !== socket) throw new Error("La conexión fue reemplazada.");
      this.connectingSocket = null;
      this.connectingPromise = null;
      this.connectingReject = null;
      this.reconnectAttempt = 0;
      this.emitState("connected", `LIVE de @${this.username} conectado vía Euler Stream`);
      return { isConnected: true, roomId: null };
    } catch (error) {
      const ownsSocket = this.socket === socket;
      if (this.connectingSocket === socket) {
        this.connectingSocket = null;
        this.connectingPromise = null;
        this.connectingReject = null;
      }
      if (ownsSocket) {
        this.socket = null;
        socket.removeAllListeners();
        socket.close();
      }
      if (this.reconnectEnabled && ownsSocket) this.scheduleReconnect(error.message || "No se pudo conectar a Euler Stream.");
      throw error;
    }
  }

  disconnect(detail = "Desconectado") {
    this.reconnectEnabled = false;
    this.connectionSettings = null;
    this.reconnectAttempt = 0;
    this.clearReconnectTimer();
    this.closeCurrentSocket();
    this.pendingGiftOccurrences.clear();
    this.clearCommentReplayBarrier();
    this.clearAllIncompleteStreaks();
    this.emitState("disconnected", detail);
  }
}
