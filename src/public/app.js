const socket = io();
let appState = null;
let hiddenActivity = false;
const giftNamesById = window.TIKTOK_GIFT_NAMES || {};

const $ = (selector) => document.querySelector(selector);
const elements = {
  settings: $("#settings-form"),
  tiktokUsername: $("#tiktok-live-username"), eulerStreamApiKey: $("#euler-stream-api-key"), eulerKeyState: $("#euler-key-state"),
  serverTapHost: $("#servertap-host"), serverTapPort: $("#servertap-port"), serverTapProtocol: $("#servertap-protocol"),
  serverTapKey: $("#servertap-key"),
  keyState: $("#key-state"),
  ttsSettings: $("#tts-settings-form"), ttsEnabled: $("#tts-enabled"), ttsLanguage: $("#tts-language"), ttsVolume: $("#tts-volume"), ttsVolumeValue: $("#tts-volume-value"),
  voiceTester: $("#voice-tester-form"), voiceTesterText: $("#voice-tester-text"), ttsSpeed: $("#tts-speed"), ttsPitch: $("#tts-pitch"),
  allowedUsers: $("#allowed-users-form"), allowAllUsers: $("#tts-allow-all-users"), allowFollowers: $("#tts-allow-followers"), allowSubscribers: $("#tts-allow-subscribers"), allowModerators: $("#tts-allow-moderators"), allowTeamMembers: $("#tts-allow-team-members"), teamMembersMinLevel: $("#tts-team-members-min-level"), allowTopGifters: $("#tts-allow-top-gifters"), topGiftersTop: $("#tts-top-gifters-top"), allowList: $("#tts-allow-list"), manageAllowedUsers: $("#manage-allowed-users"), allowedUsersListEditor: $("#allowed-users-list-editor"), allowedUsernames: $("#tts-allowed-usernames"),
  goalsToggle: $("#goals-toggle"), goalsPanel: $("#goals-panel"), goalCards: [...document.querySelectorAll(".goal-card")],
  rankingsToggle: $("#rankings-toggle"), rankingsPanel: $("#rankings-panel"), rankingOverlayCards: [...document.querySelectorAll(".ranking-overlay-option")],
  giftOverlaysToggle: $("#gift-overlays-toggle"), giftOverlaysPanel: $("#gift-overlays-panel"), giftOverlaysForm: $("#gift-overlays-form"), giftOverlaysResetOnLive: $("#gift-overlays-reset-on-live"), giftOverlaysResetNow: $("#gift-overlays-reset-now"), giftOverlayCards: [...document.querySelectorAll(".gift-overlay-option")],
  customizationModal: $("#overlay-customization-modal"), customizationForm: $("#overlay-customization-form"), customizationTitle: $("#overlay-customization-title"), customizationFontFamily: $("#customization-font-family"), customizationFontSize: $("#customization-font-size"), customizationLineSpacing: $("#customization-line-spacing"), customizationLetterSpacing: $("#customization-letter-spacing"), customizationTextColor: $("#customization-text-color"), customizationValueColor: $("#customization-value-color"), customizationRankColor: $("#customization-rank-color"), customizationTextEffect: $("#customization-text-effect"), customizationWave: $("#customization-wave"), customizationBackground: $("#customization-background"), customizationBackgroundColor: $("#customization-background-color"), customizationShowRank: $("#customization-show-rank"), customizationShowValue: $("#customization-show-value"), customizationAlignRight: $("#customization-align-right"), customizationCrown: $("#customization-crown"), giftCustomizationTitle: $("#gift-customization-title"), giftCustomizationTitleSize: $("#gift-customization-title-size"), giftCustomizationTitleColor: $("#gift-customization-title-color"), giftCustomizationUsernameColor: $("#gift-customization-username-color"), giftCustomizationUsernameSize: $("#gift-customization-username-size"), giftCustomizationTitleOffset: $("#gift-customization-title-offset"), giftCustomizationImageOffset: $("#gift-customization-image-offset"), giftCustomizationUsernameOffset: $("#gift-customization-username-offset"), giftCustomizationCoinsOffset: $("#gift-customization-coins-offset"), giftCustomizationBorder: $("#gift-customization-border"), giftCustomizationBorderColor: $("#gift-customization-border-color"), giftCustomizationImageVisible: $("#gift-customization-image-visible"), giftCustomizationImageOpacity: $("#gift-customization-image-opacity"), giftCustomizationTitleEffect: $("#gift-customization-title-effect"), giftCustomizationTitleWave: $("#gift-customization-title-wave"), giftCustomizationUsernameEffect: $("#gift-customization-username-effect"), giftCustomizationUsernameWave: $("#gift-customization-username-wave"), giftCustomizationShowCoins: $("#gift-customization-show-coins"), giftCustomizationCoinsAlias: $("#gift-customization-coins-alias"),
  minecraftDetail: $("#minecraft-detail"), minecraftDot: $("#minecraft-dot"),
  tiktokDetail: $("#tiktok-detail"), tiktokDot: $("#tiktok-dot"),
  globalStatus: $("#global-status"),
  mappingForm: $("#mapping-form"), mappingId: $("#mapping-id"), giftName: $("#gift-name"), giftId: $("#gift-id"),
  command: $("#mapping-command"), audio: $("#mapping-audio"), audioTest: $("#audio-test"), audioState: $("#audio-state"), cooldown: $("#cooldown"), enabled: $("#mapping-enabled"), editorHeading: $("#editor-heading"),
  cancelEdit: $("#cancel-edit"), mappingList: $("#mapping-list"), mappingEmpty: $("#mapping-empty"),
  simulateForm: $("#simulate-form"), simulateGift: $("#simulate-gift"), simulateCount: $("#simulate-count"),
  activityLog: $("#activity-log"), activityEmpty: $("#activity-empty"), toasts: $("#toasts")
};
let availableSounds = [];
const ttsQueue = new window.TtsQueue({ onError: (message) => toast(message, "error") });
let customizationKey = "";
const defaultCustomization = {
  fontFamily: "Space Grotesk", fontSize: 75, lineSpacing: 55, letterSpacing: 50,
  textColor: "#d9d9d9", valueColor: "#ffd84a", rankColor: "#d9d9d9", textEffect: "none",
  waveAnimation: false, showBackground: false, backgroundColor: "rgba(33, 33, 33, 0.4)",
  showRank: true, showValue: true, alignRight: false, showCrown: true,
  title: "", titleSize: 32, titleColor: "#d9d9d9", usernameColor: "#ffffff", usernameSize: 40,
  titleVerticalOffset: 0, giftVerticalOffset: 0, usernameVerticalOffset: 0, coinsVerticalOffset: 0,
  enableFontBorder: false, borderColor: "#242424", giftImageVisible: true, giftImageOpacity: 90,
  titleTextEffect: "none", titleWaveAnimation: false, usernameTextEffect: "none", usernameWaveAnimation: false, coinsAlias: "coins"
};

