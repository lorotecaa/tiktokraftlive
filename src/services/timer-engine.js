const maxTimerMilliseconds = 1_000_000 * 60_000;
const synchronizationIntervalMilliseconds = 30_000;

function clampMilliseconds(value) {
  const milliseconds = Number(value);
  if (!Number.isFinite(milliseconds)) return 0;
  return Math.max(0, Math.min(Math.round(milliseconds), maxTimerMilliseconds));
}

export class TimerEngine {
  constructor({ getTimer, onUpdate, onPersist, onExpire, onError = () => {} }) {
    this.getTimer = getTimer;
    this.onUpdate = onUpdate;
    this.onPersist = onPersist;
    this.onExpire = onExpire;
    this.onError = onError;
    const initial = getTimer()?.runtime || {};
    this.runtime = {
      status: ["idle", "running", "paused", "finished"].includes(initial.status) ? initial.status : "idle",
      remainingMs: clampMilliseconds(initial.remainingMs),
      endsAt: Math.max(0, Math.floor(Number(initial.endsAt) || 0)),
      updatedAt: Math.max(0, Math.floor(Number(initial.updatedAt) || Date.now()))
    };
    if (!this.runtime.remainingMs && this.runtime.status === "idle") this.runtime.remainingMs = this.initialMilliseconds();
    this.expiryTimer = null;
    this.synchronizationTimer = null;
  }

  initialMilliseconds() {
    return clampMilliseconds((Number(this.getTimer()?.initialMinutes) || 0) * 60_000);
  }

  currentRemainingMs(now = Date.now()) {
    if (this.runtime.status !== "running") return clampMilliseconds(this.runtime.remainingMs);
    return clampMilliseconds(this.runtime.endsAt - now);
  }

  persistence(now = Date.now()) {
    return {
      status: this.runtime.status,
      remainingMs: this.currentRemainingMs(now),
      endsAt: this.runtime.status === "running" ? this.runtime.endsAt : 0,
      updatedAt: this.runtime.updatedAt
    };
  }

  snapshot(now = Date.now()) {
    return {
      ...this.persistence(now),
      running: this.runtime.status === "running",
      serverNow: now
    };
  }

  initialize() {
    if (this.runtime.status === "running") {
      if (this.runtime.endsAt > Date.now()) this.schedule();
      else this.runtime = { status: "finished", remainingMs: 0, endsAt: 0, updatedAt: Date.now() };
    }
    this.publish();
    return this.snapshot();
  }

  publish() {
    this.onUpdate(this.snapshot());
  }

  clearSchedule() {
    if (this.expiryTimer) clearTimeout(this.expiryTimer);
    if (this.synchronizationTimer) clearInterval(this.synchronizationTimer);
    this.expiryTimer = null;
    this.synchronizationTimer = null;
  }

  schedule() {
    this.clearSchedule();
    if (this.runtime.status !== "running") return;
    const delay = this.runtime.endsAt - Date.now();
    if (delay <= 0) {
      void this.finish(true).catch((error) => this.onError(error.message));
      return;
    }
    this.expiryTimer = setTimeout(() => {
      void this.finish(true).catch((error) => this.onError(error.message));
    }, delay);
    this.expiryTimer.unref?.();
    // El panel y los widgets descuentan el tiempo localmente. Esta emisión
    // ocasional solo corrige posibles desfases sin transmitir cuatro veces
    // por segundo durante todo el LIVE.
    this.synchronizationTimer = setInterval(() => {
      if (this.runtime.status === "running") this.publish();
    }, synchronizationIntervalMilliseconds);
    this.synchronizationTimer.unref?.();
  }

  async store({ immediate = false } = {}) {
    await this.onPersist(this.persistence(), { immediate });
  }

  async start() {
    if (this.runtime.status === "running") return this.snapshot();
    let remainingMs = this.currentRemainingMs();
    if (remainingMs <= 0) remainingMs = this.initialMilliseconds();
    if (remainingMs <= 0) throw new Error("Configura un Tiempo inicial mayor que cero.");
    const now = Date.now();
    this.runtime = { status: "running", remainingMs, endsAt: now + remainingMs, updatedAt: now };
    this.schedule();
    this.publish();
    await this.store({ immediate: true });
    return this.snapshot();
  }

