function identityFor(gift) {
  return String(gift.username || gift.nickname || "").trim().replace(/^@/, "").toLocaleLowerCase();
}

function rankEntries(entries) {
  return [...entries.values()]
    .sort((left, right) => right.coins - left.coins || left.firstGiftAt - right.firstGiftAt)
    .slice(0, 10)
    .map(({ firstGiftAt, ...entry }) => entry);
}

export class RankingOverlayEngine {
  constructor({ onUpdate }) {
    this.onUpdate = onUpdate;
    this.donors = new Map();
  }

  process(gift) {
    const identity = identityFor(gift);
    const coins = Math.max(0, Number(gift.coins) || 0);
    if (!identity || !coins) return [];

    const existing = this.donors.get(identity);
    this.donors.set(identity, {
      username: gift.username || existing?.username || "espectador",
      nickname: gift.nickname || existing?.nickname || "espectador",
      avatarUrl: gift.userAvatarUrl || existing?.avatarUrl || "",
      coins: (existing?.coins || 0) + coins,
      firstGiftAt: existing?.firstGiftAt || Date.now()
    });
    const entries = rankEntries(this.donors);
    this.onUpdate({ kind: "top-donors", entries });
    return entries;
  }

  entries() {
    return rankEntries(this.donors);
  }

  reset() {
    this.donors.clear();
    const entries = [];
    this.onUpdate({ kind: "top-donors", entries });
    return entries;
  }
}
