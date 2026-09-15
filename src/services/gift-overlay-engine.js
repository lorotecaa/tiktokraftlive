function recordFromGift(gift) {
  return {
    giftId: gift.giftId,
    giftName: gift.giftName,
    username: gift.username,
    nickname: gift.nickname,
    coins: Math.max(0, Number(gift.coinValue) || 0),
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
    if (gift.coinValue > (overlays.bestGift?.coins || 0)) {
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
