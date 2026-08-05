const assert = require("node:assert/strict");
const test = require("node:test");

const {
  LINE_VERIFY_ENDPOINT,
  verifyLineIdToken,
} = require("../src/server/line-id-token-verifier");

test("LINE ID token verification posts the token and expected channel to the official endpoint", async () => {
  let captured;
  const profile = await verifyLineIdToken({
    channelId: "channel_123",
    fetchImpl: async (url, options) => {
      captured = { options, url };
      return Response.json({
        aud: "channel_123",
        exp: 2000000000,
        iss: "https://access.line.me",
        name: "Line User",
        sub: "U1234567890",
      });
    },
    idToken: "signed-id-token",
    nonce: "nonce_123",
    now: () => 1000000000 * 1000,
  });
  assert.equal(captured.url, LINE_VERIFY_ENDPOINT);
  assert.equal(captured.options.method, "POST");
  assert.equal(captured.options.body.get("id_token"), "signed-id-token");
  assert.equal(captured.options.body.get("client_id"), "channel_123");
  assert.equal(captured.options.body.get("nonce"), "nonce_123");
  assert.deepEqual(profile, {
    audience: "channel_123",
    displayName: "Line User",
    issuer: "https://access.line.me",
    subject: "U1234567890",
  });
});

test("LINE ID token verification rejects upstream invalid tokens without exposing upstream detail", async () => {
  await assert.rejects(
    verifyLineIdToken({
      channelId: "channel_123",
      fetchImpl: async () => Response.json(
        { error_description: "signature details that must stay server-side" },
        { status: 400 },
      ),
      idToken: "invalid-token",
    }),
    (error) => error.code === "invalid_token"
      && !error.message.includes("signature details"),
  );
});

test("LINE ID token verification defensively checks issuer, audience, expiry, and subject", async () => {
  const base = {
    aud: "channel_123",
    exp: 2000000000,
    iss: "https://access.line.me",
    sub: "U1234567890",
  };
  for (const payload of [
    { ...base, aud: "other-channel" },
    { ...base, exp: 1 },
    { ...base, iss: "https://attacker.example" },
    { ...base, sub: "" },
  ]) {
    await assert.rejects(
      verifyLineIdToken({
        channelId: "channel_123",
        fetchImpl: async () => Response.json(payload),
        idToken: "signed-id-token",
        now: () => 1000000000 * 1000,
      }),
      (error) => error.code === "invalid_token",
    );
  }
});

test("LINE ID token verification turns network failures into a retryable safe error", async () => {
  await assert.rejects(
    verifyLineIdToken({
      channelId: "channel_123",
      fetchImpl: async () => { throw new Error("network internals"); },
      idToken: "signed-id-token",
    }),
    (error) => error.code === "verification_unavailable"
      && !error.message.includes("network internals"),
  );
});
