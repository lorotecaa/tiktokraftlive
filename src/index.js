import "dotenv/config";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { Server } from "socket.io";
import { listAvailableSounds, sanitizeConfig } from "./config-store.js";
import { authConfigured, changePassword, refreshSession, signIn, signUp, userFromAccessToken } from "./auth-store.js";
import { claimWorkspace, saveWorkspaceConfig, workspaceByOverlayToken } from "./workspace-store.js";
import { WorkspaceRuntime } from "./workspace-runtime.js";
import { listWorkspaceUserPoints } from "./services/user-points-store.js";

const directory = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const server = http.createServer(app);
const io = new Server(server, { serveClient: true });
const workspaces = new Map();
const port = Number(process.env.PORT || 3180);
const host = process.env.HOST || "0.0.0.0";
const commandRate = Number(process.env.COMMANDS_PER_SECOND || 5);
app.use(express.json({ limit: "32kb" }));

async function workspaceFor(id) {
  if (!workspaces.has(id)) workspaces.set(id, (async () => {
    const record = await claimWorkspace(id);
    return new WorkspaceRuntime({ ...record, saveConfig: saveWorkspaceConfig, io, commandsPerSecond: commandRate, listSounds: listAvailableSounds }).initialize();
  })());
  try {
    const workspace = await workspaces.get(id);
    // Si la configuración fue recuperada o corregida mientras este proceso
    // seguía activo, una nueva sesión debe recibir la versión persistida.
    const record = await claimWorkspace(id);
    workspace.reloadConfig(record);
    return workspace;
  } catch (error) { workspaces.delete(id); throw error; }
}
async function identity(token) { const user = await userFromAccessToken(token); return { user, workspace: await workspaceFor(user.id) }; }
function tokenFrom(request) { return String(request.headers.authorization || "").replace(/^Bearer\s+/i, ""); }
function serverTapUrl(input, current) { if (input.serverTapHost === undefined) return input.serverTapUrl || current; const host = String(input.serverTapHost || "").trim(); const port = String(input.serverTapPort || "").trim(); if (!host || !/^\d{1,5}$/.test(port) || Number(port) < 1 || Number(port) > 65535) throw new Error("Indica una IP y puerto ServerTap válidos."); const url = new URL(host.includes("://") ? host : `${input.serverTapProtocol === "https:" ? "https" : "http"}://${host}`); url.port = port; url.pathname = ""; url.search = ""; url.hash = ""; return url.toString().replace(/\/$/, ""); }
async function protectedRoute(request, response, next) { try { request.session = await identity(tokenFrom(request)); next(); } catch (error) { response.status(401).json({ error: error.message }); } }
function acknowledge(done, action, workspace) { Promise.resolve().then(action).then((data) => done?.({ ok: true, data })).catch((error) => { workspace.error(error.message); done?.({ ok: false, error: error.message }); }); }

app.post("/api/auth/signup", async (request, response, next) => { try { response.json(await signUp(String(request.body?.email || "").trim(), String(request.body?.password || ""))); } catch (error) { next(error); } });
app.post("/api/auth/signin", async (request, response, next) => { try { response.json(await signIn(String(request.body?.email || "").trim(), String(request.body?.password || ""))); } catch (error) { next(error); } });
app.post("/api/auth/refresh", async (request, response, next) => { try { response.json(await refreshSession(String(request.body?.refresh_token || ""))); } catch (error) { next(error); } });
app.get("/api/health", (_request, response) => response.json({ ok: true, authConfigured }));
app.get("/api/state", protectedRoute, (request, response) => response.json({ ...request.session.workspace.publicState(), account: { email: request.session.user.email } }));
app.post("/api/auth/password", protectedRoute, async (request, response, next) => { try { await changePassword(tokenFrom(request), String(request.body?.password || "")); response.json({ ok: true }); } catch (error) { next(error); } });
app.get("/api/sounds", protectedRoute, async (_request, response, next) => { try { response.json({ sounds: await listAvailableSounds() }); } catch (error) { next(error); } });
app.get("/api/user-points", protectedRoute, async (request, response, next) => { try { response.json({ entries: await listWorkspaceUserPoints(request.session.user.id, { query: request.query.q, limit: request.query.limit }), configured: true }); } catch (error) { next(error); } });

async function publicSpace(token) { const data = await workspaceByOverlayToken(token); return data ? workspaceFor(data.ownerId) : null; }
app.get("/widget/:token/goal/:id", (_request, response) => response.sendFile(path.join(directory, "public", "goal-widget.html")));
app.get("/widget/:token/gift/:kind", (_request, response) => response.sendFile(path.join(directory, "public", "gift-widget.html")));
app.get("/widget/:token/ranking/top-donors", (_request, response) => response.sendFile(path.join(directory, "public", "ranking-widget.html")));
app.get("/widget/:token/user-points", (_request, response) => response.sendFile(path.join(directory, "public", "user-points-widget.html")));
app.get("/api/public/:token/goal/:id", async (request, response) => { const w = await publicSpace(request.params.token); const goal = w?.config.goals.find((item) => item.id === request.params.id); if (!goal) return response.sendStatus(404); response.json({ goal: w.publicGoal(goal) }); });
app.get("/api/public/:token/gift/:kind", async (request, response) => { const w = await publicSpace(request.params.token); const overlay = w?.publicGift(request.params.kind); if (!overlay) return response.sendStatus(404); response.json({ overlay }); });
app.get("/api/public/:token/ranking", async (request, response) => { const w = await publicSpace(request.params.token); if (!w) return response.sendStatus(404); response.json({ overlay: w.publicRanking() }); });
app.get("/api/public/:token/user-points", async (request, response, next) => {
  try {
    const workspace = await workspaceByOverlayToken(request.params.token);
    if (!workspace) return response.sendStatus(404);
    const customization = workspace.config.overlayCustomizations?.["user-points:historical"] || null;
    const limit = Math.max(1, Math.min(Number(customization?.itemLimit) || 10, 50));
    const entries = await listWorkspaceUserPoints(workspace.ownerId, { limit });
    response.json({ overlay: { kind: "historical", title: "Usuario y Puntos", entries, customization } });
  } catch (error) { next(error); }
});
app.use(express.static(path.join(directory, "public")));

