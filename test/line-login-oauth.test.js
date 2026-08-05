const assert = require("node:assert/strict");
const test = require("node:test");

const {
  LINE_AUTHORIZE_ENDPOINT,
  LINE_TOKEN_ENDPOINT,
  buildAuthorizationUrl,
  createAuthorizationTransaction,
  exchangeAuthorizationCode,
  oauthCookieOptions,
  openAuthorizationTransaction,
  requireMatchingState,
  sealAuthorizationTransaction,
} = require("../src/server/line-login-oauth");

test("LINE authorization transaction uses nonce and S256 PKCE with bounded values", () => {
  const transaction = createAuthorizationTransaction({
    claimedAlias: " 小明 ",
    now: () => 1000,
  });
  assert.equal(transaction.claimedAlias, "小明");
  assert.equal(transaction.issuedAt, 1000);
  assert.match(transaction.state, /^[A-Za-z0-9_-]+$/);
  assert.match(transaction.nonce, /^[A-Za-z0-9_-]+$/);
  assert.ok(transaction.codeVerifier.length >= 43 && transaction.codeVerifier.length <= 128);
  assert.notEqual(transaction.codeChallenge, transaction.codeVerifier);

  const url = buildAuthorizationUrl({
    callbackUrl: "https://line.example.com/api/line-login/callback",
    channelId: "channel_123",
    transaction,
  });
  assert.equal(url.origin + url.pathname, LINE_AUTHORIZE_ENDPOINT);
  assert.equal(url.searchParams.get("response_type"), "code");
  assert.equal(url.searchParams.get("client_id"), "channel_123");
  assert.equal(url.searchParams.get("scope"), "profile openid");
  assert.equal(url.searchParams.get("state"), transaction.state);
  assert.equal(url.searchParams.get("nonce"), transaction.nonce);
  assert.equal(url.searchParams.get("code_challenge"), transaction.codeChallenge);
  assert.equal(url.searchParams.get("code_challenge_method"), "S256");
  assert.equal(url.searchParams.get("bot_prompt"), "aggressive");
});

test("LINE authorization URL supports the normal add-friend prompt variant", () => {
  const transaction = createAuthorizationTransaction({ claimedAlias: "小明" });
  const url = buildAuthorizationUrl({
    botPrompt: "normal",
    callbackUrl: "https://line.example.com/api/line-login/callback",
    channelId: "channel_123",
    transaction,
  });
  assert.equal(url.searchParams.get("bot_prompt"), "normal");
});

test("OAuth cookie is encrypted, authenticated, and expires after ten minutes", () => {
  const transaction = createAuthorizationTransaction({ claimedAlias: "小明", now: () => 1000 });
  const token = sealAuthorizationTransaction(transaction, "channel-secret");
  assert.doesNotMatch(token, /小明|codeVerifier|claimedAlias/);
  assert.deepEqual(
    openAuthorizationTransaction(token, "channel-secret", { now: () => 2000 }),
    transaction,
  );
  const parts = token.split(".");
  parts[2] = `${parts[2][0] === "a" ? "b" : "a"}${parts[2].slice(1)}`;
  const tampered = parts.join(".");
  assert.throws(
    () => openAuthorizationTransaction(tampered, "channel-secret", { now: () => 2000 }),
    (error) => error.code === "invalid_oauth_session",
  );
  assert.throws(
    () => openAuthorizationTransaction(token, "channel-secret", { now: () => 700000 }),
    (error) => error.code === "invalid_oauth_session",
  );
});

test("OAuth state comparison rejects missing or mismatched callback state", () => {
  assert.doesNotThrow(() => requireMatchingState("expected", "expected"));
  for (const state of ["", "wrong", "expected-longer"]) {
    assert.throws(
      () => requireMatchingState(state, "expected"),
      (error) => error.code === "invalid_oauth_state",
    );
  }
});

test("authorization-code exchange sends exact callback, secret, and PKCE verifier", async () => {
  let captured;
  const result = await exchangeAuthorizationCode({
    callbackUrl: "https://line.example.com/api/line-login/callback",
    channelId: "channel_123",
    channelSecret: "secret_123",
    code: "authorization_code",
    codeVerifier: "verifier_123",
    fetchImpl: async (url, options) => {
      captured = { options, url };
      return Response.json({
        access_token: "must-not-be-returned",
        id_token: "signed-id-token",
        refresh_token: "must-not-be-returned",
      });
    },
  });
  assert.equal(captured.url, LINE_TOKEN_ENDPOINT);
  assert.equal(captured.options.method, "POST");
  assert.equal(captured.options.body.get("grant_type"), "authorization_code");
  assert.equal(captured.options.body.get("client_id"), "channel_123");
  assert.equal(captured.options.body.get("client_secret"), "secret_123");
  assert.equal(captured.options.body.get("code_verifier"), "verifier_123");
  assert.equal(
    captured.options.body.get("redirect_uri"),
    "https://line.example.com/api/line-login/callback",
  );
  assert.deepEqual(result, { idToken: "signed-id-token" });
});

test("token exchange hides LINE error details and treats upstream failures as retryable", async () => {
  await assert.rejects(
    exchangeAuthorizationCode({
      callbackUrl: "https://line.example.com/api/line-login/callback",
      channelId: "channel_123",
      channelSecret: "secret_123",
      code: "authorization_code",
      codeVerifier: "verifier_123",
      fetchImpl: async () => Response.json(
        { error_description: "sensitive upstream detail" },
        { status: 400 },
      ),
    }),
    (error) => error.code === "invalid_authorization_code"
      && !error.message.includes("sensitive upstream detail"),
  );
});

test("OAuth cookie settings are HttpOnly, same-site, scoped, and secure when requested", () => {
  assert.deepEqual(oauthCookieOptions({ maxAge: 0, secure: true }), {
    httpOnly: true,
    maxAge: 0,
    path: "/api/line-login",
    sameSite: "lax",
    secure: true,
  });
});
