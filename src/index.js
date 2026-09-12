import "dotenv/config";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { Server } from "socket.io";
import { listAvailableSounds, loadConfig, publicConfig, saveConfig, sanitizeConfig } from "./config-store.js";
import { RuleEngine } from "./services/rule-engine.js";
import { ServerTapClient } from "./services/servertap.js";
import { TikTokClient } from "./services/tiktok.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const host = process.env.HOST || "0.0.0.0";
const port = Number(process.env.PORT || 3180);
const commandsPerSecond = Number(process.env.COMMANDS_PER_SECOND || 5);
let config = await loadConfig();
let sequence = 0;
const state = {
  minecraft: { status: "disconnected", detail: "Sin conectar" },
  tiktok: { status: "disconnected", detail: "Sin conectar" },
  activity: []
};

const app = express();
app.use(express.static(path.join(__dirname, "public")));
app.get("/api/health", (_request, response) => response.json({ ok: true, state: publicState() }));
app.get("/api/sounds", async (_request, response, next) => {
  try {
    response.json({ sounds: await listAvailableSounds() });
  } catch (error) {
    next(error);
  }
});
const server = http.createServer(app);
const io = new Server(server, { serveClient: true });

function publicState() {
  return { ...state, config: publicConfig(config) };
}

function broadcastState() {
  io.emit("state", publicState());
}

function addActivity(entry) {
  const item = { id: ++sequence, at: Date.now(), ...entry };
  state.activity.unshift(item);
  state.activity = state.activity.slice(0, 100);
  io.emit("activity", item);
  return item;
}

function reportError(message) {
  console.error(message);
  addActivity({ type: "error", message });
}

function playMappingSound(mapping) {
  if (mapping?.audio) {
    io.emit("mapping:sound", { audio: mapping.audio, mappingId: mapping.id });
  }
}

const serverTap = new ServerTapClient({
  commandsPerSecond,
  onState: (next) => {
    state.minecraft = next;
    broadcastState();
  },
  onConsole: (entry) => addActivity({ type: "console", entry, message: entry.message }),
  onError: reportError
});

const ruleEngine = new RuleEngine({
  sendCommand: (command, context) => serverTap.enqueue(command, context),
  onActivity: (entry) => {
    addActivity(entry);
    if (entry.type === "action") playMappingSound(entry.mapping);
  }
});

const tiktok = new TikTokClient({
  onState: (next) => {
    state.tiktok = next;
    broadcastState();
  },
  onGift: (event) => {
  addActivity({ type: "gift", event, message: `${event.nickname} envió ${event.giftName}` });

  try {
    ruleEngine.process(event, config.mappings);
  } catch (error) {
    reportError(`No se pudo ejecutar la acción: ${error.message}`);
  }
},
  onError: reportError
});

function safeAck(ack, action) {
  Promise.resolve()
    .then(action)
    .then((data) => ack?.({ ok: true, data }))
    .catch((error) => {
      reportError(error.message);
      ack?.({ ok: false, error: error.message });
    });
}

function serverTapUrlFromInput(input = {}) {
  if (input.serverTapHost === undefined) return input.serverTapUrl ?? config.serverTap.url;
  const host = String(input.serverTapHost || "").trim();
  const port = String(input.serverTapPort || "").trim();
  const protocol = input.serverTapProtocol === "https:" ? "https:" : "http:";
  if (!host) throw new Error("Indica la IP o el dominio de ServerTap.");
  if (!/^\d{1,5}$/.test(port) || Number(port) < 1 || Number(port) > 65_535) {
    throw new Error("El puerto de ServerTap debe estar entre 1 y 65535.");
  }
  try {
    const url = new URL(host.includes("://") ? host : `${protocol}//${host}`);
    url.protocol = protocol;
    url.port = port;
    url.pathname = "";
    url.search = "";
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    throw new Error("La IP o el dominio de ServerTap no es válido.");
  }
}

