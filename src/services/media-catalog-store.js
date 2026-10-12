import path from "node:path";

function projectUrl(value) {
  return String(value || "").trim().replace(/\/+$/, "").replace(/\/rest\/v1$/i, "");
}

const url = projectUrl(process.env.SUPABASE_URL);
const key = String(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
const bucket = String(process.env.MEDIA_STORAGE_BUCKET || "tiktokraft-media").trim() || "tiktokraft-media";
const allowedExtensions = {
  sounds: new Set([".aac", ".m4a", ".mp3", ".ogg", ".wav", ".webm"]),
  videos: new Set([".mp4"])
};
const maximumBytes = { sounds: 25 * 1024 * 1024, videos: 200 * 1024 * 1024 };
const cache = new Map();
let bucketReady = null;

function storageHeaders(extra = {}) {
  return { apikey: key, Authorization: `Bearer ${key}`, ...extra };
}

function assertConfigured() {
  if (!url || !key) throw new Error("El catálogo multimedia requiere SUPABASE_URL y SUPABASE_SECRET_KEY en Render.");
}

function mediaKind(value) {
  const kind = String(value || "").trim().toLowerCase();
  if (!allowedExtensions[kind]) throw new Error("Tipo de archivo multimedia no válido.");
  return kind;
}

function validateMediaFilename(value, kindValue) {
  const kind = mediaKind(kindValue);
  const filename = String(value || "").normalize("NFC").trim();
  if (!filename || filename.length > 180 || filename !== path.basename(filename) || /[\u0000-\u001f\u007f]/.test(filename)) {
    throw new Error("El nombre del archivo no es válido.");
  }
  const extension = path.extname(filename).toLowerCase();
  if (!allowedExtensions[kind].has(extension)) {
    throw new Error(kind === "videos" ? "Solo se permiten videos MP4." : "Formato de audio no permitido.");
  }
  return { filename, extension };
}

export function normalizeMediaFilename(value, kindValue) {
  const { filename, extension } = validateMediaFilename(value, kindValue);
  const base = filename.slice(0, -extension.length)
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[^A-Za-z0-9_-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^[_-]+|[_-]+$/g, "")
    .slice(0, 160);
  if (!base) throw new Error("El nombre del archivo no contiene caracteres válidos.");
  return `${base}${extension}`;
}

function publicUrl(kind, filename) {
  return `${url}/storage/v1/object/public/${encodeURIComponent(bucket)}/${kind}/${encodeURIComponent(filename)}`;
}

async function storageRequest(endpoint, options = {}, message = "No se pudo gestionar el catálogo multimedia.") {
  assertConfigured();
  const response = await fetch(`${url}/storage/v1/${endpoint}`, options);
  if (!response.ok) {
    const detail = await response.text();
    const error = new Error(`${message} (${response.status})${detail ? `: ${detail}` : ""}`);
    error.status = response.status;
    throw error;
  }
  return response;
}

async function ensureBucket() {
  assertConfigured();
  if (!bucketReady) {
    bucketReady = (async () => {
      const existing = await fetch(`${url}/storage/v1/bucket/${encodeURIComponent(bucket)}`, { headers: storageHeaders() });
      if (existing.ok) {
        const current = await existing.json().catch(() => ({}));
        if (current.public === false) {
          await storageRequest(`bucket/${encodeURIComponent(bucket)}`, {
            method: "PUT",
            headers: storageHeaders({ "Content-Type": "application/json" }),
            body: JSON.stringify({ public: true })
          }, "No se pudo habilitar el acceso del widget al catálogo multimedia");
        }
        return;
      }
      if (existing.status !== 400 && existing.status !== 404) {
        const detail = await existing.text();
        throw new Error(`No se pudo consultar el almacenamiento multimedia (${existing.status})${detail ? `: ${detail}` : ""}`);
      }
      await storageRequest("bucket", {
        method: "POST",
        headers: storageHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ id: bucket, name: bucket, public: true })
      }, "No se pudo crear el almacenamiento multimedia");
    })().catch((error) => {
      bucketReady = null;
      throw error;
    });
  }
  return bucketReady;
}

function normalizeObject(kind, object) {
  const filename = String(object?.name || "");
  try { validateMediaFilename(filename, kind); } catch { return null; }
  return {
    filename,
    url: publicUrl(kind, filename),
    size: Number(object?.metadata?.size) || null,
    contentType: String(object?.metadata?.mimetype || object?.metadata?.contentType || ""),
    updatedAt: object?.updated_at || object?.created_at || null,
    source: "uploaded"
  };
}

export async function listGlobalMedia(kindValue, { fresh = false } = {}) {
  const kind = mediaKind(kindValue);
  assertConfigured();
  const cached = cache.get(kind);
  if (!fresh && cached && Date.now() - cached.at < 5_000) return cached.entries;
  await ensureBucket();
  const response = await storageRequest(`object/list/${encodeURIComponent(bucket)}`, {
    method: "POST",
    headers: storageHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ prefix: kind, limit: 1_000, offset: 0, sortBy: { column: "name", order: "asc" } })
  }, "No se pudo consultar el catálogo multimedia");
  const entries = (await response.json())
    .map((object) => normalizeObject(kind, object))
    .filter(Boolean)
    .sort((left, right) => left.filename.localeCompare(right.filename, "es"));
  cache.set(kind, { at: Date.now(), entries });
  return entries;
}

export async function uploadGlobalMedia(kindValue, { filename: rawFilename, contentType, buffer }) {
  const kind = mediaKind(kindValue);
  const filename = normalizeMediaFilename(rawFilename, kind);
  const body = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer || []);
  if (!body.length) throw new Error("Selecciona un archivo antes de subirlo.");
  if (body.length > maximumBytes[kind]) {
    throw new Error(kind === "videos" ? "El video supera el límite de 200 MB." : "El audio supera el límite de 25 MB.");
  }
  await ensureBucket();
  const current = await listGlobalMedia(kind, { fresh: true });
  if (current.some((entry) => entry.filename.toLocaleLowerCase() === filename.toLocaleLowerCase())) {
    throw new Error(`Ya existe un archivo llamado ${filename}.`);
  }
  await storageRequest(`object/${encodeURIComponent(bucket)}/${kind}/${encodeURIComponent(filename)}`, {
    method: "POST",
    headers: storageHeaders({ "Content-Type": String(contentType || "application/octet-stream"), "x-upsert": "false" }),
    body
  }, "No se pudo subir el archivo");
  cache.delete(kind);
  return { filename, url: publicUrl(kind, filename), size: body.length, contentType: String(contentType || ""), updatedAt: new Date().toISOString(), source: "uploaded" };
}

export async function deleteGlobalMedia(kindValue, rawFilename) {
  const kind = mediaKind(kindValue);
  const { filename } = validateMediaFilename(rawFilename, kind);
  await ensureBucket();
  const current = await listGlobalMedia(kind, { fresh: true });
  const existing = current.find((entry) => entry.filename === filename);
  if (!existing) throw new Error("El archivo ya no existe en el catálogo administrado.");
  await storageRequest(`object/${encodeURIComponent(bucket)}`, {
    method: "DELETE",
    headers: storageHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ prefixes: [`${kind}/${filename}`] })
  }, "No se pudo eliminar el archivo");
  cache.delete(kind);
  return { filename };
}
