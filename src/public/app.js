const socket = io({ autoConnect: false, auth: { token: window.TikTokraftAuth?.accessToken || "" } });
let appState = null;
let hiddenActivity = false;
let userPointsSearch = "";
let userPointsSearchTimer = null;
let userPointsOverlayToken = "";
let giftCatalog = [];
let giftCatalogSearch = "";
let activePresetPackId = "";
let actionPresetCatalogLoad = null;
const presetDetails = new Map();
const presetDetailLoads = new Map();
let pendingPresetAssignment = null;
let videoCatalogSearch = "";
let authorizedAccounts = [];
let authorizedAccountSearch = "";
let accountRoles = [];
let accountRolesSearch = "";
let statisticsAccounts = [];
let connectedStatisticsAccounts = [];
let statisticsSearch = "";
let statisticsProfileOrigin = "registered";
let adminMediaCatalog = { sounds: [], videos: [] };
let timerSettingsSaveTimer = null;
let timerSettingsRevision = 0;
let panelTimer = null;
let panelTimerRemainingMs = 0;
let panelTimerDeadline = 0;
let panelTimerSyncAt = 0;
let panelTimerServerOffsetMs = 0;
let panelTimerRenderTimer = null;
let panelTimerZeroSynchronized = false;
const giftNamesById = window.TIKTOK_GIFT_NAMES || {};
const actionPresetPacks = [];
const legacyPresetPacks = { world: { title: "Mundo cambiante (anterior)", icon: "🌦️" } };

const $ = (selector) => document.querySelector(selector);
const elements = {
  settings: $("#settings-form"),
  tiktokUsername: $("#tiktok-live-username"), eulerStreamApiKey: $("#euler-stream-api-key"), eulerKeyState: $("#euler-key-state"),
  serverTapHost: $("#servertap-host"), serverTapPort: $("#servertap-port"), serverTapProtocol: $("#servertap-protocol"),
  serverTapKey: $("#servertap-key"), serverTapVisibilityToggles: [...document.querySelectorAll(".server-tap-visibility-toggle")],
  keyState: $("#key-state"),
  ttsSettings: $("#tts-settings-form"), ttsEnabled: $("#tts-enabled"), ttsReadUsername: $("#tts-read-username"), ttsLanguage: $("#tts-language"), ttsVoice: $("#tts-voice"), ttsVoiceState: $("#tts-voice-state"), ttsVolume: $("#tts-volume"), ttsVolumeValue: $("#tts-volume-value"),
  ttsStop: $("#tts-stop"), ttsResume: $("#tts-resume"),
  voiceTester: $("#voice-tester-form"), voiceTesterText: $("#voice-tester-text"), ttsSpeed: $("#tts-speed"), ttsPitch: $("#tts-pitch"),
  allowedUsers: $("#allowed-users-form"), allowAllUsers: $("#tts-allow-all-users"), allowFollowers: $("#tts-allow-followers"), allowSubscribers: $("#tts-allow-subscribers"), allowModerators: $("#tts-allow-moderators"), allowTeamMembers: $("#tts-allow-team-members"), teamMembersMinLevel: $("#tts-team-members-min-level"), allowTopGifters: $("#tts-allow-top-gifters"), topGiftersTop: $("#tts-top-gifters-top"), allowList: $("#tts-allow-list"), manageAllowedUsers: $("#manage-allowed-users"), allowedUsersListEditor: $("#allowed-users-list-editor"), allowedUsernames: $("#tts-allowed-usernames"),
  goalsToggle: $("#goals-toggle"), goalsPanel: $("#goals-panel"), goalCards: [...document.querySelectorAll(".goal-card")],
  timerToggle: $("#timer-toggle"), timerPanel: $("#timer-panel"), timerUrl: $("#timer-overlay-url"), timerCopy: $("#timer-overlay-copy"), timerPreviewButton: $("#timer-overlay-preview-button"), timerPreview: $("#timer-preview"), timerPreviewCoinLabel: $("#timer-preview-coin-label"), timerPreviewValue: $("#timer-preview-value"), timerPreviewStatus: $("#timer-preview-status"),
  timerStart: $("#timer-start"), timerPause: $("#timer-pause"), timerReset: $("#timer-reset"), timerCurrentMinutes: $("#timer-current-minutes"), timerAddTen: $("#timer-add-ten"), timerRemoveTen: $("#timer-remove-ten"),
  timerInitialMinutes: $("#timer-initial-minutes"), timerExpiryAction: $("#timer-expiry-action"), timerPerCoin: $("#timer-per-coin"), timerCoinText: $("#timer-coin-text"), timerPerSubscription: $("#timer-per-subscription"), timerPerFollow: $("#timer-per-follow"), timerPerShare: $("#timer-per-share"), timerPerLike: $("#timer-per-like"), timerPerComment: $("#timer-per-comment"), timerMultiplierEnabled: $("#timer-multiplier-enabled"), timerMultiplierValue: $("#timer-multiplier-value"), timerShortcutToggle: $("#timer-shortcut-toggle"), timerShortcutIncrease: $("#timer-shortcut-increase"), timerShortcutDecrease: $("#timer-shortcut-decrease"), timerShortcutStep: $("#timer-shortcut-step"), timerAutosaveState: $("#timer-autosave-state"),
  rankingsToggle: $("#rankings-toggle"), rankingsPanel: $("#rankings-panel"), rankingOverlayCards: [...document.querySelectorAll(".ranking-overlay-option")],
  userPointsToggle: $("#user-points-toggle"), userPointsPanel: $("#user-points-panel"), userPointsSearch: $("#user-points-search"), userPointsList: $("#user-points-list"), userPointsEmpty: $("#user-points-empty"), userPointsStatus: $("#user-points-status"), userPointsAdd: $("#user-points-add"), userPointsUrl: $("#user-points-overlay-url"), userPointsCopy: $("#user-points-overlay-copy"), userPointsPreview: $("#user-points-overlay-preview"), userPointsLimit: $("#user-points-overlay-limit"), userPointsLimitForm: $("#user-points-overlay-form"), transactionModal: $("#user-points-transaction-modal"), transactionForm: $("#user-points-transaction-form"), transactionUser: $("#user-points-transaction-user"), transactionUsers: $("#user-points-known-users"), transactionCoins: $("#user-points-transaction-coins"), transactionDescription: $("#user-points-transaction-description"),
  giftOverlaysToggle: $("#gift-overlays-toggle"), giftOverlaysPanel: $("#gift-overlays-panel"), giftOverlaysForm: $("#gift-overlays-form"), giftOverlaysResetOnLive: $("#gift-overlays-reset-on-live"), giftOverlaysResetNow: $("#gift-overlays-reset-now"), giftOverlayCards: [...document.querySelectorAll(".gift-overlay-option")],
  customizationModal: $("#overlay-customization-modal"), customizationForm: $("#overlay-customization-form"), customizationTitle: $("#overlay-customization-title"), customizationFontFamily: $("#customization-font-family"), customizationFontSize: $("#customization-font-size"), customizationLineSpacing: $("#customization-line-spacing"), customizationLetterSpacing: $("#customization-letter-spacing"), customizationTextColor: $("#customization-text-color"), customizationValueColor: $("#customization-value-color"), customizationRankColor: $("#customization-rank-color"), customizationTextEffect: $("#customization-text-effect"), customizationWave: $("#customization-wave"), customizationBackground: $("#customization-background"), customizationBackgroundColor: $("#customization-background-color"), customizationShowRank: $("#customization-show-rank"), customizationShowValue: $("#customization-show-value"), customizationAlignRight: $("#customization-align-right"), customizationCrown: $("#customization-crown"), userPointsCustomizationLimit: $("#user-points-customization-limit"), giftCustomizationTitle: $("#gift-customization-title"), giftCustomizationTitleSize: $("#gift-customization-title-size"), giftCustomizationTitleColor: $("#gift-customization-title-color"), giftCustomizationUsernameColor: $("#gift-customization-username-color"), giftCustomizationUsernameSize: $("#gift-customization-username-size"), giftCustomizationTitleOffset: $("#gift-customization-title-offset"), giftCustomizationImageOffset: $("#gift-customization-image-offset"), giftCustomizationUsernameOffset: $("#gift-customization-username-offset"), giftCustomizationCoinsOffset: $("#gift-customization-coins-offset"), giftCustomizationBorder: $("#gift-customization-border"), giftCustomizationBorderColor: $("#gift-customization-border-color"), giftCustomizationImageVisible: $("#gift-customization-image-visible"), giftCustomizationImageOpacity: $("#gift-customization-image-opacity"), giftCustomizationTitleEffect: $("#gift-customization-title-effect"), giftCustomizationTitleWave: $("#gift-customization-title-wave"), giftCustomizationUsernameEffect: $("#gift-customization-username-effect"), giftCustomizationUsernameWave: $("#gift-customization-username-wave"), giftCustomizationShowCoins: $("#gift-customization-show-coins"), giftCustomizationCoinsAlias: $("#gift-customization-coins-alias"),
  minecraftDetail: $("#minecraft-detail"), minecraftDot: $("#minecraft-dot"),
  tiktokDetail: $("#tiktok-detail"), tiktokDot: $("#tiktok-dot"),
  globalStatus: $("#global-status"), adminPanelButton: $("#admin-panel-button"), profileButton: $("#profile-button"), logout: $("#logout-button"),
  proAccessBanner: $("#pro-access-banner"), proAccessDetails: $("#pro-access-details"), proUpgradeModal: $("#pro-upgrade-modal"),
  adminModal: $("#admin-modal"), adminMenuView: $("#admin-menu-view"), adminAuthorizationView: $("#admin-authorization-view"), adminRolesView: $("#admin-roles-view"), adminStatisticsView: $("#admin-statistics-view"), adminRegisteredUsersView: $("#admin-registered-users-view"), adminConnectedUsersView: $("#admin-connected-users-view"), adminUserProfileView: $("#admin-user-profile-view"), adminOpenAuthorization: $("#admin-open-authorization"), adminOpenRoles: $("#admin-open-roles"), adminOpenStatistics: $("#admin-open-statistics"), adminBackMenu: $("#admin-back-menu"), adminRolesBackMenu: $("#admin-roles-back-menu"), adminStatisticsBackMenu: $("#admin-statistics-back-menu"), adminOpenRegisteredUsers: $("#admin-open-registered-users"), adminOpenConnectedUsers: $("#admin-open-connected-users"), adminRegisteredUsersBack: $("#admin-registered-users-back"), adminConnectedUsersBack: $("#admin-connected-users-back"), adminRegisteredUsersSearch: $("#admin-registered-users-search"), adminRegisteredUsersList: $("#admin-registered-users-list"), adminRegisteredUsersEmpty: $("#admin-registered-users-empty"), adminConnectedUsersList: $("#admin-connected-users-list"), adminConnectedUsersEmpty: $("#admin-connected-users-empty"), adminRegisteredUsersCount: $("#admin-registered-users-count"), adminConnectedUsersCount: $("#admin-connected-users-count"), adminUserProfileBack: $("#admin-user-profile-back"), adminUserProfileTitle: $("#admin-user-profile-title"), adminUserProfileData: $("#admin-user-profile-data"), adminAuthorizedForm: $("#admin-authorized-form"), adminAuthorizedEmail: $("#admin-authorized-email"), adminAuthorizedSearch: $("#admin-authorized-search"), adminAuthorizedList: $("#admin-authorized-list"), adminAuthorizedEmpty: $("#admin-authorized-empty"), adminRolesForm: $("#admin-roles-form"), adminRoleEmail: $("#admin-role-email"), adminRoleSelect: $("#admin-role-select"), adminRolesSearch: $("#admin-roles-search"), adminRolesList: $("#admin-roles-list"), adminRolesEmpty: $("#admin-roles-empty"),
  adminMediaView: $("#admin-media-view"), adminOpenMedia: $("#admin-open-media"), adminMediaBackMenu: $("#admin-media-back-menu"), adminVideoUploadForm: $("#admin-video-upload-form"), adminVideoFile: $("#admin-video-file"), adminVideoUploadStatus: $("#admin-video-upload-status"), adminVideoList: $("#admin-video-list"), adminVideoEmpty: $("#admin-video-empty"), adminSoundUploadForm: $("#admin-sound-upload-form"), adminSoundFile: $("#admin-sound-file"), adminSoundUploadStatus: $("#admin-sound-upload-status"), adminSoundList: $("#admin-sound-list"), adminSoundEmpty: $("#admin-sound-empty"),
  profileModal: $("#profile-modal"), profileForm: $("#profile-form"), profileAvatar: $("#profile-avatar"), profileAvatarEmpty: $("#profile-avatar-empty"), profileAvatarInput: $("#profile-avatar-input"), profileEmail: $("#profile-email"), profilePassword: $("#profile-password"), profilePasswordConfirm: $("#profile-password-confirm"), profileMessage: $("#profile-message"),
  mappingForm: $("#mapping-form"), mappingId: $("#mapping-id"), mappingTriggerType: $("#mapping-trigger-type"), mappingGiftFields: $("#mapping-gift-fields"), giftName: $("#gift-name"), giftId: $("#gift-id"),
  actionModeCommand: $("#action-mode-command"), actionModePresets: $("#action-mode-presets"), actionPresetPanel: $("#action-preset-panel"), actionPresetSearchLabel: $("#action-preset-search-label"), actionPresetSearch: $("#action-preset-search"), actionPresetList: $("#action-preset-list"), actionPresetEmpty: $("#action-preset-empty"),
  command: $("#mapping-command"), audio: $("#mapping-audio"), audioTest: $("#audio-test"), audioTestStop: $("#audio-test-stop"), audioState: $("#audio-state"), mappingVideo: $("#mapping-video"), mappingVideoSelected: $("#mapping-video-selected"), selectVideoButton: $("#select-video-button"), clearVideoButton: $("#clear-video-button"), videoState: $("#video-state"), actionVideoWidgetUrl: $("#action-video-widget-url"), actionVideoWidgetCopy: $("#action-video-widget-copy"), actionVideoWidgetPreview: $("#action-video-widget-preview"), cooldown: $("#cooldown"), enabled: $("#mapping-enabled"), editorHeading: $("#editor-heading"),
  cancelEdit: $("#cancel-edit"), mappingList: $("#mapping-list"), mappingEmpty: $("#mapping-empty"), selectGiftButton: $("#select-gift-button"), giftSelectorModal: $("#gift-selector-modal"), giftSelectorSearch: $("#gift-selector-search"), giftSelectorGrid: $("#gift-selector-grid"), giftSelectorEmpty: $("#gift-selector-empty"),
  videoSelectorModal: $("#video-selector-modal"), videoSelectorSearch: $("#video-selector-search"), videoSelectorGrid: $("#video-selector-grid"), videoSelectorEmpty: $("#video-selector-empty"),
  simulateForm: $("#simulate-form"), simulateGift: $("#simulate-gift"), simulateCount: $("#simulate-count"),
  giftHistoryList: $("#gift-history-list"), giftHistoryEmpty: $("#gift-history-empty"),
  activityLog: $("#activity-log"), activityEmpty: $("#activity-empty"), toasts: $("#toasts")
};
elements.logout?.addEventListener("click", () => {
  window.TikTokraftAuth?.signOut?.();
  socket.disconnect();
  location.reload();
});
elements.proAccessDetails?.addEventListener("click", openProUpgrade);
elements.proUpgradeModal?.querySelectorAll("[data-pro-upgrade-close]").forEach((button) => button.addEventListener("click", closeProUpgrade));
let colombiaPaymentAutomatic = false;
let proPaymentCheckTimer = null;
const colombiaPaymentButton = elements.proUpgradeModal?.querySelector("a.pro-payment-option[href*='checkout.nequi.wompi.co']");
const proPaymentExplanation = elements.proUpgradeModal?.querySelector("#pro-payment-explanation");
const proPaymentStatus = elements.proUpgradeModal?.querySelector("#pro-payment-status");

