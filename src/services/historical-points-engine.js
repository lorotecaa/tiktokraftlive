function rank(entries) {
  return [...entries.values()].sort((left, right) => right.coins - left.coins || String(left.username).localeCompare(String(right.username), "es"));
}

export class HistoricalPointsEngine {
  constructor({ list, add, onUpdate, onError }) {
    this.list = list;
    this.add = add;
    this.onUpdate = onUpdate;
    this.onError = onError;
    this.entriesByUsername = new Map();
    this.writeQueue = Promise.resolve();
  }

  async load() {
    const entries = await this.list({ limit: 500 });
    this.entriesByUsername = new Map(entries.map((entry) => [entry.username, entry]));
    this.onUpdate(this.entries());
    return entries;
  }

  entries(limit = 500) {
    return rank(this.entriesByUsername).slice(0, Math.max(1, Math.min(Number(limit) || 500, 500)));
  }

  async flush() {
    await this.writeQueue;
  }

  process(gift) {
    const username = String(gift?.username || gift?.nickname || "").trim().replace(/^@/, "").toLocaleLowerCase();
    const coins = Math.max(0, Math.floor(Number(gift?.coins) || 0));
    if (!username || !coins) return;
    const existing = this.entriesByUsername.get(username);
    this.entriesByUsername.set(username, {
      username,
      nickname: String(gift.nickname || existing?.nickname || username).slice(0, 80),
      avatarUrl: String(gift.userAvatarUrl || existing?.avatarUrl || "").slice(0, 2048),
      coins: (existing?.coins || 0) + coins,
      firstGiftAt: existing?.firstGiftAt || new Date().toISOString(),
      lastGiftAt: new Date().toISOString()
    });
    this.onUpdate(this.entries());
    this.writeQueue = this.writeQueue
      .then(async () => {
        const saved = await this.add(gift);
        if (!saved) return;
        const optimistic = this.entriesByUsername.get(saved.username);
        this.entriesByUsername.set(saved.username, {
          ...saved,
          // Si llegaron más regalos mientras Supabase confirmaba este, no
          // retrocedemos visualmente al total de una confirmación anterior.
          coins: Math.max(saved.coins, optimistic?.coins || 0)
        });
        this.onUpdate(this.entries());
      })
      .catch((error) => this.onError(error));
  }
}
