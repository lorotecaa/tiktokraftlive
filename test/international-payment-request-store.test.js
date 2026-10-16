import assert from "node:assert/strict";
import test from "node:test";

process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_SECRET_KEY = "test-service-key";
const { validateInternationalContact, startInternationalPaymentRequest, latestInternationalPaymentRequest, listPendingInternationalPaymentRequests, markInternationalPaymentRequestContacted } = await import("../src/services/international-payment-request-store.js");

const userId = "11223344-5566-4777-8888-99aabbccddee";
const requestId = "aabbccdd-1122-4333-8444-556677889900";
const pendingRow = { id: requestId, user_id: userId, account_email: "person@example.com", country: "España", phone: "+34 600 123 456", status: "pending", created_at: "2026-10-16T12:00:00Z" };

test("valida país y teléfono antes de guardar datos personales", () => {
  assert.deepEqual(validateInternationalContact(" España ", " +34  600 123 456 "), { country: "España", phone: "+34 600 123 456" });
  assert.throws(() => validateInternationalContact("E", "+34 600 123 456"), /país/i);
  assert.throws(() => validateInternationalContact("España", "123"), /teléfono/i);
  assert.throws(() => validateInternationalContact("España", "+34;alert(1)"), /teléfono/i);
});

test("una solicitud exterior guarda contacto, no activa Pro ni inicia cobro", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async (input, options) => {
    assert.equal(String(input), "https://example.supabase.co/rest/v1/rpc/tiktokraft_start_international_payment_request");
    assert.equal(options.headers.Authorization, "Bearer test-service-key");
    assert.deepEqual(JSON.parse(options.body), { p_user_id: userId, p_email: "Person@Example.com", p_country: "España", p_phone: "+34 600 123 456" });
    return Response.json([pendingRow]);
  };
  try {
    const result = await startInternationalPaymentRequest({ id: userId, email: "Person@Example.com" }, " España ", " +34  600 123 456 ");
    assert.deepEqual(result, { id: requestId, userId, email: "person@example.com", country: "España", phone: "+34 600 123 456", status: "pending", createdAt: pendingRow.created_at, updatedAt: null, contactedAt: null });
  } finally { globalThis.fetch = original; }
});

test("el usuario solo consulta su propia solicitud y el administrador solo pendientes", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async (input) => {
    assert.match(String(input), /user_id=eq\.11223344-5566-4777-8888-99aabbccddee|status=eq\.pending/);
    return Response.json([pendingRow]);
  };
  try {
    assert.equal((await latestInternationalPaymentRequest(userId)).status, "pending");
    assert.equal((await listPendingInternationalPaymentRequests()).length, 1);
  } finally { globalThis.fetch = original; }
});

test("marcar como contactado no activa Pro", async () => {
  await assert.rejects(markInternationalPaymentRequestContacted("invalido", userId), /válida/i);
  const original = globalThis.fetch;
  globalThis.fetch = async (input, options) => {
    assert.equal(String(input), "https://example.supabase.co/rest/v1/rpc/tiktokraft_mark_international_payment_contacted");
    assert.deepEqual(JSON.parse(options.body), { p_id: requestId, p_admin_id: userId });
    return Response.json([{ ...pendingRow, status: "contacted" }]);
  };
  try { assert.equal((await markInternationalPaymentRequestContacted(requestId, userId)).status, "contacted"); }
  finally { globalThis.fetch = original; }
});
