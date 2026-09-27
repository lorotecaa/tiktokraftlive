const route = location.pathname.split("/").filter(Boolean);
const overlayToken = decodeURIComponent(route[1] || "");
const widget = document.querySelector("#timer-widget");
const valueElement = document.querySelector("#timer-value");
const statusElement = document.querySelector("#timer-status");
const statusLabels = { idle: "Listo para comenzar", running: "En marcha", paused: "Pausado", finished: "Finalizado" };
let currentTimer = null;
let anchorRemainingMs = 0;
let localDeadline = 0;
let socketConnected = false;

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

function render(timer) {
  if (!timer) return;
  currentTimer = timer;
  anchorRemainingMs = Math.max(0, Number(timer.remainingMs) || 0);
  localDeadline = timer.status === "running" ? Date.now() + anchorRemainingMs : 0;
  applyCustomization(timer.customization);
  widget.dataset.status = timer.status || "idle";
  renderClock();
  statusElement.textContent = statusLabels[timer.status] || "Listo";
}

async function loadTimer() {
  const response = await fetch(`/api/public/${encodeURIComponent(overlayToken)}/timer?_=${Date.now()}`, { cache: "no-store" });
  if (!response.ok) throw new Error("No se encontró este temporizador.");
  const { timer } = await response.json();
  render(timer);
}

// La carga HTTP funciona incluso en navegadores de fuentes que no permiten
// Socket.IO. El socket acelera la sincronización, pero ya no bloquea el widget.
loadTimer().catch(() => { statusElement.textContent = "Esperando conexión…"; });
if (typeof window.io === "function") {
  const socket = window.io("/public", { auth: { overlayToken } });
  socket.on("connect", () => { socketConnected = true; });
  socket.on("disconnect", () => {
    socketConnected = false;
    loadTimer().catch(() => {});
  });
  socket.on("connect_error", () => { socketConnected = false; });
  socket.on("timer:update", render);
}
setInterval(renderClock, 200);
// HTTP queda exclusivamente como respaldo cuando Socket.IO no está activo.
setInterval(() => {
  if (!socketConnected) loadTimer().catch(() => {});
}, 15_000);