function showProPaymentStatus(message) {
  if (!proPaymentStatus) return;
  proPaymentStatus.hidden = !message;
  proPaymentStatus.textContent = message;
}

async function colombiaPaymentRequest(path, method = "GET") {
  const response = await fetch(path, { method, headers: { Authorization: `Bearer ${window.TikTokraftAuth?.accessToken || ""}` }, cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "No se pudo consultar el pago.");
  return data;
}

async function checkReturnedProPayment(attempts = 0) {
  try {
    const result = await colombiaPaymentRequest("/api/payments/colombia/status");
    if (result.isPro) {
      showProPaymentStatus("Pago aprobado. Tu cuenta ya tiene Pro; actualizando el panel…");
      location.reload();
      return;
    }
    if (attempts >= 59) {
      showProPaymentStatus("Wompi todavía no confirma el pago. Si lo aprobó, vuelve a cargar la página en unos minutos. No pagues de nuevo.");
      return;
    }
    showProPaymentStatus("Esperando la confirmación segura de Wompi… No pagues de nuevo.");
    proPaymentCheckTimer = setTimeout(() => checkReturnedProPayment(attempts + 1), 2000);
  } catch {
    showProPaymentStatus("No pudimos consultar el estado. Vuelve a cargar la página; no pagues de nuevo sin comprobar antes la transacción.");
  }
}

async function initializeColombiaPayment() {
  if (!window.TikTokraftAuth?.accessToken) return;
  try {
    const result = await colombiaPaymentRequest("/api/payments/colombia/status");
    colombiaPaymentAutomatic = result.automatic === true;
    if (colombiaPaymentAutomatic) {
      colombiaPaymentButton?.setAttribute("aria-label", "Pago Colombia: pago único de 90.000 pesos y activación automática tras la confirmación de Wompi.");
      if (proPaymentExplanation) proPaymentExplanation.textContent = "Un pago por persona, sin mensualidad ni suscripción. Pagas con la cuenta que tienes abierta; Pro se activa automáticamente cuando Wompi confirme el pago aprobado.";
    }
    const currentUrl = new URL(location.href);
    if (currentUrl.searchParams.get("payment") === "return" && colombiaPaymentAutomatic) {
      currentUrl.searchParams.delete("payment");
      currentUrl.searchParams.delete("id");
      history.replaceState(null, "", `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`);
      openProUpgrade();
      if (result.isPro) {
        showProPaymentStatus("Pago aprobado. Tu cuenta ya tiene Pro.");
        location.reload();
      } else {
        void checkReturnedProPayment();
      }
    }
  } catch { /* Si no está lista la integración, se conserva el enlace manual actual. */ }
}

colombiaPaymentButton?.addEventListener("click", async (event) => {
  if (!colombiaPaymentAutomatic) return;
  event.preventDefault();
  if (colombiaPaymentButton.dataset.loading === "true") return;
  colombiaPaymentButton.dataset.loading = "true";
  showProPaymentStatus("Preparando el pago seguro para tu cuenta…");
  try {
    const result = await colombiaPaymentRequest("/api/payments/colombia/start", "POST");
    const checkout = new URL(result.checkoutUrl);
    if (checkout.origin !== "https://checkout.wompi.co") throw new Error("El destino de pago no es válido.");
    location.assign(checkout.toString());
  } catch (error) {
    showProPaymentStatus(error.message);
    colombiaPaymentButton.dataset.loading = "false";
  }
});
void initializeColombiaPayment();
elements.proUpgradeModal?.querySelector("[data-pro-payment-region='exterior']")?.addEventListener("click", () => {
  const status = elements.proUpgradeModal.querySelector("#pro-payment-status");
  if (!status) return;
  status.hidden = false;
  status.textContent = "El pago exterior todavía no está habilitado. No se ha realizado ningún cobro.";
});
elements.profileButton?.addEventListener("click", openProfileModal);
elements.profileModal?.querySelectorAll("[data-profile-modal-close]").forEach((button) => button.addEventListener("click", closeProfileModal));
elements.adminPanelButton?.addEventListener("click", openAdminPanel);
elements.adminModal?.querySelectorAll("[data-admin-modal-close]").forEach((button) => button.addEventListener("click", closeAdminPanel));
elements.adminOpenAuthorization?.addEventListener("click", openAuthorizationPanel);
elements.adminOpenRoles?.addEventListener("click", openRolesPanel);
elements.adminOpenStatistics?.addEventListener("click", openStatisticsPanel);
elements.adminOpenMedia?.addEventListener("click", openMediaPanel);
elements.adminBackMenu?.addEventListener("click", showAdminMenu);
elements.adminRolesBackMenu?.addEventListener("click", showAdminMenu);
elements.adminStatisticsBackMenu?.addEventListener("click", showAdminMenu);
elements.adminMediaBackMenu?.addEventListener("click", showAdminMenu);
elements.adminOpenRegisteredUsers?.addEventListener("click", openRegisteredUsers);
elements.adminOpenConnectedUsers?.addEventListener("click", openConnectedUsers);
elements.adminRegisteredUsersBack?.addEventListener("click", openStatisticsPanel);
elements.adminConnectedUsersBack?.addEventListener("click", openStatisticsPanel);
elements.adminUserProfileBack?.addEventListener("click", () => statisticsProfileOrigin === "connected" ? openConnectedUsers() : openRegisteredUsers());
elements.adminAuthorizedSearch?.addEventListener("input", () => { authorizedAccountSearch = elements.adminAuthorizedSearch.value.trim(); renderAuthorizedAccounts(); });
elements.adminRolesSearch?.addEventListener("input", () => { accountRolesSearch = elements.adminRolesSearch.value.trim(); renderAccountRoles(); });
elements.adminRegisteredUsersSearch?.addEventListener("input", () => { statisticsSearch = elements.adminRegisteredUsersSearch.value.trim(); renderRegisteredUsers(); });
elements.adminAuthorizedForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = elements.adminAuthorizedEmail.value.trim();
  if (!email) return toast("Escribe el correo de una cuenta registrada.", "error");
  const submit = event.submitter;
  submit.disabled = true;
  try {
    const saved = await request("admin:authorized-accounts:add", { email });
    const index = authorizedAccounts.findIndex((entry) => entry.userId === saved.userId);
    if (index >= 0) authorizedAccounts[index] = saved;
    else authorizedAccounts.push(saved);
    elements.adminAuthorizedEmail.value = "";
    renderAuthorizedAccounts();
    toast(`${saved.email} autorizado`, "success");
  } catch (error) { toast(error.message, "error"); } finally { submit.disabled = false; }
});
elements.adminRolesForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = elements.adminRoleEmail.value.trim();
  const role = elements.adminRoleSelect.value;
  if (!email) return toast("Escribe el correo de una cuenta registrada.", "error");
  const submit = event.submitter;
  submit.disabled = true;
  try {
    const saved = await request("admin:roles:assign", { email, role });
    const index = accountRoles.findIndex((entry) => entry.email === saved.email);
    if (index >= 0) accountRoles[index] = saved;
    else accountRoles.push(saved);
    elements.adminRoleEmail.value = "";
    renderAccountRoles();
    toast(`${saved.email} ahora tiene acceso ${saved.role === "administrator" ? "de ADMINISTRADOR" : "PRO"}.`, "success");
  } catch (error) { toast(error.message, "error"); } finally { submit.disabled = false; }
});
elements.adminVideoUploadForm?.addEventListener("submit", (event) => uploadAdminMedia(event, "videos"));
elements.adminSoundUploadForm?.addEventListener("submit", (event) => uploadAdminMedia(event, "sounds"));
elements.selectGiftButton?.addEventListener("click", openGiftSelector);
elements.giftSelectorModal?.querySelectorAll("[data-gift-selector-close]").forEach((button) => button.addEventListener("click", closeGiftSelector));
elements.giftSelectorSearch?.addEventListener("input", () => { giftCatalogSearch = elements.giftSelectorSearch.value.trim(); renderGiftSelector(); });
elements.actionModeCommand?.addEventListener("click", () => setActionMode("command"));
elements.actionModePresets?.addEventListener("click", () => { setActionMode("presets"); void loadActionPresetCatalog().catch(() => {}); loadActionPresetGiftCatalog(); });
elements.actionPresetSearch?.addEventListener("input", renderActionPresetList);
elements.actionPresetList?.addEventListener("click", (event) => {
  const card = event.target.closest("button[data-preset-id]");
  if (!card) return;
  activePresetPackId = card.dataset.presetId;
  renderActionPresetList();
  renderMappings(appState?.config?.mappings || []);
  const pack = actionPresetPacks.find((entry) => entry.id === activePresetPackId);
  if (pack?.effectsPath) void loadPresetDetails(pack).catch(() => {});
});
elements.selectVideoButton?.addEventListener("click", openVideoSelector);
elements.clearVideoButton?.addEventListener("click", () => renderVideoOptions(""));
elements.videoSelectorModal?.querySelectorAll("[data-video-selector-close]").forEach((button) => button.addEventListener("click", closeVideoSelector));
elements.videoSelectorSearch?.addEventListener("input", () => { videoCatalogSearch = elements.videoSelectorSearch.value.trim(); renderVideoSelector(); });
elements.profileAvatarInput?.addEventListener("change", async () => {
  const file = elements.profileAvatarInput.files?.[0];
  if (!file) return;
  try {
    profileAvatarData = await prepareProfileAvatar(file);
    renderProfileAvatar(profileAvatarData);
    elements.profileMessage.textContent = "Imagen lista para guardar.";
  } catch (error) {
    elements.profileAvatarInput.value = "";
    elements.profileMessage.textContent = error.message;
  }
});
elements.profileForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const password = elements.profilePassword.value;
  if (password !== elements.profilePasswordConfirm.value) {
    elements.profileMessage.textContent = "Las contraseñas no coinciden.";
    return;
  }
  const submit = event.submitter;
  submit.disabled = true;
  elements.profileMessage.textContent = "";
  try {
    if (password) {
      const response = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${window.TikTokraftAuth?.accessToken || ""}` },
        body: JSON.stringify({ password })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "No se pudo cambiar la contraseña.");
    }
    const profile = await request("profile:save", { avatarDataUrl: profileAvatarData });
    if (appState?.config) appState.config.profile = profile;
    toast(password ? "Perfil y contraseña guardados" : "Perfil guardado", "success");
    closeProfileModal();
  } catch (error) {
    elements.profileMessage.textContent = error.message;
  } finally {
    submit.disabled = false;
  }
});
let availableSounds = [];
let soundDurations = new Map();
let availableVideos = [];
let videoDurations = new Map();
let activeAudioTest = null;
let profileAvatarData = "";
let availableTtsVoices = [];
let ttsAutoSaveTimer = null;
let ttsAutoSaveRevision = 0;
function updateTtsPlaybackControls({ paused = false, speaking = false } = {}) {
  if (!elements.ttsStop || !elements.ttsResume) return;
  elements.ttsStop.disabled = !speaking || paused;
  elements.ttsResume.disabled = !paused;
}
const ttsQueue = new window.TtsQueue({
  onError: (message) => toast(message, "error"),
  onState: updateTtsPlaybackControls
});
updateTtsPlaybackControls();
if ("speechSynthesis" in window) {
  window.speechSynthesis.addEventListener?.("voiceschanged", loadTtsVoices);
  loadTtsVoices();
  setTimeout(loadTtsVoices, 300);
}
let customizationKey = "";
const defaultCustomization = {
  fontFamily: "Space Grotesk", fontSize: 75, lineSpacing: 55, letterSpacing: 50,
  textColor: "#d9d9d9", valueColor: "#ffd84a", rankColor: "#d9d9d9", textEffect: "none",
  waveAnimation: false, showBackground: false, backgroundColor: "rgba(33, 33, 33, 0.4)",
  showRank: true, showValue: true, alignRight: false, showCrown: true,
  title: "", titleSize: 32, titleColor: "#d9d9d9", usernameColor: "#ffffff", usernameSize: 40,
  titleVerticalOffset: 0, giftVerticalOffset: 0, usernameVerticalOffset: 0, coinsVerticalOffset: 0,
  enableFontBorder: false, borderColor: "#242424", giftImageVisible: true, giftImageOpacity: 90,
  titleTextEffect: "none", titleWaveAnimation: false, usernameTextEffect: "none", usernameWaveAnimation: false, coinsAlias: "coins", itemLimit: 10
};

const proOnlyClickSelector = [
  "#minecraft-connect", "#minecraft-disconnect", "#tiktok-connect", "#tiktok-disconnect",
  "#settings-form button", "#tts-settings-form button", "#allowed-users-form button",
  "#mapping-form button", "#simulate-form button", ".goal-form button[type=submit]",
  "#timer-panel button:not(#timer-overlay-copy):not(#timer-overlay-preview-button):not(.overlay-customize)",
  "#gift-overlays-form button", "#gift-overlays-reset-now", "#user-points-add",
  ".overlay-customize", ".mapping-list button[data-action]", ".mapping-audio-select"
].join(",");

function openProUpgrade() {
  if (!elements.proUpgradeModal) return;
  elements.proUpgradeModal.hidden = false;
  document.body.classList.add("modal-open");
  elements.proUpgradeModal.querySelector("[data-pro-upgrade-close]")?.focus();
}

function closeProUpgrade() {
  if (!elements.proUpgradeModal) return;
  elements.proUpgradeModal.hidden = true;
  document.body.classList.remove("modal-open");
  if (proPaymentCheckTimer) clearTimeout(proPaymentCheckTimer);
  proPaymentCheckTimer = null;
}

function renderAccountAccess() {
  const isFree = Boolean(appState?.account) && !appState.account.isPro;
  document.body.classList.toggle("is-free-plan", isFree);
  if (elements.proAccessBanner) elements.proAccessBanner.hidden = !isFree;
  document.querySelectorAll(proOnlyClickSelector).forEach((control) => {
    control.classList.toggle("pro-locked-control", isFree);
    control.toggleAttribute("data-pro-state", isFree);
    if (isFree) control.setAttribute("aria-description", "Requiere TikTokraft Pro");
    else control.removeAttribute("aria-description");
  });
}

document.addEventListener("click", (event) => {
  if (appState?.account?.isPro || !appState?.account) return;
  const control = event.target.closest?.(proOnlyClickSelector);
  if (!control) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  openProUpgrade();
}, true);

function request(event, payload) {
  if (appState?.account && !appState.account.isPro && event !== "profile:save") {
    openProUpgrade();
    return Promise.reject(new Error("Esta función requiere TikTokraft Pro. Tu cuenta gratuita es de solo lectura."));
  }
  return new Promise((resolve, reject) => {
    socket.emit(event, payload, (result) => result?.ok ? resolve(result.data) : reject(new Error(result?.error || "No se pudo completar la acción.")));
  });
}
window.TikTokraftGiftBrowserSync = () => socket.connected
  ? request("gift-catalog:sync", {})
  : Promise.reject(new Error("Conecta el panel y tu TikTok LIVE antes de sincronizar."));

function renderProfileAvatar(value) {
  const avatar = String(value || "");
  elements.profileAvatar.hidden = !avatar;
  elements.profileAvatarEmpty.hidden = Boolean(avatar);
  if (avatar) elements.profileAvatar.src = avatar;
  else elements.profileAvatar.removeAttribute("src");
}

function closeProfileModal() {
  elements.profileModal.hidden = true;
  document.body.classList.remove("modal-open");
}

function closeAdminPanel() {
  elements.adminModal.hidden = true;
  document.body.classList.remove("modal-open");
}

function showAdminMenu() {
  elements.adminMenuView.hidden = false;
  elements.adminAuthorizationView.hidden = true;
  elements.adminRolesView.hidden = true;
  elements.adminStatisticsView.hidden = true;
  elements.adminRegisteredUsersView.hidden = true;
  elements.adminConnectedUsersView.hidden = true;
  elements.adminUserProfileView.hidden = true;
  elements.adminMediaView.hidden = true;
}

function openAuthorizationPanel() {
  elements.adminMenuView.hidden = true;
  elements.adminAuthorizationView.hidden = false;
  elements.adminRolesView.hidden = true;
  elements.adminStatisticsView.hidden = true;
  elements.adminRegisteredUsersView.hidden = true;
  elements.adminConnectedUsersView.hidden = true;
  elements.adminUserProfileView.hidden = true;
  elements.adminMediaView.hidden = true;
  elements.adminAuthorizedEmail.focus();
}

async function openRolesPanel() {
  elements.adminMenuView.hidden = true;
  elements.adminAuthorizationView.hidden = true;
  elements.adminRolesView.hidden = false;
  elements.adminStatisticsView.hidden = true;
  elements.adminRegisteredUsersView.hidden = true;
  elements.adminConnectedUsersView.hidden = true;
  elements.adminUserProfileView.hidden = true;
  elements.adminMediaView.hidden = true;
  accountRolesSearch = "";
  elements.adminRolesSearch.value = "";
  try {
    accountRoles = await request("admin:roles:list", null);
    renderAccountRoles();
    elements.adminRoleEmail.focus();
  } catch (error) { toast(error.message, "error"); }
}

async function openAdminPanel() {
  if (!appState?.account?.isAdmin) return toast("No tienes permiso para acceder al Panel de Administración.", "error");
  authorizedAccountSearch = "";
  elements.adminAuthorizedSearch.value = "";
  showAdminMenu();
  elements.adminModal.hidden = false;
  document.body.classList.add("modal-open");
  try {
    authorizedAccounts = await request("admin:authorized-accounts:list", null);
    renderAuthorizedAccounts();
  } catch (error) {
    toast(error.message, "error");
    closeAdminPanel();
  }
}

function renderAuthorizedAccounts() {
  const search = authorizedAccountSearch.toLocaleLowerCase();
  const entries = authorizedAccounts
    .filter((entry) => String(entry.email || "").toLocaleLowerCase().includes(search))
    .sort((left, right) => String(left.email || "").localeCompare(String(right.email || ""), "es"));
  elements.adminAuthorizedList.replaceChildren();
  for (const entry of entries) {
    const row = document.createElement("div");
    row.className = "admin-authorized-row";
    const user = document.createElement("strong");
    user.textContent = entry.email;
    const added = document.createElement("small");
    added.textContent = entry.addedAt ? `Autorizado ${new Date(entry.addedAt).toLocaleDateString("es-CO")}` : "Autorizado";
    const remove = document.createElement("button");
    remove.className = "button text danger";
    remove.type = "button";
    remove.textContent = "Revocar";
    remove.addEventListener("click", async () => {
      remove.disabled = true;
      try {
        await request("admin:authorized-accounts:remove", { userId: entry.userId });
        authorizedAccounts = authorizedAccounts.filter((item) => item.userId !== entry.userId);
        renderAuthorizedAccounts();
        toast(`${entry.email} revocado`, "success");
      } catch (error) { toast(error.message, "error"); } finally { remove.disabled = false; }
    });
    const copy = document.createElement("span");
    copy.append(user, added);
    row.append(copy, remove);
    elements.adminAuthorizedList.append(row);
  }
  elements.adminAuthorizedEmpty.hidden = entries.length > 0;
}

function formatMediaSize(value) {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}

async function adminMediaFetch(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { Authorization: `Bearer ${window.TikTokraftAuth?.accessToken || ""}`, ...(options.headers || {}) }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "No se pudo gestionar el catálogo multimedia.");
  return payload;
}

function renderAdminMediaList(kind) {
  const entries = Array.isArray(adminMediaCatalog[kind]) ? adminMediaCatalog[kind] : [];
  const list = kind === "videos" ? elements.adminVideoList : elements.adminSoundList;
  const empty = kind === "videos" ? elements.adminVideoEmpty : elements.adminSoundEmpty;
  list.replaceChildren();
  for (const entry of entries) {
    const row = document.createElement("div");
    row.className = "admin-media-row";
    const info = document.createElement("span");
    const name = document.createElement("strong");
    name.textContent = entry.filename;
    const meta = document.createElement("small");
    const source = entry.source === "system" ? "Incluido con la aplicación" : "Subido por administrador";
    meta.textContent = [source, formatMediaSize(entry.size)].filter(Boolean).join(" · ");
    info.append(name, meta);
    const actions = document.createElement("span");
    actions.className = "admin-media-row-actions";
    const preview = document.createElement("button");
    preview.className = "button text";
    preview.type = "button";
    preview.textContent = kind === "videos" ? "Vista previa" : "Probar";
    preview.addEventListener("click", () => {
      if (kind === "videos") window.open(entry.url, "_blank", "noopener,noreferrer");
      else playAudioTest(entry.filename);
    });
    actions.append(preview);
    if (entry.source === "uploaded") {
      const remove = document.createElement("button");
      remove.className = "button text danger";
      remove.type = "button";
      remove.textContent = "Eliminar";
      remove.addEventListener("click", () => deleteAdminMedia(kind, entry.filename, remove));
      actions.append(remove);
    } else {
      const badge = document.createElement("b");
      badge.className = "admin-media-system-badge";
      badge.textContent = "SISTEMA";
      actions.append(badge);
    }
    row.append(info, actions);
    list.append(row);
  }
  empty.hidden = entries.length > 0;
}

async function loadAdminMedia() {
  const payload = await adminMediaFetch("/api/admin/media");
  adminMediaCatalog = {
    sounds: Array.isArray(payload.sounds) ? payload.sounds : [],
    videos: Array.isArray(payload.videos) ? payload.videos : []
  };
  renderAdminMediaList("videos");
  renderAdminMediaList("sounds");
}

async function openMediaPanel() {
  hideAdministrativeViews();
  elements.adminMediaView.hidden = false;
  try { await loadAdminMedia(); }
  catch (error) { toast(error.message, "error"); }
}

async function uploadAdminMedia(event, kind) {
  event.preventDefault();
  const input = kind === "videos" ? elements.adminVideoFile : elements.adminSoundFile;
  const status = kind === "videos" ? elements.adminVideoUploadStatus : elements.adminSoundUploadStatus;
  const file = input.files?.[0];
  if (!file) return toast("Selecciona un archivo para subir.", "error");
  const maximum = kind === "videos" ? 200 * 1024 * 1024 : 25 * 1024 * 1024;
  if (file.size > maximum) return toast(kind === "videos" ? "El video supera el límite de 200 MB." : "El audio supera el límite de 25 MB.", "error");
  const submit = event.submitter || event.currentTarget.querySelector('button[type="submit"]');
  submit.disabled = true;
  status.textContent = `Subiendo ${file.name}…`;
  try {
    const payload = await adminMediaFetch(`/api/admin/media/${kind}`, {
      method: "POST",
      headers: { "Content-Type": file.type || "application/octet-stream", "X-Media-Filename": encodeURIComponent(file.name) },
      body: file
    });
    const savedFilename = payload.entry?.filename || file.name;
    input.value = "";
    status.textContent = savedFilename === file.name
      ? `${file.name} se agregó correctamente.`
      : `${file.name} se agregó como ${savedFilename}.`;
    await Promise.all([loadAdminMedia(), kind === "videos" ? loadVideos() : loadSounds()]);
    toast(`${savedFilename} agregado al catálogo global.`, "success");
  } catch (error) {
    status.textContent = error.message;
    toast(error.message, "error");
  } finally { submit.disabled = false; }
}

async function deleteAdminMedia(kind, filename, button) {
  if (!window.confirm(`¿Eliminar ${filename} del catálogo global? Dejará de estar disponible para nuevas acciones.`)) return;
  button.disabled = true;
  try {
    await adminMediaFetch(`/api/admin/media/${kind}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename })
    });
    await Promise.all([loadAdminMedia(), kind === "videos" ? loadVideos() : loadSounds()]);
    toast(`${filename} eliminado del catálogo.`, "success");
  } catch (error) {
    toast(error.message, "error");
    button.disabled = false;
  }
}