function request(event, payload) {
  return new Promise((resolve, reject) => {
    socket.emit(event, payload, (result) => result?.ok ? resolve(result.data) : reject(new Error(result?.error || "No se pudo completar la acción.")));
  });
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#039;", "\"":"&quot;" })[char]);
}

function toast(message, type = "") {
  const item = document.createElement("div");
  item.className = `toast ${type}`;
  item.textContent = message;
  elements.toasts.append(item);
  setTimeout(() => item.remove(), 4_500);
}

function setStatus(detail, dot, source) {
  detail.textContent = source.detail || "Sin conectar";
  dot.className = `status-dot ${source.status || "disconnected"}`;
}

function serverTapParts(value) {
  try {
    const rawUrl = String(value || "").trim();
    const url = new URL(rawUrl.includes("://") ? rawUrl : `http://${rawUrl}`);
    return { host: url.hostname, port: url.port || "4567", protocol: url.protocol === "https:" ? "https:" : "http:" };
  } catch {
    return { host: "127.0.0.1", port: "4567", protocol: "http:" };
  }
}

function renderState(next) {
  appState = next;
  const { config, minecraft, tiktok } = next;
  if (document.activeElement !== elements.tiktokUsername) elements.tiktokUsername.value = config.tiktokUsername || "";
  elements.eulerKeyState.textContent = config.eulerStreamApiKeyPresent ? "API Key guardada. Déjala vacía para conservarla." : "Necesitas una API Key de Euler Stream.";
  const serverTap = serverTapParts(config.serverTap.url);
  if (![elements.serverTapHost, elements.serverTapPort, elements.serverTapProtocol].includes(document.activeElement)) {
    elements.serverTapHost.value = serverTap.host;
    elements.serverTapPort.value = serverTap.port;
    elements.serverTapProtocol.value = serverTap.protocol;
  }
  elements.keyState.textContent = config.serverTap.keyPresent ? "Clave guardada. Déjalo vacío para conservarla." : "Aún no hay una clave guardada.";
  if (!elements.ttsSettings.contains(document.activeElement) && ![elements.ttsSpeed, elements.ttsPitch].includes(document.activeElement)) {
    elements.ttsEnabled.checked = Boolean(config.tts?.enabled);
    elements.ttsLanguage.value = config.tts?.language || "es-CO";
    elements.ttsVolume.value = String(config.tts?.volume ?? 1);
    elements.ttsVolumeValue.textContent = `${Math.round((config.tts?.volume ?? 1) * 100)}%`;
    elements.ttsSpeed.value = String(config.tts?.speed ?? 60);
    elements.ttsPitch.value = String(config.tts?.pitch ?? 70);
  }
  if (!elements.allowedUsers.contains(document.activeElement)) {
    const allowed = config.tts?.allowedUsers || {};
    elements.allowAllUsers.checked = allowed.allUsers !== false;
    elements.allowFollowers.checked = Boolean(allowed.followers);
    elements.allowSubscribers.checked = Boolean(allowed.subscribers);
    elements.allowModerators.checked = Boolean(allowed.moderators);
    elements.allowTeamMembers.checked = Boolean(allowed.teamMembers);
    elements.teamMembersMinLevel.value = String(allowed.teamMembersMinLevel || 1);
    elements.allowTopGifters.checked = Boolean(allowed.topGifters);
    elements.topGiftersTop.value = String(allowed.topGiftersTop || 3);
    elements.allowList.checked = Boolean(allowed.listEnabled);
    elements.allowedUsernames.value = (allowed.usernames || []).join("\n");
  }
  setStatus(elements.minecraftDetail, elements.minecraftDot, minecraft);
  setStatus(elements.tiktokDetail, elements.tiktokDot, tiktok);
  elements.globalStatus.textContent = minecraft.status === "connected" && tiktok.status === "connected" ? "INTERACTIVO EN VIVO" : "PANEL LOCAL";
  renderMappings(config.mappings || []);
  renderGiftOverlays(config.giftOverlays || {});
  renderRankingOverlay({ kind: "top-donors", title: "Top Donadores", entries: next.rankings?.topDonors || [] });
  renderGoals(config.goals || []);
  if (!hiddenActivity) renderActivity(next.activity || []);
}

