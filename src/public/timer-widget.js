const route = location.pathname.split("/").filter(Boolean);
const overlayToken = decodeURIComponent(route[1] || "");
const widget = document.querySelector("#timer-widget");
const valueElement = document.querySelector("#timer-value");
const coinMessageElement = document.querySelector("#timer-coin-message");
const statusElement = document.querySelector("#timer-status");
const statusLabels = { idle: "Listo para comenzar", running: "En marcha", paused: "Pausado", finished: "Finalizado" };
let currentTimer = null;
let anchorRemainingMs = 0;
let localDeadline = 0;
let socketConnected = false;
let publicSocket = null;
let authoritativeSyncAt = 0;
let serverClockOffsetMs = 0;
let renderTimerId = null;
let zeroSynchronized = false;

function formatTime(value) {
  const milliseconds = Math.max(0, Math.round(Number(value) || 0));
  const totalSeconds = Math.floor(milliseconds / 1_000);
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function applyCustomization(customization = {}) {
  customization = customization && typeof customization === "object" ? customization : {};
  widget.style.setProperty("--overlay-font", customization.fontFamily || "DM Mono");
  widget.style.setProperty("--overlay-text", customization.textColor || "#d9d9d9");
  widget.style.setProperty("--overlay-value", customization.valueColor || "#ffffff");
  widget.style.setProperty("--overlay-background", customization.backgroundColor || "transparent");
  widget.style.setProperty("--overlay-scale", String((Number(customization.fontSize) || 75) / 75));
  widget.style.setProperty("--overlay-line-gap", `${Math.max(0, (Number(customization.lineSpacing) || 55) - 45) / 2}px`);
  widget.style.setProperty("--overlay-letter-spacing", `${((Number(customization.letterSpacing) || 50) - 50) / 20}px`);
  widget.dataset.showBackground = String(customization.showBackground === true);
  widget.dataset.showValue = String(customization.showValue !== false);
  widget.dataset.alignRight = String(customization.alignRight === true);
  widget.dataset.effect = customization.textEffect || "none";
  widget.dataset.wave = String(customization.waveAnimation === true);
}

function remainingNow() {
  if (!currentTimer) return 0;
  if (currentTimer.status !== "running") return anchorRemainingMs;
  return Math.max(0, localDeadline - Date.now());
}

function renderClock() {
  if (!currentTimer) return;
  const formatted = formatTime(remainingNow());
  if (valueElement.textContent !== formatted) valueElement.textContent = formatted;
}

function scheduleClock() {
  clearTimeout(renderTimerId);
  renderTimerId = null;
  renderClock();
  if (currentTimer?.status !== "running") return;
  const remainingMs = remainingNow();
  if (remainingMs <= 0) {
    if (!zeroSynchronized) {
      zeroSynchronized = true;
      synchronizeTimer({ force: true });
    }
    return;
  }
  // Solo despierta para el siguiente segundo visible. El valor se calcula
  // desde el reloj real, así que no acumula retraso si la fuente es limitada.
  const delay = Math.max(40, Math.min(1_000, (remainingMs % 1_000) + 20));
  renderTimerId = setTimeout(scheduleClock, delay);
}

function render(timer, { localReference = Date.now() } = {}) {
  if (!timer) return;
  currentTimer = timer;
  anchorRemainingMs = Math.max(0, Number(timer.remainingMs) || 0);
  if (Number.isFinite(Number(timer.serverNow))) serverClockOffsetMs = Number(timer.serverNow) - localReference;
  localDeadline = timer.status === "running"
    ? Number(timer.endsAt) > 0
      ? Number(timer.endsAt) - serverClockOffsetMs
      : Date.now() + anchorRemainingMs
    : 0;
  zeroSynchronized = false;
  applyCustomization(timer.customization);
  widget.dataset.status = timer.status || "idle";
  coinMessageElement.textContent = timer.coinMessage || "";
  coinMessageElement.hidden = !timer.coinMessage;
  scheduleClock();
  statusElement.textContent = statusLabels[timer.status] || "Listo";
}

async function loadTimer() {
  const requestedAt = Date.now();
  const response = await fetch(`/api/public/${encodeURIComponent(overlayToken)}/timer?_=${Date.now()}`, { cache: "no-store" });
  if (!response.ok) throw new Error("No se encontró este temporizador.");
  const { timer } = await response.json();
  const receivedAt = Date.now();
  render(timer, { localReference: (requestedAt + receivedAt) / 2 });
}

function synchronizeTimer({ force = false } = {}) {
  renderClock();
  const requestedAt = Date.now();
  if (!force && requestedAt - authoritativeSyncAt < 750) return;
  authoritativeSyncAt = requestedAt;
  if (socketConnected && publicSocket) {
    publicSocket.timeout(5_000).emit("timer:sync", null, (error, result) => {
      const receivedAt = Date.now();
      if (!error && result?.ok && result.data) render(result.data, { localReference: (requestedAt + receivedAt) / 2 });
    });
    return;
  }
  loadTimer().catch(() => {});
}

// La carga HTTP funciona incluso en navegadores de fuentes que no permiten
// Socket.IO. El socket acelera la sincronización, pero ya no bloquea el widget.
loadTimer().catch(() => { statusElement.textContent = "Esperando conexión…"; });
if (typeof window.io === "function") {
  publicSocket = window.io("/public", { auth: { overlayToken } });
  publicSocket.on("connect", () => { socketConnected = true; synchronizeTimer({ force: true }); });
  publicSocket.on("disconnect", () => {
    socketConnected = false;
    loadTimer().catch(() => {});
  });
  publicSocket.on("connect_error", () => { socketConnected = false; });
  publicSocket.on("timer:update", render);
}
document.addEventListener("visibilitychange", () => { if (!document.hidden) synchronizeTimer(); });
window.addEventListener("focus", synchronizeTimer);
window.addEventListener("pageshow", synchronizeTimer);
window.addEventListener("online", synchronizeTimer);
// HTTP queda exclusivamente como respaldo cuando Socket.IO no está activo.
setInterval(() => {
  if (!socketConnected) loadTimer().catch(() => {});
}, 15_000);
