import { createHash, randomUUID, timingSafeEqual } from "node:crypto";

export const PRO_PRICE_CENTS = 9_000_000;
export const PRO_CURRENCY = "COP";

function settings() {
  const publicKey = String(process.env.WOMPI_PUBLIC_KEY || "").trim();
  const integritySecret = String(process.env.WOMPI_INTEGRITY_SECRET || "").trim();
  const eventsSecret = String(process.env.WOMPI_EVENTS_SECRET || "").trim();
  const privateKey = String(process.env.WOMPI_PRIVATE_KEY || "").trim();
  const baseUrl = String(process.env.APP_URL || process.env.RENDER_EXTERNAL_URL || "").trim().replace(/\/+$/, "");
  let validUrl = false;
  try { validUrl = new URL(baseUrl).protocol === "https:"; } catch { /* Sin URL pública. */ }
  return {
    publicKey, integritySecret, eventsSecret, privateKey, baseUrl,
    ready: publicKey.startsWith("pub_prod_") && integritySecret.startsWith("prod_integrity_") && eventsSecret.startsWith("prod_events_") && privateKey.startsWith("prv_prod_") && validUrl
  };
}

export function automaticProPaymentsReady() { return settings().ready; }

export function newProReference() { return `TKP-${randomUUID().replaceAll("-", "")}`; }

export function proCheckoutUrl(reference, email) {
  const config = settings();
  if (!config.ready) throw new Error("Los pagos automáticos todavía no están configurados.");
  if (!/^TKP-[a-f0-9]{32}$/.test(reference)) throw new Error("La referencia del pago no es válida.");
  const signature = createHash("sha256")
    .update(`${reference}${PRO_PRICE_CENTS}${PRO_CURRENCY}${config.integritySecret}`)
    .digest("hex");
  const checkout = new URL("https://checkout.wompi.co/p/");
  checkout.searchParams.set("public-key", config.publicKey);
  checkout.searchParams.set("currency", PRO_CURRENCY);
  checkout.searchParams.set("amount-in-cents", String(PRO_PRICE_CENTS));
  checkout.searchParams.set("reference", reference);
  checkout.searchParams.set("signature:integrity", signature);
  checkout.searchParams.set("redirect-url", `${config.baseUrl}/?payment=return`);
  checkout.searchParams.set("customer-data:email", String(email || ""));
  return checkout.toString();
}

function signedProperty(data, path) {
  if (typeof path !== "string" || !/^[a-z_][a-z0-9_.]*$/i.test(path)) throw new Error("Propiedad de firma inválida.");
  let value = data;
  for (const part of path.split(".")) value = value?.[part];
  if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") {
    throw new Error("El evento de Wompi tiene una firma incompleta.");
  }
  return String(value);
}

export function verifiedApprovedWompiTransaction(event, checksumHeader = "") {
  const config = settings();
  if (!config.ready) throw new Error("Los pagos automáticos todavía no están configurados.");
  if (!event || event.event !== "transaction.updated" || event.environment !== "prod") return null;
  const properties = event.signature?.properties;
  if (!Array.isArray(properties) || properties.length < 1 || properties.length > 20 || !Number.isSafeInteger(event.timestamp)) {
    throw new Error("La firma del evento de Wompi no es válida.");
  }
  const supplied = String(checksumHeader || event.signature?.checksum || "").toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(supplied)) throw new Error("Falta la firma del evento de Wompi.");
  const payload = `${properties.map((property) => signedProperty(event.data, property)).join("")}${event.timestamp}${config.eventsSecret}`;
  const expected = createHash("sha256").update(payload).digest("hex");
  if (!timingSafeEqual(Buffer.from(supplied, "hex"), Buffer.from(expected, "hex"))) {
    throw new Error("La firma del evento de Wompi no coincide.");
  }
  if (event.data?.transaction?.status !== "APPROVED") return null;
  const transaction = event.data.transaction;
  if (typeof transaction.id !== "string" || !transaction.id || typeof transaction.reference !== "string" ||
      !Number.isSafeInteger(transaction.amount_in_cents) || typeof transaction.currency !== "string") {
    throw new Error("La transacción aprobada está incompleta.");
  }
  return {
    id: transaction.id,
    reference: transaction.reference,
    amountInCents: transaction.amount_in_cents,
    currency: transaction.currency
  };
}

// La firma del evento puede omitir referencia y moneda. Consultamos siempre la
// transacción real con la llave privada antes de conceder un plan de pago.
export async function fetchApprovedWompiTransaction(transactionId) {
  const config = settings();
  if (!config.ready) throw new Error("Los pagos automáticos todavía no están configurados.");
  if (typeof transactionId !== "string" || !/^[a-z0-9-]{1,100}$/i.test(transactionId)) throw new Error("ID de transacción inválido.");
  const response = await fetch(`https://production.wompi.co/v1/transactions/${encodeURIComponent(transactionId)}`, {
    headers: { Accept: "application/json", Authorization: `Bearer ${config.privateKey}` },
    signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) throw new Error(`Wompi no pudo confirmar la transacción (${response.status}).`);
  const { data } = await response.json();
  if (data?.id !== transactionId || data?.status !== "APPROVED" || typeof data.reference !== "string" ||
      !Number.isSafeInteger(data.amount_in_cents) || typeof data.currency !== "string") {
    throw new Error("Wompi aún no confirma una transacción aprobada válida.");
  }
  return { id: data.id, reference: data.reference, amountInCents: data.amount_in_cents, currency: data.currency };
}
