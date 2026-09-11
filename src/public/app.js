const socket = io();
let appState = null;
let hiddenActivity = false;

const $ = (selector) => document.querySelector(selector);
const elements = {
  settings: $("#settings-form"),
  tiktokUsername: $("#tiktok-live-username"), eulerStreamApiKey: $("#euler-stream-api-key"), eulerKeyState: $("#euler-key-state"),
  serverTapHost: $("#servertap-host"), serverTapPort: $("#servertap-port"), serverTapProtocol: $("#servertap-protocol"),
  serverTapKey: $("#servertap-key"),
  keyState: $("#key-state"),
  minecraftDetail: $("#minecraft-detail"), minecraftDot: $("#minecraft-dot"),
  tiktokDetail: $("#tiktok-detail"), tiktokDot: $("#tiktok-dot"),
  globalStatus: $("#global-status"),
  mappingForm: $("#mapping-form"), mappingId: $("#mapping-id"), giftName: $("#gift-name"), giftId: $("#gift-id"),
  command: $("#mapping-command"), cooldown: $("#cooldown"), enabled: $("#mapping-enabled"), editorHeading: $("#editor-heading"),
  cancelEdit: $("#cancel-edit"), mappingList: $("#mapping-list"), mappingEmpty: $("#mapping-empty"),
  simulateForm: $("#simulate-form"), simulateGift: $("#simulate-gift"), simulateCount: $("#simulate-count"),
  activityLog: $("#activity-log"), activityEmpty: $("#activity-empty"), toasts: $("#toasts")
};

function request(event, payload) {
  return new Promise((resolve, reject) => {
    socket.emit(event, payload, (result) => result?.ok ? resolve(result.data) : reject(new Error(result?.error || "No se pudo completar la acción.")));
  });
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#039;", "\"":"&quot;" })[char]);
}

function toast(message, type = "") {
  const item = document.createElement("div");
  item.className = `toast ${type}`;
  item.textContent = message;
  elements.toasts.append(item);
  setTimeout(() => item.remove(), 4_500);
}

function setStatus(detail, dot, source) {
  detail.textContent = source.detail || "Sin conectar";
  dot.className = `status-dot ${source.status || "disconnected"}`;
}

function serverTapParts(value) {
  try {
    const rawUrl = String(value || "").trim();
    const url = new URL(rawUrl.includes("://") ? rawUrl : `http://${rawUrl}`);
    return { host: url.hostname, port: url.port || "4567", protocol: url.protocol === "https:" ? "https:" : "http:" };
  } catch {
    return { host: "127.0.0.1", port: "4567", protocol: "http:" };
  }
}

function renderState(next) {
  appState = next;
  const { config, minecraft, tiktok } = next;
  if (document.activeElement !== elements.tiktokUsername) elements.tiktokUsername.value = config.tiktokUsername || "";
  elements.eulerKeyState.textContent = config.eulerStreamApiKeyPresent ? "API Key guardada. Déjala vacía para conservarla." : "Necesitas una API Key de Euler Stream.";
  const serverTap = serverTapParts(config.serverTap.url);
  if (![elements.serverTapHost, elements.serverTapPort, elements.serverTapProtocol].includes(document.activeElement)) {
    elements.serverTapHost.value = serverTap.host;
    elements.serverTapPort.value = serverTap.port;
    elements.serverTapProtocol.value = serverTap.protocol;
  }
  elements.keyState.textContent = config.serverTap.keyPresent ? "Clave guardada. Déjalo vacío para conservarla." : "Aún no hay una clave guardada.";
  setStatus(elements.minecraftDetail, elements.minecraftDot, minecraft);
  setStatus(elements.tiktokDetail, elements.tiktokDot, tiktok);
  elements.globalStatus.textContent = minecraft.status === "connected" && tiktok.status === "connected" ? "INTERACTIVO EN VIVO" : "PANEL LOCAL";
  renderMappings(config.mappings || []);
  if (!hiddenActivity) renderActivity(next.activity || []);
}

