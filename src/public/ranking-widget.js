const kind = decodeURIComponent(location.pathname.split("/").filter(Boolean).at(-1) || "");
const widget = document.querySelector("#ranking-widget");
const titleElement = document.querySelector("#ranking-title");
const listElement = document.querySelector("#ranking-list");

function numberFormat(value) {
  return new Intl.NumberFormat("es-CO").format(Math.max(0, Number(value) || 0));
}

function render(overlay) {
  if (!overlay || overlay.kind !== kind) return;
  const entries = Array.isArray(overlay.entries) ? overlay.entries : [];
  widget.hidden = false;
  titleElement.textContent = overlay.title?.toUpperCase() || "TOP DONADORES";
  listElement.replaceChildren();
  if (!entries.length) {
    const waiting = document.createElement("li");
    waiting.className = "ranking-waiting";
    waiting.textContent = "Esperando regalos durante el LIVE…";
    listElement.append(waiting);
    return;
  }
  entries.forEach((entry, index) => {
    const row = document.createElement("li");
    row.className = `ranking-row rank-${index + 1}`;
    const position = document.createElement("span");
    position.className = "ranking-position";
    position.textContent = String(index + 1);
    const details = document.createElement("span");
    details.className = "ranking-details";
    const name = document.createElement("b");
    name.textContent = entry.nickname || entry.username || "Espectador";
    const coins = document.createElement("em");
    coins.textContent = `${numberFormat(entry.coins)} coins`;
    details.append(name, coins);
    row.append(position, details);
    listElement.append(row);
  });
}

async function loadOverlay() {
  const response = await fetch(`/api/ranking-overlays/${encodeURIComponent(kind)}`);
  if (!response.ok) throw new Error("No se encontró este overlay.");
  const { overlay } = await response.json();
  render(overlay);
}

loadOverlay().catch(() => {
  titleElement.textContent = "TOP DONADORES";
  listElement.replaceChildren();
  const waiting = document.createElement("li");
  waiting.className = "ranking-waiting";
  waiting.textContent = "Esperando conexión al LIVE…";
  listElement.append(waiting);
});
io().on("ranking-overlay:update", render);
