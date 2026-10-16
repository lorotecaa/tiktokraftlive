import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { automaticProPaymentsReady, fetchApprovedWompiTransaction, proCheckoutUrl, verifiedApprovedWompiTransaction, PRO_PRICE_CENTS } from "../src/services/wompi-pro.js";

process.env.APP_URL = "https://tiktokraft.loroland.pro";
process.env.WOMPI_PUBLIC_KEY = "pub_prod_example";
process.env.WOMPI_INTEGRITY_SECRET = "prod_integrity_example";
process.env.WOMPI_EVENTS_SECRET = "prod_events_example";
process.env.WOMPI_PRIVATE_KEY = "prv_prod_example";

const reference = `TKP-${"a".repeat(32)}`;
const sign = (event) => createHash("sha256").update(`${event.data.transaction.id}${event.data.transaction.status}${event.data.transaction.amount_in_cents}${event.timestamp}${process.env.WOMPI_EVENTS_SECRET}`).digest("hex");
function event(status = "APPROVED") {
  const result = {
    event: "transaction.updated", environment: "prod", timestamp: 1530291411,
    data: { transaction: { id: "wompi-transaction-1", status, reference, amount_in_cents: PRO_PRICE_CENTS, currency: "COP" } },
    signature: { properties: ["transaction.id", "transaction.status", "transaction.amount_in_cents"] }
  };
  result.signature.checksum = sign(result);
  return result;
}

test("checkout crea un cobro único firmado para el correo autenticado", () => {
  assert.equal(automaticProPaymentsReady(), true);
  const checkout = new URL(proCheckoutUrl(reference, "persona@example.com"));
  assert.equal(checkout.origin, "https://checkout.wompi.co");
  assert.equal(checkout.searchParams.get("reference"), reference);
  assert.equal(checkout.searchParams.get("amount-in-cents"), "9000000");
  assert.equal(checkout.searchParams.get("customer-data:email"), "persona@example.com");
  assert.equal(checkout.searchParams.get("redirect-url"), "https://tiktokraft.loroland.pro/?payment=return");
  const expected = createHash("sha256").update(`${reference}9000000COPprod_integrity_example`).digest("hex");
  assert.equal(checkout.searchParams.get("signature:integrity"), expected);
});

test("solo se acepta un evento firmado y aprobado", () => {
  const approved = event();
  assert.deepEqual(verifiedApprovedWompiTransaction(approved), { id: "wompi-transaction-1", reference, amountInCents: PRO_PRICE_CENTS, currency: "COP" });
  assert.equal(verifiedApprovedWompiTransaction(event("DECLINED")), null);
  approved.data.transaction.amount_in_cents = 1;
  assert.throws(() => verifiedApprovedWompiTransaction(approved), /firma.*coincide/i);
  const spoofed = event();
  spoofed.data.transaction.reference = "TKP-falsa";
  // La firma de Wompi no necesariamente incluye la referencia; la base de datos
  // exige que exista una orden previa con esa referencia antes de activar Pro.
  assert.equal(verifiedApprovedWompiTransaction(spoofed).reference, "TKP-falsa");
});

test("sin credenciales completas no se habilita el pago automático", () => {
  const original = process.env.WOMPI_EVENTS_SECRET;
  delete process.env.WOMPI_EVENTS_SECRET;
  try { assert.equal(automaticProPaymentsReady(), false); }
  finally { process.env.WOMPI_EVENTS_SECRET = original; }
});

test("confirma referencia y monto con Wompi usando la llave privada", async () => {
  let authenticated = false;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, options) => {
    authenticated = options.headers.Authorization === "Bearer prv_prod_example";
    assert.equal(String(input), "https://production.wompi.co/v1/transactions/wompi-transaction-1");
    return Response.json({ data: { id: "wompi-transaction-1", status: "APPROVED", reference, amount_in_cents: PRO_PRICE_CENTS, currency: "COP" } });
  };
  try {
    assert.deepEqual(await fetchApprovedWompiTransaction("wompi-transaction-1"), { id: "wompi-transaction-1", reference, amountInCents: PRO_PRICE_CENTS, currency: "COP" });
    assert.equal(authenticated, true);
  } finally { globalThis.fetch = originalFetch; }
});
