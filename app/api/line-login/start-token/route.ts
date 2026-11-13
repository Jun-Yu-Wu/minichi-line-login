import { randomBytes } from "node:crypto";

import config from "../../../../src/server/config";
import database from "../../../../src/server/database";
import securityModule from "../../../../src/server/line-login-security-repository";
import requestSecurity from "../../../../src/server/public-request-security";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const oauthConfig = config.lineLoginWebConfig();
    if (!requestSecurity.isSameOriginRequest(request, new URL(oauthConfig.callbackUrl).origin)) {
      return json({ error: "forbidden" }, 403);
    }
    try {
      await requestSecurity.readBoundedBody(request, 0);
    } catch (error) {
      if (error instanceof requestSecurity.RequestBodyTooLargeError) {
        return json({ error: "request_too_large" }, 413);
      }
      return json({ error: "invalid_request" }, 400);
    }

    const clientIp = requestSecurity.trustedClientIp(request);
    if (!clientIp) return json({ error: "client_ip_unavailable" }, 503);

    const token = randomBytes(32).toString("base64url");
    const issued = await securityModule.issueLineLoginStartToken(
      database.getDatabasePool(),
      requestSecurity.hashRateLimitKey(oauthConfig.channelSecret, "csrf-issue-ip", clientIp),
      requestSecurity.hashOneTimeToken(token),
    );
    if (!issued) return json({ error: "rate_limited" }, 429);
    return json({ csrfToken: token }, 200);
  } catch (error) {
    console.error("LINE Login start token issuance failed", {
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    return json({ error: "not_configured" }, 503);
  }
}

function json(payload: Record<string, unknown>, status: number) {
  return Response.json(payload, {
    headers: { "cache-control": "no-store" },
    status,
  });
}