  async pause() {
    if (this.runtime.status !== "running") return this.snapshot();
    const now = Date.now();
    this.runtime = { status: "paused", remainingMs: this.currentRemainingMs(now), endsAt: 0, updatedAt: now };
    this.clearSchedule();
    this.publish();
    await this.store({ immediate: true });
    return this.snapshot();
  }

  async reset() {
    const now = Date.now();
    this.clearSchedule();
    this.runtime = { status: "idle", remainingMs: this.initialMilliseconds(), endsAt: 0, updatedAt: now };
    this.publish();
    await this.store({ immediate: true });
    return this.snapshot();
  }

  async setMinutes(minutes) {
    const numeric = Number(minutes);
    if (!Number.isFinite(numeric) || numeric < 0) throw new Error("Introduce una cantidad de minutos válida.");
    const remainingMs = clampMilliseconds(numeric * 60_000);
    const now = Date.now();
    if (remainingMs <= 0 && this.currentRemainingMs(now) > 0) return this.finish(true);
    const wasRunning = this.runtime.status === "running";
    const status = remainingMs <= 0 ? "finished" : wasRunning ? "running" : this.runtime.status === "paused" ? "paused" : "idle";
    this.runtime = { status, remainingMs, endsAt: wasRunning && remainingMs > 0 ? now + remainingMs : 0, updatedAt: now };
    if (status === "running") this.schedule();
    else this.clearSchedule();
    this.publish();
    await this.store({ immediate: true });
    return this.snapshot();
  }

  async adjustMinutes(minutes, options) {
    const numeric = Number(minutes);
    if (!Number.isFinite(numeric)) throw new Error("El ajuste de tiempo no es válido.");
    return this.adjustMilliseconds(Math.round(numeric * 60_000), options);
  }

  async adjustMilliseconds(deltaMilliseconds, { immediate = false, executeOnZero = true } = {}) {
    const delta = Number(deltaMilliseconds);
    if (!Number.isFinite(delta) || !delta) return this.snapshot();
    const now = Date.now();
    const previous = this.currentRemainingMs(now);
    const next = clampMilliseconds(previous + delta);
    if (previous > 0 && next <= 0 && executeOnZero) return this.finish(true, { immediate });
    let status = this.runtime.status;
    if (status === "finished" && next > 0) status = "paused";
    this.runtime = {
      status,
      remainingMs: next,
      endsAt: status === "running" ? now + next : 0,
      updatedAt: now
    };
    if (status === "running") this.schedule();
    else this.clearSchedule();
    this.publish();
    await this.store({ immediate });
    return this.snapshot();
  }

  async processInteraction(metric, amount = 1) {
    const timer = this.getTimer();
    const seconds = Number(timer?.adjustments?.[metric]);
    const units = Number(amount);
    if (!Number.isFinite(seconds) || !Number.isFinite(units) || !seconds || units <= 0) return this.snapshot();
    const multiplier = timer?.multiplier?.enabled ? Number(timer.multiplier.value) || 1 : 1;
    return this.adjustMilliseconds(Math.round(seconds * units * multiplier * 1_000));
  }

  async finish(executeAction = true, { immediate = true } = {}) {
    if (this.runtime.status === "finished" && this.currentRemainingMs() === 0) return this.snapshot();
    const now = Date.now();
    this.clearSchedule();
    this.runtime = { status: "finished", remainingMs: 0, endsAt: 0, updatedAt: now };
    this.publish();
    const results = await Promise.allSettled([
      this.store({ immediate }),
      executeAction ? this.onExpire() : Promise.resolve()
    ]);
    const failure = results.find((result) => result.status === "rejected");
    if (failure) throw failure.reason;
    return this.snapshot();
  }

  dispose() {
    this.clearSchedule();
  }
}
