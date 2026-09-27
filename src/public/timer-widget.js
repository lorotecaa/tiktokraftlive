const route = location.pathname.split("/").filter(Boolean);
const overlayToken = decodeURIComponent(route[1] || "");
const widget = document.querySelector("#timer-widget");
const valueElement = document.querySelector("#timer-value");
const statusElement = document.querySelector("#timer-status");
const statusLabels = { idle: "Listo para comenzar", running: "En marcha", paused: "Pausado", finished: "Finalizado" };
let currentTimer = null;
let anchorRemainingMs = 0;
let anchorReceivedAt = Date.now();

function formatTime(value) {
  const milliseconds = Math.max(0, Math.round(Number(value) || 0));
  const hours = Math.floor(milliseconds / 3_600_000);
  const minutes = hours > 0 ? Math.floor(milliseconds / 60_000) % 60 : Math.floor(milliseconds / 60_000);
  const seconds = Math.floor((milliseconds % 60_000) / 1_000);
  const fraction = milliseconds % 1_000;
  const decimal = fraction ? `.${String(fraction).padStart(3, "0").replace(/0+$/, "")}` : "";
  const minuteAndSecond = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}${decimal}`;
  return hours > 0 ? `${String(hours).padStart(2, "0")}:${minuteAndSecond}` : minuteAndSecond;
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
  return Math.max(0, anchorRemainingMs - (Date.now() - anchorReceivedAt));
}

function renderClock() {
  if (!currentTimer) return;
  valueElement.textContent = formatTime(remainingNow());
}

function render(timer) {
  if (!timer) return;
  currentTimer = timer;
  anchorRemainingMs = Math.max(0, Number(timer.remainingMs) || 0);
  anchorReceivedAt = Date.now();
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
  socket.on("timer:update", render);
}
setInterval(renderClock, 50);
setInterval(() => loadTimer().catch(() => {}), 2_000);
