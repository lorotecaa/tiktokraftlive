import assert from "node:assert/strict";
import test from "node:test";

process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_SECRET_KEY = "test-service-key";
const { startManualProRequest, latestManualProRequest, listPendingManualProRequests, reviewManualProRequest } = await import("../src/services/manual-pro-request-store.js");

const userId = "11223344-5566-4777-8888-99aabbccddee";
const requestId = "aabbccdd-1122-4333-8444-556677889900";
const pendingRow = { id: requestId, user_id: userId, account_email: "person@example.com", status: "pending", created_at: "2026-10-16T12:00:00Z" };

test("un clic registra una intención pendiente ligada a la cuenta, no un pago", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async (input, options) => {
    assert.equal(String(input), "https://example.supabase.co/rest/v1/rpc/tiktokraft_start_manual_pro_request");
    assert.equal(options.headers.Authorization, "Bearer test-service-key");
    assert.deepEqual(JSON.parse(options.body), { p_user_id: userId, p_email: "Person@Example.com" });
    return Response.json([pendingRow]);
  };
  try {
    const result = await startManualProRequest({ id: userId, email: "Person@Example.com" });
    assert.deepEqual(result, { id: requestId, userId, email: "person@example.com", status: "pending", createdAt: pendingRow.created_at, reviewedAt: null, transactionReference: null });
  } finally { globalThis.fetch = original; }
});

test("solo se consulta la solicitud de la cuenta indicada", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async (input) => {
    assert.match(String(input), /user_id=eq\.11223344-5566-4777-8888-99aabbccddee/);
    return Response.json([pendingRow]);
  };
  try { assert.equal((await latestManualProRequest(userId)).status, "pending"); }
  finally { globalThis.fetch = original; }
});

test("la bandeja del administrador solo consulta solicitudes pendientes", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async (input) => {
    assert.match(String(input), /status=eq\.pending/);
    return Response.json([pendingRow]);
  };
  try { assert.equal((await listPendingManualProRequests()).length, 1); }
  finally { globalThis.fetch = original; }
});

test("aprobar exige referencia verificada y envía la decisión a la función atómica", async () => {
  await assert.rejects(reviewManualProRequest(requestId, userId, "approved", ""), /referencia/i);
  await assert.rejects(reviewManualProRequest("no-es-uuid", userId, "approved", "ABCD"), /válida/i);
  const original = globalThis.fetch;
  globalThis.fetch = async (input, options) => {
    assert.equal(String(input), "https://example.supabase.co/rest/v1/rpc/tiktokraft_review_manual_pro_request");
    assert.deepEqual(JSON.parse(options.body), { p_id: requestId, p_admin_id: userId, p_decision: "approved", p_transaction_reference: "WOMPI-1234" });
    return Response.json([{ ...pendingRow, status: "approved", transaction_reference: "WOMPI-1234" }]);
  };
  try { assert.equal((await reviewManualProRequest(requestId, userId, "approved", " WOMPI-1234 ")).status, "approved"); }
  finally { globalThis.fetch = original; }
});