function mergeSettings(input = {}) {
  const proposed = {
    ...config,
    tiktokUsername: input.tiktokUsername ?? config.tiktokUsername,
    eulerStreamApiKey: input.eulerStreamApiKey ? input.eulerStreamApiKey : config.eulerStreamApiKey,
    serverTap: {
      url: serverTapUrlFromInput(input),
      key: input.serverTapKey ? input.serverTapKey : config.serverTap.key
    }
  };
  return sanitizeConfig(proposed);
}

io.on("connection", (socket) => {
  socket.emit("state", publicState());

  socket.on("settings:save", (input, ack) => safeAck(ack, async () => {
    config = await saveConfig(mergeSettings(input));
    broadcastState();
    return publicConfig(config);
  }));

  socket.on("minecraft:connect", (_input, ack) => safeAck(ack, async () => {
    const serverInfo = await serverTap.connect(config.serverTap);
    addActivity({ type: "system", message: `Minecraft conectado: ${serverInfo.name || "ServerTap"}` });
    return serverInfo;
  }));
  socket.on("minecraft:disconnect", (_input, ack) => safeAck(ack, () => serverTap.disconnect()));

  socket.on("tiktok:connect", (_input, ack) => safeAck(ack, async () => {
    const connection = await tiktok.connect(config.tiktokUsername, config.eulerStreamApiKey);
    addActivity({ type: "system", message: `TikTok LIVE conectado: @${config.tiktokUsername}` });
    return { roomId: connection.roomId };
  }));
  socket.on("tiktok:disconnect", (_input, ack) => safeAck(ack, () => tiktok.disconnect()));

  socket.on("mapping:save", (input, ack) => safeAck(ack, async () => {
    const mapping = sanitizeConfig({ mappings: [input] }).mappings[0];
    if (!mapping) throw new Error("Añade un comando a la acción.");
    if (mapping.audio && !(await listAvailableSounds()).includes(mapping.audio)) {
      throw new Error("El audio seleccionado ya no está disponible.");
    }
    const existing = config.mappings.findIndex((entry) => entry.id === mapping.id);
    const mappings = [...config.mappings];
    if (existing >= 0) mappings[existing] = mapping;
    else mappings.push(mapping);
    config = await saveConfig({ ...config, mappings });
    broadcastState();
    return mapping;
  }));

  socket.on("mapping:delete", (id, ack) => safeAck(ack, async () => {
    config = await saveConfig({ ...config, mappings: config.mappings.filter((mapping) => mapping.id !== id) });
    broadcastState();
    return { id };
  }));

  socket.on("mapping:test", (id, ack) => safeAck(ack, () => {
    const mapping = config.mappings.find((entry) => entry.id === id);
    if (!mapping) throw new Error("No existe esa acción.");
    const event = { giftId: mapping.giftId || "demo", giftName: mapping.giftName || "Regalo de prueba", repeatCount: 1, username: "prueba", nickname: "Prueba" };
    const command = ruleEngine.render(mapping.command, event);
    serverTap.enqueue(command, { test: true, mappingId: mapping.id });
    addActivity({ type: "action", event, mapping, command, message: "Prueba enviada a Minecraft" });
    playMappingSound(mapping);
    return { command };
  }));

  socket.on("gift:simulate", (input, ack) => safeAck(ack, () => {
    const event = {
      giftId: String(input?.giftId || "demo"),
      giftName: String(input?.giftName || "Regalo de prueba"),
      repeatCount: Math.max(1, Number(input?.repeatCount) || 1),
      username: "prueba",
      nickname: "Prueba"
    };
    addActivity({ type: "gift", event, message: `Simulación: ${event.giftName}` });
    return ruleEngine.process(event, config.mappings);
  }));
});

server.listen(port, host, () => {
  console.log(`TikTokraft Live disponible en http://${host}:${port}`);
  console.log("El panel se enlaza solo a localhost. Conserva la clave de ServerTap en privado.");
});

function shutdown() {
  tiktok.disconnect("Aplicación detenida");
  serverTap.disconnect("Aplicación detenida");
  server.close(() => process.exit(0));
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
