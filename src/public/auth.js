(() => {
  const storageKey = "tiktokraft-session";
  const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
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
  if (window.TikTokraftAuth.accessToken) return;
  const modal = document.createElement("div");
  modal.className = "auth-gate";
  modal.innerHTML = `<form class="auth-dialog"><h1>TikTokraft <em>Live</em></h1><p>Inicia sesión para abrir tu espacio privado.</p><label>Email<input name="email" type="email" required autocomplete="email" /></label><label>Contraseña<input name="password" type="password" minlength="6" required autocomplete="current-password" /></label><small class="auth-message"></small><div><button class="button primary" type="submit">Iniciar sesión</button><button class="button text" type="button">Crear cuenta</button></div></form>`;
  document.body.append(modal);
  const form = modal.querySelector("form"), message = modal.querySelector("small"), create = modal.querySelector("button[type=button]");
  async function submit(path) { const data = Object.fromEntries(new FormData(form)); const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }); const result = await response.json(); if (!response.ok) throw new Error(result.error || "No se pudo iniciar sesión."); return result; }
  form.addEventListener("submit", async (event) => { event.preventDefault(); message.textContent = ""; try { const session = await submit("/api/auth/signin"); if (!session.access_token) throw new Error("Confirma tu email y vuelve a iniciar sesión."); localStorage.setItem(storageKey, JSON.stringify(session)); location.reload(); } catch (error) { message.textContent = error.message; } });
  create.addEventListener("click", async () => { message.textContent = ""; try { const result = await submit("/api/auth/signup"); if (result.access_token) { localStorage.setItem(storageKey, JSON.stringify(result)); location.reload(); } else message.textContent = "Cuenta creada. Confirma el email y luego inicia sesión."; } catch (error) { message.textContent = error.message; } });
})();
