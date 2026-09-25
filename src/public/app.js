const socket = io({ autoConnect: false, auth: { token: window.TikTokraftAuth?.accessToken || "" } });
let appState = null;
let hiddenActivity = false;
let userPointsSearch = "";
let userPointsSearchTimer = null;
let userPointsOverlayToken = "";
let giftCatalog = [];
let giftCatalogSearch = "";
let authorizedTikTokUsers = [];
let authorizedTikTokSearch = "";
let accountRoles = [];
let accountRolesSearch = "";
let statisticsAccounts = [];
let connectedStatisticsAccounts = [];
let statisticsSearch = "";
let statisticsProfileOrigin = "registered";
const giftNamesById = window.TIKTOK_GIFT_NAMES || {};

const $ = (selector) => document.querySelector(selector);
const elements = {
  settings: $("#settings-form"),
  tiktokUsername: $("#tiktok-live-username"), eulerStreamApiKey: $("#euler-stream-api-key"), eulerKeyState: $("#euler-key-state"),
  serverTapHost: $("#servertap-host"), serverTapPort: $("#servertap-port"), serverTapProtocol: $("#servertap-protocol"),
  serverTapKey: $("#servertap-key"),
  keyState: $("#key-state"),
  ttsSettings: $("#tts-settings-form"), ttsEnabled: $("#tts-enabled"), ttsLanguage: $("#tts-language"), ttsVolume: $("#tts-volume"), ttsVolumeValue: $("#tts-volume-value"),
  ttsStop: $("#tts-stop"), ttsResume: $("#tts-resume"),
  voiceTester: $("#voice-tester-form"), voiceTesterText: $("#voice-tester-text"), ttsSpeed: $("#tts-speed"), ttsPitch: $("#tts-pitch"),
  allowedUsers: $("#allowed-users-form"), allowAllUsers: $("#tts-allow-all-users"), allowFollowers: $("#tts-allow-followers"), allowSubscribers: $("#tts-allow-subscribers"), allowModerators: $("#tts-allow-moderators"), allowTeamMembers: $("#tts-allow-team-members"), teamMembersMinLevel: $("#tts-team-members-min-level"), allowTopGifters: $("#tts-allow-top-gifters"), topGiftersTop: $("#tts-top-gifters-top"), allowList: $("#tts-allow-list"), manageAllowedUsers: $("#manage-allowed-users"), allowedUsersListEditor: $("#allowed-users-list-editor"), allowedUsernames: $("#tts-allowed-usernames"),
  goalsToggle: $("#goals-toggle"), goalsPanel: $("#goals-panel"), goalCards: [...document.querySelectorAll(".goal-card")],
  rankingsToggle: $("#rankings-toggle"), rankingsPanel: $("#rankings-panel"), rankingOverlayCards: [...document.querySelectorAll(".ranking-overlay-option")],
  userPointsToggle: $("#user-points-toggle"), userPointsPanel: $("#user-points-panel"), userPointsSearch: $("#user-points-search"), userPointsList: $("#user-points-list"), userPointsEmpty: $("#user-points-empty"), userPointsStatus: $("#user-points-status"), userPointsAdd: $("#user-points-add"), userPointsUrl: $("#user-points-overlay-url"), userPointsCopy: $("#user-points-overlay-copy"), userPointsPreview: $("#user-points-overlay-preview"), userPointsLimit: $("#user-points-overlay-limit"), userPointsLimitForm: $("#user-points-overlay-form"), transactionModal: $("#user-points-transaction-modal"), transactionForm: $("#user-points-transaction-form"), transactionUser: $("#user-points-transaction-user"), transactionUsers: $("#user-points-known-users"), transactionCoins: $("#user-points-transaction-coins"), transactionDescription: $("#user-points-transaction-description"),
  giftOverlaysToggle: $("#gift-overlays-toggle"), giftOverlaysPanel: $("#gift-overlays-panel"), giftOverlaysForm: $("#gift-overlays-form"), giftOverlaysResetOnLive: $("#gift-overlays-reset-on-live"), giftOverlaysResetNow: $("#gift-overlays-reset-now"), giftOverlayCards: [...document.querySelectorAll(".gift-overlay-option")],
  customizationModal: $("#overlay-customization-modal"), customizationForm: $("#overlay-customization-form"), customizationTitle: $("#overlay-customization-title"), customizationFontFamily: $("#customization-font-family"), customizationFontSize: $("#customization-font-size"), customizationLineSpacing: $("#customization-line-spacing"), customizationLetterSpacing: $("#customization-letter-spacing"), customizationTextColor: $("#customization-text-color"), customizationValueColor: $("#customization-value-color"), customizationRankColor: $("#customization-rank-color"), customizationTextEffect: $("#customization-text-effect"), customizationWave: $("#customization-wave"), customizationBackground: $("#customization-background"), customizationBackgroundColor: $("#customization-background-color"), customizationShowRank: $("#customization-show-rank"), customizationShowValue: $("#customization-show-value"), customizationAlignRight: $("#customization-align-right"), customizationCrown: $("#customization-crown"), userPointsCustomizationLimit: $("#user-points-customization-limit"), giftCustomizationTitle: $("#gift-customization-title"), giftCustomizationTitleSize: $("#gift-customization-title-size"), giftCustomizationTitleColor: $("#gift-customization-title-color"), giftCustomizationUsernameColor: $("#gift-customization-username-color"), giftCustomizationUsernameSize: $("#gift-customization-username-size"), giftCustomizationTitleOffset: $("#gift-customization-title-offset"), giftCustomizationImageOffset: $("#gift-customization-image-offset"), giftCustomizationUsernameOffset: $("#gift-customization-username-offset"), giftCustomizationCoinsOffset: $("#gift-customization-coins-offset"), giftCustomizationBorder: $("#gift-customization-border"), giftCustomizationBorderColor: $("#gift-customization-border-color"), giftCustomizationImageVisible: $("#gift-customization-image-visible"), giftCustomizationImageOpacity: $("#gift-customization-image-opacity"), giftCustomizationTitleEffect: $("#gift-customization-title-effect"), giftCustomizationTitleWave: $("#gift-customization-title-wave"), giftCustomizationUsernameEffect: $("#gift-customization-username-effect"), giftCustomizationUsernameWave: $("#gift-customization-username-wave"), giftCustomizationShowCoins: $("#gift-customization-show-coins"), giftCustomizationCoinsAlias: $("#gift-customization-coins-alias"),
  minecraftDetail: $("#minecraft-detail"), minecraftDot: $("#minecraft-dot"),
  tiktokDetail: $("#tiktok-detail"), tiktokDot: $("#tiktok-dot"),
  globalStatus: $("#global-status"), adminPanelButton: $("#admin-panel-button"), profileButton: $("#profile-button"), logout: $("#logout-button"),
  adminModal: $("#admin-modal"), adminMenuView: $("#admin-menu-view"), adminAuthorizationView: $("#admin-authorization-view"), adminRolesView: $("#admin-roles-view"), adminStatisticsView: $("#admin-statistics-view"), adminRegisteredUsersView: $("#admin-registered-users-view"), adminConnectedUsersView: $("#admin-connected-users-view"), adminUserProfileView: $("#admin-user-profile-view"), adminOpenAuthorization: $("#admin-open-authorization"), adminOpenRoles: $("#admin-open-roles"), adminOpenStatistics: $("#admin-open-statistics"), adminBackMenu: $("#admin-back-menu"), adminRolesBackMenu: $("#admin-roles-back-menu"), adminStatisticsBackMenu: $("#admin-statistics-back-menu"), adminOpenRegisteredUsers: $("#admin-open-registered-users"), adminOpenConnectedUsers: $("#admin-open-connected-users"), adminRegisteredUsersBack: $("#admin-registered-users-back"), adminConnectedUsersBack: $("#admin-connected-users-back"), adminRegisteredUsersSearch: $("#admin-registered-users-search"), adminRegisteredUsersList: $("#admin-registered-users-list"), adminRegisteredUsersEmpty: $("#admin-registered-users-empty"), adminConnectedUsersList: $("#admin-connected-users-list"), adminConnectedUsersEmpty: $("#admin-connected-users-empty"), adminRegisteredUsersCount: $("#admin-registered-users-count"), adminConnectedUsersCount: $("#admin-connected-users-count"), adminUserProfileBack: $("#admin-user-profile-back"), adminUserProfileTitle: $("#admin-user-profile-title"), adminUserProfileData: $("#admin-user-profile-data"), adminAuthorizedForm: $("#admin-authorized-form"), adminAuthorizedUsername: $("#admin-authorized-username"), adminAuthorizedSearch: $("#admin-authorized-search"), adminAuthorizedList: $("#admin-authorized-list"), adminAuthorizedEmpty: $("#admin-authorized-empty"), adminRolesForm: $("#admin-roles-form"), adminRoleEmail: $("#admin-role-email"), adminRoleSelect: $("#admin-role-select"), adminRolesSearch: $("#admin-roles-search"), adminRolesList: $("#admin-roles-list"), adminRolesEmpty: $("#admin-roles-empty"),
  profileModal: $("#profile-modal"), profileForm: $("#profile-form"), profileAvatar: $("#profile-avatar"), profileAvatarEmpty: $("#profile-avatar-empty"), profileAvatarInput: $("#profile-avatar-input"), profileEmail: $("#profile-email"), profilePassword: $("#profile-password"), profilePasswordConfirm: $("#profile-password-confirm"), profileMessage: $("#profile-message"),
  mappingForm: $("#mapping-form"), mappingId: $("#mapping-id"), giftName: $("#gift-name"), giftId: $("#gift-id"),
  command: $("#mapping-command"), audio: $("#mapping-audio"), audioTest: $("#audio-test"), audioState: $("#audio-state"), cooldown: $("#cooldown"), enabled: $("#mapping-enabled"), editorHeading: $("#editor-heading"),
  cancelEdit: $("#cancel-edit"), mappingList: $("#mapping-list"), mappingEmpty: $("#mapping-empty"), selectGiftButton: $("#select-gift-button"), giftSelectorModal: $("#gift-selector-modal"), giftSelectorSearch: $("#gift-selector-search"), giftSelectorGrid: $("#gift-selector-grid"), giftSelectorEmpty: $("#gift-selector-empty"),
  simulateForm: $("#simulate-form"), simulateGift: $("#simulate-gift"), simulateCount: $("#simulate-count"),
  giftHistoryList: $("#gift-history-list"), giftHistoryEmpty: $("#gift-history-empty"),
  activityLog: $("#activity-log"), activityEmpty: $("#activity-empty"), toasts: $("#toasts")
};
elements.logout?.addEventListener("click", () => {
  window.TikTokraftAuth?.signOut?.();
  socket.disconnect();
  location.reload();
});
elements.profileButton?.addEventListener("click", openProfileModal);
elements.profileModal?.querySelectorAll("[data-profile-modal-close]").forEach((button) => button.addEventListener("click", closeProfileModal));
elements.adminPanelButton?.addEventListener("click", openAdminPanel);
elements.adminModal?.querySelectorAll("[data-admin-modal-close]").forEach((button) => button.addEventListener("click", closeAdminPanel));
elements.adminOpenAuthorization?.addEventListener("click", openAuthorizationPanel);
elements.adminOpenRoles?.addEventListener("click", openRolesPanel);
elements.adminOpenStatistics?.addEventListener("click", openStatisticsPanel);
elements.adminBackMenu?.addEventListener("click", showAdminMenu);
elements.adminRolesBackMenu?.addEventListener("click", showAdminMenu);
elements.adminStatisticsBackMenu?.addEventListener("click", showAdminMenu);
elements.adminOpenRegisteredUsers?.addEventListener("click", openRegisteredUsers);
elements.adminOpenConnectedUsers?.addEventListener("click", openConnectedUsers);
elements.adminRegisteredUsersBack?.addEventListener("click", openStatisticsPanel);
elements.adminConnectedUsersBack?.addEventListener("click", openStatisticsPanel);
elements.adminUserProfileBack?.addEventListener("click", () => statisticsProfileOrigin === "connected" ? openConnectedUsers() : openRegisteredUsers());
elements.adminAuthorizedSearch?.addEventListener("input", () => { authorizedTikTokSearch = elements.adminAuthorizedSearch.value.trim(); renderAuthorizedTikTokUsers(); });
elements.adminRolesSearch?.addEventListener("input", () => { accountRolesSearch = elements.adminRolesSearch.value.trim(); renderAccountRoles(); });
elements.adminRegisteredUsersSearch?.addEventListener("input", () => { statisticsSearch = elements.adminRegisteredUsersSearch.value.trim(); renderRegisteredUsers(); });
elements.adminAuthorizedForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const username = elements.adminAuthorizedUsername.value.trim();
  if (!username) return toast("Escribe un nombre de usuario de TikTok.", "error");
  const submit = event.submitter;
  submit.disabled = true;
  try {
    const saved = await request("admin:authorized-tiktok:add", { username });
    const index = authorizedTikTokUsers.findIndex((entry) => entry.username === saved.username);
    if (index >= 0) authorizedTikTokUsers[index] = saved;
    else authorizedTikTokUsers.push(saved);
    elements.adminAuthorizedUsername.value = "";
    renderAuthorizedTikTokUsers();
    toast(`@${saved.username} autorizado`, "success");
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
    toast(`${saved.email} ahora tiene el rol ADMINISTRADOR.`, "success");
  } catch (error) { toast(error.message, "error"); } finally { submit.disabled = false; }
});
elements.selectGiftButton?.addEventListener("click", openGiftSelector);
elements.giftSelectorModal?.querySelectorAll("[data-gift-selector-close]").forEach((button) => button.addEventListener("click", closeGiftSelector));
elements.giftSelectorSearch?.addEventListener("input", () => { giftCatalogSearch = elements.giftSelectorSearch.value.trim(); renderGiftSelector(); });
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
let profileAvatarData = "";
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

