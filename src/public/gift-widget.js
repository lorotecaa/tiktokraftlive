const kind = decodeURIComponent(location.pathname.split("/").filter(Boolean).at(-1) || "");
const widget = document.querySelector("#gift-widget");
const titleElement = document.querySelector("#gift-widget-title");
const imageElement = document.querySelector("#gift-widget-image");
const userElement = document.querySelector("#gift-widget-user");
const nameElement = document.querySelector("#gift-widget-name");
const valueElement = document.querySelector("#gift-widget-value");

function numberFormat(value) {
  return new Intl.NumberFormat("es-CO").format(Math.max(0, Number(value) || 0));
}

function render(overlay) {
  if (!overlay || overlay.kind !== kind) return;
  widget.dataset.kind = kind;
  titleElement.textContent = overlay.title.toUpperCase();
  const record = overlay.record;
  if (!record) {
    widget.dataset.hasImage = "false";
    imageElement.hidden = true;
    imageElement.removeAttribute("src");
    userElement.textContent = kind === "best-gift" ? "Esperando regalo" : "Esperando racha";
    nameElement.textContent = "—";
    valueElement.textContent = "—";
    return;
  }
  const imageUrl = String(record.giftImageUrl || "").trim();
  widget.dataset.hasImage = String(Boolean(imageUrl));
  imageElement.hidden = !imageUrl;
  if (imageUrl) {
    imageElement.src = imageUrl;
    imageElement.alt = record.giftName || "Regalo";
  } else {
    imageElement.removeAttribute("src");
  }
  userElement.textContent = record.nickname || record.username || "Alguien";
  nameElement.textContent = record.giftName;
  valueElement.textContent = kind === "best-gift" ? `${numberFormat(record.coins)} coins` : `× ${numberFormat(record.repeatCount)}`;
}

async function loadOverlay() {
  const response = await fetch(`/api/gift-overlays/${encodeURIComponent(kind)}`);
  if (!response.ok) throw new Error("No se encontró este overlay.");
  const { overlay } = await response.json();
  render(overlay);
}

imageElement.addEventListener("error", () => { imageElement.hidden = true; });
loadOverlay().catch(() => { widget.hidden = true; });
io().on("gift-overlay:update", render);
