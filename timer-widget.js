const route = location.pathname.split("/").filter(Boolean);
const overlayToken = decodeURIComponent(route[1] || "");
const widget = document.querySelector("#timer-widget");
const valueElement = document.querySelector("#timer-value");
const statusElement = document.querySelector("#timer-status");
const statusLabels = { idle: "Listo para comenzar", running: "En marcha", paused: "Pausado", finished: "Finalizado" };

function formatTime(value) {
  const milliseconds = Math.max(0, Math.round(Number(value) || 0));
  const minutes = Math.floor(milliseconds / 60_000);
  const seconds = Math.floor((milliseconds % 60_000) / 1_000);
  const fraction = milliseconds % 1_000;
  const decimal = fraction ? `.${String(fraction).padStart(3, "0").replace(/0+$/, "")}` : "";
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}${decimal}`;
}

function applyCustomization(customization = {}) {
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

function render(timer) {
  if (!timer) return;
  applyCustomization(timer.customization);
  widget.dataset.status = timer.status || "idle";
  valueElement.textContent = formatTime(timer.remainingMs);
  statusElement.textContent = statusLabels[timer.status] || "Listo";
}

async function loadTimer() {
  const response = await fetch(`/api/public/${encodeURIComponent(overlayToken)}/timer`, { cache: "no-store" });
  if (!response.ok) throw new Error("No se encontró este temporizador.");
  const { timer } = await response.json();
  render(timer);
}

const socket = io("/public", { auth: { overlayToken } });
socket.on("timer:update", render);
socket.on("connect_error", () => { statusElement.textContent = "Reconectando…"; });
loadTimer().catch(() => { statusElement.textContent = "Esperando conexión…"; });
setInterval(() => loadTimer().catch(() => {}), 10_000);