function numberFormat(value) {
  return new Intl.NumberFormat("es-CO").format(Math.max(0, Number(value) || 0));
}

function goalUrl(id) {
  return `${window.location.origin}/widget/goal/${encodeURIComponent(id)}`;
}

function goalCard(type) {
  return elements.goalCards.find((card) => card.dataset.goalType === type);
}

function renderGoal(goal) {
  const card = goalCard(goal.type);
  const active = document.activeElement;
  if (!card || (card.contains(active) && active?.matches("input:not([type=hidden]), textarea"))) return;
  card.querySelector(".goal-id").value = goal.id;
  card.querySelector(".goal-name").value = goal.name;
  card.querySelector(".goal-target").value = goal.target;
  card.querySelector(".goal-current").value = goal.current;
  card.querySelector(".goal-enabled-input").checked = goal.enabled;
  const row = card.querySelector(".goal-url-row");
  row.hidden = false;
  card.querySelector(".goal-url").value = goalUrl(goal.id);
  const customize = card.querySelector(".goal-customize");
  customize.disabled = false;
  customize.dataset.overlayKey = `goal:${goal.id}`;
  customize.dataset.overlayTitle = goal.name;
  const percentage = Math.min(100, Math.round((goal.current / goal.target) * 100));
  card.querySelector(".goal-preview-label").textContent = goal.name;
  card.querySelector(".goal-preview-track span").style.width = `${percentage}%`;
  card.querySelector(".goal-preview-value").textContent = `${numberFormat(goal.current)} / ${numberFormat(goal.target)}`;
}

function renderGoals(goals) {
  for (const goal of goals) renderGoal(goal);
}

function giftOverlayUrl(kind) {
  return `${window.location.origin}/widget/gift/${encodeURIComponent(kind)}`;
}

function giftOverlayCard(kind) {
  return elements.giftOverlayCards.find((card) => card.dataset.giftOverlayKind === kind);
}

function renderGiftOverlay(kind, record) {
  const card = giftOverlayCard(kind);
  if (!card) return;
  card.querySelector(".gift-overlay-url-input").value = giftOverlayUrl(kind);
  const image = card.querySelector(".gift-overlay-preview-image");
  const name = card.querySelector(".gift-overlay-preview-name");
  const value = card.querySelector(".gift-overlay-preview-value");
  if (!record) {
    image.hidden = true;
    image.removeAttribute("src");
    name.textContent = kind === "best-gift" ? "Esperando regalo" : "Esperando racha";
    value.textContent = "—";
    return;
  }
  const imageUrl = String(record.giftImageUrl || "").trim();
  image.hidden = !imageUrl;
  if (imageUrl) {
    image.src = imageUrl;
    image.alt = record.giftName || "Regalo";
  } else {
    image.removeAttribute("src");
  }
  name.textContent = `${record.nickname || record.username || "Alguien"} · ${record.giftName}`;
  value.textContent = kind === "best-gift" ? `${numberFormat(record.coins)} coins` : `× ${numberFormat(record.repeatCount)}`;
}

function renderGiftOverlays(overlays) {
  if (!elements.giftOverlaysForm.contains(document.activeElement)) {
    elements.giftOverlaysResetOnLive.checked = Boolean(overlays.resetOnNewLive);
  }
  renderGiftOverlay("best-gift", overlays.bestGift);
  renderGiftOverlay("best-streak", overlays.bestStreak);
}

function rankingOverlayUrl(kind) {
  return `${window.location.origin}/widget/ranking/${encodeURIComponent(kind)}`;
}

function renderRankingOverlay(overlay) {
  const card = elements.rankingOverlayCards.find((item) => item.dataset.rankingOverlayKind === overlay.kind);
  if (!card) return;
  card.querySelector(".ranking-overlay-url-input").value = rankingOverlayUrl(overlay.kind);
  const list = card.querySelector(".ranking-overlay-preview-list");
  const entries = Array.isArray(overlay.entries) ? overlay.entries : [];
  list.replaceChildren();
  if (!entries.length) {
    const item = document.createElement("li");
    item.textContent = "Esperando regalos durante el LIVE…";
    list.append(item);
    return;
  }
  entries.slice(0, 5).forEach((entry, index) => {
    const item = document.createElement("li");
    const name = document.createElement("span");
    name.textContent = `${index + 1}. ${entry.nickname || entry.username || "Espectador"}`;
    const coins = document.createElement("b");
    coins.textContent = `${numberFormat(entry.coins)} coins`;
    item.append(name, coins);
    list.append(item);
  });
}

