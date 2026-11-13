import config from "../../../src/server/config";
import database from "../../../src/server/database";
import ingressModule from "../../../src/server/line-binding-ingress-service";
import securityModule from "../../../src/server/line-login-security-repository";
import verifierModule from "../../../src/server/line-id-token-verifier";
import requestSecurity from "../../../src/server/public-request-security";

export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 12 * 1024;

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") || "";
  if (contentType.split(";")[0].trim().toLowerCase() !== "application/json") {
    return json({ error: "unsupported_media_type" }, 415);
  }

  let bodyBytes;
  try {
    bodyBytes = await requestSecurity.readBoundedBody(request, MAX_BODY_BYTES);
  } catch (error) {
    if (error instanceof requestSecurity.RequestBodyTooLargeError) {
      return json({ error: "request_too_large" }, 413);
    }
    return json({ error: "invalid_request" }, 400);
  }

  let body;
  try {
    body = JSON.parse(new TextDecoder().decode(bodyBytes));
  } catch (_error) {
    body = null;
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return json({ error: "invalid_request", message: "申請資料格式不正確。" }, 400);
  }

  try {
    const ingressConfig = config.lineBindingIngressConfig();
    const clientIp = requestSecurity.trustedClientIp(request);
    if (!clientIp) return json({ error: "not_configured" }, 503);
    if (typeof body.idToken !== "string" || body.idToken.length > 8192) {
      return json({ error: "invalid_request", message: "申請資料格式不正確。" }, 400);
    }
    if (typeof body.claimedAlias !== "string" || !body.claimedAlias.trim() || body.claimedAlias.length > 160) {
      return json({ error: "invalid_alias", message: "請填寫 160 字以內的 LINE 社群名稱。" }, 400);
    }

    const pool = database.getDatabasePool();
    const ipAllowed = await securityModule.consumeLineLoginRateLimit(
      pool,
      "line_binding_ip",
      requestSecurity.hashRateLimitKey(ingressConfig.channelSecret, "binding-ip", clientIp),
    );
    if (!ipAllowed) return json({ error: "rate_limited" }, 429);

    const verified = await verifierModule.verifyLineIdToken({
      channelId: ingressConfig.channelId,
      idToken: body.idToken,
      timeoutMs: ingressConfig.verificationTimeoutMs,
    });

    const subjectAllowed = await securityModule.consumeLineLoginRateLimit(
      pool,
      "line_binding_subject",
      requestSecurity.hashRateLimitKey(
        ingressConfig.channelSecret,
        `binding-subject:${ingressConfig.channelId}`,
        verified.subject,
      ),
    );
    if (!subjectAllowed) return json({ error: "rate_limited" }, 429);

    const service = ingressModule.createLineBindingIngressService({
      requestTtlMinutes: ingressConfig.requestTtlMinutes,
    });
    const result = await service.submit(pool, {
      claimedAlias: body.claimedAlias,
      displayNameSnapshot: verified.displayName,
      providerScope: ingressConfig.channelId,
      providerSubject: verified.subject,
    });
    return json({
      expiresAt: result.request?.expires_at || null,
      requestId: result.request?.request_id || null,
      status: result.status,
    }, ["created", "auto_approved"].includes(result.disposition) ? 201 : 200);
  } catch (error) {
    if (verifierModule.isLineIdTokenVerificationError(error)) {
      const code = error?.code || "invalid_token";
      const status = code === "invalid_token" ? 401 : code === "not_configured" ? 503 : 502;
      return json({ error: code, message: error instanceof Error ? error.message : undefined }, status);
    }
    if (ingressModule.isLineBindingIngressServiceError(error)) {
      const code = error?.code || "binding_request_failed";
      const status = code.startsWith("invalid_") ? 400 : code === "request_conflict" ? 409 : 500;
      return json({ error: code, message: error instanceof Error ? error.message : undefined }, status);
    }
    if (error instanceof Error && error.message.includes("MINICHI_LINE_LOGIN_")) {
      return json({ error: "not_configured", message: "LINE 綁定服務尚未完成設定。" }, 503);
    }
    console.error("LINE binding ingress failed", {
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    return json({ error: "binding_request_failed", message: "申請暫時無法完成，請稍後再試。" }, 500);
  }
}

function json(payload: Record<string, unknown>, status: number) {
  return Response.json(payload, {
    headers: { "cache-control": "no-store" },
    status,
  });
}
