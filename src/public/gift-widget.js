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

function applyCustomization(customization = {}) {
  widget.style.setProperty("--overlay-font", customization.fontFamily || "Space Grotesk");
  widget.style.setProperty("--overlay-text", customization.textColor || "#ffffff");
  widget.style.setProperty("--overlay-value", customization.valueColor || "#ffd84a");
  widget.style.setProperty("--overlay-background", customization.backgroundColor || "transparent");
  widget.style.setProperty("--overlay-scale", String((Number(customization.fontSize) || 75) / 75));
  widget.style.setProperty("--overlay-letter-spacing", `${((Number(customization.letterSpacing) || 50) - 50) / 20}px`);
  widget.dataset.effect = customization.textEffect || "none";
  widget.dataset.showBackground = String(customization.showBackground === true);
  widget.dataset.showValue = String(customization.showValue !== false);
  widget.dataset.alignRight = String(customization.alignRight === true);
  widget.dataset.wave = String(customization.waveAnimation === true);
}

function render(overlay) {
  if (!overlay || overlay.kind !== kind) return;
  widget.dataset.kind = kind;
  applyCustomization(overlay.customization);
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
io().on("overlay-customization:update", ({ key, customization }) => {
  if (key === `gift:${kind}`) applyCustomization(customization);
});
