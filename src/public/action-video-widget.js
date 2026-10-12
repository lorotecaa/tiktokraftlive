const route = location.pathname.split("/").filter(Boolean);
const overlayToken = decodeURIComponent(route[1] || "");
const video = document.querySelector("#action-video");
let playbackRevision = 0;

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

const socket = window.io("/public", { auth: { overlayToken } });
socket.on("action-video:play", playActionVideo);
