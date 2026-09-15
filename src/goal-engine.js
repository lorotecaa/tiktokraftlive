const metricTypes = new Set(["likes", "follows", "coins"]);

export class GoalEngine {
  constructor({ getGoals, onUpdate }) {
    this.getGoals = getGoals;
    this.onUpdate = onUpdate;
  }

  process(metric, amount) {
    if (!metricTypes.has(metric)) return [];
    const increment = Math.max(0, Math.floor(Number(amount) || 0));
    if (!increment) return [];
    const updated = [];
    for (const goal of this.getGoals()) {
      if (!goal.enabled || goal.type !== metric) continue;
      goal.current = Math.min(1_000_000_000, goal.current + increment);
      updated.push({ ...goal });
      this.onUpdate({ ...goal });
    }
    return updated;
  }
}
