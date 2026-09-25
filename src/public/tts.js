(() => {
  class TtsQueue {
    constructor({ onError = () => {}, onState = () => {} } = {}) {
      this.onError = onError;
      this.onState = onState;
      this.items = [];
      this.speaking = false;
      this.paused = false;
    }

    notifyState() {
      this.onState({ paused: this.paused, speaking: this.speaking, pending: this.items.length });
    }

    enqueue(text, settings) {
      const value = String(text || "").trim();
      if (!value) return;
      // STOP es un corte de lectura: lo que llega mientras está activo no se
      // acumula para ser reproducido cuando se vuelva a activar el audio.
      if (this.paused) return;
      if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
        this.onError("Este navegador no admite síntesis de voz.");
        return;
      }
      this.items.push({ text: value, settings });
      this.notifyState();
      this.playNext();
    }

    playNext() {
      if (this.paused || this.speaking || this.items.length === 0) return;
      const next = this.items.shift();
      const utterance = new SpeechSynthesisUtterance(next.text);
      this.activeUtterance = utterance;
      utterance.lang = next.settings.language;
      utterance.volume = next.settings.volume;
      utterance.rate = Math.max(0.1, Math.min(10, (Number(next.settings.speed) || 60) / 50));
      utterance.pitch = Math.max(0, Math.min(2, (Number(next.settings.pitch) || 70) / 50));
      this.speaking = true;
      this.notifyState();
      const finish = () => {
        if (this.activeUtterance !== utterance) return;
        this.activeUtterance = null;
        this.speaking = false;
        this.notifyState();
        this.playNext();
      };
      utterance.onend = finish;
      utterance.onerror = (event) => {
        if (event.error !== "interrupted" && event.error !== "canceled") this.onError("No se pudo reproducir la voz.");
        finish();
      };
      window.speechSynthesis.speak(utterance);
    }

    pause() {
      if (this.paused) return;
      this.paused = true;
      if ("speechSynthesis" in window) window.speechSynthesis.pause();
      this.notifyState();
    }

    resume() {
      if (!this.paused) return;
      this.paused = false;
      // Al reanudar se empieza un punto nuevo: se descarta el mensaje que
      // estaba pausado y cualquier elemento pendiente de una versión previa.
      this.items = [];
      this.activeUtterance = null;
      this.speaking = false;
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
      this.notifyState();
    }
  }

  window.TtsQueue = TtsQueue;
})();
