import assert from "node:assert/strict";
import test from "node:test";

process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_SECRET_KEY = "service-secret";

const { deleteRegisteredAccount, listRegisteredAccounts } = await import("../src/services/admin-statistics-store.js?test=admin-statistics");

test("las estadísticas muestran la verificación real y la eliminación usa Supabase Auth", async () => {
  const userId = "11111111-1111-4111-8111-111111111111";
  const calls = [];
  globalThis.fetch = async (input, options = {}) => {
    calls.push({ input: String(input), options });
    if (String(input).includes("/auth/v1/admin/users?page=")) {
      return Response.json({ users: [{ id: userId, email: "persona@example.com", email_confirmed_at: "2026-10-16T12:00:00.000Z" }] });
    }
    if (String(input).includes("/rest/v1/rpc/")) {
      return Response.json([{ user_id: userId, email: "persona@example.com", registered_at: "2026-10-16T11:00:00.000Z" }]);
    }
    if (String(input).endsWith(`/auth/v1/admin/users/${userId}`)) return Response.json({ id: userId });
    return new Response("No esperado", { status: 500 });
  };

  const [account] = await listRegisteredAccounts();
  assert.equal(account.emailVerified, true);
  assert.equal(account.emailConfirmedAt, "2026-10-16T12:00:00.000Z");

  await deleteRegisteredAccount(userId);
  const deletion = calls.find((call) => call.input.endsWith(`/auth/v1/admin/users/${userId}`));
  assert.equal(deletion?.options?.method, "DELETE");
  assert.equal(deletion?.options?.headers?.Authorization, "Bearer service-secret");
  await assert.rejects(() => deleteRegisteredAccount("identificador-invalido"), /no es válida/);
});
