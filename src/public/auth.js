(() => {
  const storageKey = "tiktokraft-session";
  const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
  const recoveryParams = new URLSearchParams(location.hash.replace(/^#/, ""));
  const recoveryToken = recoveryParams.get("type") === "recovery" ? recoveryParams.get("access_token") || "" : "";
  const recoveryError = recoveryParams.get("error_description") || "";
  window.TikTokraftAuth = {
    accessToken: saved?.access_token || "",
    refreshToken: saved?.refresh_token || "",
    signOut() {
      this.accessToken = "";
      this.refreshToken = "";
      localStorage.removeItem(storageKey);
    },
    async refresh() {
      if (!this.refreshToken) return false;
      const response = await fetch("/api/auth/refresh", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ refresh_token: this.refreshToken }) });
      if (!response.ok) return false;
      const session = await response.json();
      if (!session.access_token) return false;
      this.accessToken = session.access_token;
      this.refreshToken = session.refresh_token || this.refreshToken;
      localStorage.setItem(storageKey, JSON.stringify(session));
      return true;
    }
  };
  if (window.TikTokraftAuth.accessToken && !recoveryToken && !recoveryError) return;

  const modal = document.createElement("div");
  modal.className = "auth-gate";
  document.body.append(modal);

  async function submit(path, data, accessToken = "") {
    const headers = { "Content-Type": "application/json" };
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    const response = await fetch(path, { method: "POST", headers, body: JSON.stringify(data) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "No se pudo completar la solicitud.");
    return result;
  }

  function clearRecoveryUrl() {
    history.replaceState(null, "", `${location.pathname}${location.search}`);
  }

  function renderLogin(initialMessage = "", initialEmail = "") {
    modal.innerHTML = `<form class="auth-dialog"><h1>TikTokraft <em>Live</em></h1><p>Inicia sesión o crea una cuenta gratis para explorar la aplicación.</p><label>Email<input name="email" type="email" required autocomplete="email" /></label><label>Contraseña<input name="password" type="password" minlength="6" required autocomplete="current-password" /></label><button class="auth-forgot" type="button">Olvidé mi contraseña</button><small class="auth-message"></small><div><button class="button primary" type="submit">Iniciar sesión</button><button class="button text auth-create" type="button">Crear cuenta gratis</button></div></form>`;
    const form = modal.querySelector("form");
    const message = modal.querySelector(".auth-message");
    const create = modal.querySelector(".auth-create");
    const forgot = modal.querySelector(".auth-forgot");
    form.elements.email.value = initialEmail;
    message.textContent = initialMessage;
    if (/actualizada|enviamos/i.test(initialMessage)) message.classList.add("success");
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      message.className = "auth-message";
      message.textContent = "";
      try {
        const data = Object.fromEntries(new FormData(form));
        const session = await submit("/api/auth/signin", data);
        if (!session.access_token) throw new Error("Confirma tu email y vuelve a iniciar sesión.");
        localStorage.setItem(storageKey, JSON.stringify(session));
        location.reload();
      } catch (error) { message.textContent = error.message; }
    });
    create.addEventListener("click", async () => {
      message.className = "auth-message";
      message.textContent = "";
      if (!form.reportValidity()) return;
      create.disabled = true;
      try {
        const data = Object.fromEntries(new FormData(form));
        const result = await submit("/api/auth/signup", data);
        if (result.access_token) { localStorage.setItem(storageKey, JSON.stringify(result)); location.reload(); }
        else { message.classList.add("success"); message.textContent = "Cuenta gratuita creada. Confirma el email y luego inicia sesión."; }
      } catch (error) { message.textContent = error.message; }
      finally { create.disabled = false; }
    });
    forgot.addEventListener("click", () => renderRecoveryRequest(form.elements.email.value));
  }

  function renderRecoveryRequest(initialEmail = "") {
    modal.innerHTML = `<form class="auth-dialog"><h1>Recupera tu <em>cuenta</em></h1><p>Escribe tu correo y te enviaremos un enlace seguro para crear una contraseña nueva.</p><label>Email<input name="email" type="email" required autocomplete="email" /></label><small class="auth-message"></small><div><button class="button primary" type="submit">Enviar enlace</button><button class="button text auth-back" type="button">Volver a iniciar sesión</button></div></form>`;
    const form = modal.querySelector("form");
    const message = modal.querySelector(".auth-message");
    const submitButton = form.querySelector("button[type=submit]");
    form.elements.email.value = initialEmail;
    form.querySelector(".auth-back").addEventListener("click", () => renderLogin("", form.elements.email.value));
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      message.className = "auth-message";
      message.textContent = "";
      submitButton.disabled = true;
      try {
        await submit("/api/auth/recover", { email: form.elements.email.value });
        message.classList.add("success");
        message.textContent = "Si el correo está registrado, recibirás el enlace de recuperación. Revisa también Spam.";
      } catch (error) { message.textContent = error.message; }
      finally { submitButton.disabled = false; }
    });
  }

  function renderNewPassword(accessToken) {
    window.TikTokraftAuth.signOut();
    modal.innerHTML = `<form class="auth-dialog"><h1>Crea una contraseña <em>nueva</em></h1><p>El enlace fue validado. Escribe y confirma tu contraseña nueva.</p><label>Nueva contraseña<input name="password" type="password" minlength="6" required autocomplete="new-password" /></label><label>Confirmar contraseña<input name="confirmation" type="password" minlength="6" required autocomplete="new-password" /></label><small class="auth-message"></small><div><button class="button primary" type="submit">Guardar contraseña</button></div></form>`;
    const form = modal.querySelector("form");
    const message = modal.querySelector(".auth-message");
    const submitButton = form.querySelector("button[type=submit]");
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      message.textContent = "";
      if (form.elements.password.value !== form.elements.confirmation.value) {
        message.textContent = "Las contraseñas no coinciden.";
        return;
      }
      submitButton.disabled = true;
      try {
        await submit("/api/auth/password", { password: form.elements.password.value }, accessToken);
        clearRecoveryUrl();
        renderLogin("Contraseña actualizada. Ya puedes iniciar sesión.");
      } catch (error) { message.textContent = error.message; }
      finally { submitButton.disabled = false; }
    });
  }

  if (recoveryToken) renderNewPassword(recoveryToken);
  else {
    if (recoveryError) clearRecoveryUrl();
    renderLogin(recoveryError ? "El enlace de recuperación no es válido o ya expiró. Solicita uno nuevo." : "");
  }
})();
