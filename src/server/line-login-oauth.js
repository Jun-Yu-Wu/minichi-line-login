const crypto = require("node:crypto");

const LINE_AUTHORIZE_ENDPOINT = "https://access.line.me/oauth2/v2.1/authorize";
const LINE_TOKEN_ENDPOINT = "https://api.line.me/oauth2/v2.1/token";
const LINE_BOT_PROMPTS = new Set(["normal", "aggressive"]);
const OAUTH_COOKIE_NAME = "minichi_line_oauth";
const OAUTH_TTL_MS = 10 * 60 * 1000;

/**
 * @typedef {{
 *   claimedAlias: string,
 *   codeChallenge: string,
 *   codeVerifier: string,
 *   issuedAt: number,
 *   nonce: string,
 *   state: string,
 * }} AuthorizationTransaction
 */

class LineLoginOAuthError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "LineLoginOAuthError";
    this.code = code;
  }
}

function base64url(value) {
  return Buffer.from(value).toString("base64url");
}

function oauthKey(channelSecret) {
  const secret = String(channelSecret || "").trim();
  if (!secret) throw new LineLoginOAuthError("not_configured", "LINE 登入服務尚未完成設定。");
  return crypto.createHash("sha256").update("minichi-line-oauth-v1\0").update(secret).digest();
}

/** @param {{claimedAlias: unknown, now?: () => number}} options */
function createAuthorizationTransaction({ claimedAlias, now = () => Date.now() }) {
  const alias = String(claimedAlias || "").normalize("NFKC").trim();
  if (!alias || alias.length > 160) {
    throw new LineLoginOAuthError("invalid_alias", "請填寫 160 字以內的 LINE 社群名稱。");
  }
  const codeVerifier = base64url(crypto.randomBytes(64));
  return {
    claimedAlias: alias,
    codeChallenge: base64url(crypto.createHash("sha256").update(codeVerifier).digest()),
    codeVerifier,
    issuedAt: now(),
    nonce: base64url(crypto.randomBytes(32)),
    state: base64url(crypto.randomBytes(32)),
  };
}

/** @param {AuthorizationTransaction} transaction @param {string} channelSecret */
function sealAuthorizationTransaction(transaction, channelSecret) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", oauthKey(channelSecret), iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(transaction), "utf8"),
    cipher.final(),
  ]);
  return [
    "v1",
    base64url(iv),
    base64url(ciphertext),
    base64url(cipher.getAuthTag()),
  ].join(".");
}

/**
 * @param {unknown} token
 * @param {string} channelSecret
 * @param {{now?: () => number}} [options]
 * @returns {AuthorizationTransaction}
 */
function openAuthorizationTransaction(token, channelSecret, { now = () => Date.now() } = {}) {
  try {
    const [version, encodedIv, encodedCiphertext, encodedTag, extra] = String(token || "").split(".");
    if (version !== "v1" || !encodedIv || !encodedCiphertext || !encodedTag || extra) {
      throw new Error("invalid token structure");
    }
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      oauthKey(channelSecret),
      Buffer.from(encodedIv, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(encodedTag, "base64url"));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(encodedCiphertext, "base64url")),
      decipher.final(),
    ]).toString("utf8");
    const transaction = JSON.parse(plaintext);
    if (
      !transaction
      || typeof transaction.claimedAlias !== "string"
      || typeof transaction.codeVerifier !== "string"
      || typeof transaction.nonce !== "string"
      || typeof transaction.state !== "string"
      || !Number.isFinite(transaction.issuedAt)
      || transaction.issuedAt > now() + 60_000
      || now() - transaction.issuedAt > OAUTH_TTL_MS
    ) {
      throw new Error("invalid transaction");
    }
    return transaction;
  } catch (error) {
    if (error instanceof LineLoginOAuthError) throw error;
    throw new LineLoginOAuthError(
      "invalid_oauth_session",
      "LINE 登入階段已失效，請重新開始。",
    );
  }
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left || ""));
  const b = Buffer.from(String(right || ""));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function requireMatchingState(receivedState, expectedState) {
  if (!safeEqual(receivedState, expectedState)) {
    throw new LineLoginOAuthError(
      "invalid_oauth_state",
      "LINE 登入驗證狀態不一致，請重新開始。",
    );
  }
}

