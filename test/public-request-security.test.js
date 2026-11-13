const assert = require("node:assert/strict");
const test = require("node:test");

const {
  RequestBodyTooLargeError,
  hashOneTimeToken,
  hashRateLimitKey,
  isSameOriginRequest,
  isValidOneTimeToken,
  readBoundedBody,
  trustedClientIp,
} = require("../src/server/public-request-security");

test("bounded body reading enforces bytes when Content-Length is missing or understated", async () => {
  const exact = new Request("https://line.example.com/api", {
    method: "POST",
    body: new TextEncoder().encode("1234"),
  });
  assert.equal(new TextDecoder().decode(await readBoundedBody(exact, 4)), "1234");

  const understated = new Request("https://line.example.com/api", {
    headers: { "content-length": "1" },
    method: "POST",
    body: new TextEncoder().encode("12345"),
  });
  await assert.rejects(readBoundedBody(understated, 4), RequestBodyTooLargeError);
});

test("bounded body reading rejects an oversized declared body before consuming it", async () => {
  const request = new Request("https://line.example.com/api", {
    headers: { "content-length": "5" },
    method: "POST",
    body: new TextEncoder().encode("12345"),
  });
  await assert.rejects(readBoundedBody(request, 4), RequestBodyTooLargeError);
});

test("same-origin guard requires the configured origin and rejects cross-site fetch metadata", () => {
  const origin = "https://line.example.com";
  const sameOrigin = new Request(`${origin}/api`, {
    headers: { origin, "sec-fetch-site": "same-origin" },
    method: "POST",
  });
  assert.equal(isSameOriginRequest(sameOrigin, origin), true);

  const wrongOrigin = new Request(`${origin}/api`, {
    headers: { origin: "https://attacker.example", "sec-fetch-site": "cross-site" },
    method: "POST",
  });
  const missingOrigin = new Request(`${origin}/api`, { method: "POST" });
  assert.equal(isSameOriginRequest(wrongOrigin, origin), false);
  assert.equal(isSameOriginRequest(missingOrigin, origin), false);
});

test("Vercel client IP uses its trusted edge header and production fails closed elsewhere", () => {
  const request = new Request("https://line.example.com/api", {
    headers: {
      "x-forwarded-for": "198.51.100.5",
      "x-vercel-forwarded-for": "203.0.113.8",
    },
  });
  assert.equal(trustedClientIp(request, { isProduction: true, isVercel: true }), "203.0.113.8");
  assert.equal(trustedClientIp(request, { isProduction: true, isVercel: false }), null);
  assert.equal(trustedClientIp(new Request("https://line.example.com/api"), {
    isProduction: false,
    isVercel: false,
  }), "development");
});

test("rate-limit keys are scope-separated and CSRF tokens are high-entropy base64url values", () => {
  assert.notEqual(
    hashRateLimitKey("secret", "binding-ip", "203.0.113.8"),
    hashRateLimitKey("secret", "start-ip", "203.0.113.8"),
  );
  assert.match(hashOneTimeToken("token"), /^[0-9a-f]{64}$/);
  const token = "A".repeat(43);
  assert.equal(isValidOneTimeToken(token), true);
  assert.equal(isValidOneTimeToken(`${token}A`), false);
});
