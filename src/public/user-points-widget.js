const widget = document.querySelector("#user-points-widget");
const route = location.pathname.split("/").filter(Boolean);
const overlayToken = decodeURIComponent(route[1] || "");
const titleElement = document.querySelector("#user-points-title");
const listElement = document.querySelector("#user-points-ranking");
let currentOverlay = null;

function numberFormat(value) {
  return new Intl.NumberFormat("es-CO").format(Math.max(0, Number(value) || 0));
}

function applyCustomization(customization) {
  customization ||= {};
  widget.style.setProperty("--overlay-font", customization.fontFamily || "Space Grotesk");
  widget.style.setProperty("--overlay-text", customization.textColor || "#ffffff");
  widget.style.setProperty("--overlay-value", customization.valueColor || "#ffd84a");
  widget.style.setProperty("--overlay-rank", customization.rankColor || "#d9d9d9");
  widget.style.setProperty("--overlay-background", customization.backgroundColor || "transparent");
  widget.style.setProperty("--overlay-scale", String((Number(customization.fontSize) || 75) / 75));
  widget.style.setProperty("--overlay-letter-spacing", `${((Number(customization.letterSpacing) || 50) - 50) / 20}px`);
  widget.dataset.effect = customization.textEffect || "none";
  widget.dataset.showBackground = String(customization.showBackground === true);
  widget.dataset.showRank = String(customization.showRank !== false);
  widget.dataset.showValue = String(customization.showValue !== false);
  widget.dataset.alignRight = String(customization.alignRight === true);
  widget.dataset.wave = String(customization.waveAnimation === true);
  widget.dataset.showCrown = String(customization.showCrown !== false);
}

function render(overlay) {
  if (!overlay || overlay.kind !== "historical") return;
  currentOverlay = overlay;
  const entries = Array.isArray(overlay.entries) ? overlay.entries : [];
  applyCustomization(overlay.customization);
  titleElement.textContent = (overlay.title || "Usuario y Puntos").toUpperCase();
  listElement.replaceChildren();
  if (!entries.length) {
    const waiting = document.createElement("li");
    waiting.className = "user-points-waiting";
    waiting.textContent = "Esperando regalos registrados…";
    listElement.append(waiting);
    return;
  }
  entries.forEach((entry, index) => {
    const row = document.createElement("li");
    row.className = `user-points-row rank-${index + 1}`;
    const position = document.createElement("span");
    position.className = "user-points-position";
    position.textContent = String(index + 1);
    const name = document.createElement("b");
    name.textContent = entry.nickname || entry.username || "Espectador";
    const coins = document.createElement("em");
    coins.textContent = `${numberFormat(entry.coins)} coins`;
    row.append(position, name, coins);
    listElement.append(row);
  });
}

async function loadOverlay() {
  const response = await fetch(`/api/public/${encodeURIComponent(overlayToken)}/user-points`);
  if (!response.ok) throw new Error("No se encontró este overlay.");
  const { overlay } = await response.json();
  render(overlay);
}

loadOverlay().catch(() => {
  titleElement.textContent = "USUARIO Y PUNTOS";
  listElement.innerHTML = '<li class="user-points-waiting">Esperando conexión al panel…</li>';
});

setInterval(() => loadOverlay().catch(() => {}), 1500);
