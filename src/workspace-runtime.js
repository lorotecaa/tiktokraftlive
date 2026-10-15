import { randomUUID } from "node:crypto";
import { publicConfig, sanitizeConfig } from "./config-store.js";
import { RuleEngine } from "./services/rule-engine.js";
import { GoalEngine } from "./services/goal-engine.js";
import { GiftOverlayEngine } from "./services/gift-overlay-engine.js";
import { RankingOverlayEngine } from "./services/ranking-overlay-engine.js";
import { HistoricalPointsEngine } from "./services/historical-points-engine.js";
import { TimerEngine } from "./services/timer-engine.js";
import { ServerTapClient } from "./services/servertap.js";
import { TikTokClient, isAllowedTtsUser } from "./services/tiktok.js";
import { addWorkspaceManualPoints, addWorkspaceUserPoints, deleteWorkspaceUserPoints, listWorkspaceUserPoints } from "./services/user-points-store.js";
import { listGiftCatalog, upsertGiftCatalog, upsertGiftCatalogBatch } from "./services/gift-catalog-store.js";
import { fetchLiveRoomGifts } from "./services/tiktok-gift-catalog.js";
import { presetEffect } from "./action-preset-catalog.js";

function serverTapUrl(input, current) {
  if (input.serverTapHost === undefined) return input.serverTapUrl ?? current.url;
  const host = String(input.serverTapHost || "").trim();
  const port = String(input.serverTapPort || "").trim();
  const protocol = input.serverTapProtocol === "https:" ? "https:" : "http:";
  if (!host || !/^\d{1,5}$/.test(port) || Number(port) < 1 || Number(port) > 65_535) throw new Error("Indica una IP y puerto ServerTap válidos.");
  const url = new URL(host.includes("://") ? host : `${protocol}//${host}`);
  url.protocol = protocol; url.port = port; url.pathname = ""; url.search = ""; url.hash = "";
  return url.toString().replace(/\/$/, "");
}