function renderMappings(mappings) {
  elements.mappingList.innerHTML = mappings.map((mapping) => `
    <article class="mapping-row ${mapping.enabled ? "" : "disabled"}">
      <div class="mapping-gift">${escapeHtml((mapping.giftName || mapping.giftId || "?").slice(0, 1).toUpperCase())}</div>
      <div class="mapping-main">
        <strong>${escapeHtml(mapping.giftName || `Regalo #${mapping.giftId}`)}</strong>
        <p>${escapeHtml(mapping.command)}</p>
      </div>
      <div class="mapping-tools">
        <button class="icon-button" data-action="test" data-id="${escapeHtml(mapping.id)}" title="Probar en Minecraft">▷</button>
        <button class="icon-button" data-action="edit" data-id="${escapeHtml(mapping.id)}" title="Editar">✎</button>
        <button class="icon-button delete" data-action="delete" data-id="${escapeHtml(mapping.id)}" title="Eliminar">×</button>
      </div>
    </article>`).join("");
  elements.mappingEmpty.hidden = mappings.length > 0;
}

function symbolFor(entry) {
  if (entry.type === "gift" || entry.type === "gift-unmapped") return ["♥", "gift"];
  if (entry.type === "action") return ["⚡", "action"];
  if (entry.type === "error") return ["!", "error"];
  if (entry.type === "console") return [">", "console"];
  if (entry.type === "cooldown") return ["○", "console"];
  return ["·", ""];
}

function entryText(entry) {
  if (entry.type === "gift") return `${entry.event.nickname} regaló ${entry.event.giftName}${entry.event.repeatCount > 1 ? ` ×${entry.event.repeatCount}` : ""}`;
  if (entry.type === "gift-unmapped") return `${entry.event.nickname} regaló ${entry.event.giftName}; no hay acción configurada`;
  if (entry.type === "action") return `${entry.mapping?.giftName || entry.event.giftName} → ${entry.command}`;
  return entry.message || "Evento";
}

function renderActivity(activity) {
  elements.activityLog.innerHTML = activity.map((entry) => {
    const [symbol, className] = symbolFor(entry);
    const time = new Date(entry.at).toLocaleTimeString([], { hour:"2-digit", minute:"2-digit", second:"2-digit" });
    return `<div class="activity-item"><span class="activity-time">${time}</span><span class="activity-symbol ${className}">${symbol}</span><span class="activity-message">${escapeHtml(entryText(entry))}${entry.type === "console" && entry.entry?.level ? `<small class="activity-meta">${escapeHtml(entry.entry.level)}</small>` : ""}</span></div>`;
  }).join("");
  elements.activityEmpty.hidden = activity.length > 0;
}

function resetEditor() {
  elements.mappingForm.reset();
  elements.mappingId.value = "";
  elements.cooldown.value = 0;
  elements.enabled.checked = true;
  elements.editorHeading.textContent = "Nueva acción";
  elements.cancelEdit.hidden = true;
}

function openEditor(mapping) {
  elements.mappingId.value = mapping.id;
  elements.giftName.value = mapping.giftName;
  elements.giftId.value = mapping.giftId;
  elements.command.value = mapping.command;
  elements.cooldown.value = mapping.cooldownMs;
  elements.enabled.checked = mapping.enabled;
  elements.editorHeading.textContent = "Editar acción";
  elements.cancelEdit.hidden = false;
  elements.mappingForm.scrollIntoView({ behavior:"smooth", block:"center" });
  elements.giftName.focus();
}

async function control(button, event, payload, success) {
  button.disabled = true;
  try { await request(event, payload); toast(success, "success"); } catch (error) { toast(error.message, "error"); } finally { button.disabled = false; }
}

elements.settings.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submit = event.submitter;
  await control(submit, "settings:save", {
    serverTapHost: elements.serverTapHost.value.trim(),
    serverTapPort: elements.serverTapPort.value.trim(),
    serverTapProtocol: elements.serverTapProtocol.value,
    serverTapKey: elements.serverTapKey.value
  }, "Conexión guardada");
  elements.serverTapKey.value = "";
});

$("#minecraft-connect").addEventListener("click", (event) => control(event.currentTarget, "minecraft:connect", null, "Minecraft conectado"));
$("#minecraft-disconnect").addEventListener("click", (event) => control(event.currentTarget, "minecraft:disconnect", null, "Minecraft desconectado"));
$("#tiktok-connect").addEventListener("click", async (event) => {
  const button = event.currentTarget;
  const username = elements.tiktokUsername.value.trim().replace(/^@/, "");
  if (!username) return toast("Escribe el usuario de un TikTok LIVE activo.", "error");
  if (!elements.eulerStreamApiKey.value && !appState?.config?.eulerStreamApiKeyPresent) return toast("Pega tu Euler Stream API Key para conectar.", "error");
  button.disabled = true;
  try {
    await request("settings:save", { tiktokUsername: username, eulerStreamApiKey: elements.eulerStreamApiKey.value.trim() });
    elements.eulerStreamApiKey.value = "";
    await request("tiktok:connect", null);
    toast(`LIVE de @${username} conectado`, "success");
  } catch (error) {
    toast(error.message, "error");
  } finally {
    button.disabled = false;
  }
});
$("#tiktok-disconnect").addEventListener("click", (event) => control(event.currentTarget, "tiktok:disconnect", null, "TikTok desconectado"));

elements.mappingForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = {
    id: elements.mappingId.value || `rule-${crypto.randomUUID()}`,
    giftName: elements.giftName.value.trim(), giftId: elements.giftId.value.trim(), command: elements.command.value.trim(),
    cooldownMs: Number(elements.cooldown.value), enabled: elements.enabled.checked
  };
  if (!data.giftName && !data.giftId) return toast("Indica al menos el nombre o ID del regalo.", "error");
  try { await request("mapping:save", data); toast("Acción guardada", "success"); resetEditor(); } catch (error) { toast(error.message, "error"); }
});
elements.cancelEdit.addEventListener("click", resetEditor);

elements.mappingList.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button || !appState) return;
  const mapping = appState.config.mappings.find((item) => item.id === button.dataset.id);
  if (!mapping) return;
  if (button.dataset.action === "edit") return openEditor(mapping);
  if (button.dataset.action === "delete") {
    if (!confirm(`¿Eliminar la acción de ${mapping.giftName || mapping.giftId}?`)) return;
    return control(button, "mapping:delete", mapping.id, "Acción eliminada");
  }
  if (button.dataset.action === "test") return control(button, "mapping:test", mapping.id, "Comando de prueba enviado");
});

elements.simulateForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const input = elements.simulateGift.value.trim();
  if (!input) return toast("Escribe un nombre o ID para simular.", "error");
  const isId = /^\d+$/.test(input);
  try {
    const result = await request("gift:simulate", { giftId: isId ? input : "", giftName: isId ? "" : input, repeatCount: elements.simulateCount.value });
    toast(result.executed ? `${result.executed} acción(es) enviada(s)` : "No coincide con ninguna acción", result.executed ? "success" : "");
  } catch (error) { toast(error.message, "error"); }
});

$("#clear-activity").addEventListener("click", () => { hiddenActivity = true; elements.activityLog.innerHTML = ""; elements.activityEmpty.hidden = false; });
socket.on("state", (next) => { hiddenActivity = false; renderState(next); });
socket.on("activity", (entry) => {
  if (hiddenActivity) return;
  if (appState) { appState.activity.unshift(entry); appState.activity = appState.activity.slice(0, 100); renderActivity(appState.activity); }
});
socket.on("connect_error", () => toast("Se perdió la conexión con el panel local.", "error"));
const donationSound = new Audio("/sounds/au.mp3");

socket.on("gift:sound", (data) => {
  if (data?.giftId !== "5655") return;

  donationSound.currentTime = 0;
  donationSound.play().catch(() => {});
});
