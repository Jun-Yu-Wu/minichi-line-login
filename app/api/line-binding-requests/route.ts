import config from "../../../src/server/config";
import database from "../../../src/server/database";
import ingressModule from "../../../src/server/line-binding-ingress-service";
import verifierModule from "../../../src/server/line-id-token-verifier";

export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 12 * 1024;

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") || "";
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (!contentType.toLowerCase().startsWith("application/json")) {
    return json({ error: "unsupported_media_type" }, 415);
  }
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return json({ error: "request_too_large" }, 413);
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return json({ error: "invalid_request", message: "申請資料格式不正確。" }, 400);
  }

  try {
    const ingressConfig = config.lineBindingIngressConfig();
    const verified = await verifierModule.verifyLineIdToken({
      channelId: ingressConfig.channelId,
      idToken: body.idToken,
      timeoutMs: ingressConfig.verificationTimeoutMs,
    });
    const service = ingressModule.createLineBindingIngressService({
      requestTtlMinutes: ingressConfig.requestTtlMinutes,
    });
    const result = await service.submit(database.getDatabasePool(), {
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