export class WorkspaceRuntime {
  constructor({ ownerId, config, overlayToken, saveConfig, io, commandsPerSecond, listSounds, listVideos = async () => [], onGiftCatalogUpsert = async () => {}, onGiftCatalogBatchUpsert = async () => {} }) {
    this.ownerId = ownerId; this.config = config; this.overlayToken = overlayToken; this.saveConfig = saveConfig; this.io = io; this.commandsPerSecond = commandsPerSecond; this.listSounds = listSounds; this.listVideos = listVideos; this.onGiftCatalogUpsert = onGiftCatalogUpsert; this.onGiftCatalogBatchUpsert = onGiftCatalogBatchUpsert;
    this.state = { minecraft: { status: "disconnected", detail: "Sin conectar" }, tiktok: { status: "disconnected", detail: "Sin conectar" }, activity: [] };
    this.sequence = 0; this.giftSequence = 0; this.giftHistory = []; this.giftCatalog = new Map(); this.giftCatalogWriteQueue = Promise.resolve(); this.giftCatalogSyncPromise = null; this.giftCatalogSyncStatus = { status: "idle", detail: "Conecta tu LIVE para consultar sus regalos sin esperar donaciones." }; this.saveQueue = Promise.resolve(); this.saveTimer = null; this.liveReadCommentIds = new Map();
    this.goalEngine = new GoalEngine({ getGoals: () => this.config.goals, onUpdate: (goal) => this.emit("goal:update", this.publicGoal(goal)) });
    this.giftEngine = new GiftOverlayEngine({ getOverlays: () => this.config.giftOverlays, onUpdate: ({ kind, record }) => this.emit("gift-overlay:update", { ...this.publicGift(kind), record }) });
    this.rankingEngine = new RankingOverlayEngine({ onUpdate: ({ kind, entries }) => this.emit("ranking-overlay:update", { kind, title: "Top Donadores", entries, customization: this.custom(`ranking:${kind}`) }) });
    this.pointsEngine = new HistoricalPointsEngine({
      list: (options) => listWorkspaceUserPoints(this.ownerId, options), add: (gift) => addWorkspaceUserPoints(this.ownerId, gift), addManual: (input) => addWorkspaceManualPoints(this.ownerId, input), remove: (username) => deleteWorkspaceUserPoints(this.ownerId, username),
      onUpdate: (entries) => this.emit("user-points:update", { entries: entries.slice(0, 100), configured: true }), onError: (error) => this.error(`Usuario y Puntos: ${error.message}`)
    });
    this.serverTap = new ServerTapClient({ commandsPerSecond, onState: (next) => { this.state.minecraft = next; this.broadcast(); }, onConsole: (entry) => this.activity({ type: "console", entry, message: entry.message }), onError: (message) => this.error(message) });
    this.rules = new RuleEngine({ sendCommand: (command, context) => this.serverTap.enqueue(command, context), onActivity: (entry) => this.handleRuleActivity(entry), getMinecraftVersion: () => this.serverTap.minecraftVersion, isMappingActive: (mapping) => this.serverTap.status === "connected" && this.config.mappings.some((entry) => entry.id === mapping.id && entry.enabled) });
    this.timerEngine = new TimerEngine({
      getTimer: () => this.config.timer,
      onUpdate: (timer) => this.emitTimer(timer),
      onPersist: (runtime, options) => this.persistTimerRuntime(runtime, options),
      onExpire: () => this.executeTimerExpiryAction(),
      onError: (message) => this.error(`Temporizador: ${message}`)
    });
    this.tiktok = new TikTokClient({
      onState: (next) => { if (next.status === "disconnected") this.rankingEngine.reset(); this.state.tiktok = next; this.broadcast(); },
      onGift: (event) => { this.recordGift(event); if (this.giftEngine.process(event).length) this.queueSave(); this.rankingEngine.process(event); this.pointsEngine.process(event); this.activity({ type: "gift", event, message: `${event.nickname} envió ${event.giftName}` }); try { this.rules.process(event, this.config.mappings); } catch (error) { this.error(error.message); } },
      // Las actualizaciones parciales solo sirven para refrescar el overlay.
      // El récord se guarda al recibir el evento final en onGift, que contiene
      // el repeatCount completo y ya se usa para acciones y actividad.
      onGiftProgress: (event) => { this.giftEngine.processStreak(event); },
      onMetric: (metric, amount, event) => {
        if (this.goalEngine.process(metric, amount).length) this.queueSave();
        void this.timerEngine.processInteraction(metric, amount).catch((error) => this.error(`Temporizador: ${error.message}`));
        if (["likes", "follows", "shares"].includes(metric)) {
          try { this.rules.processInteraction(metric, event || { triggerType: metric, eventName: metric, repeatCount: amount, username: "espectador", nickname: "Espectador" }, this.config.mappings); }
          catch (error) { this.error(error.message); }
        }
      },
      onComment: (event) => { if (this.config.tts.enabled) this.emit("tiktok:comment", event); }, shouldReadComment: (event) => this.config.tts.enabled && isAllowedTtsUser(event, this.config.tts.allowedUsers), readCommentIds: this.liveReadCommentIds, onError: (message) => this.error(message)
    });
  }
  async initialize() {
    try {
      await this.pointsEngine.load();
    } catch (error) {
      // El historial es independiente del arranque del panel. Un problema de
      // migración o una caché de esquema de Supabase no debe rechazar Socket.IO.
      console.error(`[${this.ownerId}] No se pudo cargar Usuario y Puntos: ${error.message}`);
    }
    try {
      const catalog = await listGiftCatalog();
      this.giftCatalog = new Map(catalog.map((gift) => [gift.giftId, gift]));
    } catch (error) {
      // El catálogo es una ayuda del editor; no debe impedir que el LIVE ni
      // las acciones existentes arranquen si falta aplicar su migración.
      console.warn(`[${this.ownerId}] No se pudo cargar el catálogo de regalos: ${error.message}`);
    }
    this.timerEngine.initialize();
    return this;
  }
  room() { return `workspace:${this.ownerId}`; }
  publicRoom() { return `public-workspace:${this.ownerId}`; }
  reloadConfig({ config, overlayToken }) {
    this.config = config;
    this.overlayToken = overlayToken;
  }
  emit(event, payload) { this.io.to(this.room()).emit(event, payload); }
  emitPublic(event, payload) { this.io.of("/public").to(this.publicRoom()).emit(event, payload); }
  handleRuleActivity(entry) {
    this.activity(entry);
    if (entry.type !== "action" || !entry.mapping) return;
    if (entry.mapping.audio) this.emit("mapping:sound", { audio: entry.mapping.audio, mappingId: entry.mapping.id });
    if (entry.mapping.video) {
      this.emitPublic("action-video:play", {
        id: randomUUID(),
        at: Date.now(),
        mappingId: entry.mapping.id,
        videoUrl: `/media/videos/${encodeURIComponent(entry.mapping.video)}`,
        video: entry.mapping.video,
        triggerType: entry.mapping.triggerType || "gift",
        username: entry.event?.username || "",
        nickname: entry.event?.nickname || ""
      });
    }
  }
  emitTimer(timer = this.timerEngine.snapshot()) {
    this.emit("timer:update", this.timerState(timer));
    this.io.of("/public").to(this.publicRoom()).emit("timer:update", this.publicTimer(timer));
  }
  recordGift(event) {
    const gift = {
      id: ++this.giftSequence,
      at: Date.now(),
      giftName: event.giftName || "Regalo",
      giftId: String(event.giftId || "")
    };
    this.giftHistory.unshift(gift);
    this.giftHistory = this.giftHistory.slice(0, 200);
    this.emit("gift-history:update", this.giftHistory);
    this.recordGiftCatalog(event);
  }
  giftCatalogEntries() {
    return [...this.giftCatalog.values()]
      .sort((left, right) => String(right.lastSeenAt || "").localeCompare(String(left.lastSeenAt || "")) || left.giftName.localeCompare(right.giftName, "es"));
  }
  mergeGiftCatalog(gift) {
    if (!gift?.giftId) return;
    const current = this.giftCatalog.get(gift.giftId);
    this.giftCatalog.set(gift.giftId, { ...current, ...gift });
  }
  recordGiftCatalog(event) {
    const giftId = String(event?.giftId || "").trim();
    if (!giftId) return;
    const previous = this.giftCatalog.get(giftId);
    const gift = {
      giftId,
      giftName: String(event?.giftName || giftId).trim().slice(0, 80),
      coinValue: Math.max(0, Math.floor(Number(event?.coinValue) || 0)),
      giftImageUrl: String(event?.giftImageUrl || "").trim().slice(0, 2_048),
      lastSeenAt: new Date().toISOString()
    };
    const shouldPersist = !previous
      || (!previous.giftImageUrl && gift.giftImageUrl)
      || (!previous.coinValue && gift.coinValue)
      || /^regalo\s*#/i.test(previous.giftName || "");
    this.giftCatalog.set(giftId, { ...previous, ...gift });
    this.emit("gift-catalog:update", this.giftCatalogEntries());
    if (!shouldPersist) return;
    const write = this.giftCatalogWriteQueue.then(async () => {
      const saved = await upsertGiftCatalog(gift);
      if (!saved) return;
      this.mergeGiftCatalog(saved);
      await this.onGiftCatalogUpsert(saved);
    });
    this.giftCatalogWriteQueue = write.catch((error) => this.error(error.message));
  }
  setGiftCatalogSyncStatus(status, detail) {
    this.giftCatalogSyncStatus = { status, detail };
    this.emit("gift-catalog:sync-status", this.giftCatalogSyncStatus);
  }
  async syncGiftCatalog() {
    if (this.giftCatalogSyncPromise) return this.giftCatalogSyncPromise;
    if (this.tiktok.status !== "connected") throw new Error("Conecta tu TikTok LIVE antes de sincronizar sus regalos.");
    this.setGiftCatalogSyncStatus("loading", "Consultando los regalos disponibles en tu LIVE…");
    const sync = (async () => {
      const roomGifts = await fetchLiveRoomGifts(this.config.tiktokUsername, this.config.eulerStreamApiKey);
      if (!roomGifts.length) throw new Error("TikTok no devolvió regalos para este LIVE.");
      await this.giftCatalogWriteQueue;
      const lastSeenAt = new Date().toISOString();
      const merged = roomGifts.map((gift) => {
        const previous = this.giftCatalog.get(gift.giftId);
        return {
          giftId: gift.giftId,
          giftName: gift.giftName || previous?.giftName || `Regalo #${gift.giftId}`,
          coinValue: gift.coinValue || previous?.coinValue || 0,
          giftImageUrl: gift.giftImageUrl || previous?.giftImageUrl || "",
          lastSeenAt
        };
      });
      await upsertGiftCatalogBatch(merged);
      let added = 0;
      for (const gift of merged) {
        if (!this.giftCatalog.has(gift.giftId)) added += 1;
        this.mergeGiftCatalog(gift);
      }
      await this.onGiftCatalogBatchUpsert(merged);
      this.emit("gift-catalog:update", this.giftCatalogEntries());
      this.setGiftCatalogSyncStatus("success", `${roomGifts.length} regalos consultados; ${added} nuevos en el catálogo.`);
      return { count: roomGifts.length, added };
    })().catch((error) => {
      this.setGiftCatalogSyncStatus("error", "No se pudo consultar la lista de tu sala. Confirma que sigues en LIVE e inténtalo de nuevo; TikTok también puede restringir esta consulta gratuita.");
      console.warn(`[${this.ownerId}] No se pudo sincronizar el catálogo del LIVE: ${error.message}`);
      throw error;
    }).finally(() => { this.giftCatalogSyncPromise = null; });
    this.giftCatalogSyncPromise = sync;
    return sync;
  }
  activity(entry) { const item = { id: ++this.sequence, at: Date.now(), ...entry }; this.state.activity.unshift(item); this.state.activity = this.state.activity.slice(0, 100); this.emit("activity", item); }
  error(message) { console.error(`[${this.ownerId}] ${message}`); this.activity({ type: "error", message }); }
  custom(key) { return this.config.overlayCustomizations[key] || null; }
  publicGoal(goal) { return { ...goal, customization: this.custom(`goal:${goal.id}`) }; }
  publicGift(kind) { const definition = { "best-gift": ["bestGift", "Mejor Regalo"], "best-streak": ["bestStreak", "Mejor Racha"] }[kind]; return definition ? { kind, title: definition[1], record: this.config.giftOverlays[definition[0]], customization: this.custom(`gift:${kind}`) } : null; }
  publicRanking() { return { kind: "top-donors", title: "Top Donadores", entries: this.rankingEngine.entries(), customization: this.custom("ranking:top-donors") }; }
  publicPoints() { const customization = this.custom("user-points:historical"); return { kind: "historical", title: "Usuario y Puntos", entries: this.pointsEngine.entries(customization?.itemLimit || 10), customization }; }
  timerCoinMessage() {
    const timer = this.config.timer || {};
    const seconds = Number(timer.adjustments?.coins) || 0;
    const multiplier = timer.multiplier?.enabled ? Number(timer.multiplier.value) || 1 : 1;
    const effectiveSeconds = Number((seconds * multiplier).toFixed(3));
    const formattedSeconds = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 3 }).format(effectiveSeconds);
    return String(timer.coinText || "").replaceAll("{segundos}", formattedSeconds).slice(0, 180);
  }
  timerState(timer = this.timerEngine.snapshot()) { return { ...timer, coinMessage: this.timerCoinMessage() }; }
  publicTimer(timer = this.timerEngine.snapshot()) { return { ...this.timerState(timer), customization: this.custom("timer:main") }; }
  publicState() { return { ...this.state, giftHistory: this.giftHistory, giftCatalog: this.giftCatalogEntries(), giftCatalogSync: this.giftCatalogSyncStatus, config: publicConfig(this.config), timer: this.timerState(), rankings: { topDonors: this.rankingEngine.entries() }, userPoints: { entries: this.pointsEngine.entries(100), configured: true }, workspace: { overlayToken: this.overlayToken } }; }
  broadcast() { this.emit("state", this.publicState()); }
  async save(next = this.config) {
    // Conserva los cambios hechos mientras una escritura anterior espera a
    // Supabase. Reemplazar la configuración con esa respuesta antigua podía
    // restaurar un récord de Mejor Regalo ya superado.
    this.config = next;
    await this.saveConfig(this.ownerId, next);
    this.broadcast();
    return this.config;
  }
  queueSave() { if (this.saveTimer) return; this.saveTimer = setTimeout(() => { this.saveTimer = null; this.saveQueue = this.saveQueue.then(() => this.save()).catch((error) => this.error(error.message)); }, 500); }
  async saveNow() { if (this.saveTimer) { clearTimeout(this.saveTimer); this.saveTimer = null; } this.saveQueue = this.saveQueue.then(() => this.save()); await this.saveQueue; }
  async persistTimerRuntime(runtime, { immediate = false } = {}) { this.config = sanitizeConfig({ ...this.config, timer: { ...this.config.timer, runtime } }); if (immediate) await this.saveNow(); else this.queueSave(); }
  async saveTimerSettings(input) { this.config = sanitizeConfig({ ...this.config, timer: { ...this.config.timer, ...input, runtime: this.timerEngine.persistence() } }); await this.saveNow(); this.emitTimer(); return this.config.timer; }
  async executeTimerExpiryAction() {
    const mappingId = this.config.timer?.actionMappingId;
    this.activity({ type: "timer", message: "El temporizador llegó a 00:00" });
    if (!mappingId) return { executed: 0 };
    const mapping = this.config.mappings.find((entry) => entry.id === mappingId);
    if (!mapping) throw new Error("La acción configurada al finalizar ya no existe.");
    return this.rules.executeSelected(mapping, { giftId: mapping.giftId || "timer", giftName: mapping.giftName || "Temporizador", eventName: "Temporizador", username: "temporizador", nickname: "Temporizador", repeatCount: 1 }, { context: { timer: true }, message: "Acción del temporizador ejecutada" });
  }
  async dispose() { this.timerEngine.dispose(); this.rules.dispose(); this.tiktok.disconnect("Sesión finalizada"); this.serverTap.disconnect("Sesión finalizada"); await Promise.all([this.saveNow(), this.pointsEngine.flush(), this.giftCatalogWriteQueue]); }
  async saveMapping(input) {
    const existing = this.config.mappings.find((entry) => entry.id === input?.id);
    const mapping = sanitizeConfig({ mappings: [{ ...input, source: existing?.source || "command", presetGroupId: existing?.presetGroupId || "", presetPackId: existing?.presetPackId || "", presetEffectTitle: existing?.presetEffectTitle || "", presetEffectId: existing?.presetEffectId || "" }] }).mappings[0];
    if (!mapping) throw new Error("Configura al menos un comando, audio o video para la acción.");
    if (mapping.triggerType === "gift" && !mapping.giftName && !mapping.giftId) throw new Error("Indica al menos el nombre o ID del regalo.");
    if (mapping.audio && !(await this.listSounds()).includes(mapping.audio)) throw new Error("El audio seleccionado ya no está disponible.");
    if (mapping.video && !(await this.listVideos()).includes(mapping.video)) throw new Error("El video seleccionado ya no está disponible.");
    await this.saveNow();
    const mappings = [...this.config.mappings];
    const index = mappings.findIndex((entry) => entry.id === mapping.id);
    if (index >= 0) mappings[index] = mapping; else mappings.push(mapping);
    await this.save({ ...this.config, mappings });
    return mapping;
  }
  async saveMappingsBatch(input) {
    const inputs = input?.mappings;
    const packId = String(input?.packId || "").trim();
    if (!/^[a-z0-9-]{1,40}$/.test(packId)) throw new Error("El paquete seleccionado no es válido.");
    if (!Array.isArray(inputs) || inputs.length < 1 || inputs.length > 12) throw new Error("El paquete debe contener entre 1 y 12 acciones.");
    const presetGroupId = randomUUID();
    const mappings = inputs.map((entry) => sanitizeConfig({ mappings: [{ ...entry, id: `rule-${randomUUID()}`, source: "preset", presetGroupId, presetPackId: packId }] }).mappings[0]);
    if (mappings.some((mapping) => !mapping || mapping.triggerType !== "gift" || (!mapping.giftId && !mapping.giftName))) {
      throw new Error("Cada efecto necesita un regalo y un comando válido.");
    }
    if (mappings.some((mapping) => !mapping.command || mapping.audio || mapping.video)) {
      throw new Error("El paquete solo puede crear acciones de Minecraft con comando.");
    }
    const giftKeys = mappings.map((mapping) => mapping.giftId || mapping.giftName.toLocaleLowerCase());
    if (new Set(giftKeys).size !== giftKeys.length) throw new Error("Selecciona un regalo distinto para cada efecto.");
    await this.saveNow();
    await this.save({ ...this.config, mappings: [...this.config.mappings, ...mappings] });
    return mappings;
  }
  async savePresetEffect(input) {
    const packId = String(input?.packId || "");
    const selected = presetEffect(packId, String(input?.effectId || ""));
    if (!selected) throw new Error("Ese efecto de preajuste no existe.");
    const { effect } = selected;
    const giftId = String(input?.giftId || "").trim().slice(0, 80);
    const giftName = String(input?.giftName || "").trim().slice(0, 80);
    if (!giftId && !giftName) throw new Error("Selecciona un regalo para activar el efecto.");
    const existing = this.config.mappings.find((mapping) => mapping.source === "preset" && mapping.presetPackId === packId && mapping.presetEffectId === effect.id);
    const duplicate = this.config.mappings.find((mapping) => mapping.id !== existing?.id && mapping.source === "preset" && mapping.presetPackId === packId && mapping.presetEffectId && (giftId && mapping.giftId === giftId || giftName && mapping.giftName?.toLocaleLowerCase() === giftName.toLocaleLowerCase()));
    if (duplicate) throw new Error("Ese regalo ya está asignado a otro efecto de este paquete.");
    const mapping = sanitizeConfig({ mappings: [{
      id: existing?.id || `rule-${randomUUID()}`, enabled: true, triggerType: "gift", giftId, giftName,
      command: effect.command || effect.variants?.[0]?.[0] || "", audio: "", video: "", cooldownMs: 0,
      source: "preset", presetGroupId: packId, presetPackId: packId, presetEffectTitle: effect.title, presetEffectId: effect.id
    }] }).mappings[0];
    await this.saveNow();
    const mappings = [...this.config.mappings];
    const index = mappings.findIndex((entry) => entry.id === mapping.id);
    if (index >= 0) mappings[index] = mapping; else mappings.push(mapping);
    await this.save({ ...this.config, mappings });
    return mapping;
  }
  async saveSurvivalEffect(input) {
    return WorkspaceRuntime.prototype.savePresetEffect.call(this, { ...input, packId: "survival" });
  }
  async deletePresetGroup(groupId) {
    const id = String(groupId || "").trim();
    const removed = this.config.mappings.filter((mapping) => mapping.source === "preset" && mapping.presetGroupId === id);
    if (!id || !removed.length) throw new Error("Ese paquete de preajustes ya no existe.");
    const removedIds = new Set(removed.map((mapping) => mapping.id));
    const timer = removedIds.has(this.config.timer?.actionMappingId) ? { ...this.config.timer, actionMappingId: "" } : this.config.timer;
    await this.save({ ...this.config, timer, mappings: this.config.mappings.filter((mapping) => !removedIds.has(mapping.id)) });
    return { groupId: id, deleted: removed.length };
  }
  async saveGoal(input) { const type = String(input?.type || "").toLowerCase(); const existing = this.config.goals.find((goal) => goal.id === input?.id || goal.type === type); const candidate = { ...input, id: existing?.id || randomUUID(), type }; const next = sanitizeConfig({ ...this.config, goals: [...this.config.goals.filter((goal) => goal.id !== existing?.id && goal.type !== type), candidate] }); const goal = next.goals.find((goal) => goal.id === candidate.id); if (!goal) throw new Error("Completa un objetivo válido."); await this.save(next); this.emit("goal:update", this.publicGoal(goal)); return this.publicGoal(goal); }
  async connectTikTok() { const connection = await this.tiktok.connect(this.config.tiktokUsername, this.config.eulerStreamApiKey); this.giftHistory = []; this.emit("gift-history:update", this.giftHistory); if (this.config.giftOverlays.resetOnNewLive) { this.giftEngine.reset(); await this.saveNow(); } this.activity({ type: "system", message: `TikTok LIVE conectado: @${this.config.tiktokUsername}` }); void this.syncGiftCatalog().catch(() => {}); return connection; }
}
