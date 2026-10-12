const route = location.pathname.split("/").filter(Boolean);
const overlayToken = decodeURIComponent(route[1] || "");
const stage = document.querySelector("#action-video-stage");
const output = document.querySelector("#action-video-output");
const outputContext = output.getContext("2d", { alpha: true, desynchronized: true });
const video = document.querySelector("#action-video");
let playbackRevision = 0;
let activePlayback = null;
let watchdogWorker = null;
let watchdogInterval = null;

function resizeOutput() {
  const width = Math.max(1, Math.round(stage.clientWidth));
  const height = Math.max(1, Math.round(stage.clientHeight));
  const pixelRatio = Math.max(1, Math.min(Number(window.devicePixelRatio) || 1, 2));
  const targetWidth = Math.round(width * pixelRatio);
  const targetHeight = Math.round(height * pixelRatio);
  if (output.width !== targetWidth || output.height !== targetHeight) {
    output.width = targetWidth;
    output.height = targetHeight;
  }
}

function drawVideoFrame() {
  if (!activePlayback || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !video.videoWidth || !video.videoHeight) return;
  resizeOutput();
  const canvasWidth = output.width;
  const canvasHeight = output.height;
  const videoRatio = video.videoWidth / video.videoHeight;
  const canvasRatio = canvasWidth / canvasHeight;
  const drawWidth = videoRatio >= canvasRatio ? canvasWidth : canvasHeight * videoRatio;
  const drawHeight = videoRatio >= canvasRatio ? canvasWidth / videoRatio : canvasHeight;
  const drawX = (canvasWidth - drawWidth) / 2;
  const drawY = (canvasHeight - drawHeight) / 2;
  outputContext.clearRect(0, 0, canvasWidth, canvasHeight);
  try {
    outputContext.drawImage(video, drawX, drawY, drawWidth, drawHeight);
    output.hidden = false;
  } catch {
    // El siguiente pulso vuelve a intentarlo cuando el decodificador entregue
    // un fotograma utilizable.
  }
}

function clearOutput() {
  outputContext.clearRect(0, 0, output.width, output.height);
  output.hidden = true;
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
  clearOutput();
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
  const stalled = now - playback.lastProgressAt > 650;
  const drifted = Math.abs(current - expected) > 0.35;
  const canSeek = video.readyState >= HTMLMediaElement.HAVE_METADATA && Number.isFinite(duration) && duration > 0;
  const needsRecovery = force || video.paused || stalled || drifted;
  if (needsRecovery && now - playback.lastRecoveryAt >= 180) {
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
  drawVideoFrame();
}

function startWatchdog() {
  clearWatchdog();
  // El Worker no depende de requestAnimationFrame, que los motores Chromium
  // suspenden cuando una ventana queda oculta. Cada pulso fuerza un nuevo
  // dibujo del fotograma decodificado en el canvas visible del widget.
  if (typeof Worker === "function") {
    try {
      const source = "setInterval(() => postMessage(0), 33);";
      const workerUrl = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
      watchdogWorker = new Worker(workerUrl);
      URL.revokeObjectURL(workerUrl);
      watchdogWorker.onmessage = () => maintainPlayback();
    } catch {
      watchdogWorker = null;
    }
  }
  watchdogInterval = setInterval(() => maintainPlayback(), watchdogWorker ? 250 : 33);
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
  clearOutput();
  video.muted = false;
  video.defaultMuted = false;
  video.playsInline = true;
  video.disablePictureInPicture = true;
  video.preload = "auto";
  video.src = videoUrl;
  video.currentTime = 0;
  video.load();
  startWatchdog();
  try {
    await video.play();
  } catch {
    if (revision === playbackRevision) maintainPlayback({ force: true });
  }
}

video.addEventListener("loadedmetadata", () => maintainPlayback({ force: true }));
video.addEventListener("loadeddata", drawVideoFrame);
video.addEventListener("playing", () => {
  if (!activePlayback) return;
  activePlayback.lastMediaTime = Number(video.currentTime) || 0;
  activePlayback.lastProgressAt = Date.now();
  drawVideoFrame();
});
video.addEventListener("seeked", drawVideoFrame);
video.addEventListener("ended", stopVideo);
video.addEventListener("error", stopVideo);
for (const eventName of ["pause", "stalled", "suspend", "waiting"]) {
  video.addEventListener(eventName, () => {
    if (activePlayback) maintainPlayback({ force: true });
  });
}

window.addEventListener("resize", () => {
  resizeOutput();
  drawVideoFrame();
});
window.addEventListener("focus", () => maintainPlayback({ force: true }));
window.addEventListener("pageshow", () => maintainPlayback({ force: true }));
window.addEventListener("online", () => maintainPlayback({ force: true }));
document.addEventListener("visibilitychange", () => maintainPlayback({ force: true }));

const socket = window.io("/public", { auth: { overlayToken } });
socket.on("action-video:play", playActionVideo);
