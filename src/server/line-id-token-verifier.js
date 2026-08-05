const LINE_VERIFY_ENDPOINT = "https://api.line.me/oauth2/v2.1/verify";

class LineIdTokenVerificationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "LineIdTokenVerificationError";
    this.code = code;
  }
}

function requireToken(value) {
  const token = String(value || "").trim();
  if (!token || token.length > 8192) {
    throw new LineIdTokenVerificationError(
      "invalid_token",
      "LINE 登入憑證無效，請重新登入後再試。",
    );
  }
  return token;
}

/**
 * @param {{
 *   channelId: string,
 *   fetchImpl?: typeof fetch,
 *   idToken: string,
 *   nonce?: string,
 *   now?: () => number,
 *   timeoutMs?: number,
 * }} options
 */
async function verifyLineIdToken({
  channelId,
  fetchImpl = globalThis.fetch,
  idToken,
  nonce,
  now = () => Date.now(),
  timeoutMs = 5000,
}) {
  const token = requireToken(idToken);
  const expectedChannelId = String(channelId || "").trim();
  if (!expectedChannelId) {
    throw new LineIdTokenVerificationError(
      "not_configured",
      "LINE 綁定服務尚未完成設定。",
    );
  }
  if (typeof fetchImpl !== "function") {
    throw new LineIdTokenVerificationError(
      "verification_unavailable",
      "暫時無法驗證 LINE 登入憑證，請稍後再試。",
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    const body = new URLSearchParams({ client_id: expectedChannelId, id_token: token });
    const expectedNonce = String(nonce || "").trim();
    if (expectedNonce) body.set("nonce", expectedNonce);
    response = await fetchImpl(LINE_VERIFY_ENDPOINT, {
      body,
      headers: { "content-type": "application/x-www-form-urlencoded" },
      method: "POST",
      signal: controller.signal,
    });
  } catch (_error) {
    throw new LineIdTokenVerificationError(
      "verification_unavailable",
      "暫時無法驗證 LINE 登入憑證，請稍後再試。",
    );
  } finally {
    clearTimeout(timeout);
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new LineIdTokenVerificationError(
      response.status >= 500 ? "verification_unavailable" : "invalid_token",
      response.status >= 500
        ? "暫時無法驗證 LINE 登入憑證，請稍後再試。"
        : "LINE 登入憑證無效，請重新登入後再試。",
    );
  }

  const subject = String(payload?.sub || "").trim();
  const issuer = String(payload?.iss || "").trim();
  const audience = String(payload?.aud || "").trim();
  const expiresAt = Number(payload?.exp);
  if (
    !subject
    || subject.length > 255
    || issuer !== "https://access.line.me"
    || audience !== expectedChannelId
    || !Number.isFinite(expiresAt)
    || expiresAt * 1000 <= now()
  ) {
    throw new LineIdTokenVerificationError(
      "invalid_token",
      "LINE 登入憑證無效，請重新登入後再試。",
    );
  }

  return {
    audience,
    displayName: String(payload?.name || "").trim().slice(0, 160) || null,
    issuer,
    subject,
  };
}

function isLineIdTokenVerificationError(error) {
  return error instanceof LineIdTokenVerificationError;
}

module.exports = {
  LINE_VERIFY_ENDPOINT,
  LineIdTokenVerificationError,
  isLineIdTokenVerificationError,
  verifyLineIdToken,
};