function renderAccountRoles() {
  const search = accountRolesSearch.toLocaleLowerCase();
  const entries = accountRoles
    .filter((entry) => String(entry.email || "").toLocaleLowerCase().includes(search))
    .sort((left, right) => String(left.email || "").localeCompare(String(right.email || ""), "es"));
  elements.adminRolesList.replaceChildren();
  for (const entry of entries) {
    const row = document.createElement("div");
    row.className = "admin-role-row";
    const details = document.createElement("span");
    const email = document.createElement("strong");
    email.textContent = entry.email;
    const role = document.createElement("b");
    role.className = "admin-role-badge";
    role.textContent = entry.role === "administrator" ? "ADMINISTRADOR" : String(entry.role || "USUARIO").toUpperCase();
    const permissions = document.createElement("small");
    permissions.textContent = entry.role === "administrator" ? "Gestiona autorización, roles, estadísticas y multimedia." : entry.role === "pro" ? "Puede crear acciones, solicitudes y conectar TikTok LIVE y ServerTap." : "Cuenta gratuita de solo lectura.";
    details.append(email, role, permissions);
    row.append(details);
    if (entry.email === "loroteca98@gmail.com") {
      const primary = document.createElement("span");
      primary.className = "admin-primary-role";
      primary.textContent = "Principal";
      row.append(primary);
    } else {
      const remove = document.createElement("button");
      remove.className = "button text danger";
      remove.type = "button";
      remove.textContent = "Quitar rol";
      remove.addEventListener("click", async () => {
        const accessName = entry.role === "administrator" ? "ADMINISTRADOR" : "PRO";
        if (!window.confirm(`¿Quitar el acceso ${accessName} a ${entry.email}? Esta cuenta volverá al plan gratis de solo lectura.`)) return;
        remove.disabled = true;
        try {
          await request("admin:roles:remove", { email: entry.email });
          accountRoles = accountRoles.filter((item) => item.email !== entry.email);
          renderAccountRoles();
          toast(`Rol quitado a ${entry.email}.`, "success");
        } catch (error) { toast(error.message, "error"); } finally { remove.disabled = false; }
      });
      row.append(remove);
    }
    elements.adminRolesList.append(row);
  }
  elements.adminRolesEmpty.hidden = entries.length > 0;
}

function hideAdministrativeViews() {
  elements.adminMenuView.hidden = true;
  elements.adminAuthorizationView.hidden = true;
  elements.adminRolesView.hidden = true;
  elements.adminStatisticsView.hidden = true;
  elements.adminRegisteredUsersView.hidden = true;
  elements.adminConnectedUsersView.hidden = true;
  elements.adminUserProfileView.hidden = true;
  elements.adminMediaView.hidden = true;
}

function formatAdministrativeDate(value) {
  if (!value) return "No disponible";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "No disponible" : date.toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" });
}

function updateStatisticsCounts() {
  elements.adminRegisteredUsersCount.textContent = String(statisticsAccounts.length);
  elements.adminConnectedUsersCount.textContent = String(statisticsAccounts.filter((account) => account.active).length);
}

async function loadStatisticsAccounts() {
  statisticsAccounts = await request("admin:statistics:registered", null);
  updateStatisticsCounts();
  return statisticsAccounts;
}

async function openStatisticsPanel() {
  hideAdministrativeViews();
  elements.adminStatisticsView.hidden = false;
  try { await loadStatisticsAccounts(); } catch (error) { toast(error.message, "error"); }
}

function createAdministrativeAccountRow(account, origin) {
  const row = document.createElement("div");
  row.className = "admin-statistics-row";
  const open = document.createElement("button");
  open.className = "admin-statistics-row-main";
  open.type = "button";
  const detail = document.createElement("span");
  const email = document.createElement("strong");
  email.textContent = account.email;
  const tiktok = document.createElement("small");
  tiktok.textContent = account.tiktokUsername ? `TikTok: @${account.tiktokUsername}` : "TikTok: sin configurar";
  const verification = document.createElement("small");
  verification.className = account.emailVerified ? "admin-email-verified" : "admin-email-pending";
  verification.textContent = account.emailVerified ? "✓ Correo verificado" : "! Correo sin verificar";
  detail.append(email, tiktok, verification);
  const status = document.createElement("b");
  status.className = account.tiktokStatus === "connected" ? "admin-status-live" : account.active ? "admin-status-panel" : "admin-status-idle";
  status.textContent = account.status;
  open.append(detail, status);
  open.addEventListener("click", () => openAdministrativeUserProfile(account.userId, origin));
  row.append(open);
  const protectedAccount = account.email.toLocaleLowerCase() === "loroteca98@gmail.com" || account.email.toLocaleLowerCase() === String(appState?.account?.email || "").toLocaleLowerCase();
  if (origin === "registered" && !protectedAccount) {
    const remove = document.createElement("button");
    remove.className = "admin-user-delete";
    remove.type = "button";
    remove.textContent = "Eliminar usuario";
    remove.addEventListener("click", () => deleteAdministrativeUser(account, remove));
    row.append(remove);
  }
  return row;
}

async function deleteAdministrativeUser(account, button) {
  const confirmation = window.prompt(`Esta acción eliminará permanentemente la cuenta y todos sus datos.\n\nEscribe ${account.email} para confirmar:`);
  if (confirmation === null) return;
  if (confirmation.trim().toLocaleLowerCase() !== account.email.toLocaleLowerCase()) {
    return toast("El correo escrito no coincide. No se eliminó la cuenta.", "error");
  }
  button.disabled = true;
  const previousText = button.textContent;
  button.textContent = "Eliminando…";
  try {
    await request("admin:user:delete", { userId: account.userId });
    statisticsAccounts = statisticsAccounts.filter((entry) => entry.userId !== account.userId);
    connectedStatisticsAccounts = connectedStatisticsAccounts.filter((entry) => entry.userId !== account.userId);
    updateStatisticsCounts();
    renderRegisteredUsers();
    toast(`La cuenta ${account.email} fue eliminada.`, "success");
  } catch (error) {
    button.disabled = false;
    button.textContent = previousText;
    toast(error.message, "error");
  }
}

function renderRegisteredUsers() {
  const search = statisticsSearch.toLocaleLowerCase();
  const entries = statisticsAccounts.filter((account) => account.email.toLocaleLowerCase().includes(search));
  elements.adminRegisteredUsersList.replaceChildren(...entries.map((account) => createAdministrativeAccountRow(account, "registered")));
  elements.adminRegisteredUsersEmpty.hidden = entries.length > 0;
}

async function openRegisteredUsers() {
  hideAdministrativeViews();
  elements.adminRegisteredUsersView.hidden = false;
  statisticsSearch = "";
  elements.adminRegisteredUsersSearch.value = "";
  try {
    await loadStatisticsAccounts();
    renderRegisteredUsers();
    elements.adminRegisteredUsersSearch.focus();
  } catch (error) { toast(error.message, "error"); }
}

function renderConnectedUsers() {
  elements.adminConnectedUsersList.replaceChildren(...connectedStatisticsAccounts.map((account) => createAdministrativeAccountRow(account, "connected")));
  elements.adminConnectedUsersEmpty.hidden = connectedStatisticsAccounts.length > 0;
}

