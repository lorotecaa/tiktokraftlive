const goalId = decodeURIComponent(location.pathname.split("/").filter(Boolean).at(-1) || "");
const widget = document.querySelector("#goal-widget");
const nameElement = document.querySelector("#goal-name");
const valueElement = document.querySelector("#goal-value");
const percentElement = document.querySelector("#goal-percent");
const progressElement = document.querySelector("#goal-progress");

function numberFormat(value) {
  return new Intl.NumberFormat("es-CO").format(Math.max(0, Number(value) || 0));
}

function render(goal) {
  if (!goal || goal.id !== goalId) return;
  const percentage = Math.min(100, Math.round((goal.current / goal.target) * 100));
  widget.dataset.type = goal.type;
  widget.hidden = !goal.enabled;
  nameElement.textContent = goal.name;
  valueElement.textContent = `${numberFormat(goal.current)} / ${numberFormat(goal.target)}`;
  percentElement.textContent = `${percentage}%`;
  progressElement.style.width = `${percentage}%`;
}

async function loadGoal() {
  const response = await fetch(`/api/goals/${encodeURIComponent(goalId)}`);
  if (!response.ok) throw new Error("No se encontró esta meta.");
  const { goal } = await response.json();
  render(goal);
}

loadGoal().catch(() => { widget.hidden = true; });
io().on("goal:update", render);
