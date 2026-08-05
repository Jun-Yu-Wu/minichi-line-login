import { NextRequest, NextResponse } from "next/server";

import config from "../../../../src/server/config";
import oauthModule from "../../../../src/server/line-login-oauth";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (Number.isFinite(contentLength) && contentLength > 4096) {
    return redirectToRegister(request, "request_too_large");
  }
  try {
    const form = await request.formData();
    const oauthConfig = config.lineLoginWebConfig();
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
