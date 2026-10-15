(() => {
  const root = document.querySelector("#workspace-gifts-panel");
  if (!root) return;

  const search = root.querySelector("#gift-browser-search");
  const sort = root.querySelector("#gift-browser-sort");
  const grid = root.querySelector("#gift-browser-grid");
  const empty = root.querySelector("#gift-browser-empty");
  const more = root.querySelector("#gift-browser-more");
  const count = root.querySelector("#gift-browser-count");
  const preview = root.querySelector("#gift-browser-preview-body");
  const download = root.querySelector("#gift-browser-download");
  const downloadStatus = root.querySelector("#gift-browser-download-status");
  const syncButton = root.querySelector("#gift-browser-sync");
  const syncStatus = root.querySelector("#gift-browser-sync-status");
  const favoriteKey = "tiktokraft:favorite-gifts";
  let favorites;
  try { favorites = new Set(JSON.parse(localStorage.getItem(favoriteKey) || "[]").map(String)); }
  catch { favorites = new Set(); }
  let entries = [];
  let selectedId = "";
  let type = "all";
  let price = "all";
  let visibleLimit = 120;
  let loading = false;

  function setSyncStatus(next) {
    const status = String(next?.status || "idle");
    syncStatus.textContent = String(next?.detail || "");
    syncStatus.dataset.status = status;
    syncButton.disabled = status === "loading";
    syncButton.textContent = status === "loading" ? "Consultando…" : "↻ Sincronizar LIVE";
  }

  function imageUrl(value) {
    try {
      const url = new URL(String(value || ""));
      return url.protocol === "https:" ? url.href : "";
    } catch { return ""; }
  }

  function normalize(raw) {
    const giftId = String(raw?.giftId || "").trim();
    if (!giftId) return null;
    return {
      giftId,
      giftName: String(raw.giftName || window.TIKTOK_GIFT_NAMES?.[giftId] || `Regalo #${giftId}`).trim(),
      coinValue: Math.max(0, Number(raw.coinValue) || 0),
      giftImageUrl: imageUrl(raw.giftImageUrl),
      lastSeenAt: String(raw.lastSeenAt || "")
    };
  }

  function setEntries(next) {
    const byId = new Map();
    for (const raw of Array.isArray(next) ? next : []) {
      const gift = normalize(raw);
      if (gift) byId.set(gift.giftId, gift);
    }
    entries = [...byId.values()];
    if (!entries.some((gift) => gift.giftId === selectedId)) selectedId = entries[0]?.giftId || "";
    if (!root.hidden) render();
  }

  function inPriceRange(gift) {
    const value = gift.coinValue;
    if (price === "all") return true;
    if (value <= 0) return false;
    if (price === "1000+") return value >= 1000;
    const [minimum, maximum] = price.split("-").map(Number);
    return value >= minimum && value <= maximum;
  }

  function filtered() {
    const query = search.value.trim().toLocaleLowerCase("es");
    const matches = entries.filter((gift) => {
      if (type === "favorites" && !favorites.has(gift.giftId)) return false;
      if (type === "basic" && (gift.coinValue < 1 || gift.coinValue > 99)) return false;
      if (type === "premium" && gift.coinValue < 1000) return false;
      if (type === "images" && !gift.giftImageUrl) return false;
      if (!inPriceRange(gift)) return false;
      return !query || `${gift.giftName} ${gift.giftId} ${gift.coinValue}`.toLocaleLowerCase("es").includes(query);
    });
    if (sort.value === "name") matches.sort((a, b) => a.giftName.localeCompare(b.giftName, "es"));
    else if (sort.value === "price-asc") matches.sort((a, b) => a.coinValue - b.coinValue || a.giftName.localeCompare(b.giftName, "es"));
    else if (sort.value === "price-desc") matches.sort((a, b) => b.coinValue - a.coinValue || a.giftName.localeCompare(b.giftName, "es"));
    else matches.sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt) || a.giftName.localeCompare(b.giftName, "es"));
    return matches;
  }

  function visual(gift, className) {
    const box = document.createElement("span");
    box.className = className;
    if (!gift.giftImageUrl) { box.textContent = "✦"; return box; }
    const img = document.createElement("img");
    img.src = gift.giftImageUrl;
    img.alt = "";
    img.loading = "lazy";
    img.referrerPolicy = "no-referrer";
    img.addEventListener("error", () => { img.remove(); box.textContent = "✦"; }, { once: true });
    box.append(img);
    return box;
  }

  function renderPreview() {
    const gift = entries.find((entry) => entry.giftId === selectedId);
    preview.replaceChildren();
    downloadStatus.textContent = "";
    download.disabled = !gift?.giftImageUrl;
    if (!gift) {
      const note = document.createElement("span");
      note.className = "gift-browser-preview-placeholder";
      note.textContent = "Selecciona un regalo para verlo aquí.";
      preview.append(note);
      return;
    }
    const title = document.createElement("strong");
    title.textContent = gift.giftName;
    const details = document.createElement("dl");
    for (const [label, value] of [
      ["ID", gift.giftId],
      ["Diamantes", gift.coinValue > 0 ? gift.coinValue.toLocaleString("es-CO") : "Sin dato"],
      ["Imagen", gift.giftImageUrl ? "Disponible" : "No disponible"]
    ]) {
      const dt = document.createElement("dt");
      const dd = document.createElement("dd");
      dt.textContent = label;
      dd.textContent = value;
      details.append(dt, dd);
    }
    preview.append(visual(gift, "gift-browser-preview-image"), title, details);
    if (!gift.giftImageUrl) downloadStatus.textContent = "Este regalo aún no tiene imagen registrada.";
  }

  function renderCard(gift) {
    const card = document.createElement("article");
    card.className = `gift-browser-card${gift.giftId === selectedId ? " is-selected" : ""}`;
    const main = document.createElement("button");
    main.type = "button";
    main.className = "gift-browser-card-main";
    main.setAttribute("aria-label", `Ver ${gift.giftName}, ${gift.coinValue || "precio desconocido"} diamantes`);
    const name = document.createElement("span");
    name.className = "gift-browser-card-name";
    name.textContent = gift.giftName;
    const cost = document.createElement("span");
    cost.className = `gift-browser-card-price${gift.coinValue ? "" : " is-unknown"}`;
    cost.textContent = gift.coinValue ? `${gift.coinValue.toLocaleString("es-CO")} ♢` : "— ♢";
    main.append(visual(gift, "gift-browser-card-image"), name, cost);
    main.addEventListener("click", () => {
      selectedId = gift.giftId;
      grid.querySelector(".gift-browser-card.is-selected")?.classList.remove("is-selected");
      card.classList.add("is-selected");
      renderPreview();
    });
    const favorite = document.createElement("button");
    favorite.type = "button";
    favorite.className = "gift-browser-favorite";
    favorite.textContent = favorites.has(gift.giftId) ? "♥" : "♡";
    favorite.setAttribute("aria-label", `${favorites.has(gift.giftId) ? "Quitar" : "Añadir"} ${gift.giftName} ${favorites.has(gift.giftId) ? "de" : "a"} favoritos`);
    favorite.setAttribute("aria-pressed", String(favorites.has(gift.giftId)));
    favorite.addEventListener("click", () => {
      if (favorites.has(gift.giftId)) favorites.delete(gift.giftId); else favorites.add(gift.giftId);
      try { localStorage.setItem(favoriteKey, JSON.stringify([...favorites])); } catch { /* El catálogo sigue usable sin almacenamiento local. */ }
      render();
    });
    card.append(main, favorite);
    return card;
  }

  function render() {
    const counts = {
      all: entries.length,
      favorites: entries.filter((gift) => favorites.has(gift.giftId)).length,
      basic: entries.filter((gift) => gift.coinValue >= 1 && gift.coinValue <= 99).length,
      premium: entries.filter((gift) => gift.coinValue >= 1000).length,
      images: entries.filter((gift) => gift.giftImageUrl).length
    };
    for (const [key, value] of Object.entries(counts)) root.querySelector(`#gift-browser-count-${key}`).textContent = value.toLocaleString("es-CO");
    const matches = filtered();
    count.textContent = `${matches.length.toLocaleString("es-CO")} / ${entries.length.toLocaleString("es-CO")} regalos`;
    empty.hidden = matches.length > 0;
    empty.textContent = entries.length ? "No hay regalos que coincidan con estos filtros." : "Aún no hay regalos registrados. Conecta tu LIVE para consultar los regalos disponibles en tu sala.";
    grid.replaceChildren(...matches.slice(0, visibleLimit).map(renderCard));
    more.hidden = matches.length <= visibleLimit;
    if (!matches.some((gift) => gift.giftId === selectedId)) selectedId = matches[0]?.giftId || "";
    renderPreview();
  }

  async function open() {
    render();
    if (loading || !window.TikTokraftAuth?.accessToken) return;
    loading = true;
    try {
      const response = await fetch("/api/gift-catalog?limit=2000", { headers: { Authorization: `Bearer ${window.TikTokraftAuth.accessToken}` } });
      if (!response.ok) throw new Error("No se pudo actualizar el catálogo.");
      const data = await response.json();
      setEntries(data.entries);
    } catch (error) {
      downloadStatus.textContent = error.message;
    } finally { loading = false; }
  }

  async function downloadPng() {
    const gift = entries.find((entry) => entry.giftId === selectedId);
    if (!gift?.giftImageUrl) return;
    download.disabled = true;
    downloadStatus.textContent = "Preparando PNG…";
    try {
      const response = await fetch(`/api/gift-catalog/${encodeURIComponent(gift.giftId)}/image`, { headers: { Authorization: `Bearer ${window.TikTokraftAuth?.accessToken || ""}` } });
      if (!response.ok) throw new Error("No se pudo descargar la imagen de este regalo.");
      const blob = await response.blob();
      const bitmap = await createImageBitmap(blob);
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      canvas.getContext("2d").drawImage(bitmap, 0, 0);
      bitmap.close?.();
      const png = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!png) throw new Error("El navegador no pudo convertir esta imagen a PNG.");
      const url = URL.createObjectURL(png);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${gift.giftName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").slice(0, 50) || "regalo"}-${gift.giftId}.png`;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      downloadStatus.textContent = "PNG descargado.";
    } catch (error) {
      downloadStatus.textContent = error.message;
    } finally { download.disabled = false; }
  }

  root.querySelector("#gift-browser-types").addEventListener("click", (event) => {
    const button = event.target.closest("[data-gift-type]");
    if (!button) return;
    type = button.dataset.giftType;
    visibleLimit = 120;
    root.querySelectorAll("[data-gift-type]").forEach((item) => { const active = item === button; item.classList.toggle("is-active", active); item.setAttribute("aria-pressed", String(active)); });
    render();
  });
  root.querySelector("#gift-browser-prices").addEventListener("click", (event) => {
    const button = event.target.closest("[data-gift-price]");
    if (!button) return;
    price = button.dataset.giftPrice;
    visibleLimit = 120;
    root.querySelectorAll("[data-gift-price]").forEach((item) => { const active = item === button; item.classList.toggle("is-active", active); item.setAttribute("aria-pressed", String(active)); });
    render();
  });
  search.addEventListener("input", () => { visibleLimit = 120; render(); });
  sort.addEventListener("change", render);
  more.addEventListener("click", () => { visibleLimit += 120; render(); });
  download.addEventListener("click", downloadPng);
  syncButton.addEventListener("click", async () => {
    setSyncStatus({ status: "loading", detail: "Consultando los regalos disponibles en tu LIVE…" });
    try {
      if (typeof window.TikTokraftGiftBrowserSync !== "function") throw new Error("El panel aún está cargando.");
      await window.TikTokraftGiftBrowserSync();
    }
    catch {
      if (syncStatus.dataset.status !== "error") setSyncStatus({ status: "error", detail: "No se pudo consultar la lista. Comprueba que TikTok LIVE esté conectado y vuelve a intentarlo." });
    }
  });
  window.TikTokraftGiftBrowser = { setEntries, setSyncStatus, open };
  render();
})();