function customizationFor(key) {
  return { ...defaultCustomization, ...(appState?.config?.overlayCustomizations?.[key] || {}) };
}

function openCustomization(button) {
  const key = button.dataset.overlayKey;
  if (!key) return;
  customizationKey = key;
  const customization = customizationFor(key);
  const isGiftOverlay = key.startsWith("gift:");
  const isBestStreak = key === "gift:best-streak";
  elements.customizationModal.dataset.variant = isGiftOverlay ? "gift" : "default";
  elements.customizationTitle.textContent = isGiftOverlay ? `Personalizar · ${button.dataset.overlayTitle}` : (button.dataset.overlayTitle || "Overlay");
  if (isGiftOverlay) {
    $("#gift-customization-overlay-heading").textContent = `Opciones de ${button.dataset.overlayTitle}`;
    $("#gift-customization-value-heading").textContent = isBestStreak ? "Racha" : "Coins";
    $("#customization-value-color-label").textContent = isBestStreak ? "Color de la racha" : "Color de coins";
    $("#gift-customization-value-offset-label").textContent = isBestStreak ? "Posición vertical de la racha" : "Posición vertical de coins";
    $("#gift-customization-show-value-label").textContent = isBestStreak ? "Mostrar racha" : "Mostrar coins";
    $("#customization-font-size-label").textContent = "Escala general";
    $("#gift-customization-alias-row").hidden = isBestStreak;
  } else {
    $("#customization-font-size-label").textContent = "Tamaño de fuente";
    $("#gift-customization-alias-row").hidden = false;
  }
  elements.customizationFontFamily.value = customization.fontFamily;
  elements.customizationFontSize.value = customization.fontSize;
  elements.customizationLineSpacing.value = customization.lineSpacing;
  elements.customizationLetterSpacing.value = customization.letterSpacing;
  elements.customizationTextColor.value = customization.textColor;
  elements.customizationValueColor.value = customization.valueColor;
  elements.customizationRankColor.value = customization.rankColor;
  elements.customizationTextEffect.value = customization.textEffect;
  elements.customizationWave.checked = customization.waveAnimation;
  elements.customizationBackground.checked = customization.showBackground;
  elements.customizationBackgroundColor.value = customization.backgroundColor;
  elements.customizationShowRank.checked = customization.showRank;
  elements.customizationShowValue.checked = customization.showValue;
  elements.customizationAlignRight.checked = customization.alignRight;
  elements.customizationCrown.checked = customization.showCrown;
  elements.giftCustomizationTitle.value = customization.title;
  elements.giftCustomizationTitleSize.value = customization.titleSize;
  elements.giftCustomizationTitleColor.value = customization.titleColor;
  elements.giftCustomizationUsernameColor.value = customization.usernameColor;
  elements.giftCustomizationUsernameSize.value = customization.usernameSize;
  elements.giftCustomizationTitleOffset.value = customization.titleVerticalOffset;
  elements.giftCustomizationImageOffset.value = customization.giftVerticalOffset;
  elements.giftCustomizationUsernameOffset.value = customization.usernameVerticalOffset;
  elements.giftCustomizationCoinsOffset.value = customization.coinsVerticalOffset;
  elements.giftCustomizationBorder.checked = customization.enableFontBorder;
  elements.giftCustomizationBorderColor.value = customization.borderColor;
  elements.giftCustomizationImageVisible.checked = customization.giftImageVisible;
  elements.giftCustomizationImageOpacity.value = customization.giftImageOpacity;
  elements.giftCustomizationTitleEffect.value = customization.titleTextEffect;
  elements.giftCustomizationTitleWave.checked = customization.titleWaveAnimation;
  elements.giftCustomizationUsernameEffect.value = customization.usernameTextEffect;
  elements.giftCustomizationUsernameWave.checked = customization.usernameWaveAnimation;
  elements.giftCustomizationShowCoins.checked = customization.showValue;
  elements.giftCustomizationCoinsAlias.value = customization.coinsAlias;
  elements.customizationModal.hidden = false;
  document.body.classList.add("modal-open");
}

function closeCustomization() {
  elements.customizationModal.hidden = true;
  document.body.classList.remove("modal-open");
  customizationKey = "";
}

