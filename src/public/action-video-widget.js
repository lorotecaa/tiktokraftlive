const route = location.pathname.split("/").filter(Boolean);
const overlayToken = decodeURIComponent(route[1] || "");
const stage = document.querySelector("#action-video-stage");
const video = document.querySelector("#action-video");
let playbackRevision = 0;
let activePlayback = null;
let watchdogWorker = null;
let watchdogInterval = null;

function fitVideoToStage() {
  if (!video.videoWidth || !video.videoHeight || !stage.clientWidth || !stage.clientHeight) return;
  const videoRatio = video.videoWidth / video.videoHeight;
  const stageRatio = stage.clientWidth / stage.clientHeight;
  // Define una sola dimensión y deja la otra automática. Así nunca se corta
  // el MP4 aunque TikTok Studio cambie el tamaño de la fuente del navegador.
  video.style.width = videoRatio >= stageRatio ? "100%" : "auto";
  video.style.height = videoRatio >= stageRatio ? "auto" : "100%";
}

function clearWatchdog() {
  if (watchdogWorker) watchdogWorker.terminate();
  if (watchdogInterval) clearInterval(watchdogInterval);
  watchdogWorker = null;
  watchdogInterval = null;
}

function expectedPlaybackTime(playback, now = Date.now()) {
  return Math.max(0, (now - playback.startedAt) / 1_000);
}

function stopVideo() {
  playbackRevision += 1;
  activePlayback = null;
  clearWatchdog();
  video.pause();
  video.removeAttribute("src");
  video.load();
  video.hidden = true;
}

function maintainPlayback({ force = false } = {}) {
  const playback = activePlayback;
  if (!playback || playback.revision !== playbackRevision) return;
  const now = Date.now();
  const expected = expectedPlaybackTime(playback, now);
  const duration = Number(video.duration);
  if (Number.isFinite(duration) && duration > 0 && expected >= duration) {
    stopVideo();
    return;
  }

  const current = Number(video.currentTime) || 0;
  if (Math.abs(current - playback.lastMediaTime) >= 0.03) {
    playback.lastMediaTime = current;
    playback.lastProgressAt = now;
  }
  const stalled = now - playback.lastProgressAt > 700;
  const drifted = Math.abs(current - expected) > 0.4;
  const canSeek = video.readyState >= HTMLMediaElement.HAVE_METADATA && Number.isFinite(duration) && duration > 0;
  const needsRecovery = force || video.paused || stalled || drifted;
  if (!needsRecovery || now - playback.lastRecoveryAt < 220) return;

  playback.lastRecoveryAt = now;
  if (canSeek && (stalled || drifted)) {
    video.currentTime = Math.min(expected, Math.max(0, duration - 0.04));
    playback.lastMediaTime = video.currentTime;
    playback.lastProgressAt = now;
  }
  video.playbackRate = 1;
  // Un rechazo temporal al pasar TikTok Studio a segundo plano ya no cancela
  // la animación. El vigilante vuelve a intentarlo mientras siga vigente.
  void video.play().catch(() => {});
}

function startWatchdog() {
  clearWatchdog();
  // Los temporizadores de una ventana en segundo plano pueden ser limitados.
  // Un Worker independiente mantiene el pulso y el intervalo sirve de respaldo
  // para motores antiguos de fuentes web.
  if (typeof Worker === "function") {
    try {
      const source = "setInterval(() => postMessage(0), 200);";
      const workerUrl = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
      watchdogWorker = new Worker(workerUrl);
      URL.revokeObjectURL(workerUrl);
      watchdogWorker.onmessage = () => maintainPlayback();
    } catch {
      watchdogWorker = null;
    }
  }
  watchdogInterval = setInterval(() => maintainPlayback(), 350);
}

async function playActionVideo(payload) {
  const videoUrl = String(payload?.videoUrl || "").trim();
  if (!videoUrl) return;
  stopVideo();
  const revision = ++playbackRevision;
  const now = Date.now();
  activePlayback = {
    revision,
    startedAt: now,
    lastMediaTime: 0,
    lastProgressAt: now,
    lastRecoveryAt: 0
  };
  video.hidden = false;
  video.muted = false;
  video.defaultMuted = false;
  video.playsInline = true;
  video.preload = "auto";
  video.src = videoUrl;
  video.currentTime = 0;
  video.load();
  startWatchdog();
  try {
    await video.play();
  } catch {
    // TikTok Studio puede rechazar el primer play() al perder el foco. No se
    // descarta el evento: el vigilante lo reanuda y lo alinea con el reloj.
    if (revision === playbackRevision) maintainPlayback({ force: true });
  }
}

video.addEventListener("loadedmetadata", () => {
  fitVideoToStage();
  maintainPlayback({ force: true });
});
video.addEventListener("playing", () => {
  if (!activePlayback) return;
  activePlayback.lastMediaTime = Number(video.currentTime) || 0;
  activePlayback.lastProgressAt = Date.now();
});
video.addEventListener("ended", stopVideo);
video.addEventListener("error", stopVideo);
for (const eventName of ["pause", "stalled", "suspend", "waiting"]) {
  video.addEventListener(eventName, () => {
    if (activePlayback) maintainPlayback({ force: true });
  });
}

window.addEventListener("resize", fitVideoToStage);
window.addEventListener("focus", () => maintainPlayback({ force: true }));
window.addEventListener("pageshow", () => maintainPlayback({ force: true }));
window.addEventListener("online", () => maintainPlayback({ force: true }));
document.addEventListener("visibilitychange", () => maintainPlayback({ force: true }));

const socket = window.io("/public", { auth: { overlayToken } });
socket.on("action-video:play", playActionVideo);
