const defaultRepository = require("./line-binding-ingress-repository");

class LineBindingIngressServiceError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "LineBindingIngressServiceError";
    this.code = code;
  }
}

function requireInput(input = {}) {
  const claimedAlias = String(input.claimedAlias || "").normalize("NFKC").trim();
  const providerScope = String(input.providerScope || "").trim();
  const providerSubject = String(input.providerSubject || "").trim();
  if (!claimedAlias || claimedAlias.length > 160) {
    throw new LineBindingIngressServiceError(
      "invalid_alias",
      "請填寫 160 字以內的 LINE 社群名稱。",
    );
  }
  if (!providerScope || !providerSubject) {
    throw new LineBindingIngressServiceError(
      "invalid_identity",
      "LINE 登入身分資料不完整，請重新登入後再試。",
    );
  }
  return {
    claimedAlias,
    displayNameSnapshot: String(input.displayNameSnapshot || "").trim().slice(0, 160) || null,
    provider: "line",
    providerScope,
    providerSubject,
  };
}

function translateDatabaseError(error) {
  if (error?.code !== "23505") return error;
  return new LineBindingIngressServiceError(
    "request_conflict",
    "LINE 綁定申請正在處理，請稍後再試。",
  );
}

function createLineBindingIngressService({
  repository = defaultRepository,
  requestTtlMinutes = 1440,
} = {}) {
  return {
    async submit(database, input) {
      const normalized = requireInput(input);
      const normalizedClaimedAlias = repository.normalizeCustomerAlias(normalized.claimedAlias);
      try {
        const result = await repository.submitLineBindingRequest(database, {
          ...normalized,
          normalizedClaimedAlias,
        }, requestTtlMinutes);
        if (!result) {
          throw new LineBindingIngressServiceError(
            "request_failed",
            "LINE 綁定申請沒有取得有效結果。",
          );
        }
        if (result.disposition === "already_bound") {
          return { disposition: "already_bound", request: null, status: "bound" };
        }
        if (result.disposition === "auto_approved") {
          return {
            disposition: "auto_approved",
            request: result,
            status: result.status || "bound",
          };
        }
        return {
          disposition: result.disposition === "reused" ? "reused" : "created",
          request: result,
          status: result.status || "pending",
        };
      } catch (error) {
        throw translateDatabaseError(error);
      }
    },
  };
}

function isLineBindingIngressServiceError(error) {
  return error instanceof LineBindingIngressServiceError;
}

module.exports = {
  LineBindingIngressServiceError,
  createLineBindingIngressService,
  isLineBindingIngressServiceError,
  requireInput,
};