function readCustomization() {
  const customization = {
    fontFamily: elements.customizationFontFamily.value,
    fontSize: Number(elements.customizationFontSize.value),
    lineSpacing: Number(elements.customizationLineSpacing.value),
    letterSpacing: Number(elements.customizationLetterSpacing.value),
    textColor: elements.customizationTextColor.value,
    valueColor: elements.customizationValueColor.value,
    rankColor: elements.customizationRankColor.value,
    textEffect: elements.customizationTextEffect.value,
    waveAnimation: elements.customizationWave.checked,
    showBackground: elements.customizationBackground.checked,
    backgroundColor: elements.customizationBackgroundColor.value.trim(),
    showRank: elements.customizationShowRank.checked,
    showValue: elements.customizationShowValue.checked,
    alignRight: elements.customizationAlignRight.checked,
    showCrown: elements.customizationCrown.checked
  };
  if (!customizationKey.startsWith("gift:")) return customization;
  return {
    ...customization,
    title: elements.giftCustomizationTitle.value.trim(), titleSize: Number(elements.giftCustomizationTitleSize.value),
    titleColor: elements.giftCustomizationTitleColor.value, usernameColor: elements.giftCustomizationUsernameColor.value,
    usernameSize: Number(elements.giftCustomizationUsernameSize.value), titleVerticalOffset: Number(elements.giftCustomizationTitleOffset.value),
    giftVerticalOffset: Number(elements.giftCustomizationImageOffset.value), usernameVerticalOffset: Number(elements.giftCustomizationUsernameOffset.value),
    coinsVerticalOffset: Number(elements.giftCustomizationCoinsOffset.value), enableFontBorder: elements.giftCustomizationBorder.checked,
    borderColor: elements.giftCustomizationBorderColor.value, giftImageVisible: elements.giftCustomizationImageVisible.checked,
    giftImageOpacity: Number(elements.giftCustomizationImageOpacity.value), titleTextEffect: elements.giftCustomizationTitleEffect.value,
    titleWaveAnimation: elements.giftCustomizationTitleWave.checked, usernameTextEffect: elements.giftCustomizationUsernameEffect.value,
    usernameWaveAnimation: elements.giftCustomizationUsernameWave.checked, showValue: elements.giftCustomizationShowCoins.checked,
    coinsAlias: elements.giftCustomizationCoinsAlias.value.trim()
  };
}

function renderMappings(mappings) {
  elements.mappingList.innerHTML = mappings.map((mapping) => `
    <article class="mapping-row ${mapping.enabled ? "" : "disabled"}">
      <div class="mapping-gift">${escapeHtml((mapping.giftName || mapping.giftId || "?").slice(0, 1).toUpperCase())}</div>
      <div class="mapping-main">
        <strong>${escapeHtml(mapping.giftName || `Regalo #${mapping.giftId}`)}</strong>
        <p>${escapeHtml(mapping.command)}</p>
      </div>
      <div class="mapping-tools">
        <button class="icon-button" data-action="test" data-id="${escapeHtml(mapping.id)}" title="Probar en Minecraft">▷</button>
        <button class="icon-button" data-action="edit" data-id="${escapeHtml(mapping.id)}" title="Editar">✎</button>
        <button class="icon-button delete" data-action="delete" data-id="${escapeHtml(mapping.id)}" title="Eliminar">×</button>
      </div>
    </article>`).join("");
  elements.mappingEmpty.hidden = mappings.length > 0;
}

function soundUrl(filename) {
  return `/sounds/${encodeURIComponent(filename)}`;
}

function playSound(filename) {
  if (!filename) return;
  const audio = new Audio(soundUrl(filename));
  audio.play().catch(() => toast("El navegador bloqueó la reproducción de audio.", "error"));
}

function currentTtsSettings() {
  return {
    enabled: Boolean(appState?.config?.tts?.enabled),
    language: appState?.config?.tts?.language || "es-CO",
    volume: Number(appState?.config?.tts?.volume ?? 1),
    speed: Number(appState?.config?.tts?.speed ?? 60),
    pitch: Number(appState?.config?.tts?.pitch ?? 70)
  };
}

function allowedUsersSettings() {
  return {
    allUsers: elements.allowAllUsers.checked,
    followers: elements.allowFollowers.checked,
    subscribers: elements.allowSubscribers.checked,
    moderators: elements.allowModerators.checked,
    teamMembers: elements.allowTeamMembers.checked,
    teamMembersMinLevel: Number(elements.teamMembersMinLevel.value),
    topGifters: elements.allowTopGifters.checked,
    topGiftersTop: Number(elements.topGiftersTop.value),
    listEnabled: elements.allowList.checked,
    usernames: elements.allowedUsernames.value.split(/[\n,]/).map((value) => value.trim()).filter(Boolean)
  };
}

function playTts(text, { allowWhenDisabled = false } = {}) {
  const settings = currentTtsSettings();
  if (!settings.enabled && !allowWhenDisabled) return toast("Activa TTS en General Settings para reproducir.", "error");
  ttsQueue.enqueue(text, settings);
}

function renderSoundOptions(selectedAudio = elements.audio.value) {
  const selected = selectedAudio || "";
  elements.audio.replaceChildren(new Option("Sin audio", ""));
  for (const filename of availableSounds) elements.audio.add(new Option(filename, filename));
  if (selected && !availableSounds.includes(selected)) {
    elements.audio.add(new Option(`${selected} (no disponible)`, selected));
  }
  elements.audio.value = selected;
  elements.audioTest.disabled = !selected || !availableSounds.includes(selected);
  elements.audioState.textContent = availableSounds.length
    ? `${availableSounds.length} audio(s) disponible(s) en src/public/sounds/.`
    : "No hay audios disponibles. Colócalos en src/public/sounds/.";
}

async function loadSounds() {
  try {
    const response = await fetch("/api/sounds");
    if (!response.ok) throw new Error();
    const payload = await response.json();
    availableSounds = Array.isArray(payload.sounds) ? payload.sounds : [];
    renderSoundOptions();
  } catch {
    elements.audioState.textContent = "No se pudo cargar la lista de audios.";
  }
}

function symbolFor(entry) {
  if (entry.type === "gift" || entry.type === "gift-unmapped") return ["♥", "gift"];
  if (entry.type === "action") return ["⚡", "action"];
  if (entry.type === "error") return ["!", "error"];
  if (entry.type === "console") return [">", "console"];
  if (entry.type === "cooldown") return ["○", "console"];
  return ["·", ""];
}

function giftActivityName(event) {
  const giftName = event.giftName || "Regalo";
  const giftId = String(event.giftId || "");
  const mapping = appState?.config?.mappings?.find((item) =>
    item.giftId && String(item.giftId) === giftId && item.giftName
  );
  const isGenericIdLabel = giftId && (
    giftName.trim() === giftId ||
    giftName.trim() === `#${giftId}` ||
    giftName.trim().toLocaleLowerCase() === `regalo #${giftId}`.toLocaleLowerCase()
  );
  const catalogName = giftNamesById[giftId];
  if (isGenericIdLabel && (catalogName || mapping?.giftName)) {
    return `${giftName} (${catalogName || mapping.giftName})`;
  }
  if (!mapping || giftName.trim().toLocaleLowerCase() === mapping.giftName.trim().toLocaleLowerCase()) return giftName;
  return `${giftName} (${mapping.giftName})`;
}