function request(event, payload) {
  return new Promise((resolve, reject) => {
    socket.emit(event, payload, (result) => result?.ok ? resolve(result.data) : reject(new Error(result?.error || "No se pudo completar la acción.")));
  });
}

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
}

function openAuthorizationPanel() {
  elements.adminMenuView.hidden = true;
  elements.adminAuthorizationView.hidden = false;
  elements.adminRolesView.hidden = true;
  elements.adminStatisticsView.hidden = true;
  elements.adminRegisteredUsersView.hidden = true;
  elements.adminConnectedUsersView.hidden = true;
  elements.adminUserProfileView.hidden = true;
  elements.adminAuthorizedUsername.focus();
}

async function openRolesPanel() {
  elements.adminMenuView.hidden = true;
  elements.adminAuthorizationView.hidden = true;
  elements.adminRolesView.hidden = false;
  elements.adminStatisticsView.hidden = true;
  elements.adminRegisteredUsersView.hidden = true;
  elements.adminConnectedUsersView.hidden = true;
  elements.adminUserProfileView.hidden = true;
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
  authorizedTikTokSearch = "";
  elements.adminAuthorizedSearch.value = "";
  showAdminMenu();
  elements.adminModal.hidden = false;
  document.body.classList.add("modal-open");
  try {
    authorizedTikTokUsers = await request("admin:authorized-tiktok:list", null);
    renderAuthorizedTikTokUsers();
  } catch (error) {
    toast(error.message, "error");
    closeAdminPanel();
  }
}

