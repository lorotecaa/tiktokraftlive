import assert from "node:assert/strict";
import test from "node:test";

process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_PUBLISHABLE_KEY = "publishable-key";
process.env.APP_URL = "https://panel.example.com";

const { requestPasswordReset, signIn } = await import("../src/auth-store.js?test=password-recovery");

test("solicita recuperación con el correo normalizado y la URL de regreso", async () => {
  let request;
  globalThis.fetch = async (input, options) => {
    request = { input: String(input), options };
    return Response.json({});
  };
  await requestPasswordReset("  Persona@Example.com ");
  assert.equal(request.input, "https://example.supabase.co/auth/v1/recover?redirect_to=https%3A%2F%2Fpanel.example.com");
  assert.deepEqual(JSON.parse(request.options.body), { email: "persona@example.com" });
});

test("traduce los errores de acceso y límite de correo", async () => {
  globalThis.fetch = async () => Response.json({ message: "Invalid login credentials" }, { status: 400 });
  await assert.rejects(() => signIn("persona@example.com", "secreto"), /correo o la contraseña son incorrectos/i);

  globalThis.fetch = async () => Response.json({ code: "over_email_send_rate_limit", message: "email rate limit exceeded" }, { status: 429 });
  await assert.rejects(() => requestPasswordReset("persona@example.com"), /límite de correos/i);
});