function entryText(entry) {
  if (entry.type === "gift") return `${entry.event.nickname} regaló ${giftActivityName(entry.event)}${entry.event.repeatCount > 1 ? ` ×${entry.event.repeatCount}` : ""}`;
  if (entry.type === "gift-unmapped") return `${entry.event.nickname} regaló ${giftActivityName(entry.event)}; no hay acción configurada`;
  if (entry.type === "action") return `${entry.mapping?.giftName || entry.event.giftName} → ${entry.command}`;
  return entry.message || "Evento";
}

function renderActivity(activity) {
  elements.activityLog.innerHTML = activity.map((entry) => {
    const [symbol, className] = symbolFor(entry);
    const time = new Date(entry.at).toLocaleTimeString([], { hour:"2-digit", minute:"2-digit", second:"2-digit" });
    return `<div class="activity-item"><span class="activity-time">${time}</span><span class="activity-symbol ${className}">${symbol}</span><span class="activity-message">${escapeHtml(entryText(entry))}${entry.type === "console" && entry.entry?.level ? `<small class="activity-meta">${escapeHtml(entry.entry.level)}</small>` : ""}</span></div>`;
  }).join("");
  elements.activityEmpty.hidden = activity.length > 0;
}

function resetEditor() {
  elements.mappingForm.reset();
  elements.mappingId.value = "";
  elements.cooldown.value = 0;
  elements.enabled.checked = true;
  renderSoundOptions("");
  elements.editorHeading.textContent = "Nueva acción";
  elements.cancelEdit.hidden = true;
}

function openEditor(mapping) {
  elements.mappingId.value = mapping.id;
  elements.giftName.value = mapping.giftName;
  elements.giftId.value = mapping.giftId;
  elements.command.value = mapping.command;
  renderSoundOptions(mapping.audio);
  elements.cooldown.value = mapping.cooldownMs;
  elements.enabled.checked = mapping.enabled;
  elements.editorHeading.textContent = "Editar acción";
  elements.cancelEdit.hidden = false;
  elements.mappingForm.scrollIntoView({ behavior:"smooth", block:"center" });
  elements.giftName.focus();
}

async function control(button, event, payload, success) {
  button.disabled = true;
  try { await request(event, payload); toast(success, "success"); } catch (error) { toast(error.message, "error"); } finally { button.disabled = false; }
}

elements.settings.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submit = event.submitter;
  await control(submit, "settings:save", {
    serverTapHost: elements.serverTapHost.value.trim(),
    serverTapPort: elements.serverTapPort.value.trim(),
    serverTapProtocol: elements.serverTapProtocol.value,
    serverTapKey: elements.serverTapKey.value
  }, "Conexión guardada");
  elements.serverTapKey.value = "";
});

$("#minecraft-connect").addEventListener("click", (event) => control(event.currentTarget, "minecraft:connect", null, "Minecraft conectado"));
$("#minecraft-disconnect").addEventListener("click", (event) => control(event.currentTarget, "minecraft:disconnect", null, "Minecraft desconectado"));
$("#tiktok-connect").addEventListener("click", async (event) => {
  const button = event.currentTarget;
  const username = elements.tiktokUsername.value.trim().replace(/^@/, "");
  if (!username) return toast("Escribe el usuario de un TikTok LIVE activo.", "error");
  if (!elements.eulerStreamApiKey.value && !appState?.config?.eulerStreamApiKeyPresent) return toast("Pega tu Euler Stream API Key para conectar.", "error");
  button.disabled = true;
  try {
    await request("settings:save", { tiktokUsername: username, eulerStreamApiKey: elements.eulerStreamApiKey.value.trim() });
    elements.eulerStreamApiKey.value = "";
    await request("tiktok:connect", null);
    toast(`LIVE de @${username} conectado`, "success");
  } catch (error) {
    toast(error.message, "error");
  } finally {
    button.disabled = false;
  }
});
$("#tiktok-disconnect").addEventListener("click", (event) => control(event.currentTarget, "tiktok:disconnect", null, "TikTok desconectado"));

