(() => {
  class TtsQueue {
    constructor({ onError = () => {} } = {}) {
      this.onError = onError;
      this.items = [];
      this.speaking = false;
    }

    enqueue(text, settings) {
      const value = String(text || "").trim();
      if (!value) return;
      if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
        this.onError("Este navegador no admite síntesis de voz.");
        return;
      }
      this.items.push({ text: value, settings });
      this.playNext();
    }

    playNext() {
      if (this.speaking || this.items.length === 0) return;
      const next = this.items.shift();
      const utterance = new SpeechSynthesisUtterance(next.text);
      utterance.lang = next.settings.language;
      utterance.volume = next.settings.volume;
      utterance.rate = Math.max(0.1, Math.min(10, (Number(next.settings.speed) || 60) / 50));
      utterance.pitch = Math.max(0, Math.min(2, (Number(next.settings.pitch) || 70) / 50));
      this.speaking = true;
      const finish = () => {
        this.speaking = false;
        this.playNext();
      };
      utterance.onend = finish;
      utterance.onerror = (event) => {
        if (event.error !== "interrupted" && event.error !== "canceled") this.onError("No se pudo reproducir la voz.");
        finish();
      };
      window.speechSynthesis.speak(utterance);
    }
  }

  window.TtsQueue = TtsQueue;
})();