/**
 * @param {{botPrompt?: "normal" | "aggressive", callbackUrl: string, channelId: string, transaction: AuthorizationTransaction}} input
 */
function buildAuthorizationUrl({ botPrompt = "aggressive", callbackUrl, channelId, transaction }) {
  const url = new URL(LINE_AUTHORIZE_ENDPOINT);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", channelId);
  url.searchParams.set("redirect_uri", callbackUrl);
  url.searchParams.set("state", transaction.state);
  url.searchParams.set("scope", "profile openid");
  url.searchParams.set("nonce", transaction.nonce);
  url.searchParams.set("code_challenge", transaction.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("ui_locales", "zh-TW");
  if (LINE_BOT_PROMPTS.has(botPrompt)) url.searchParams.set("bot_prompt", botPrompt);
  return url;
}

async function exchangeAuthorizationCode({
  callbackUrl,
  channelId,
  channelSecret,
  code,
  codeVerifier,
  fetchImpl = globalThis.fetch,
  timeoutMs = 5000,
}) {
  const cleanCode = String(code || "").trim();
  if (!cleanCode || cleanCode.length > 2048) {
    throw new LineLoginOAuthError("invalid_authorization_code", "LINE 授權碼無效，請重新開始。");
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    response = await fetchImpl(LINE_TOKEN_ENDPOINT, {
      body: new URLSearchParams({
        client_id: channelId,
        client_secret: channelSecret,
        code: cleanCode,
        code_verifier: codeVerifier,
        grant_type: "authorization_code",
        redirect_uri: callbackUrl,
      }),
      headers: { "content-type": "application/x-www-form-urlencoded" },
      method: "POST",
      signal: controller.signal,
    });
  } catch (_error) {
    throw new LineLoginOAuthError(
      "token_exchange_unavailable",
      "LINE 登入服務暫時無法連線，請稍後再試。",
    );
  } finally {
    clearTimeout(timeout);
  }
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new LineLoginOAuthError(
      response.status >= 500 ? "token_exchange_unavailable" : "invalid_authorization_code",
      response.status >= 500
        ? "LINE 登入服務暫時無法連線，請稍後再試。"
        : "LINE 授權碼無效，請重新開始。",
    );
  }
  const idToken = String(payload?.id_token || "").trim();
  if (!idToken || idToken.length > 8192) {
    throw new LineLoginOAuthError(
      "missing_id_token",
      "LINE 未回傳可驗證的登入身分，請重新授權。",
    );
  }
  return { idToken };
}

function isLineLoginOAuthError(error) {
  return error instanceof LineLoginOAuthError;
}

/** @returns {{httpOnly: boolean, maxAge: number, path: string, sameSite: "lax", secure: boolean}} */
function oauthCookieOptions({ maxAge = Math.floor(OAUTH_TTL_MS / 1000), secure }) {
  return {
    httpOnly: true,
    maxAge,
    path: "/api/line-login",
    sameSite: "lax",
    secure: Boolean(secure),
  };
}

module.exports = {
  LINE_AUTHORIZE_ENDPOINT,
  LINE_BOT_PROMPTS,
  LINE_TOKEN_ENDPOINT,
  OAUTH_COOKIE_NAME,
  OAUTH_TTL_MS,
  LineLoginOAuthError,
  buildAuthorizationUrl,
  createAuthorizationTransaction,
  exchangeAuthorizationCode,
  isLineLoginOAuthError,
  oauthCookieOptions,
  openAuthorizationTransaction,
  requireMatchingState,
  sealAuthorizationTransaction,
};