elements.ttsVolume.addEventListener("input", () => {
  elements.ttsVolumeValue.textContent = `${Math.round(Number(elements.ttsVolume.value) * 100)}%`;
});
elements.ttsSettings.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submit = event.submitter;
  await control(submit, "tts:save", {
    enabled: elements.ttsEnabled.checked,
    language: elements.ttsLanguage.value,
    volume: Number(elements.ttsVolume.value),
    speed: Number(elements.ttsSpeed.value),
    pitch: Number(elements.ttsPitch.value)
  }, "Configuración TTS guardada");
});
elements.voiceTester.addEventListener("submit", (event) => {
  event.preventDefault();
  playTts(elements.voiceTesterText.value, { allowWhenDisabled: true });
});
elements.manageAllowedUsers.addEventListener("click", () => {
  elements.allowedUsersListEditor.hidden = !elements.allowedUsersListEditor.hidden;
  if (!elements.allowedUsersListEditor.hidden) elements.allowedUsernames.focus();
});
elements.allowedUsers.addEventListener("submit", async (event) => {
  event.preventDefault();
  await control(event.submitter, "tts:save", { allowedUsers: allowedUsersSettings() }, "Usuarios permitidos guardados");
});

document.querySelectorAll(".overlay-customize").forEach((button) => {
  button.addEventListener("click", () => openCustomization(button));
});
elements.customizationModal.querySelectorAll("[data-modal-close]").forEach((button) => {
  button.addEventListener("click", closeCustomization);
});
elements.customizationForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!customizationKey) return;
  const submit = event.submitter;
  submit.disabled = true;
  try {
    const saved = await request("overlay-customization:save", { key: customizationKey, customization: readCustomization() });
    if (appState?.config) {
      appState.config.overlayCustomizations ||= {};
      appState.config.overlayCustomizations[saved.key] = saved.customization;
    }
    toast("Personalización guardada", "success");
    closeCustomization();
  } catch (error) {
    toast(error.message, "error");
  } finally {
    submit.disabled = false;
  }
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !elements.customizationModal.hidden) closeCustomization();
});

function toggleAccordion(button, panel) {
  const isOpen = button.getAttribute("aria-expanded") === "true";
  button.setAttribute("aria-expanded", String(!isOpen));
  if (isOpen) {
    panel.classList.remove("is-open");
    setTimeout(() => { if (!panel.classList.contains("is-open")) panel.hidden = true; }, 180);
  } else {
    panel.hidden = false;
    requestAnimationFrame(() => panel.classList.add("is-open"));
  }
}

elements.goalsToggle.addEventListener("click", () => {
  toggleAccordion(elements.goalsToggle, elements.goalsPanel);
});
elements.rankingsToggle.addEventListener("click", () => {
  toggleAccordion(elements.rankingsToggle, elements.rankingsPanel);
});
for (const card of elements.rankingOverlayCards) {
  const kind = card.dataset.rankingOverlayKind;
  card.querySelector(".ranking-overlay-copy").addEventListener("click", async () => {
    const input = card.querySelector(".ranking-overlay-url-input");
    try {
      await navigator.clipboard.writeText(input.value);
    } catch {
      input.select();
      document.execCommand("copy");
    }
    toast("URL copiada", "success");
  });
  card.querySelector(".ranking-overlay-preview-button").addEventListener("click", () => window.open(rankingOverlayUrl(kind), "_blank", "noopener"));
}
elements.giftOverlaysToggle.addEventListener("click", () => {
  toggleAccordion(elements.giftOverlaysToggle, elements.giftOverlaysPanel);
});
elements.giftOverlaysForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await control(event.submitter, "gift-overlays:save", { resetOnNewLive: elements.giftOverlaysResetOnLive.checked }, "Configuración de regalos guardada");
});
elements.giftOverlaysResetNow.addEventListener("click", (event) => control(event.currentTarget, "gift-overlays:reset", null, "Récords restablecidos"));
for (const card of elements.giftOverlayCards) {
  card.querySelector(".gift-overlay-preview-image").addEventListener("error", (event) => { event.currentTarget.hidden = true; });
  const kind = card.dataset.giftOverlayKind;
  card.querySelector(".gift-overlay-copy").addEventListener("click", async () => {
    const input = card.querySelector(".gift-overlay-url-input");
    try {
      await navigator.clipboard.writeText(input.value);
    } catch {
      input.select();
      document.execCommand("copy");
    }
    toast("URL copiada", "success");
  });
  card.querySelector(".gift-overlay-preview").addEventListener("click", () => window.open(giftOverlayUrl(kind), "_blank", "noopener"));
}
for (const card of elements.goalCards) {
  const form = card.querySelector(".goal-form");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submit = event.submitter;
    const data = {
      id: card.querySelector(".goal-id").value,
      type: card.dataset.goalType,
      name: card.querySelector(".goal-name").value.trim(),
      target: Number(card.querySelector(".goal-target").value),
      current: Number(card.querySelector(".goal-current").value),
      enabled: card.querySelector(".goal-enabled-input").checked
    };
    await control(submit, "goal:save", data, "Meta guardada");
  });
  card.querySelector(".goal-copy").addEventListener("click", async () => {
    const input = card.querySelector(".goal-url");
    try {
      await navigator.clipboard.writeText(input.value);
    } catch {
      input.select();
      document.execCommand("copy");
    }
    toast("URL copiada", "success");
  });
  card.querySelector(".goal-preview").addEventListener("click", () => {
    const url = card.querySelector(".goal-url").value;
    if (url) window.open(url, "_blank", "noopener");
  });
}

