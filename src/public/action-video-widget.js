const route = location.pathname.split("/").filter(Boolean);
const overlayToken = decodeURIComponent(route[1] || "");
const stage = document.querySelector("#action-video-stage");
const video = document.querySelector("#action-video");
let playbackRevision = 0;

function fitVideoToStage() {
  if (!video.videoWidth || !video.videoHeight || !stage.clientWidth || !stage.clientHeight) return;
  const videoRatio = video.videoWidth / video.videoHeight;
  const stageRatio = stage.clientWidth / stage.clientHeight;
  // Define una sola dimensión y deja la otra automática. Así nunca se corta
  // el MP4 aunque TikTok Studio cambie el tamaño de la fuente del navegador.
  video.style.width = videoRatio >= stageRatio ? "100%" : "auto";
  video.style.height = videoRatio >= stageRatio ? "auto" : "100%";
}

function stopVideo() {
  playbackRevision += 1;
  video.pause();
  video.removeAttribute("src");
  video.load();
  video.hidden = true;
}

async function playActionVideo(payload) {
  const videoUrl = String(payload?.videoUrl || "").trim();
  if (!videoUrl) return;
  const revision = ++playbackRevision;
  video.pause();
  video.hidden = false;
  video.muted = false;
  video.src = videoUrl;
  video.currentTime = 0;
  video.load();
  try {
    await video.play();
  } catch {
    if (revision === playbackRevision) stopVideo();
  }
}

video.addEventListener("ended", stopVideo);
video.addEventListener("error", stopVideo);
video.addEventListener("loadedmetadata", fitVideoToStage);
window.addEventListener("resize", fitVideoToStage);

const socket = window.io("/public", { auth: { overlayToken } });
socket.on("action-video:play", playActionVideo);
