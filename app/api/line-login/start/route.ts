import { NextRequest, NextResponse } from "next/server";

import config from "../../../../src/server/config";
import database from "../../../../src/server/database";
import securityModule from "../../../../src/server/line-login-security-repository";
import oauthModule from "../../../../src/server/line-login-oauth";
import requestSecurity from "../../../../src/server/public-request-security";

export const dynamic = "force-dynamic";
const MAX_BODY_BYTES = 4096;

export async function POST(request: NextRequest) {
  let oauthConfig;
  try {
    oauthConfig = config.lineLoginWebConfig();
  } catch (_error) {
    return redirectToRegister(request, "not_configured");
  }

  const expectedOrigin = new URL(oauthConfig.callbackUrl).origin;
  if (!requestSecurity.isSameOriginRequest(request, expectedOrigin)) {
    return new Response("Forbidden", {
      headers: { "cache-control": "no-store", "content-type": "text/plain; charset=utf-8" },
      status: 403,
    });
  }
  if ((request.headers.get("content-type") || "").split(";")[0].trim().toLowerCase() !== "application/x-www-form-urlencoded") {
    return new Response("Unsupported media type", {
      headers: { "cache-control": "no-store", "content-type": "text/plain; charset=utf-8" },
      status: 415,
    });
  }

  let bodyBytes;
  try {
    bodyBytes = await requestSecurity.readBoundedBody(request, MAX_BODY_BYTES);
  } catch (error) {
    if (error instanceof requestSecurity.RequestBodyTooLargeError) {
      return redirectToRegister(request, "request_too_large");
    }
    return redirectToRegister(request, "login_start_failed");
  }

  const form = new URLSearchParams(new TextDecoder().decode(bodyBytes));
  const consentValues = form.getAll("purchaseNoticeAccepted");
  if (consentValues.length !== 1 || consentValues[0] !== "accepted") {
    return redirectToRegister(request, "purchase_notice_required");
  }
  const csrfValues = form.getAll("csrfToken");
  const csrfToken = csrfValues.length === 1 ? csrfValues[0] : null;
  if (!requestSecurity.isValidOneTimeToken(csrfToken)) {
    return redirectToRegister(request, "csrf_token_invalid");
  }

  try {
    const clientIp = requestSecurity.trustedClientIp(request);
    if (!clientIp) return redirectToRegister(request, "not_configured");
    const pool = database.getDatabasePool();
    const csrfConsumed = await securityModule.consumeLineLoginStartToken(
      pool,
      requestSecurity.hashOneTimeToken(csrfToken),
    );
    if (!csrfConsumed) return redirectToRegister(request, "csrf_token_invalid");

    const rateAllowed = await securityModule.consumeLineLoginRateLimit(
      pool,
      "line_start_ip",
      requestSecurity.hashRateLimitKey(oauthConfig.channelSecret, "start-ip", clientIp),
    );
    if (!rateAllowed) return redirectToRegister(request, "rate_limited");

    const transaction = oauthModule.createAuthorizationTransaction({
      claimedAlias: form.get("claimedAlias"),
    });
    const authorizationUrl = oauthModule.buildAuthorizationUrl({
      botPrompt: oauthConfig.botPrompt === "normal" ? "normal" : "aggressive",
      callbackUrl: oauthConfig.callbackUrl,
      channelId: oauthConfig.channelId,
      transaction,
    });
    const response = NextResponse.redirect(authorizationUrl, 303);
    response.cookies.set(
      oauthModule.OAUTH_COOKIE_NAME,
      oauthModule.sealAuthorizationTransaction(
        transaction,
        oauthConfig.channelSecret,
      ),
      oauthModule.oauthCookieOptions({
        secure: config.shouldUseSecureCookies(request.url),
      }),
    );
    response.headers.set("cache-control", "no-store");
    return response;
  } catch (error) {
    const code = oauthModule.isLineLoginOAuthError(error)
      ? error?.code || "login_start_failed"
      : error instanceof Error && error.message.includes("MINICHI_LINE_LOGIN")
        ? "not_configured"
        : "login_start_failed";
    return redirectToRegister(request, code);
  }
}

function redirectToRegister(request: NextRequest, error: string) {
  const url = new URL("/line-register", publicAppOrigin(request));
  url.searchParams.set("error", error);
  const response = NextResponse.redirect(url, 303);
  response.headers.set("cache-control", "no-store");
  return response;
}

function publicAppOrigin(request: NextRequest) {
  try {
    return new URL(
      String(process.env.MINICHI_LINE_LOGIN_CALLBACK_URL || "").trim(),
    ).origin;
  } catch (_error) {
    return request.nextUrl.origin;
  }
}
