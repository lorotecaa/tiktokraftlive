import { randomUUID } from "node:crypto";
import { publicConfig, sanitizeConfig } from "./config-store.js";
import { RuleEngine } from "./services/rule-engine.js";
import { GoalEngine } from "./services/goal-engine.js";
import { GiftOverlayEngine } from "./services/gift-overlay-engine.js";
import { RankingOverlayEngine } from "./services/ranking-overlay-engine.js";
import { HistoricalPointsEngine } from "./services/historical-points-engine.js";
import { ServerTapClient } from "./services/servertap.js";
import { TikTokClient, isAllowedTtsUser } from "./services/tiktok.js";
import { addWorkspaceManualPoints, addWorkspaceUserPoints, deleteWorkspaceUserPoints, listWorkspaceUserPoints } from "./services/user-points-store.js";

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
  constructor({ ownerId, config, overlayToken, saveConfig, io, commandsPerSecond, listSounds }) {
    this.ownerId = ownerId; this.config = config; this.overlayToken = overlayToken; this.saveConfig = saveConfig; this.io = io; this.commandsPerSecond = commandsPerSecond; this.listSounds = listSounds;
    this.state = { minecraft: { status: "disconnected", detail: "Sin conectar" }, tiktok: { status: "disconnected", detail: "Sin conectar" }, activity: [] };
    this.sequence = 0; this.saveQueue = Promise.resolve(); this.saveTimer = null;
    this.goalEngine = new GoalEngine({ getGoals: () => this.config.goals, onUpdate: (goal) => this.emit("goal:update", this.publicGoal(goal)) });
    this.giftEngine = new GiftOverlayEngine({ getOverlays: () => this.config.giftOverlays, onUpdate: ({ kind, record }) => this.emit("gift-overlay:update", { ...this.publicGift(kind), record }) });
    this.rankingEngine = new RankingOverlayEngine({ onUpdate: ({ kind, entries }) => this.emit("ranking-overlay:update", { kind, title: "Top Donadores", entries, customization: this.custom(`ranking:${kind}`) }) });
    this.pointsEngine = new HistoricalPointsEngine({
      list: (options) => listWorkspaceUserPoints(this.ownerId, options), add: (gift) => addWorkspaceUserPoints(this.ownerId, gift), addManual: (input) => addWorkspaceManualPoints(this.ownerId, input), remove: (username) => deleteWorkspaceUserPoints(this.ownerId, username),
      onUpdate: (entries) => this.emit("user-points:update", { entries: entries.slice(0, 100), configured: true }), onError: (error) => this.error(`Usuario y Puntos: ${error.message}`)
    });
    this.serverTap = new ServerTapClient({ commandsPerSecond, onState: (next) => { this.state.minecraft = next; this.broadcast(); }, onConsole: (entry) => this.activity({ type: "console", entry, message: entry.message }), onError: (message) => this.error(message) });
    this.rules = new RuleEngine({ sendCommand: (command, context) => this.serverTap.enqueue(command, context), onActivity: (entry) => { this.activity(entry); if (entry.type === "action" && entry.mapping?.audio) this.emit("mapping:sound", { audio: entry.mapping.audio, mappingId: entry.mapping.id }); } });
    this.tiktok = new TikTokClient({
      onState: (next) => { if (next.status === "disconnected") this.rankingEngine.reset(); this.state.tiktok = next; this.broadcast(); },
      onGift: (event) => { if (this.giftEngine.process(event).length) this.queueSave(); this.rankingEngine.process(event); this.pointsEngine.process(event); this.activity({ type: "gift", event, message: `${event.nickname} envió ${event.giftName}` }); try { this.rules.process(event, this.config.mappings); } catch (error) { this.error(error.message); } },
      // Las actualizaciones parciales solo sirven para refrescar el overlay.
      // El récord se guarda al recibir el evento final en onGift, que contiene
      // el repeatCount completo y ya se usa para acciones y actividad.
      onGiftProgress: (event) => { this.giftEngine.processStreak(event); },
      onMetric: (metric, amount) => { if (this.goalEngine.process(metric, amount).length) this.queueSave(); },
      onComment: (event) => { if (this.config.tts.enabled) this.emit("tiktok:comment", event); }, shouldReadComment: (event) => this.config.tts.enabled && isAllowedTtsUser(event, this.config.tts.allowedUsers), onError: (message) => this.error(message)
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
    return this;
  }
  room() { return `workspace:${this.ownerId}`; }
  reloadConfig({ config, overlayToken }) {
    this.config = config;
    this.overlayToken = overlayToken;
  }
  emit(event, payload) { this.io.to(this.room()).emit(event, payload); }
  activity(entry) { const item = { id: ++this.sequence, at: Date.now(), ...entry }; this.state.activity.unshift(item); this.state.activity = this.state.activity.slice(0, 100); this.emit("activity", item); }
  error(message) { console.error(`[${this.ownerId}] ${message}`); this.activity({ type: "error", message }); }
  custom(key) { return this.config.overlayCustomizations[key] || null; }
  publicGoal(goal) { return { ...goal, customization: this.custom(`goal:${goal.id}`) }; }
  publicGift(kind) { const definition = { "best-gift": ["bestGift", "Mejor Regalo"], "best-streak": ["bestStreak", "Mejor Racha"] }[kind]; return definition ? { kind, title: definition[1], record: this.config.giftOverlays[definition[0]], customization: this.custom(`gift:${kind}`) } : null; }
  publicRanking() { return { kind: "top-donors", title: "Top Donadores", entries: this.rankingEngine.entries(), customization: this.custom("ranking:top-donors") }; }
  publicPoints() { const customization = this.custom("user-points:historical"); return { kind: "historical", title: "Usuario y Puntos", entries: this.pointsEngine.entries(customization?.itemLimit || 10), customization }; }
  publicState() { return { ...this.state, config: publicConfig(this.config), rankings: { topDonors: this.rankingEngine.entries() }, userPoints: { entries: this.pointsEngine.entries(100), configured: true }, workspace: { overlayToken: this.overlayToken } }; }
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
  async dispose() { this.tiktok.disconnect("Sesión finalizada"); this.serverTap.disconnect("Sesión finalizada"); await Promise.all([this.saveNow(), this.pointsEngine.flush()]); }
  async saveMapping(input) { const mapping = sanitizeConfig({ mappings: [input] }).mappings[0]; if (!mapping) throw new Error("Añade un comando a la acción."); if (mapping.audio && !(await this.listSounds()).includes(mapping.audio)) throw new Error("El audio seleccionado ya no está disponible."); await this.saveNow(); const mappings = [...this.config.mappings]; const index = mappings.findIndex((entry) => entry.id === mapping.id); if (index >= 0) mappings[index] = mapping; else mappings.push(mapping); await this.save({ ...this.config, mappings }); return mapping; }
  async saveGoal(input) { const type = String(input?.type || "").toLowerCase(); const existing = this.config.goals.find((goal) => goal.id === input?.id || goal.type === type); const candidate = { ...input, id: existing?.id || randomUUID(), type }; const next = sanitizeConfig({ ...this.config, goals: [...this.config.goals.filter((goal) => goal.id !== existing?.id && goal.type !== type), candidate] }); const goal = next.goals.find((goal) => goal.id === candidate.id); if (!goal) throw new Error("Completa un objetivo válido."); await this.save(next); this.emit("goal:update", this.publicGoal(goal)); return this.publicGoal(goal); }
  async connectTikTok() { const connection = await this.tiktok.connect(this.config.tiktokUsername, this.config.eulerStreamApiKey); if (this.config.giftOverlays.resetOnNewLive) { this.giftEngine.reset(); await this.saveNow(); } this.activity({ type: "system", message: `TikTok LIVE conectado: @${this.config.tiktokUsername}` }); return connection; }
}