async function openConnectedUsers() {
  hideAdministrativeViews();
  elements.adminConnectedUsersView.hidden = false;
  try {
    connectedStatisticsAccounts = await request("admin:statistics:connected", null);
    renderConnectedUsers();
  } catch (error) { toast(error.message, "error"); }
}

async function openAdministrativeUserProfile(userId, origin) {
  statisticsProfileOrigin = origin;
  hideAdministrativeViews();
  elements.adminUserProfileView.hidden = false;
  elements.adminUserProfileTitle.textContent = "Cargando cuenta…";
  elements.adminUserProfileData.replaceChildren();
  try {
    const account = await request("admin:statistics:profile", { userId });
    elements.adminUserProfileTitle.textContent = account.email;
    const fields = [
      ["Correo", account.email],
      ["Correo verificado", account.emailVerified ? `Sí${account.emailConfirmedAt ? ` · ${formatAdministrativeDate(account.emailConfirmedAt)}` : ""}` : "No, todavía está pendiente"],
      ["Fecha de registro", formatAdministrativeDate(account.registeredAt)],
      ["Último inicio de sesión", formatAdministrativeDate(account.lastSignInAt)],
      ["Estado actual", account.status],
      ["TikTok asociado", account.tiktokUsername ? `@${account.tiktokUsername}` : "No configurado"],
      ["Estado del LIVE", account.tiktokStatus === "connected" ? "Conectado" : "No conectado"],
      ["Conexiones del panel", account.panelConnections ? String(account.panelConnections) : "No hay conexiones activas"],
      ["Última actualización de configuración", formatAdministrativeDate(account.workspaceUpdatedAt)]
    ];
    for (const [label, value] of fields) {
      const term = document.createElement("dt"); term.textContent = label;
      const detail = document.createElement("dd"); detail.textContent = value;
      if (label === "Correo verificado") detail.className = account.emailVerified ? "admin-profile-email-verified" : "admin-profile-email-pending";
      elements.adminUserProfileData.append(term, detail);
    }
  } catch (error) {
    elements.adminUserProfileTitle.textContent = "No se pudo cargar la cuenta";
    toast(error.message, "error");
  }
}

function openProfileModal() {
  elements.profileForm.reset();
  profileAvatarData = appState?.config?.profile?.avatarDataUrl || "";
  renderProfileAvatar(profileAvatarData);
  elements.profileEmail.value = appState?.account?.email || "";
  elements.profileMessage.textContent = "";
  elements.profileModal.hidden = false;
  document.body.classList.add("modal-open");
}

function prepareProfileAvatar(file) {
  if (!file?.type?.match(/^image\/(jpeg|png|webp)$/)) return Promise.reject(new Error("Selecciona una imagen JPG, PNG o WebP."));
  if (file.size > 10 * 1024 * 1024) return Promise.reject(new Error("La imagen no puede superar 10 MB."));
  return new Promise((resolve, reject) => {
    const source = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(source);
      const scale = Math.min(1, 256 / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
      const avatar = canvas.toDataURL("image/jpeg", 0.86);
      if (avatar.length > 350_000) return reject(new Error("No se pudo reducir suficientemente la imagen."));
      resolve(avatar);
    };
    image.onerror = () => { URL.revokeObjectURL(source); reject(new Error("No se pudo leer la imagen.")); };
    image.src = source;
  });
}

async function loadPanelState() {
  const auth = window.TikTokraftAuth;
  if (!auth?.accessToken) return;
  const fetchState = () => fetch("/api/state", { headers: { Authorization: `Bearer ${auth.accessToken}` } });
  let response = await fetchState();
  if (response.status === 401 && await auth.refresh()) response = await fetchState();
  if (!response.ok) return;
  hiddenActivity = false;
  renderState(await response.json());
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
  appState = { ...next, account: next.account || appState?.account };
  const { config, minecraft, tiktok } = appState;
  userPointsOverlayToken = appState.workspace?.overlayToken || userPointsOverlayToken;
  elements.actionVideoWidgetUrl.value = actionVideoWidgetUrl();
  elements.adminPanelButton.hidden = !Boolean(appState.account?.isAdmin);
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
    elements.ttsReadUsername.checked = config.tts?.readUsername !== false;
    elements.ttsLanguage.value = config.tts?.language || "es-CO";
    renderTtsVoiceOptions(config.tts);
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
  giftCatalog = Array.isArray(next.giftCatalog) ? next.giftCatalog : giftCatalog;
  window.TikTokraftGiftBrowser?.setEntries(giftCatalog);
  window.TikTokraftGiftBrowser?.setSyncStatus(next.giftCatalogSync);
  renderMappings(config.mappings || []);
  renderTimerSettings(config.timer || {}, config.mappings || []);
  renderTimer(next.timer || appState.timer);
  if (!elements.giftSelectorModal.hidden) renderGiftSelector();
  renderGiftOverlays(config.giftOverlays || {});
  renderRankingOverlay({ kind: "top-donors", title: "Top Donadores", entries: next.rankings?.topDonors || [] });
  renderUserPoints(next.userPoints?.entries || [], next.userPoints?.configured);
  renderGoals(config.goals || []);
  renderGiftHistory(next.giftHistory || []);
  if (!hiddenActivity) renderActivity(next.activity || []);
  renderAccountAccess();
}

function numberFormat(value) {
  return new Intl.NumberFormat("es-CO").format(Math.max(0, Number(value) || 0));
}

function formatTimerTime(value) {
  const milliseconds = Math.max(0, Math.round(Number(value) || 0));
  const totalSeconds = Math.floor(milliseconds / 1_000);
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function timerOverlayUrl() {
  return `${window.location.origin}/widget/${encodeURIComponent(appState?.workspace?.overlayToken || "")}/timer`;
}

function actionVideoWidgetUrl() {
  return `${window.location.origin}/widget/${encodeURIComponent(appState?.workspace?.overlayToken || "")}/action-video?v=20261012-4`;
}

function timerInputValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? String(Number(number.toFixed(3))) : "0";
}

function setTimerFieldValue(field, value) {
  if (document.activeElement !== field) field.value = String(value);
}

function renderTimerActionOptions(mappings, selectedId) {
  if (document.activeElement === elements.timerExpiryAction) return;
  const selected = String(selectedId || "");
  const fragment = document.createDocumentFragment();
  const empty = document.createElement("option");
  empty.value = "";
  empty.textContent = "Sin acción";
  fragment.append(empty);
  for (const mapping of mappings) {
    const option = document.createElement("option");
    option.value = mapping.id;
    const name = mappingTriggerDefinition(mapping).title(mapping);
    option.textContent = `${name} → ${mappingOutputSummary(mapping)}`;
    fragment.append(option);
  }
  elements.timerExpiryAction.replaceChildren(fragment);
  elements.timerExpiryAction.value = selected;
}

function renderTimerSettings(timer, mappings) {
  const adjustments = timer.adjustments || {};
  const multiplier = timer.multiplier || {};
  const shortcuts = timer.shortcuts || {};
  elements.timerUrl.value = timerOverlayUrl();
  renderTimerActionOptions(mappings, timer.actionMappingId);
  setTimerFieldValue(elements.timerInitialMinutes, timerInputValue(timer.initialMinutes ?? 10));
  setTimerFieldValue(elements.timerPerCoin, timerInputValue(adjustments.coins));
  setTimerFieldValue(elements.timerCoinText, timer.coinText ?? "Cada moneda suma {segundos} segundos");
  setTimerFieldValue(elements.timerPerSubscription, timerInputValue(adjustments.subscriptions));
  setTimerFieldValue(elements.timerPerFollow, timerInputValue(adjustments.follows));
  setTimerFieldValue(elements.timerPerShare, timerInputValue(adjustments.shares));
  setTimerFieldValue(elements.timerPerLike, timerInputValue(adjustments.likes));
  setTimerFieldValue(elements.timerPerComment, timerInputValue(adjustments.comments));
  if (document.activeElement !== elements.timerMultiplierEnabled) elements.timerMultiplierEnabled.checked = Boolean(multiplier.enabled);
  setTimerFieldValue(elements.timerMultiplierValue, timerInputValue(multiplier.value ?? 1.5));
  elements.timerMultiplierValue.disabled = !elements.timerMultiplierEnabled.checked;
  if (document.activeElement !== elements.timerShortcutToggle) elements.timerShortcutToggle.value = shortcuts.toggle || "";
  if (document.activeElement !== elements.timerShortcutIncrease) elements.timerShortcutIncrease.value = shortcuts.increase || "";
  if (document.activeElement !== elements.timerShortcutDecrease) elements.timerShortcutDecrease.value = shortcuts.decrease || "";
  setTimerFieldValue(elements.timerShortcutStep, timerInputValue(shortcuts.stepMinutes ?? 1));
}

function renderTimer(timer, { localReference = Date.now() } = {}) {
  if (!timer) return;
  if (appState) appState.timer = timer;
  panelTimer = timer;
  panelTimerRemainingMs = Math.max(0, Number(timer.remainingMs) || 0);
  if (Number.isFinite(Number(timer.serverNow))) panelTimerServerOffsetMs = Number(timer.serverNow) - localReference;
  panelTimerDeadline = timer.status === "running"
    ? Number(timer.endsAt) > 0
      ? Number(timer.endsAt) - panelTimerServerOffsetMs
      : Date.now() + panelTimerRemainingMs
    : 0;
  panelTimerZeroSynchronized = false;
  const statusLabels = { idle: "Listo para comenzar", running: "En marcha", paused: "Pausado", finished: "Finalizado" };
  elements.timerPreview.dataset.status = timer.status || "idle";
  elements.timerPreviewStatus.textContent = statusLabels[timer.status] || "Listo";
  elements.timerPreviewCoinLabel.textContent = timer.coinMessage || "";
  elements.timerPreviewCoinLabel.hidden = !timer.coinMessage;
  elements.timerStart.textContent = timer.status === "paused" ? "▶ Reanudar" : "▶ Comenzar";
  elements.timerStart.disabled = timer.status === "running";
  elements.timerPause.disabled = timer.status !== "running";
  schedulePanelTimerClock();
}

function panelTimerRemainingNow() {
  if (!panelTimer) return 0;
  if (panelTimer.status !== "running") return panelTimerRemainingMs;
  return Math.max(0, panelTimerDeadline - Date.now());
}

function renderPanelTimerClock() {
  if (!panelTimer) return;
  const remainingMs = panelTimerRemainingNow();
  const formatted = formatTimerTime(remainingMs);
  if (elements.timerPreviewValue.textContent !== formatted) elements.timerPreviewValue.textContent = formatted;
}

function schedulePanelTimerClock() {
  clearTimeout(panelTimerRenderTimer);
  panelTimerRenderTimer = null;
  renderPanelTimerClock();
  if (panelTimer?.status !== "running") return;
  const remainingMs = panelTimerRemainingNow();
  if (remainingMs <= 0) {
    if (!panelTimerZeroSynchronized) {
      panelTimerZeroSynchronized = true;
      synchronizePanelTimer({ force: true });
    }
    return;
  }
  // Programa únicamente el siguiente cambio visible de segundo. Si Chrome
  // retrasa este callback, el siguiente valor se recalcula con Date.now().
  const delay = Math.max(40, Math.min(1_000, (remainingMs % 1_000) + 20));
  panelTimerRenderTimer = setTimeout(schedulePanelTimerClock, delay);
}

function synchronizePanelTimer({ force = false } = {}) {
  // Repinta inmediatamente con el plazo local y luego confirma el estado
  // autoritativo del servidor. Ninguna transición se decide en el navegador.
  renderPanelTimerClock();
  const requestedAt = Date.now();
  if (!socket.connected || (!force && requestedAt - panelTimerSyncAt < 750)) return;
  panelTimerSyncAt = requestedAt;
  socket.timeout(5_000).emit("timer:sync", null, (error, result) => {
    const receivedAt = Date.now();
    if (!error && result?.ok && result.data) renderTimer(result.data, { localReference: (requestedAt + receivedAt) / 2 });
  });
}

function readTimerSettings() {
  const numericFields = [elements.timerInitialMinutes, elements.timerPerCoin, elements.timerPerSubscription, elements.timerPerFollow, elements.timerPerShare, elements.timerPerLike, elements.timerPerComment, elements.timerMultiplierValue, elements.timerShortcutStep];
  if (numericFields.some((field) => !field.checkValidity() || field.value === "" || !Number.isFinite(Number(field.value)))) throw new Error("Revisa los valores numéricos del temporizador.");
  const assignedShortcuts = [elements.timerShortcutToggle.value, elements.timerShortcutIncrease.value, elements.timerShortcutDecrease.value].filter(Boolean);
  if (new Set(assignedShortcuts).size !== assignedShortcuts.length) throw new Error("Cada control debe utilizar un atajo de teclado diferente.");
  return {
    initialMinutes: Number(elements.timerInitialMinutes.value),
    actionMappingId: elements.timerExpiryAction.value,
    coinText: elements.timerCoinText.value,
    adjustments: {
      coins: Number(elements.timerPerCoin.value),
      subscriptions: Number(elements.timerPerSubscription.value),
      follows: Number(elements.timerPerFollow.value),
      shares: Number(elements.timerPerShare.value),
      likes: Number(elements.timerPerLike.value),
      comments: Number(elements.timerPerComment.value)
    },
    multiplier: { enabled: elements.timerMultiplierEnabled.checked, value: Number(elements.timerMultiplierValue.value) },
    shortcuts: {
      toggle: elements.timerShortcutToggle.value,
      increase: elements.timerShortcutIncrease.value,
      decrease: elements.timerShortcutDecrease.value,
      stepMinutes: Number(elements.timerShortcutStep.value)
    }
  };
}

function scheduleTimerSettingsSave() {
  clearTimeout(timerSettingsSaveTimer);
  const revision = ++timerSettingsRevision;
  elements.timerAutosaveState.classList.remove("is-error");
  elements.timerAutosaveState.textContent = "Guardando cambios…";
  timerSettingsSaveTimer = setTimeout(async () => {
    try {
      const saved = await request("timer:settings:save", readTimerSettings());
      if (appState?.config) appState.config.timer = saved;
      if (revision === timerSettingsRevision) elements.timerAutosaveState.textContent = "Cambios guardados automáticamente.";
    } catch (error) {
      if (revision === timerSettingsRevision) {
        elements.timerAutosaveState.classList.add("is-error");
        elements.timerAutosaveState.textContent = error.message;
      }
    }
  }, 350);
}

