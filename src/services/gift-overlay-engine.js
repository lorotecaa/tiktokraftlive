function individualCoinValue(gift) {
  const directValue = Number(gift.coinValue);
  if (Number.isFinite(directValue) && directValue >= 0) return directValue;

  const repeatCount = Math.max(1, Number(gift.repeatCount) || 1);
  const totalCoins = Number(gift.coins);
  return Number.isFinite(totalCoins) ? Math.max(0, totalCoins / repeatCount) : 0;
}

function recordFromGift(gift) {
  return {
    giftId: gift.giftId,
    giftName: gift.giftName,
    giftImageUrl: gift.giftImageUrl || "",
    username: gift.username,
    nickname: gift.nickname,
    coins: individualCoinValue(gift),
    repeatCount: Math.max(1, Number(gift.repeatCount) || 1),
    at: Date.now()
  };
}

export class GiftOverlayEngine {
  constructor({ getOverlays, onUpdate }) {
    this.getOverlays = getOverlays;
    this.onUpdate = onUpdate;
  }

  process(gift) {
    const overlays = this.getOverlays();
    const updated = [];
    const coinValue = individualCoinValue(gift);
    if (!overlays.bestGift || coinValue > overlays.bestGift.coins) {
      overlays.bestGift = recordFromGift(gift);
      updated.push({ kind: "best-gift", record: overlays.bestGift });
    }
    if (gift.repeatCount > (overlays.bestStreak?.repeatCount || 0)) {
      overlays.bestStreak = recordFromGift(gift);
      updated.push({ kind: "best-streak", record: overlays.bestStreak });
    }
    for (const item of updated) this.onUpdate(item);
    return updated;
  }

  reset() {
    const overlays = this.getOverlays();
    overlays.bestGift = null;
    overlays.bestStreak = null;
    const updates = [
      { kind: "best-gift", record: null },
      { kind: "best-streak", record: null }
    ];
    for (const item of updates) this.onUpdate(item);
    return updates;
  }
}
