import { NextRequest, NextResponse } from "next/server";

import config from "../../../../src/server/config";
import database from "../../../../src/server/database";
import ingressModule from "../../../../src/server/line-binding-ingress-service";
import verifierModule from "../../../../src/server/line-id-token-verifier";
import oauthModule from "../../../../src/server/line-login-oauth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  let secureCookie = config.shouldUseSecureCookies(request.url);
  try {
    const oauthConfig = config.lineLoginWebConfig();
    const sealed = request.cookies.get(oauthModule.OAUTH_COOKIE_NAME)?.value;
    const transaction = oauthModule.openAuthorizationTransaction(
      sealed,
      oauthConfig.channelSecret,
    );
    oauthModule.requireMatchingState(
      request.nextUrl.searchParams.get("state"),
      transaction.state,
    );
    if (request.nextUrl.searchParams.get("error")) {
      return resultRedirect(request, "denied", secureCookie);
    }

    const exchanged = await oauthModule.exchangeAuthorizationCode({
      callbackUrl: oauthConfig.callbackUrl,
      channelId: oauthConfig.channelId,
      channelSecret: oauthConfig.channelSecret,
      code: request.nextUrl.searchParams.get("code"),
      codeVerifier: transaction.codeVerifier,
      timeoutMs: oauthConfig.verificationTimeoutMs,
    });
    const verified = await verifierModule.verifyLineIdToken({
      channelId: oauthConfig.channelId,
      idToken: exchanged.idToken,
      nonce: transaction.nonce,
      timeoutMs: oauthConfig.verificationTimeoutMs,
    });
    const service = ingressModule.createLineBindingIngressService({
      requestTtlMinutes: oauthConfig.requestTtlMinutes,
    });
    const result = await service.submit(database.getDatabasePool(), {
      claimedAlias: transaction.claimedAlias,
      displayNameSnapshot: verified.displayName,
      providerScope: oauthConfig.channelId,
      providerSubject: verified.subject,
    });
    return resultRedirect(request, result.status, secureCookie);
  } catch (error) {
    const code = classifyCallbackError(error);
    if (code === "callback_failed") {
      console.error("LINE Login callback failed", describeCallbackError(error));
    }
    return resultRedirect(request, code, secureCookie);
  }
}

function describeCallbackError(error: unknown) {
  if (!(error instanceof Error)) {
    return {
      errorName: "UnknownError",
      errorCode: null,
      errorMessage: String(error),
    };
  }
  const metadata = error as Error & {
    code?: unknown;
    constraint?: unknown;
    detail?: unknown;
    hint?: unknown;
  };
  return {
    errorName: error.name,
    errorCode: typeof metadata.code === "string" ? metadata.code : null,
    errorMessage: error.message,
    errorConstraint: typeof metadata.constraint === "string" ? metadata.constraint : null,
    errorDetail: typeof metadata.detail === "string" ? metadata.detail : null,
    errorHint: typeof metadata.hint === "string" ? metadata.hint : null,
  };
}

function classifyCallbackError(error: unknown) {
  if (oauthModule.isLineLoginOAuthError(error)) {
    const code = error?.code || "callback_failed";
    if (["invalid_oauth_session", "invalid_oauth_state"].includes(code)) return "session_expired";
    if (["invalid_authorization_code", "missing_id_token"].includes(code)) return "login_invalid";
    if (code === "token_exchange_unavailable") return "temporarily_unavailable";
  }
  if (verifierModule.isLineIdTokenVerificationError(error)) {
    return error?.code === "verification_unavailable"
      ? "temporarily_unavailable"
      : "login_invalid";
  }
  if (ingressModule.isLineBindingIngressServiceError(error)) {
    return error?.code === "request_conflict" ? "request_conflict" : "binding_failed";
  }
  if (error instanceof Error && error.message.includes("MINICHI_LINE_LOGIN")) {
    return "not_configured";
  }
  return "callback_failed";
}

function resultRedirect(request: NextRequest, result: string, secure: boolean) {
  const url = new URL("/line-register/result", publicAppOrigin(request));
  url.searchParams.set("result", result);
  const response = NextResponse.redirect(url, 303);
  response.cookies.set(
    oauthModule.OAUTH_COOKIE_NAME,
    "",
    oauthModule.oauthCookieOptions({ maxAge: 0, secure }),
  );
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
