const kind = decodeURIComponent(location.pathname.split("/").filter(Boolean).at(-1) || "");
const widget = document.querySelector("#gift-widget");
const titleElement = document.querySelector("#gift-widget-title");
const imageElement = document.querySelector("#gift-widget-image");
const userElement = document.querySelector("#gift-widget-user");
const nameElement = document.querySelector("#gift-widget-name");
const valueElement = document.querySelector("#gift-widget-value");
let currentOverlay = null;

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
  widget.style.setProperty("--gift-line-height", String((Number(customization.lineSpacing) || 55) / 50));
  widget.style.setProperty("--gift-title-size", `${Number(customization.titleSize) || 32}px`);
  widget.style.setProperty("--gift-title-color", customization.titleColor || "#d9d9d9");
  widget.style.setProperty("--gift-username-color", customization.usernameColor || "#ffffff");
  widget.style.setProperty("--gift-username-size", `${Number(customization.usernameSize) || 40}px`);
  widget.style.setProperty("--gift-title-offset", `${Number(customization.titleVerticalOffset) || 0}px`);
  widget.style.setProperty("--gift-image-offset", `${Number(customization.giftVerticalOffset) || 0}px`);
  widget.style.setProperty("--gift-username-offset", `${Number(customization.usernameVerticalOffset) || 0}px`);
  widget.style.setProperty("--gift-value-offset", `${Number(customization.coinsVerticalOffset) || 0}px`);
  widget.style.setProperty("--gift-border-color", customization.borderColor || "#242424");
  widget.style.setProperty("--gift-image-opacity", String(Math.max(0, Math.min(Number(customization.giftImageOpacity) || 90, 100)) / 100));
  widget.dataset.effect = customization.textEffect || "none";
  widget.dataset.showBackground = String(customization.showBackground === true);
  widget.dataset.showValue = String(customization.showValue !== false);
  widget.dataset.alignRight = String(customization.alignRight === true);
  widget.dataset.wave = String(customization.waveAnimation === true);
  widget.dataset.imageVisible = String(customization.giftImageVisible !== false);
  widget.dataset.border = String(customization.enableFontBorder === true);
  widget.dataset.titleEffect = customization.titleTextEffect || "none";
  widget.dataset.titleWave = String(customization.titleWaveAnimation === true);
  widget.dataset.usernameEffect = customization.usernameTextEffect || "none";
  widget.dataset.usernameWave = String(customization.usernameWaveAnimation === true);
}

function render(overlay) {
  if (!overlay || overlay.kind !== kind) return;
  currentOverlay = overlay;
  widget.dataset.kind = kind;
  const customization = overlay.customization || {};
  applyCustomization(customization);
  titleElement.textContent = customization.title || overlay.title.toUpperCase();
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
  imageElement.hidden = !imageUrl || customization.giftImageVisible === false;
  if (imageUrl) {
    imageElement.src = imageUrl;
    imageElement.alt = record.giftName || "Regalo";
  } else {
    imageElement.removeAttribute("src");
  }
  userElement.textContent = record.nickname || record.username || "Alguien";
  nameElement.textContent = record.giftName;
  const alias = customization.coinsAlias || "coins";
  valueElement.textContent = kind === "best-gift" ? `${numberFormat(record.coins)} ${alias}` : `× ${numberFormat(record.repeatCount)}`;
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
  if (key === `gift:${kind}` && currentOverlay) render({ ...currentOverlay, customization });
});
