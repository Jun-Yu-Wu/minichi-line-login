const { createHash, createHmac } = require("node:crypto");
const { isIP } = require("node:net");

class RequestBodyTooLargeError extends Error {
  constructor() {
    super("Request body exceeds the configured limit");
    this.name = "RequestBodyTooLargeError";
  }
}

async function readBoundedBody(request, maxBytes) {
  const declaredLength = request.headers.get("content-length");
  if (/^\d+$/.test(declaredLength || "") && Number(declaredLength) > maxBytes) {
    throw new RequestBodyTooLargeError();
  }

  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();

  const chunks = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel().catch(() => {});
        throw new RequestBodyTooLargeError();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

function isSameOriginRequest(request, expectedOrigin) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    if (new URL(origin).origin !== expectedOrigin) return false;
  } catch (_error) {
    return false;
  }
  const fetchSite = request.headers.get("sec-fetch-site");
  return !fetchSite || fetchSite === "same-origin";
}

function trustedClientIp(request, {
  isProduction = process.env.NODE_ENV === "production",
  isVercel = process.env.VERCEL === "1",
} = {}) {
  if (isProduction && !isVercel) return null;
  const header = isVercel ? "x-vercel-forwarded-for" : "x-forwarded-for";
  const value = request.headers.get(header) || (isVercel
    ? request.headers.get("x-forwarded-for")
    : "");
  const candidate = String(value || "").split(",")[0].trim();
  if (isIP(candidate)) return candidate;
  // shortcut: production IP extraction trusts Vercel's overwritten client-IP header; update this adapter if hosting changes.
  return isProduction ? null : "development";
}

function hashRateLimitKey(secret, scope, value) {
  return createHmac("sha256", secret)
    .update(`minichi-line-login:${scope}:${value}`)
    .digest("hex");
}

function hashOneTimeToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

function isValidOneTimeToken(token) {
  return typeof token === "string" && /^[A-Za-z0-9_-]{43}$/.test(token);
}

module.exports = {
  RequestBodyTooLargeError,
  hashOneTimeToken,
  hashRateLimitKey,
  isSameOriginRequest,
  isValidOneTimeToken,
  readBoundedBody,
  trustedClientIp,
};