elements.mappingForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = {
    id: elements.mappingId.value || `rule-${crypto.randomUUID()}`,
    giftName: elements.giftName.value.trim(), giftId: elements.giftId.value.trim(), command: elements.command.value.trim(), audio: elements.audio.value,
    cooldownMs: Number(elements.cooldown.value), enabled: elements.enabled.checked
  };
  if (!data.giftName && !data.giftId) return toast("Indica al menos el nombre o ID del regalo.", "error");
  try {
    const saved = await request("mapping:save", data);
    if (appState?.config?.mappings && saved?.id) {
      const existing = appState.config.mappings.findIndex((mapping) => mapping.id === saved.id);
      if (existing >= 0) appState.config.mappings[existing] = saved;
      else appState.config.mappings.push(saved);
      renderMappings(appState.config.mappings);
    }
    toast("Acción guardada", "success");
    resetEditor();
  } catch (error) { toast(error.message, "error"); }
});
elements.cancelEdit.addEventListener("click", resetEditor);
elements.audio.addEventListener("change", () => {
  elements.audioTest.disabled = !elements.audio.value || !availableSounds.includes(elements.audio.value);
});
elements.audioTest.addEventListener("click", () => playSound(elements.audio.value));

elements.mappingList.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button || !appState) return;
  const mapping = appState.config.mappings.find((item) => item.id === button.dataset.id);
  if (!mapping) return;
  if (button.dataset.action === "edit") return openEditor(mapping);
  if (button.dataset.action === "delete") {
    if (!confirm(`¿Eliminar la acción de ${mapping.giftName || mapping.giftId}?`)) return;
    return control(button, "mapping:delete", mapping.id, "Acción eliminada");
  }
  if (button.dataset.action === "test") return control(button, "mapping:test", mapping.id, "Comando de prueba enviado");
});

elements.simulateForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const input = elements.simulateGift.value.trim();
  if (!input) return toast("Escribe un nombre o ID para simular.", "error");
  const isId = /^\d+$/.test(input);
  try {
    const result = await request("gift:simulate", { giftId: isId ? input : "", giftName: isId ? "" : input, repeatCount: elements.simulateCount.value });
    toast(result.executed ? `${result.executed} acción(es) enviada(s)` : "No coincide con ninguna acción", result.executed ? "success" : "");
  } catch (error) { toast(error.message, "error"); }
});

$("#clear-activity").addEventListener("click", () => { hiddenActivity = true; elements.activityLog.innerHTML = ""; elements.activityEmpty.hidden = false; });
socket.on("state", (next) => { hiddenActivity = false; renderState(next); });
socket.on("activity", (entry) => {
  if (hiddenActivity) return;
  if (appState) { appState.activity.unshift(entry); appState.activity = appState.activity.slice(0, 100); renderActivity(appState.activity); }
});
socket.on("tiktok:comment", (comment) => {
  if (!appState?.config?.tts?.enabled || !comment?.text) return;
  ttsQueue.enqueue(`${comment.nickname}: ${comment.text}`, currentTtsSettings());
});
socket.on("goal:update", (goal) => {
  if (!appState || !goal?.id) return;
  const existing = appState.config.goals.findIndex((item) => item.id === goal.id);
  if (existing >= 0) appState.config.goals[existing] = goal;
  else appState.config.goals.push(goal);
  renderGoal(goal);
});
socket.on("gift-overlay:update", (overlay) => {
  if (!overlay?.kind) return;
  if (appState?.config?.giftOverlays) {
    appState.config.giftOverlays[overlay.kind === "best-gift" ? "bestGift" : "bestStreak"] = overlay.record;
  }
  renderGiftOverlay(overlay.kind, overlay.record);
});
socket.on("ranking-overlay:update", (overlay) => {
  if (!overlay?.kind) return;
  if (appState) {
    appState.rankings ||= {};
    appState.rankings.topDonors = overlay.entries || [];
  }
  renderRankingOverlay(overlay);
});
socket.on("overlay-customization:update", ({ key, customization }) => {
  if (!appState?.config || !key) return;
  appState.config.overlayCustomizations ||= {};
  appState.config.overlayCustomizations[key] = customization;
});
socket.on("connect_error", () => toast("Se perdió la conexión con el panel local.", "error"));
socket.on("mapping:sound", (data) => playSound(data?.audio));
loadSounds();