io.use(async (socket, next) => { try { const session = await identity(socket.handshake.auth?.token); socket.data.session = session; next(); } catch (error) { next(new Error(error.message)); } });
io.on("connection", (socket) => {
  const w = socket.data.session.workspace; socket.join(w.room()); socket.emit("state", { ...w.publicState(), account: { email: socket.data.session.user.email } });
  socket.on("settings:save", (input, done) => acknowledge(done, () => w.save(sanitizeConfig({ ...w.config, tiktokUsername: input.tiktokUsername ?? w.config.tiktokUsername, eulerStreamApiKey: input.eulerStreamApiKey || w.config.eulerStreamApiKey, serverTap: { ...w.config.serverTap, url: serverTapUrl(input, w.config.serverTap.url), key: input.serverTapKey || w.config.serverTap.key } })), w));
  socket.on("tts:save", (input, done) => acknowledge(done, async () => { await w.save({ ...w.config, tts: { ...w.config.tts, ...input } }); return w.config.tts; }, w));
  socket.on("profile:save", (input, done) => acknowledge(done, async () => { const profile = sanitizeConfig({ profile: input }).profile; await w.save({ ...w.config, profile }); return profile; }, w));
  socket.on("user-points:transaction", (input, done) => acknowledge(done, async () => { const entry = await w.pointsEngine.addTransaction(input); w.activity({ type: "user-points", message: `Transacción manual: ${entry.nickname || entry.username}` }); return entry; }, w));
  socket.on("gift-overlays:save", (input, done) => acknowledge(done, async () => { await w.save({ ...w.config, giftOverlays: { ...w.config.giftOverlays, resetOnNewLive: input?.resetOnNewLive === true } }); return w.config.giftOverlays; }, w));
  socket.on("gift-overlays:reset", (_input, done) => acknowledge(done, async () => { w.giftEngine.reset(); await w.saveNow(); return w.config.giftOverlays; }, w));
  socket.on("overlay-customization:save", (input, done) => acknowledge(done, async () => { const key = String(input?.key || ""); const customization = sanitizeConfig({ overlayCustomizations: { [key]: input?.customization } }).overlayCustomizations[key]; if (!customization) throw new Error("Overlay inválido."); await w.save({ ...w.config, overlayCustomizations: { ...w.config.overlayCustomizations, [key]: customization } }); w.emit("overlay-customization:update", { key, customization }); return { key, customization }; }, w));
  socket.on("goal:save", (input, done) => acknowledge(done, () => w.saveGoal(input), w));
  socket.on("minecraft:connect", (_input, done) => acknowledge(done, () => w.serverTap.connect(w.config.serverTap), w));
  socket.on("minecraft:disconnect", (_input, done) => acknowledge(done, () => w.serverTap.disconnect(), w));
  socket.on("tiktok:connect", (_input, done) => acknowledge(done, () => w.connectTikTok(), w));
  socket.on("tiktok:disconnect", (_input, done) => acknowledge(done, async () => { w.tiktok.disconnect(); w.giftEngine.reset(); w.rankingEngine.reset(); await w.saveNow(); return w.config.giftOverlays; }, w));
  socket.on("mapping:save", (input, done) => acknowledge(done, () => w.saveMapping(input), w));
  socket.on("mapping:delete", (id, done) => acknowledge(done, async () => { await w.save({ ...w.config, mappings: w.config.mappings.filter((item) => item.id !== id) }); return { id }; }, w));
  socket.on("mapping:test", (id, done) => acknowledge(done, () => { const mapping = w.config.mappings.find((item) => item.id === id); if (!mapping) throw new Error("No existe esa acción."); const event = { giftId: mapping.giftId || "demo", giftName: mapping.giftName || "Regalo de prueba", repeatCount: 1, username: "prueba", nickname: "Prueba" }; const command = w.rules.render(mapping.command, event); w.serverTap.enqueue(command, { test: true, mappingId: mapping.id }); w.activity({ type: "action", event, mapping, command, message: "Prueba enviada a Minecraft" }); return { command }; }, w));
  socket.on("gift:simulate", (input, done) => acknowledge(done, () => w.rules.process({ giftId: String(input?.giftId || "demo"), giftName: String(input?.giftName || "Regalo de prueba"), repeatCount: Math.max(1, Number(input?.repeatCount) || 1), username: "prueba", nickname: "Prueba" }, w.config.mappings), w));
});
app.use((error, _request, response, _next) => { console.error(error); response.status(500).json({ error: error.message || "Error interno." }); });
server.listen(port, host, () => console.log(`TikTokraft Live disponible en http://${host}:${port}`));
async function shutdown() { await Promise.allSettled([...workspaces.values()].map(async (workspace) => (await workspace).dispose())); server.close(() => process.exit(0)); }
process.on("SIGINT", shutdown); process.on("SIGTERM", shutdown);