function renderAuthorizedTikTokUsers() {
  const search = authorizedTikTokSearch.toLocaleLowerCase();
  const entries = authorizedTikTokUsers
    .filter((entry) => String(entry.username || "").toLocaleLowerCase().includes(search))
    .sort((left, right) => String(left.username || "").localeCompare(String(right.username || ""), "es"));
  elements.adminAuthorizedList.replaceChildren();
  for (const entry of entries) {
    const row = document.createElement("div");
    row.className = "admin-authorized-row";
    const user = document.createElement("strong");
    user.textContent = `@${entry.username}`;
    const added = document.createElement("small");
    added.textContent = entry.addedAt ? `Autorizado ${new Date(entry.addedAt).toLocaleDateString("es-CO")}` : "Autorizado";
    const remove = document.createElement("button");
    remove.className = "button text danger";
    remove.type = "button";
    remove.textContent = "Revocar";
    remove.addEventListener("click", async () => {
      remove.disabled = true;
      try {
        await request("admin:authorized-tiktok:remove", { username: entry.username });
        authorizedTikTokUsers = authorizedTikTokUsers.filter((item) => item.username !== entry.username);
        renderAuthorizedTikTokUsers();
        toast(`@${entry.username} revocado`, "success");
      } catch (error) { toast(error.message, "error"); } finally { remove.disabled = false; }
    });
    const copy = document.createElement("span");
    copy.append(user, added);
    row.append(copy, remove);
    elements.adminAuthorizedList.append(row);
  }
  elements.adminAuthorizedEmpty.hidden = entries.length > 0;
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
    permissions.textContent = entry.role === "administrator" ? "Gestiona roles y autorizaciones de TikTok LIVE." : "Usuario normal.";
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
        if (!window.confirm(`¿Quitar el rol de ADMINISTRADOR a ${entry.email}? Esta cuenta volverá a ser un usuario normal.`)) return;
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
  const row = document.createElement("button");
  row.className = "admin-statistics-row";
  row.type = "button";
  const detail = document.createElement("span");
  const email = document.createElement("strong");
  email.textContent = account.email;
  const tiktok = document.createElement("small");
  tiktok.textContent = account.tiktokUsername ? `TikTok: @${account.tiktokUsername}` : "TikTok: sin configurar";
  detail.append(email, tiktok);
  const status = document.createElement("b");
  status.className = account.tiktokStatus === "connected" ? "admin-status-live" : account.active ? "admin-status-panel" : "admin-status-idle";
  status.textContent = account.status;
  row.append(detail, status);
  row.addEventListener("click", () => openAdministrativeUserProfile(account.userId, origin));
  return row;
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
  giftCatalog = Array.isArray(next.giftCatalog) ? next.giftCatalog : giftCatalog;
  if (!elements.giftSelectorModal.hidden) renderGiftSelector();
  renderGiftOverlays(config.giftOverlays || {});
  renderRankingOverlay({ kind: "top-donors", title: "Top Donadores", entries: next.rankings?.topDonors || [] });
  renderUserPoints(next.userPoints?.entries || [], next.userPoints?.configured);
  renderGoals(config.goals || []);
  renderGiftHistory(next.giftHistory || []);
  if (!hiddenActivity) renderActivity(next.activity || []);
}

