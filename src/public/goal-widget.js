const route = location.pathname.split("/").filter(Boolean);
const overlayToken = decodeURIComponent(route[1] || "");
const goalId = decodeURIComponent(route[3] || "");
const widget = document.querySelector("#goal-widget");
const nameElement = document.querySelector("#goal-name");
const valueElement = document.querySelector("#goal-value");
const percentElement = document.querySelector("#goal-percent");
const progressElement = document.querySelector("#goal-progress");

function numberFormat(value) {
  return new Intl.NumberFormat("es-CO").format(Math.max(0, Number(value) || 0));
}

function applyCustomization(customization = {}) {
  widget.style.setProperty("--overlay-font", customization.fontFamily || "Space Grotesk");
  widget.style.setProperty("--overlay-text", customization.textColor || "#e8f2f1");
  widget.style.setProperty("--overlay-value", customization.valueColor || "#e8f2f1");
  widget.style.setProperty("--overlay-background", customization.backgroundColor || "transparent");
  widget.style.setProperty("--overlay-scale", String((Number(customization.fontSize) || 75) / 75));
  widget.style.setProperty("--overlay-letter-spacing", `${((Number(customization.letterSpacing) || 50) - 50) / 20}px`);
  widget.dataset.effect = customization.textEffect || "none";
  widget.dataset.showBackground = String(customization.showBackground === true);
  widget.dataset.showRank = String(customization.showRank !== false);
  widget.dataset.showValue = String(customization.showValue !== false);
  widget.dataset.alignRight = String(customization.alignRight === true);
  widget.dataset.wave = String(customization.waveAnimation === true);
}

function render(goal) {
  if (!goal || goal.id !== goalId) return;
  const percentage = Math.min(100, Math.round((goal.current / goal.target) * 100));
  widget.dataset.type = goal.type;
  applyCustomization(goal.customization);
  widget.hidden = !goal.enabled;
  nameElement.textContent = goal.name;
  valueElement.textContent = `${numberFormat(goal.current)} / ${numberFormat(goal.target)}`;
  percentElement.textContent = `${percentage}%`;
  progressElement.style.width = `${percentage}%`;
}

async function loadGoal() {
  const response = await fetch(`/api/public/${encodeURIComponent(overlayToken)}/goal/${encodeURIComponent(goalId)}`);
  if (!response.ok) throw new Error("No se encontró esta meta.");
  const { goal } = await response.json();
  render(goal);
}

loadGoal().catch(() => { widget.hidden = true; });
setInterval(() => loadGoal().catch(() => {}), 1500);