function goalUrl(id) {
  return `${window.location.origin}/widget/${encodeURIComponent(appState?.workspace?.overlayToken || "")}/goal/${encodeURIComponent(id)}`;
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
  return `${window.location.origin}/widget/${encodeURIComponent(appState?.workspace?.overlayToken || "")}/gift/${encodeURIComponent(kind)}`;
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
  return `${window.location.origin}/widget/${encodeURIComponent(appState?.workspace?.overlayToken || "")}/ranking/${encodeURIComponent(kind)}`;
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

function userPointsOverlayUrl() {
  return `${window.location.origin}/widget/${encodeURIComponent(userPointsOverlayToken || appState?.workspace?.overlayToken || "")}/user-points`;
}

function renderUserPoints(entries, configured = true) {
  if (!elements.userPointsList) return;
  const points = Array.isArray(entries) ? entries : [];
  elements.userPointsList.replaceChildren();
  elements.userPointsStatus.textContent = configured
    ? `${numberFormat(points.length)} usuario${points.length === 1 ? "" : "s"} cargado${points.length === 1 ? "" : "s"}.`
    : "Configura Supabase para guardar el historial permanentemente.";
  elements.userPointsEmpty.hidden = points.length > 0;
  elements.userPointsAdd.disabled = !configured;
  elements.transactionUsers.replaceChildren();
  for (const entry of points) {
    const row = document.createElement("li");
    const name = document.createElement("strong");
    name.textContent = entry.nickname || entry.username || "Espectador";
    const username = document.createElement("small");
    username.textContent = entry.username && entry.nickname !== entry.username ? `@${entry.username}` : "";
    const user = document.createElement("span");
    user.className = "user-points-name";
    user.append(name, username);
    const coins = document.createElement("b");
    coins.textContent = `${numberFormat(entry.coins)} coins`;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "user-points-remove";
    remove.dataset.username = entry.username;
    remove.title = `Eliminar a ${entry.nickname || entry.username}`;
    remove.setAttribute("aria-label", `Eliminar a ${entry.nickname || entry.username}`);
    remove.textContent = "−";
    row.append(user, coins, remove);
    elements.userPointsList.append(row);
    const option = document.createElement("option");
    option.value = entry.username;
    option.label = entry.nickname || entry.username;
    elements.transactionUsers.append(option);
  }
  elements.userPointsUrl.value = userPointsOverlayUrl();
  elements.userPointsLimit.value = String(customizationFor("user-points:historical").itemLimit);
}

function openTransactionModal() {
  elements.transactionForm.reset();
  elements.transactionModal.hidden = false;
  document.body.classList.add("modal-open");
  elements.transactionUser.focus();
}

function closeTransactionModal() {
  elements.transactionModal.hidden = true;
  document.body.classList.remove("modal-open");
}

async function loadUserPoints(query = "") {
  try {
    const parameters = new URLSearchParams({ limit: "100" });
    if (query) parameters.set("q", query);
    const response = await fetch(`/api/user-points?${parameters}`, { headers: { Authorization: `Bearer ${window.TikTokraftAuth?.accessToken || ""}` } });
    if (!response.ok) throw new Error("No se pudo cargar Usuario y Puntos.");
    const result = await response.json();
    userPointsOverlayToken = String(result.overlayToken || userPointsOverlayToken);
    renderUserPoints(result.entries, result.configured);
  } catch (error) {
    elements.userPointsStatus.textContent = error.message;
  }
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
  const isUserPointsOverlay = key === "user-points:historical";
  const isTimerOverlay = key === "timer:main";
  const isBestStreak = key === "gift:best-streak";
  elements.customizationModal.dataset.variant = isGiftOverlay ? "gift" : (isUserPointsOverlay ? "user-points" : (isTimerOverlay ? "timer" : "default"));
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
  elements.userPointsCustomizationLimit.value = customization.itemLimit;
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
  if (customizationKey === "user-points:historical") {
    return { ...customization, itemLimit: Number(elements.userPointsCustomizationLimit.value) };
  }
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

function formatMediaDuration(duration) {
  if (!Number.isFinite(duration)) return "";
  const totalSeconds = Math.max(duration > 0 ? 1 : 0, Math.round(duration));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return hours
    ? `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
    : `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function soundOptionLabel(filename) {
  const duration = formatMediaDuration(soundDurations.get(filename));
  return `${filename}${duration ? ` · ${duration}` : ""}`;
}

function videoOptionLabel(filename) {
  const duration = formatMediaDuration(videoDurations.get(filename));
  return `${filename}${duration ? ` · ${duration}` : ""}`;
}

function mappingAudioOptions(selectedAudio = "") {
  const sounds = [...availableSounds];
  if (selectedAudio && !sounds.includes(selectedAudio)) sounds.push(selectedAudio);
  return ["", ...sounds].map((filename) => {
    const label = filename
      ? `${soundOptionLabel(filename)}${availableSounds.includes(filename) ? "" : " (no disponible)"}`
      : "Sin audio";
    return `<option value="${escapeHtml(filename)}"${filename === selectedAudio ? " selected" : ""}>${escapeHtml(label)}</option>`;
  }).join("");
}

function setMappingAudioPickerOpen(picker, open) {
  if (!picker) return;
  const trigger = picker.querySelector(".mapping-audio-trigger");
  const select = picker.querySelector(".mapping-audio-select");
  trigger.hidden = open;
  trigger.setAttribute("aria-expanded", String(open));
  select.hidden = !open;
  if (open) select.focus();
}

const mappingTriggerDefinitions = {
  gift: { label: "Regalo", title: (mapping) => mapping.giftName || `Regalo #${mapping.giftId}`, icon: "R" },
  likes: { label: "Me gusta", title: () => "Me gusta", icon: "♥" },
  follows: { label: "Seguir", title: () => "Nuevo seguidor", icon: "+" },
  shares: { label: "Compartir", title: () => "Compartir LIVE", icon: "↗" }
};

function mappingTriggerDefinition(mapping) {
  return mappingTriggerDefinitions[mapping?.triggerType] || mappingTriggerDefinitions.gift;
}

function mappingOutputSummary(mapping) {
  const outputs = [];
  if (mapping.command) outputs.push(mapping.command);
  if (mapping.audio) outputs.push(`Audio: ${mapping.audio}`);
  if (mapping.video) outputs.push(`Video: ${mapping.video}`);
  return outputs.join(" + ") || "Sin salida";
}

function giftForMapping(mapping) {
  if ((mapping?.triggerType || "gift") !== "gift") return null;
  const giftId = String(mapping.giftId || "").trim();
  const giftName = String(mapping.giftName || "").trim().toLocaleLowerCase();
  return giftCatalog.find((gift) => giftId && String(gift.giftId || "") === giftId)
    || giftCatalog.find((gift) => giftName && String(gift.giftName || "").trim().toLocaleLowerCase() === giftName)
    || null;
}

function mappingGiftVisual(mapping, trigger) {
  const isGift = (mapping.triggerType || "gift") === "gift";
  const fallback = isGift ? (mapping.giftName || mapping.giftId || "?").slice(0, 1).toUpperCase() : trigger.icon;
  const gift = isGift ? giftForMapping(mapping) : null;
  const imageUrl = String(gift?.giftImageUrl || "").trim();
  return `<div class="mapping-gift${imageUrl ? " has-image" : ""}"><span>${escapeHtml(fallback)}</span>${imageUrl ? `<img src="${escapeHtml(imageUrl)}" alt="" loading="lazy" referrerpolicy="no-referrer" />` : ""}</div>`;
}

function renderMappings(mappings) {
  const presets = elements.actionModePresets.getAttribute("aria-selected") === "true";
  document.querySelector(".mapping-layout")?.classList.toggle("survival-gallery-layout", presets && Boolean(activePresetPackId));
  if (presets && activePresetPackId) {
    renderPresetGallery(mappings);
    elements.mappingEmpty.hidden = true;
    return;
  }
  const visible = mappings.filter((mapping) => (mapping.source === "preset") === presets);
  if (presets) {
    const groups = new Map();
    for (const mapping of visible) {
      const id = mapping.presetGroupId;
      if (!groups.has(id)) groups.set(id, []);
      groups.get(id).push(mapping);
    }
    elements.mappingList.innerHTML = [...groups].map(([groupId, entries]) => {
      const pack = actionPresetPacks.find((item) => item.id === entries[0].presetPackId) || legacyPresetPacks[entries[0].presetPackId];
      return `<article class="installed-preset-card">
        <header class="installed-preset-header"><span class="installed-preset-icon" aria-hidden="true">${pack?.icon || "✦"}</span><div><strong>${escapeHtml(pack?.title || "Paquete de preajustes")}</strong><small>${entries.length} efecto${entries.length === 1 ? "" : "s"} configurado${entries.length === 1 ? "" : "s"}</small></div><button type="button" class="button text installed-preset-delete" data-action="delete-preset-group" data-group-id="${escapeHtml(groupId)}" title="Eliminar este paquete completo">Eliminar paquete</button></header>
        <div class="installed-preset-effects">${entries.map((mapping) => {
          const trigger = mappingTriggerDefinition(mapping);
          return `<div class="installed-preset-effect">${mappingGiftVisual(mapping, trigger)}<div><strong>${escapeHtml(mapping.presetEffectTitle || trigger.title(mapping))}</strong><small>Regalo: ${escapeHtml(trigger.title(mapping))}</small><code>${escapeHtml(mapping.command || "")}</code></div><button type="button" class="icon-button" data-action="test" data-id="${escapeHtml(mapping.id)}" title="Probar efecto">▷</button></div>`;
        }).join("")}</div>
      </article>`;
    }).join("");
  } else {
  elements.mappingList.innerHTML = visible.map((mapping) => {
    const trigger = mappingTriggerDefinition(mapping);
    const title = trigger.title(mapping);
    return `
    <article class="mapping-row ${mapping.enabled ? "" : "disabled"}">
      ${mappingGiftVisual(mapping, trigger)}
      <div class="mapping-main">
        <span class="mapping-trigger-badge">${escapeHtml(trigger.label)}</span>
        <strong>${escapeHtml(title)}</strong>
        <p>${escapeHtml(mapping.command || "Sin comando de Minecraft")}</p>
        <div class="mapping-audio" data-mapping-id="${escapeHtml(mapping.id)}">
          <button type="button" class="mapping-audio-trigger" data-action="audio" data-id="${escapeHtml(mapping.id)}" aria-expanded="false" title="Cambiar audio rápidamente"><span>Audio:</span> <b>${escapeHtml(mapping.audio || "Sin audio")}</b></button>
          <select class="mapping-audio-select" data-action="audio" data-id="${escapeHtml(mapping.id)}" aria-label="Cambiar audio de ${escapeHtml(title || "esta acción")}" hidden>${mappingAudioOptions(mapping.audio || "")}</select>
        </div>
        <p class="mapping-video"><span>Video:</span> ${escapeHtml(mapping.video || "Sin video")}</p>
      </div>
      <div class="mapping-tools">
        <button class="icon-button" data-action="test" data-id="${escapeHtml(mapping.id)}" title="Probar acción">▷</button>
        <button class="icon-button" data-action="edit" data-id="${escapeHtml(mapping.id)}" title="Editar">✎</button>
        <button class="icon-button delete" data-action="delete" data-id="${escapeHtml(mapping.id)}" title="Eliminar">×</button>
      </div>
    </article>`;
  }).join("");
  }
  elements.mappingList.querySelectorAll(".mapping-gift img").forEach((image) => {
    image.addEventListener("error", () => {
      image.closest(".mapping-gift")?.classList.remove("has-image");
      image.remove();
    }, { once: true });
  });
  elements.mappingEmpty.textContent = presets ? "Todavía no has creado ningún paquete de preajustes. Elige uno a la izquierda y asigna sus regalos." : "Todavía no hay acciones de Minecraft CMD. Crea una a la izquierda.";
  elements.mappingEmpty.hidden = visible.length > 0;
}

function renderPresetGallery(mappings) {
  const pack = actionPresetPacks.find((entry) => entry.id === activePresetPackId);
  const catalog = pack?.effectsPath ? presetDetails.get(pack.id) : pack;
  if (!catalog) {
    elements.mappingList.innerHTML = '<p class="empty-state">Cargando opciones del preajuste…</p>';
    return;
  }
  const version = appState?.minecraft?.minecraftVersion || "";
  const versionLabel = version ? `Minecraft ${escapeHtml(version)}` : appState?.minecraft?.status === "connected" ? "Versión de Minecraft no detectada" : "Conecta ServerTap para ejecutar";
  const versionParts = version.match(/^(\d+)\.(\d+)(?:\.(\d+))?/);
  const configured = mappings.filter((mapping) => mapping.source === "preset" && mapping.presetPackId === activePresetPackId && mapping.presetEffectId);
  const byEffectId = new Map(configured.map((mapping) => [mapping.presetEffectId, mapping]));
  const oldCount = mappings.filter((mapping) => mapping.source === "preset" && mapping.presetPackId === activePresetPackId && !mapping.presetEffectId).length;
  elements.mappingList.innerHTML = `<section class="survival-gallery" aria-label="Opciones de ${escapeHtml(pack.title)}">
    <header class="survival-gallery-header"><div><p class="eyebrow">PREAJUSTE · MINECRAFT</p><h3>${escapeHtml(pack.title)}</h3><p>${escapeHtml(pack.description)}</p><small>${configured.length} de ${catalog.effects.length} opciones activas · ${versionLabel}</small></div><button type="button" class="button text" data-preset-back>← Ver paquetes</button></header>
    ${oldCount ? `<p class="survival-legacy-note">Hay ${oldCount} acción(es) del paquete anterior que siguen activas. Puedes gestionarlas al volver a la lista de paquetes.</p>` : ""}
    <div class="survival-options-grid">${catalog.effects.map((effect) => {
      const mapping = byEffectId.get(effect.id);
      const minimumVersion = effect.minimumVersion || pack.minimumVersion;
      const minimum = minimumVersion?.split(".").map(Number);
      const current = versionParts ? [Number(versionParts[1]), Number(versionParts[2]), Number(versionParts[3] || 0)] : null;
      const firstDifference = minimum && current ? current.findIndex((part, index) => part !== (minimum[index] || 0)) : -1;
      const unavailable = firstDifference >= 0 && current[firstDifference] < (minimum[firstDifference] || 0);
      const icon = Number.isInteger(effect.col) && Number.isInteger(effect.row)
        ? `<span class="survival-option-icon" style="background-position:-${16 + effect.col * 143}px -${22 + effect.row * 73}px" aria-hidden="true"></span>`
        : `<span class="survival-option-emoji" aria-hidden="true">${escapeHtml(effect.icon || pack.icon || "✦")}</span>`;
      return `<article class="survival-option${mapping ? " is-configured" : ""}${unavailable ? " is-unavailable" : ""}"><button type="button" class="survival-option-select" data-preset-effect-id="${escapeHtml(effect.id)}" ${unavailable ? "disabled" : ""} title="${escapeHtml(unavailable ? `Requiere Minecraft Java ${minimumVersion} o posterior` : mapping ? `Cambiar regalo de ${effect.title}` : `Asignar regalo a ${effect.title}`)}">${icon}<span class="survival-option-copy"><strong>${escapeHtml(effect.title)}</strong><small>${escapeHtml(unavailable ? `Requiere ${minimumVersion}+` : mapping ? mapping.giftName || mapping.giftId : "Elegir regalo")}</small></span></button>${mapping ? `<div class="survival-option-tools"><button type="button" class="icon-button" data-action="test" data-id="${escapeHtml(mapping.id)}" title="Probar efecto">▷</button><button type="button" class="icon-button delete" data-action="remove-preset-effect" data-id="${escapeHtml(mapping.id)}" title="Quitar regalo de esta opción">×</button></div>` : ""}</article>`;
    }).join("")}</div>
    <p class="survival-gallery-hint">Las opciones se activan individualmente al asignarles un regalo.${activePresetPackId === "diamond-challenge" ? " Atención: la TNT y los jefes pueden dañar tu mundo. JEFE INMORTAL permanece hasta retirarlo con comandos de Minecraft." : activePresetPackId === "survival" ? " Los efectos de criaturas y jefes pueden alterar tu mundo." : ""}</p>
  </section>`;
}

function closeGiftSelector() {
  elements.giftSelectorModal.hidden = true;
  document.body.classList.remove("modal-open");
  pendingPresetAssignment = null;
}

async function openGiftSelector() {
  giftCatalogSearch = "";
  elements.giftSelectorSearch.value = "";
  elements.giftSelectorModal.hidden = false;
  document.body.classList.add("modal-open");
  renderGiftSelector();
  elements.giftSelectorSearch.focus();
  try {
    const response = await fetch("/api/gift-catalog?limit=2000", {
      headers: { Authorization: `Bearer ${window.TikTokraftAuth?.accessToken || ""}` }
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "No se pudo cargar el catálogo de regalos.");
    giftCatalog = Array.isArray(payload.entries) ? payload.entries : [];
    if (appState) appState.giftCatalog = giftCatalog;
    renderGiftSelector();
  } catch (error) {
    toast(error.message, "error");
  }
}

function renderGiftSelector() {
  const search = giftCatalogSearch.toLocaleLowerCase();
  const entries = giftCatalog.filter((gift) => {
    if (!search) return true;
    return [gift.giftName, gift.giftId, gift.coinValue].some((value) => String(value ?? "").toLocaleLowerCase().includes(search));
  });
  elements.giftSelectorGrid.replaceChildren();
  for (const gift of entries) {
    const card = document.createElement("button");
    card.className = "gift-selector-card";
    card.type = "button";
    card.title = `Seleccionar ${gift.giftName || "regalo"}`;
    const visual = document.createElement("span");
    visual.className = "gift-selector-image";
    const imageUrl = String(gift.giftImageUrl || "").trim();
    if (imageUrl) {
      const image = document.createElement("img");
      image.src = imageUrl;
      image.alt = "";
      image.referrerPolicy = "no-referrer";
      image.addEventListener("error", () => image.remove(), { once: true });
      visual.append(image);
    }
    const name = document.createElement("strong");
    name.textContent = gift.giftName || "Regalo";
    const coins = document.createElement("span");
    coins.className = "gift-selector-coins";
    coins.textContent = `${numberFormat(gift.coinValue)} coins`;
    const id = document.createElement("code");
    id.textContent = `ID: ${gift.giftId}`;
    card.append(visual, name, coins, id);
    card.addEventListener("click", () => {
      if (pendingPresetAssignment) {
        const assignment = pendingPresetAssignment;
        closeGiftSelector();
        void assignPresetGift(assignment, gift);
        return;
      }
      elements.giftName.value = String(gift.giftName || "");
      elements.giftId.value = String(gift.giftId || "");
      closeGiftSelector();
      elements.command.focus();
    });
    elements.giftSelectorGrid.append(card);
  }
  elements.giftSelectorEmpty.hidden = entries.length > 0;
}

async function assignPresetGift({ packId, effectId }, gift) {
  const existing = (appState?.config?.mappings || []).find((mapping) => mapping.source === "preset" && mapping.presetPackId === packId && mapping.presetEffectId === effectId);
  const other = (appState?.config?.mappings || []).find((mapping) => mapping.id !== existing?.id && (mapping.triggerType || "gift") === "gift" && (String(mapping.giftId || "") === String(gift.giftId || "") || giftLabelKey(mapping.giftName) === giftLabelKey(gift.giftName)));
  if (other && other.source !== "preset" && !confirm("Este regalo ya activa una acción de Minecraft CMD. Si lo asignas también aquí, se ejecutarán ambas. ¿Continuar?")) return;
  try {
    const saved = await request("mapping:save-preset-effect", { packId, effectId, giftId: gift.giftId, giftName: gift.giftName });
    if (appState?.config?.mappings) {
      const index = appState.config.mappings.findIndex((mapping) => mapping.id === saved.id);
      if (index >= 0) appState.config.mappings[index] = saved; else appState.config.mappings.push(saved);
      renderMappings(appState.config.mappings);
    }
    toast(`${saved.presetEffectTitle} activado con ${gift.giftName}`, "success");
  } catch (error) { toast(error.message, "error"); }
}

function giftLabelKey(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase();
}

function setActionMode(mode) {
  const presets = mode === "presets";
  elements.mappingForm.hidden = presets;
  elements.actionPresetPanel.hidden = !presets;
  elements.actionModeCommand.classList.toggle("is-active", !presets);
  elements.actionModePresets.classList.toggle("is-active", presets);
  elements.actionModeCommand.setAttribute("aria-selected", String(!presets));
  elements.actionModePresets.setAttribute("aria-selected", String(presets));
  if (presets) renderActionPresetList();
  renderMappings(appState?.config?.mappings || []);
}

async function loadPresetDetails(pack) {
  if (presetDetails.has(pack.id)) return presetDetails.get(pack.id);
  if (!presetDetailLoads.has(pack.id)) presetDetailLoads.set(pack.id, fetch(`${pack.effectsPath}?v=20261014`)
    .then(async (response) => {
      if (!response.ok) throw new Error(`No se pudo cargar ${pack.title}.`);
      const catalog = await response.json();
      if (!Array.isArray(catalog.effects) || !catalog.effects.length) throw new Error("El catálogo de preajustes está incompleto.");
      presetDetails.set(pack.id, catalog);
      renderMappings(appState?.config?.mappings || []);
      return catalog;
    })
    .catch((error) => { presetDetailLoads.delete(pack.id); toast(error.message, "error"); throw error; }));
  return presetDetailLoads.get(pack.id);
}

async function loadActionPresetCatalog() {
  if (actionPresetPacks.length) return actionPresetPacks;
  if (!actionPresetCatalogLoad) actionPresetCatalogLoad = fetch("/action-preset-catalog.json?v=20261014-preset-cards")
    .then(async (response) => {
      if (!response.ok) throw new Error("No se pudo cargar el catálogo de preajustes.");
      const packs = await response.json();
      if (!Array.isArray(packs) || packs.some((pack) => !pack.id || !Array.isArray(pack.effects) && !pack.effectsPath)) throw new Error("El catálogo de preajustes no es válido.");
      actionPresetPacks.splice(0, actionPresetPacks.length, ...packs);
      renderActionPresetList();
      renderMappings(appState?.config?.mappings || []);
      return actionPresetPacks;
    })
    .catch((error) => { actionPresetCatalogLoad = null; toast(error.message, "error"); throw error; });
  return actionPresetCatalogLoad;
}

function renderActionPresetList() {
  if (!elements.actionPresetList) return;
  elements.actionPresetSearchLabel.hidden = false;
  elements.actionPresetList.hidden = false;
  const search = giftLabelKey(elements.actionPresetSearch.value);
  const packs = actionPresetPacks.filter((pack) => giftLabelKey(`${pack.title} ${pack.description}`).includes(search));
  elements.actionPresetList.innerHTML = packs.map((pack) => {
    const image = pack.image
      ? `<img class="action-preset-card-image" src="${escapeHtml(pack.image)}" alt="" loading="lazy" decoding="async">`
      : `<span class="action-preset-card-icon" aria-hidden="true">${escapeHtml(pack.icon || "✦")}</span>`;
    const count = pack.optionCount || pack.effects?.length || 0;
    return `<button class="action-preset-card${pack.id === activePresetPackId ? " is-selected" : ""}" type="button" data-preset-id="${escapeHtml(pack.id)}">${image}<span class="action-preset-card-copy"><strong>${escapeHtml(pack.title)}</strong><small>${escapeHtml(count)} opciones</small></span></button>`;
  }).join("");
  elements.actionPresetEmpty.hidden = packs.length > 0;
}

async function loadActionPresetGiftCatalog() {
  try {
    const response = await fetch("/api/gift-catalog?limit=2000", { headers: { Authorization: `Bearer ${window.TikTokraftAuth?.accessToken || ""}` } });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "No se pudo cargar el catálogo de regalos.");
    giftCatalog = Array.isArray(payload.entries) ? payload.entries : [];
    if (appState) appState.giftCatalog = giftCatalog;
  } catch (error) { toast(error.message, "error"); }
}

function videoUrl(filename) {
  return `/media/videos/${encodeURIComponent(filename)}`;
}

function stopVideoSelectorPreviews(except = null) {
  for (const video of elements.videoSelectorGrid.querySelectorAll("video")) {
    if (video === except) continue;
    video.pause();
    video.closest(".video-selector-card")?.classList.remove("is-playing");
    try { video.currentTime = 0; } catch { /* Los metadatos todavía pueden estar cargando. */ }
  }
}

function closeVideoSelector() {
  stopVideoSelectorPreviews();
  elements.videoSelectorModal.hidden = true;
  document.body.classList.remove("modal-open");
}

async function openVideoSelector() {
  videoCatalogSearch = "";
  elements.videoSelectorSearch.value = "";
  elements.videoSelectorModal.hidden = false;
  document.body.classList.add("modal-open");
  renderVideoSelector();
  elements.videoSelectorSearch.focus();
  await loadVideos();
  renderVideoSelector();
}

function renderVideoSelector() {
  const search = videoCatalogSearch.toLocaleLowerCase();
  const entries = availableVideos.filter((filename) => !search || filename.toLocaleLowerCase().includes(search));
  const selected = elements.mappingVideo.value;
  stopVideoSelectorPreviews();
  elements.videoSelectorGrid.replaceChildren();
  for (const filename of entries) {
    const card = document.createElement("button");
    card.className = `video-selector-card${filename === selected ? " is-selected" : ""}`;
    card.type = "button";
    card.title = `Seleccionar ${filename}`;
    card.setAttribute("aria-label", `Vista previa y selección de ${filename}`);
    const preview = document.createElement("span");
    preview.className = "video-selector-preview";
    const video = document.createElement("video");
    video.src = videoUrl(filename);
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.preload = "metadata";
    const hint = document.createElement("span");
    hint.className = "video-selector-play-hint";
    hint.textContent = "▶ Vista previa";
    preview.append(video, hint);
    const name = document.createElement("strong");
    name.textContent = filename;
    const duration = document.createElement("small");
    const updateDuration = () => {
      const value = Number(video.duration);
      if (Number.isFinite(value)) videoDurations.set(filename, value);
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        preview.style.aspectRatio = `${video.videoWidth} / ${video.videoHeight}`;
      }
      const label = formatMediaDuration(videoDurations.get(filename));
      duration.textContent = label ? `Duración ${label}` : "Pasa el mouse para reproducir";
      if (elements.mappingVideo.value === filename) elements.mappingVideoSelected.textContent = videoOptionLabel(filename);
    };
    updateDuration();
    video.addEventListener("loadedmetadata", updateDuration, { once: true });
    const startPreview = () => {
      stopVideoSelectorPreviews(video);
      card.classList.add("is-playing");
      video.play().catch(() => card.classList.remove("is-playing"));
    };
    const stopPreview = () => {
      video.pause();
      card.classList.remove("is-playing");
      try { video.currentTime = 0; } catch { /* Sin metadatos todavía. */ }
    };
    card.addEventListener("pointerenter", startPreview);
    card.addEventListener("pointerleave", stopPreview);
    card.addEventListener("focus", startPreview);
    card.addEventListener("blur", stopPreview);
    card.addEventListener("click", () => {
      renderVideoOptions(filename);
      closeVideoSelector();
      elements.cooldown.focus();
    });
    card.append(preview, name, duration);
    if (filename === selected) {
      const badge = document.createElement("b");
      badge.className = "video-selector-selected-badge";
      badge.textContent = "SELECCIONADO";
      card.append(badge);
    }
    elements.videoSelectorGrid.append(card);
  }
  elements.videoSelectorEmpty.hidden = entries.length > 0;
}

function soundUrl(filename) {
  return `/media/sounds/${encodeURIComponent(filename)}`;
}

function playSound(filename) {
  if (!filename) return;
  const audio = new Audio(soundUrl(filename));
  audio.play().catch(() => toast("El navegador bloqueó la reproducción de audio.", "error"));
}

function stopAudioTest() {
  const audio = activeAudioTest;
  activeAudioTest = null;
  elements.audioTestStop.disabled = true;
  if (!audio) return;
  audio.pause();
  try { audio.currentTime = 0; } catch { /* El navegador aún no cargó los metadatos. */ }
}

function playAudioTest(filename) {
  stopAudioTest();
  if (!filename) return;
  const audio = new Audio(soundUrl(filename));
  activeAudioTest = audio;
  elements.audioTestStop.disabled = false;
  audio.addEventListener("ended", () => {
    if (activeAudioTest !== audio) return;
    activeAudioTest = null;
    elements.audioTestStop.disabled = true;
  }, { once: true });
  audio.play().catch(() => {
    if (activeAudioTest !== audio) return;
    activeAudioTest = null;
    elements.audioTestStop.disabled = true;
    toast("El navegador bloqueó la reproducción de audio.", "error");
  });
}

function currentTtsSettings({ fromControls = false } = {}) {
  const selectedVoice = elements.ttsVoice?.selectedOptions?.[0];
  return {
    enabled: Boolean(appState?.config?.tts?.enabled),
    language: fromControls ? elements.ttsLanguage.value : appState?.config?.tts?.language || "es-CO",
    voiceURI: fromControls ? elements.ttsVoice.value : appState?.config?.tts?.voiceURI || "",
    voiceName: fromControls ? selectedVoice?.dataset.voiceName || "" : appState?.config?.tts?.voiceName || "",
    volume: Number(fromControls ? elements.ttsVolume.value : appState?.config?.tts?.volume ?? 1),
    speed: Number(fromControls ? elements.ttsSpeed.value : appState?.config?.tts?.speed ?? 60),
    pitch: Number(fromControls ? elements.ttsPitch.value : appState?.config?.tts?.pitch ?? 70)
  };
}

function ttsSettingsFromControls() {
  return {
    enabled: elements.ttsEnabled.checked,
    language: elements.ttsLanguage.value,
    voiceURI: elements.ttsVoice.value,
    voiceName: elements.ttsVoice.selectedOptions[0]?.dataset.voiceName || "",
    volume: Number(elements.ttsVolume.value),
    speed: Number(elements.ttsSpeed.value),
    pitch: Number(elements.ttsPitch.value),
    readUsername: elements.ttsReadUsername.checked
  };
}

function scheduleTtsAutoSave() {
  clearTimeout(ttsAutoSaveTimer);
  const revision = ++ttsAutoSaveRevision;
  ttsAutoSaveTimer = setTimeout(async () => {
    try {
      const saved = await request("tts:save", ttsSettingsFromControls());
      if (revision !== ttsAutoSaveRevision || !appState?.config) return;
      appState.config.tts = { ...appState.config.tts, ...saved };
    } catch (error) {
      toast(error.message, "error");
    }
  }, 150);
}

function ttsVoiceIdentity(voice) {
  return String(voice?.voiceURI || voice?.name || "");
}

function renderTtsVoiceOptions(settings = appState?.config?.tts || {}) {
  if (!elements.ttsVoice) return;
  const selectedVoiceURI = String(settings?.voiceURI || elements.ttsVoice.value || "");
  const selectedLanguage = elements.ttsLanguage.value || settings?.language || "es-CO";
  const voices = [...availableTtsVoices].sort((left, right) => {
    const leftPreferred = left.lang === selectedLanguage ? 0 : 1;
    const rightPreferred = right.lang === selectedLanguage ? 0 : 1;
    return leftPreferred - rightPreferred
      || String(left.lang).localeCompare(String(right.lang), "es")
      || String(left.name).localeCompare(String(right.name), "es");
  });
  const fragment = document.createDocumentFragment();
  const automatic = document.createElement("option");
  automatic.value = "";
  automatic.textContent = "Automática del navegador";
  fragment.append(automatic);
  const preferred = voices.filter((voice) => voice.lang === selectedLanguage);
  const other = voices.filter((voice) => voice.lang !== selectedLanguage);
  const appendGroup = (label, entries) => {
    if (!entries.length) return;
    const group = document.createElement("optgroup");
    group.label = label;
    for (const voice of entries) {
      const option = document.createElement("option");
      option.value = ttsVoiceIdentity(voice);
      option.dataset.voiceName = voice.name;
      option.textContent = `${voice.name} · ${voice.lang}${voice.localService ? " · local" : " · online"}`;
      group.append(option);
    }
    fragment.append(group);
  };
  appendGroup(`Voces en ${selectedLanguage}`, preferred);
  appendGroup("Otros idiomas", other);
  if (selectedVoiceURI && !voices.some((voice) => ttsVoiceIdentity(voice) === selectedVoiceURI)) {
    const unavailable = document.createElement("option");
    unavailable.value = selectedVoiceURI;
    unavailable.dataset.voiceName = settings?.voiceName || "";
    unavailable.textContent = `${settings?.voiceName || "Voz guardada"} · no disponible en este navegador`;
    fragment.append(unavailable);
  }
  elements.ttsVoice.replaceChildren(fragment);
  elements.ttsVoice.value = selectedVoiceURI;
  elements.ttsVoiceState.textContent = voices.length
    ? `${voices.length} voces disponibles en este navegador.`
    : "El navegador todavía no informó sus voces instaladas.";
}

function loadTtsVoices() {
  if (!("speechSynthesis" in window)) {
    elements.ttsVoiceState.textContent = "Este navegador no admite voces TTS.";
    return;
  }
  const uniqueVoices = new Map();
  for (const voice of window.speechSynthesis.getVoices()) {
    const identity = ttsVoiceIdentity(voice);
    if (identity && !uniqueVoices.has(identity)) uniqueVoices.set(identity, voice);
  }
  availableTtsVoices = [...uniqueVoices.values()];
  renderTtsVoiceOptions();
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

function playTts(text, { allowWhenDisabled = false, useDraft = false } = {}) {
  const settings = currentTtsSettings({ fromControls: useDraft });
  if (!settings.enabled && !allowWhenDisabled) return toast("Activa TTS en General Settings para reproducir.", "error");
  ttsQueue.enqueue(text, settings);
}

function renderSoundOptions(selectedAudio = elements.audio.value) {
  const selected = selectedAudio || "";
  elements.audio.replaceChildren(new Option("Sin audio", ""));
  for (const filename of availableSounds) elements.audio.add(new Option(soundOptionLabel(filename), filename));
  if (selected && !availableSounds.includes(selected)) {
    elements.audio.add(new Option(`${selected} (no disponible)`, selected));
  }
  elements.audio.value = selected;
  elements.audioTest.disabled = !selected || !availableSounds.includes(selected);
  elements.audioState.textContent = availableSounds.length
    ? `${availableSounds.length} audio(s) disponible(s) en el catálogo global.`
    : "No hay audios disponibles en el catálogo global.";
}

async function loadSounds() {
  try {
    const response = await fetch("/api/sounds", { headers: { Authorization: `Bearer ${window.TikTokraftAuth?.accessToken || ""}` } });
    if (!response.ok) throw new Error();
    const payload = await response.json();
    availableSounds = Array.isArray(payload.sounds) ? payload.sounds : [];
    soundDurations = new Map((Array.isArray(payload.details) ? payload.details : [])
      .filter((sound) => sound && typeof sound.filename === "string" && Number.isFinite(sound.durationSeconds))
      .map((sound) => [sound.filename, sound.durationSeconds]));
    renderSoundOptions();
    if (appState?.config?.mappings) renderMappings(appState.config.mappings);
  } catch {
    elements.audioState.textContent = "No se pudo cargar la lista de audios.";
  }
}

function renderVideoOptions(selectedVideo = elements.mappingVideo.value) {
  const selected = selectedVideo || "";
  elements.mappingVideo.value = selected;
  elements.mappingVideoSelected.textContent = selected
    ? `${videoOptionLabel(selected)}${availableVideos.includes(selected) ? "" : " (no disponible)"}`
    : "Seleccionar video";
  elements.selectVideoButton.classList.toggle("has-selection", Boolean(selected));
  elements.clearVideoButton.hidden = !selected;
  elements.videoState.textContent = availableVideos.length
    ? `${availableVideos.length} video(s) aprobado(s) disponible(s).`
    : "Todavía no hay videos aprobados disponibles.";
}

async function loadVideos() {
  try {
    const response = await fetch("/api/videos", { headers: { Authorization: `Bearer ${window.TikTokraftAuth?.accessToken || ""}` } });
    if (!response.ok) throw new Error();
    const payload = await response.json();
    const videos = Array.isArray(payload.videos) ? payload.videos : [];
    availableVideos = videos.map((video) => video?.filename).filter((filename) => typeof filename === "string");
    videoDurations = new Map(videos
      .filter((video) => video && typeof video.filename === "string" && Number.isFinite(video.durationSeconds))
      .map((video) => [video.filename, video.durationSeconds]));
    renderVideoOptions();
    if (!elements.videoSelectorModal.hidden) renderVideoSelector();
    if (appState?.config?.mappings) renderMappings(appState.config.mappings);
  } catch {
    elements.videoState.textContent = "No se pudo cargar el catálogo de videos.";
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
  if (entry.type === "action") {
    const title = entry.mapping ? mappingTriggerDefinition(entry.mapping).title(entry.mapping) : (entry.event?.eventName || entry.event?.giftName || "Acción");
    return `${title} → ${mappingOutputSummary(entry.mapping || { command: entry.command })}`;
  }
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

function renderGiftHistory(gifts) {
  const entries = Array.isArray(gifts) ? gifts : [];
  elements.giftHistoryList.replaceChildren();
  for (const gift of entries) {
    const row = document.createElement("div");
    row.className = "gift-history-row";
    const name = document.createElement("strong");
    name.textContent = gift.giftName || "Regalo";
    const id = document.createElement("code");
    id.textContent = gift.giftId || "Sin ID";
    row.append(name, id);
    elements.giftHistoryList.append(row);
  }
  elements.giftHistoryEmpty.hidden = entries.length > 0;
}

function resetEditor() {
  elements.mappingForm.reset();
  elements.mappingId.value = "";
  elements.mappingTriggerType.value = "gift";
  elements.cooldown.value = 0;
  elements.enabled.checked = true;
  renderSoundOptions("");
  renderVideoOptions("");
  elements.editorHeading.textContent = "Nueva acción";
  elements.cancelEdit.hidden = true;
  syncMappingTriggerEditor();
}

function openEditor(mapping) {
  setActionMode("command");
  elements.mappingId.value = mapping.id;
  elements.mappingTriggerType.value = mapping.triggerType || "gift";
  elements.giftName.value = mapping.giftName;
  elements.giftId.value = mapping.giftId;
  elements.command.value = mapping.command;
  renderVideoOptions(mapping.video || "");
  renderSoundOptions(mapping.audio);
  elements.cooldown.value = mapping.cooldownMs;
  elements.enabled.checked = mapping.enabled;
  elements.editorHeading.textContent = "Editar acción";
  elements.cancelEdit.hidden = false;
  syncMappingTriggerEditor();
  elements.mappingForm.scrollIntoView({ behavior:"smooth", block:"center" });
  (mapping.triggerType === "gift" ? elements.giftName : elements.mappingTriggerType).focus();
}

function syncMappingTriggerEditor() {
  const isGift = elements.mappingTriggerType.value === "gift";
  elements.mappingGiftFields.hidden = !isGift;
  elements.selectGiftButton.hidden = !isGift;
}

async function control(button, event, payload, success) {
  button.disabled = true;
  try { await request(event, payload); toast(success, "success"); } catch (error) { toast(error.message, "error"); } finally { button.disabled = false; }
}

function setServerTapFieldVisible(button, visible) {
  const field = document.getElementById(button.dataset.target);
  const control = button.closest(".server-tap-visibility-control");
  if (!field || !control) return;
  control.classList.toggle("is-concealed", !visible);
  if (field === elements.serverTapKey) field.type = visible ? "text" : "password";
  const fieldName = button.dataset.target === "servertap-host" ? "IP o dominio"
    : button.dataset.target === "servertap-port" ? "puerto"
      : button.dataset.target === "servertap-protocol" ? "protocolo"
        : "contraseña";
  button.setAttribute("aria-pressed", String(visible));
  button.setAttribute("aria-label", `${visible ? "Ocultar" : "Mostrar"} ${fieldName}`);
  button.title = `${visible ? "Ocultar" : "Mostrar"} ${fieldName}`;
}

elements.serverTapVisibilityToggles.forEach((button) => button.addEventListener("click", () => {
  const visible = button.getAttribute("aria-pressed") !== "true";
  setServerTapFieldVisible(button, visible);
  if (visible) document.getElementById(button.dataset.target)?.focus({ preventScroll: true });
}));

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
  const passwordToggle = elements.serverTapVisibilityToggles.find((button) => button.dataset.target === "servertap-key");
  if (passwordToggle) setServerTapFieldVisible(passwordToggle, false);
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
elements.ttsVolume.addEventListener("change", scheduleTtsAutoSave);
elements.ttsEnabled.addEventListener("change", scheduleTtsAutoSave);
elements.ttsReadUsername.addEventListener("change", scheduleTtsAutoSave);
elements.ttsLanguage.addEventListener("change", () => {
  renderTtsVoiceOptions();
  scheduleTtsAutoSave();
});
elements.ttsVoice.addEventListener("change", scheduleTtsAutoSave);
elements.ttsSpeed.addEventListener("change", scheduleTtsAutoSave);
elements.ttsPitch.addEventListener("change", scheduleTtsAutoSave);
elements.ttsSettings.addEventListener("submit", (event) => {
  event.preventDefault();
  scheduleTtsAutoSave();
});
elements.ttsStop.addEventListener("click", () => ttsQueue.pause());
elements.ttsResume.addEventListener("click", () => ttsQueue.resume());
elements.voiceTester.addEventListener("submit", (event) => {
  event.preventDefault();
  playTts(elements.voiceTesterText.value, { allowWhenDisabled: true, useDraft: true });
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
  if (event.key !== "Escape") return;
  if (!elements.adminModal.hidden) closeAdminPanel();
  else if (!elements.profileModal.hidden) closeProfileModal();
  else if (!elements.transactionModal.hidden) closeTransactionModal();
  else if (!elements.customizationModal.hidden) closeCustomization();
});
document.addEventListener("keydown", (event) => {
  if (event.defaultPrevented || event.ctrlKey || event.altKey || event.metaKey) return;
  const target = event.target;
  if (target?.matches?.("input, textarea, select, button, [contenteditable=true]")) return;
  const shortcuts = appState?.config?.timer?.shortcuts;
  if (!shortcuts) return;
  let socketEvent = "";
  let payload = null;
  if (shortcuts.toggle && event.code === shortcuts.toggle) {
    if (event.repeat) return;
    socketEvent = appState?.timer?.status === "running" ? "timer:pause" : "timer:start";
  } else if (shortcuts.increase && event.code === shortcuts.increase) {
    socketEvent = "timer:adjust";
    payload = { minutes: Number(shortcuts.stepMinutes) || 1 };
  } else if (shortcuts.decrease && event.code === shortcuts.decrease) {
    socketEvent = "timer:adjust";
    payload = { minutes: -(Number(shortcuts.stepMinutes) || 1) };
  }
  if (!socketEvent) return;
  event.preventDefault();
  request(socketEvent, payload).catch((error) => toast(error.message, "error"));
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

const workspaceGroups = {
  tools: { button: document.querySelector('[data-workspace-group="tools"]'), menu: document.querySelector("#workspace-tools-menu") },
  overlays: { button: document.querySelector('[data-workspace-group="overlays"]'), menu: document.querySelector("#workspace-overlays-menu") },
  audio: { button: document.querySelector('[data-workspace-group="audio"]'), menu: document.querySelector("#workspace-audio-panel") },
  gifts: { button: document.querySelector('[data-workspace-group="gifts"]'), menu: document.querySelector("#workspace-gifts-panel") },
};
const workspaceFeatures = {
  temporizador: { group: "tools", section: document.querySelector("#temporizador"), toggle: elements.timerToggle, panel: elements.timerPanel },
  "usuario-y-puntos": { group: "overlays", section: document.querySelector("#usuario-y-puntos"), toggle: elements.userPointsToggle, panel: elements.userPointsPanel },
  "rankings-overlays": { group: "overlays", section: document.querySelector("#rankings-overlays"), toggle: elements.rankingsToggle, panel: elements.rankingsPanel },
  "regalo-overlays": { group: "overlays", section: document.querySelector("#regalo-overlays"), toggle: elements.giftOverlaysToggle, panel: elements.giftOverlaysPanel },
  metas: { group: "overlays", section: document.querySelector("#metas"), toggle: elements.goalsToggle, panel: elements.goalsPanel },
};

function hideWorkspaceFeatures() {
  for (const feature of Object.values(workspaceFeatures)) {
    feature.section.hidden = true;
    feature.panel.hidden = true;
    feature.panel.classList.remove("is-open");
    feature.toggle.setAttribute("aria-expanded", "false");
    document.querySelector(`[data-workspace-feature="${feature.section.id}"]`)?.setAttribute("aria-expanded", "false");
  }
}

function showWorkspaceGroup(groupName, keepOpen = false) {
  const current = workspaceGroups[groupName];
  if (!current) return;
  const wasOpen = current.button.getAttribute("aria-expanded") === "true";
  for (const [name, group] of Object.entries(workspaceGroups)) {
    if (name !== groupName && group.button.getAttribute("aria-expanded") === "true") toggleAccordion(group.button, group.menu);
  }
  if (!keepOpen || !wasOpen) hideWorkspaceFeatures();
  if (!wasOpen || !keepOpen) toggleAccordion(current.button, current.menu);
  if (groupName === "gifts" && (!wasOpen || keepOpen)) void window.TikTokraftGiftBrowser?.open();
}

function showWorkspaceFeature(featureId) {
  const feature = workspaceFeatures[featureId];
  if (!feature) return;
  showWorkspaceGroup(feature.group, true);
  hideWorkspaceFeatures();
  feature.section.hidden = false;
  toggleAccordion(feature.toggle, feature.panel);
  document.querySelector(`[data-workspace-feature="${featureId}"]`)?.setAttribute("aria-expanded", "true");
  if (featureId === "usuario-y-puntos" && !userPointsSearch) loadUserPoints();
}

for (const [name, group] of Object.entries(workspaceGroups)) {
  group.button.addEventListener("click", () => showWorkspaceGroup(name));
}
document.querySelectorAll("[data-workspace-feature]").forEach((choice) => choice.addEventListener("click", () => {
  const featureId = choice.dataset.workspaceFeature;
  history.replaceState(null, "", `#${featureId}`);
  showWorkspaceFeature(featureId);
}));
document.querySelectorAll("[data-workspace-nav]").forEach((link) => link.addEventListener("click", (event) => {
  event.preventDefault();
  const groupName = link.dataset.workspaceNav;
  history.replaceState(null, "", link.getAttribute("href"));
  showWorkspaceGroup(groupName, true);
  workspaceGroups[groupName].button.scrollIntoView({ behavior: "smooth", block: "start" });
}));
function revealWorkspaceHash() {
  const target = decodeURIComponent(location.hash.slice(1));
  if (workspaceFeatures[target]) showWorkspaceFeature(target);
  else if (target === "herramientas") showWorkspaceGroup("tools", true);
  else if (target === "overlays") showWorkspaceGroup("overlays", true);
  else if (target === "audio-bot") showWorkspaceGroup("audio", true);
  else if (target === "regalos-tiktok") showWorkspaceGroup("gifts", true);
}
window.addEventListener("hashchange", revealWorkspaceHash);
revealWorkspaceHash();

elements.goalsToggle.addEventListener("click", () => {
  toggleAccordion(elements.goalsToggle, elements.goalsPanel);
});
elements.timerToggle.addEventListener("click", () => {
  toggleAccordion(elements.timerToggle, elements.timerPanel);
});
elements.timerCopy.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(elements.timerUrl.value);
  } catch {
    elements.timerUrl.select();
    document.execCommand("copy");
  }
  toast("URL copiada", "success");
});
elements.timerPreviewButton.addEventListener("click", () => window.open(timerOverlayUrl(), "_blank", "noopener"));
elements.timerStart.addEventListener("click", (event) => control(event.currentTarget, "timer:start", null, appState?.timer?.status === "paused" ? "Temporizador reanudado" : "Temporizador iniciado"));
elements.timerPause.addEventListener("click", (event) => control(event.currentTarget, "timer:pause", null, "Temporizador pausado"));
elements.timerReset.addEventListener("click", (event) => control(event.currentTarget, "timer:reset", null, "Temporizador reiniciado"));
function manualTimerAdjustment(button, direction) {
  const minutes = Number(elements.timerCurrentMinutes.value);
  if (!elements.timerCurrentMinutes.checkValidity() || !Number.isFinite(minutes) || minutes <= 0) {
    toast("Introduce una cantidad de minutos mayor que cero.", "error");
    return;
  }
  const amount = timerInputValue(minutes);
  control(button, "timer:adjust", { minutes: direction * minutes }, direction > 0 ? `Se agregaron ${amount} minutos` : `Se redujeron ${amount} minutos`);
}
elements.timerAddTen.addEventListener("click", (event) => manualTimerAdjustment(event.currentTarget, 1));
elements.timerRemoveTen.addEventListener("click", (event) => manualTimerAdjustment(event.currentTarget, -1));

const timerAutoSaveFields = [elements.timerInitialMinutes, elements.timerExpiryAction, elements.timerPerCoin, elements.timerCoinText, elements.timerPerSubscription, elements.timerPerFollow, elements.timerPerShare, elements.timerPerLike, elements.timerPerComment, elements.timerMultiplierValue, elements.timerShortcutToggle, elements.timerShortcutIncrease, elements.timerShortcutDecrease, elements.timerShortcutStep];
timerAutoSaveFields.forEach((field) => {
  field.addEventListener(field.matches("input") ? "input" : "change", scheduleTimerSettingsSave);
});
elements.timerMultiplierEnabled.addEventListener("change", () => {
  elements.timerMultiplierValue.disabled = !elements.timerMultiplierEnabled.checked;
  scheduleTimerSettingsSave();
});
elements.rankingsToggle.addEventListener("click", () => {
  toggleAccordion(elements.rankingsToggle, elements.rankingsPanel);
});
elements.userPointsToggle.addEventListener("click", () => {
  toggleAccordion(elements.userPointsToggle, elements.userPointsPanel);
  if (!userPointsSearch) loadUserPoints();
});
elements.userPointsSearch.addEventListener("input", () => {
  userPointsSearch = elements.userPointsSearch.value.trim();
  clearTimeout(userPointsSearchTimer);
  userPointsSearchTimer = setTimeout(() => loadUserPoints(userPointsSearch), 220);
});
elements.userPointsAdd.addEventListener("click", openTransactionModal);
elements.userPointsList.addEventListener("click", async (event) => {
  const button = event.target.closest(".user-points-remove");
  if (!button?.dataset.username) return;
  const name = button.closest("li")?.querySelector("strong")?.textContent || button.dataset.username;
  if (!confirm(`¿Eliminar a ${name} y todos sus puntos históricos?`)) return;
  button.disabled = true;
  try {
    await request("user-points:delete", button.dataset.username);
    toast("Usuario eliminado", "success");
    await loadUserPoints(userPointsSearch);
  } catch (error) {
    toast(error.message, "error");
    button.disabled = false;
  }
});
elements.transactionModal.querySelectorAll("[data-transaction-modal-close]").forEach((button) => {
  button.addEventListener("click", closeTransactionModal);
});
elements.transactionForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submit = event.submitter;
  submit.disabled = true;
  try {
    const entry = await request("user-points:transaction", {
      username: elements.transactionUser.value.trim(),
      coins: Number(elements.transactionCoins.value),
      description: elements.transactionDescription.value.trim()
    });
    toast(`Transacción guardada para ${entry.nickname || entry.username}`, "success");
    closeTransactionModal();
    if (userPointsSearch) loadUserPoints(userPointsSearch);
  } catch (error) {
    toast(error.message, "error");
  } finally {
    submit.disabled = false;
  }
});
elements.userPointsCopy.addEventListener("click", async () => {
  try {
    await loadUserPoints(userPointsSearch);
    if (!userPointsOverlayToken) throw new Error("No se pudo obtener la URL pública del overlay.");
    await navigator.clipboard.writeText(elements.userPointsUrl.value);
  } catch (error) {
    if (!userPointsOverlayToken) return toast(error.message, "error");
    elements.userPointsUrl.select();
    document.execCommand("copy");
  }
  toast("URL copiada", "success");
});
elements.userPointsPreview.addEventListener("click", async () => {
  await loadUserPoints(userPointsSearch);
  if (!userPointsOverlayToken) return toast("No se pudo obtener la URL pública del overlay.", "error");
  window.open(userPointsOverlayUrl(), "_blank", "noopener");
});
elements.userPointsLimitForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const key = "user-points:historical";
    const saved = await request("overlay-customization:save", {
      key,
      customization: { ...customizationFor(key), itemLimit: Number(elements.userPointsLimit.value) }
    });
    if (appState?.config) {
      appState.config.overlayCustomizations ||= {};
      appState.config.overlayCustomizations[key] = saved.customization;
    }
    elements.userPointsLimit.value = String(saved.customization.itemLimit);
    toast("Cantidad de usuarios guardada", "success");
  } catch (error) {
    toast(error.message, "error");
  }
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

elements.mappingTriggerType.addEventListener("change", syncMappingTriggerEditor);
syncMappingTriggerEditor();
elements.actionVideoWidgetCopy.addEventListener("click", async () => {
  const url = elements.actionVideoWidgetUrl.value;
  try {
    await navigator.clipboard.writeText(url);
  } catch {
    elements.actionVideoWidgetUrl.select();
    document.execCommand("copy");
  }
  toast("URL del widget de videos copiada", "success");
});
elements.actionVideoWidgetPreview.addEventListener("click", () => {
  const url = elements.actionVideoWidgetUrl.value;
  if (url) window.open(url, "_blank", "noopener");
});

elements.mappingForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const triggerType = elements.mappingTriggerType.value;
  const data = {
    id: elements.mappingId.value || `rule-${crypto.randomUUID()}`,
    triggerType,
    giftName: triggerType === "gift" ? elements.giftName.value.trim() : "", giftId: triggerType === "gift" ? elements.giftId.value.trim() : "", command: elements.command.value.trim(), audio: elements.audio.value, video: elements.mappingVideo.value,
    cooldownMs: Number(elements.cooldown.value), enabled: elements.enabled.checked
  };
  if (triggerType === "gift" && !data.giftName && !data.giftId) return toast("Indica al menos el nombre o ID del regalo.", "error");
  if (!data.command && !data.audio && !data.video) return toast("Configura al menos un comando, audio o video.", "error");
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
elements.audioTest.addEventListener("click", () => playAudioTest(elements.audio.value));
elements.audioTestStop.addEventListener("click", stopAudioTest);

elements.mappingList.addEventListener("click", async (event) => {
  if (event.target.closest("button[data-preset-back]")) {
    activePresetPackId = "";
    renderActionPresetList();
    renderMappings(appState?.config?.mappings || []);
    return;
  }
  const presetSelect = event.target.closest("button[data-preset-effect-id]");
  if (presetSelect && !presetSelect.disabled) {
    pendingPresetAssignment = { packId: activePresetPackId, effectId: presetSelect.dataset.presetEffectId };
    openGiftSelector();
    return;
  }
  const audioTrigger = event.target.closest(".mapping-audio-trigger");
  if (audioTrigger) {
    setMappingAudioPickerOpen(audioTrigger.closest(".mapping-audio"), true);
    return;
  }
  const button = event.target.closest("button[data-action]");
  if (!button || !appState) return;
  if (button.dataset.action === "delete-preset-group") {
    const groupId = button.dataset.groupId;
    const group = appState.config.mappings.filter((item) => item.source === "preset" && item.presetGroupId === groupId);
    if (!group.length || !confirm(`¿Eliminar este paquete y sus ${group.length} efectos?`)) return;
    return control(button, "mapping:delete-preset-group", groupId, "Paquete de preajustes eliminado");
  }
  const mapping = appState.config.mappings.find((item) => item.id === button.dataset.id);
  if (!mapping) return;
  if (button.dataset.action === "remove-preset-effect" && mapping.source === "preset" && mapping.presetEffectId) {
    if (!confirm(`¿Quitar el regalo de ${mapping.presetEffectTitle}? La opción permanecerá disponible para configurarla de nuevo.`)) return;
    return control(button, "mapping:delete", mapping.id, "Regalo quitado del preajuste");
  }
  if (button.dataset.action === "edit" && mapping.source !== "preset") return openEditor(mapping);
  if (button.dataset.action === "delete") {
    const title = mappingTriggerDefinition(mapping).title(mapping);
    if (!confirm(`¿Eliminar la acción de ${title}?`)) return;
    return control(button, "mapping:delete", mapping.id, "Acción eliminada");
  }
  if (button.dataset.action === "test") return control(button, "mapping:test", mapping.id, "Prueba de acción ejecutada");
});

elements.mappingList.addEventListener("change", async (event) => {
  const select = event.target.closest(".mapping-audio-select");
  if (!select || !appState) return;
  const mapping = appState.config.mappings.find((item) => item.id === select.dataset.id);
  if (!mapping) return;
  select.dataset.saving = "true";
  select.disabled = true;
  try {
    const saved = await request("mapping:save", { ...mapping, audio: select.value });
    const index = appState.config.mappings.findIndex((item) => item.id === saved.id);
    if (index >= 0) appState.config.mappings[index] = saved;
    renderMappings(appState.config.mappings);
    toast("Audio de la acción actualizado", "success");
  } catch (error) {
    renderMappings(appState.config.mappings);
    toast(error.message, "error");
  }
});

elements.mappingList.addEventListener("keydown", (event) => {
  const select = event.target.closest(".mapping-audio-select");
  if (select && event.key === "Escape") {
    event.preventDefault();
    setMappingAudioPickerOpen(select.closest(".mapping-audio"), false);
  }
});

elements.mappingList.addEventListener("focusout", (event) => {
  const select = event.target.closest(".mapping-audio-select");
  if (!select || select.dataset.saving === "true") return;
  setTimeout(() => {
    if (!select.closest(".mapping-audio")?.contains(document.activeElement)) {
      setMappingAudioPickerOpen(select.closest(".mapping-audio"), false);
    }
  }, 0);
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
socket.on("account:deleted", ({ message } = {}) => {
  window.TikTokraftAuth?.signOut?.();
  window.alert(message || "Tu cuenta fue eliminada por el administrador.");
  location.reload();
});
socket.on("activity", (entry) => {
  if (hiddenActivity) return;
  if (appState) { appState.activity.unshift(entry); appState.activity = appState.activity.slice(0, 100); renderActivity(appState.activity); }
});
socket.on("gift-history:update", (gifts) => {
  if (appState) appState.giftHistory = Array.isArray(gifts) ? gifts : [];
  renderGiftHistory(gifts);
});
socket.on("gift-catalog:update", (gifts) => {
  giftCatalog = Array.isArray(gifts) ? gifts : [];
  if (appState) appState.giftCatalog = giftCatalog;
  window.TikTokraftGiftBrowser?.setEntries(giftCatalog);
  if (appState?.config?.mappings) renderMappings(appState.config.mappings);
  if (!elements.giftSelectorModal.hidden) renderGiftSelector();
});
socket.on("gift-catalog:sync-status", (status) => {
  if (appState) appState.giftCatalogSync = status;
  window.TikTokraftGiftBrowser?.setSyncStatus(status);
});
socket.on("gift-catalog:upsert", (gift) => {
  if (!gift?.giftId) return;
  const index = giftCatalog.findIndex((entry) => String(entry.giftId) === String(gift.giftId));
  if (index >= 0) giftCatalog[index] = { ...giftCatalog[index], ...gift };
  else giftCatalog.unshift(gift);
  if (appState) appState.giftCatalog = giftCatalog;
  window.TikTokraftGiftBrowser?.setEntries(giftCatalog);
  if (appState?.config?.mappings) renderMappings(appState.config.mappings);
  if (!elements.giftSelectorModal.hidden) renderGiftSelector();
});
socket.on("gift-catalog:batch", (gifts) => {
  if (!Array.isArray(gifts) || !gifts.length) return;
  const byId = new Map(giftCatalog.map((gift) => [String(gift.giftId), gift]));
  for (const gift of gifts) if (gift?.giftId) byId.set(String(gift.giftId), { ...byId.get(String(gift.giftId)), ...gift });
  giftCatalog = [...byId.values()];
  if (appState) appState.giftCatalog = giftCatalog;
  window.TikTokraftGiftBrowser?.setEntries(giftCatalog);
  if (appState?.config?.mappings) renderMappings(appState.config.mappings);
  if (!elements.giftSelectorModal.hidden) renderGiftSelector();
});
socket.on("tiktok:comment", (comment) => {
  if (!appState?.config?.tts?.enabled || !comment?.text) return;
  const spokenComment = appState.config.tts?.readUsername === false
    ? comment.text
    : `${comment.nickname}: ${comment.text}`;
  ttsQueue.enqueue(spokenComment, currentTtsSettings());
});
socket.on("timer:update", (timer) => renderTimer(timer));
socket.on("connect", () => synchronizePanelTimer({ force: true }));
document.addEventListener("visibilitychange", () => { if (!document.hidden) synchronizePanelTimer(); });
window.addEventListener("focus", synchronizePanelTimer);
window.addEventListener("pageshow", synchronizePanelTimer);
window.addEventListener("online", synchronizePanelTimer);
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
socket.on("user-points:update", (overlay) => {
  if (!overlay) return;
  if (appState) {
    appState.userPoints ||= {};
    appState.userPoints.entries = overlay.entries || [];
  }
  if (!userPointsSearch) renderUserPoints(overlay.entries || [], true);
});
socket.on("overlay-customization:update", ({ key, customization }) => {
  if (!appState?.config || !key) return;
  appState.config.overlayCustomizations ||= {};
  appState.config.overlayCustomizations[key] = customization;
  if (key === "user-points:historical") {
    elements.userPointsLimit.value = String(customization.itemLimit);
  }
});
let refreshingPanelSession = false;
socket.on("connect_error", async () => {
  if (!window.TikTokraftAuth?.accessToken) return;
  if (!refreshingPanelSession && await (async () => {
    refreshingPanelSession = true;
    try { return await window.TikTokraftAuth?.refresh?.(); } finally { refreshingPanelSession = false; }
  })()) {
    socket.auth.token = window.TikTokraftAuth.accessToken;
    socket.connect();
    return;
  }
  toast("Se perdió la conexión con el panel local.", "error");
});
socket.on("mapping:sound", (data) => playSound(data?.audio));
socket.on("media-catalog:update", async () => {
  await Promise.all([loadSounds(), loadVideos()]);
  if (elements.adminMediaView && !elements.adminMediaView.hidden) {
    try { await loadAdminMedia(); } catch (error) { toast(error.message, "error"); }
  }
});
void (async () => {
  await loadPanelState();
  // La lista está protegida por autenticación. Esperar a que el estado del
  // panel renueve una sesión vencida evita dejar el selector vacío tras un
  // despliegue o una recarga con un token antiguo.
  await loadSounds();
  await loadVideos();
  socket.auth.token = window.TikTokraftAuth?.accessToken || "";
  socket.connect();
})();