function numberFormat(value) {
  return new Intl.NumberFormat("es-CO").format(Math.max(0, Number(value) || 0));
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
  const isBestStreak = key === "gift:best-streak";
  elements.customizationModal.dataset.variant = isGiftOverlay ? "gift" : (isUserPointsOverlay ? "user-points" : "default");
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

function closeGiftSelector() {
  elements.giftSelectorModal.hidden = true;
  document.body.classList.remove("modal-open");
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
      elements.giftName.value = String(gift.giftName || "");
      elements.giftId.value = String(gift.giftId || "");
      closeGiftSelector();
      elements.command.focus();
    });
    elements.giftSelectorGrid.append(card);
  }
  elements.giftSelectorEmpty.hidden = entries.length > 0;
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
    const response = await fetch("/api/sounds", { headers: { Authorization: `Bearer ${window.TikTokraftAuth?.accessToken || ""}` } });
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
elements.ttsStop.addEventListener("click", () => ttsQueue.pause());
elements.ttsResume.addEventListener("click", () => ttsQueue.resume());
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
  if (event.key !== "Escape") return;
  if (!elements.adminModal.hidden) closeAdminPanel();
  else if (!elements.profileModal.hidden) closeProfileModal();
  else if (!elements.transactionModal.hidden) closeTransactionModal();
  else if (!elements.customizationModal.hidden) closeCustomization();
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
socket.on("gift-history:update", (gifts) => {
  if (appState) appState.giftHistory = Array.isArray(gifts) ? gifts : [];
  renderGiftHistory(gifts);
});
socket.on("gift-catalog:update", (gifts) => {
  giftCatalog = Array.isArray(gifts) ? gifts : [];
  if (appState) appState.giftCatalog = giftCatalog;
  if (!elements.giftSelectorModal.hidden) renderGiftSelector();
});
socket.on("gift-catalog:upsert", (gift) => {
  if (!gift?.giftId) return;
  const index = giftCatalog.findIndex((entry) => String(entry.giftId) === String(gift.giftId));
  if (index >= 0) giftCatalog[index] = { ...giftCatalog[index], ...gift };
  else giftCatalog.unshift(gift);
  if (appState) appState.giftCatalog = giftCatalog;
  if (!elements.giftSelectorModal.hidden) renderGiftSelector();
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
loadSounds();
void (async () => {
  await loadPanelState();
  socket.auth.token = window.TikTokraftAuth?.accessToken || "";
  socket.connect();
})();
