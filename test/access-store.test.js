import assert from "node:assert/strict";
import test from "node:test";

process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_SECRET_KEY = "service-secret";

const { authorizeAccountEmail, isAccountAuthorized, listAuthorizedAccounts, revokeAccountAuthorization } = await import("../src/services/access-store.js?test=email-authorization");

test("autorizar por correo vincula el acceso al ID real de Supabase Auth", async () => {
  const userId = "11111111-1111-4111-8111-111111111111";
  const requests = [];
  globalThis.fetch = async (input, options = {}) => {
    requests.push({ input: String(input), options });
    if (String(input).includes("/auth/v1/admin/users?")) {
      return Response.json({ users: [{ id: userId, email: "persona@example.com" }] });
    }
    if (options.method === "POST") {
      return Response.json([{ user_id: userId, email: "persona@example.com", added_at: "2026-10-16T12:00:00Z" }]);
    }
    return new Response("No esperado", { status: 500 });
  };

  const authorized = await authorizeAccountEmail("  Persona@Example.com ", userId);
  assert.deepEqual({ userId: authorized.userId, email: authorized.email }, { userId, email: "persona@example.com" });
  const insertion = requests.find((entry) => entry.options.method === "POST");
  assert.match(insertion.input, /tiktokraft_authorized_accounts/);
  assert.equal(JSON.parse(insertion.options.body).user_id, userId);
  assert.ok(requests.every((entry) => !entry.input.includes("authorized_tiktok_users")));
});

test("un usuario de TikTok repetido no autoriza a otra cuenta registrada", async () => {
  const allowedId = "11111111-1111-4111-8111-111111111111";
  const otherId = "22222222-2222-4222-8222-222222222222";
  const requests = [];
  globalThis.fetch = async (input) => {
    requests.push(String(input));
    return Response.json(String(input).includes(allowedId) ? [{ user_id: allowedId }] : []);
  };

  assert.equal(await isAccountAuthorized(allowedId), true);
  assert.equal(await isAccountAuthorized(otherId), false);
  assert.ok(requests.every((input) => input.includes("tiktokraft_authorized_accounts?user_id=eq.")));
});

test("la lista y revocación usan el ID de cuenta", async () => {
  const userId = "11111111-1111-4111-8111-111111111111";
  let deleted;
  globalThis.fetch = async (input, options = {}) => {
    if (options.method === "DELETE") {
      deleted = String(input);
      return new Response(null, { status: 204 });
    }
    return Response.json([{ user_id: userId, email: "persona@example.com", added_at: null }]);
  };

  assert.equal((await listAuthorizedAccounts())[0].email, "persona@example.com");
  await revokeAccountAuthorization(userId);
  assert.match(deleted, new RegExp(`user_id=eq\\.${userId}`));
});
