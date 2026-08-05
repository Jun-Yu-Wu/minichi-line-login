function positiveIntegerEnv(name, fallback) {
  const value = Number.parseInt(String(process.env[name] || ""), 10);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function configuredEnv(name) {
  const value = String(process.env[name] || "").trim();
  return value && !value.includes("replace_with_") ? value : "";
}

function databaseConfig({ connectionString: connectionStringOverride } = {}) {
  const connectionString = String(
    connectionStringOverride || configuredEnv("MINICHI_LINE_LOGIN_DB_URL"),
  ).trim();
  if (!connectionString) throw new Error("MINICHI_LINE_LOGIN_DB_URL is required");
  return {
    connectionString,
    ssl: String(process.env.MINICHI_LINE_LOGIN_DB_SSL || "true") !== "false"
      ? { rejectUnauthorized: false }
      : false,
    max: positiveIntegerEnv("MINICHI_LINE_LOGIN_DB_POOL_MAX", 2),
    connectionTimeoutMillis: positiveIntegerEnv(
      "MINICHI_LINE_LOGIN_DB_CONNECTION_TIMEOUT_MS",
      5000,
    ),
    idleTimeoutMillis: positiveIntegerEnv(
      "MINICHI_LINE_LOGIN_DB_IDLE_TIMEOUT_MS",
      10000,
    ),
    statement_timeout: positiveIntegerEnv(
      "MINICHI_LINE_LOGIN_DB_STATEMENT_TIMEOUT_MS",
      10000,
    ),
    query_timeout: positiveIntegerEnv(
      "MINICHI_LINE_LOGIN_DB_QUERY_TIMEOUT_MS",
      12000,
    ),
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
    application_name: "minichi_line_login",
  };
}

function lineBindingIngressConfig() {
  const channelId = configuredEnv("MINICHI_LINE_LOGIN_CHANNEL_ID");
  if (!channelId) throw new Error("MINICHI_LINE_LOGIN_CHANNEL_ID is required");
  return {
    channelId,
    requestTtlMinutes: positiveIntegerEnv(
      "MINICHI_LINE_BINDING_REQUEST_TTL_MINUTES",
      1440,
    ),
    verificationTimeoutMs: positiveIntegerEnv(
      "MINICHI_LINE_VERIFY_TIMEOUT_MS",
      5000,
    ),
  };
}

function lineLoginWebConfig() {
  const ingress = lineBindingIngressConfig();
  const channelSecret = configuredEnv("MINICHI_LINE_LOGIN_CHANNEL_SECRET");
  const callbackUrl = String(
    process.env.MINICHI_LINE_LOGIN_CALLBACK_URL || "",
  ).trim();
  if (!channelSecret) throw new Error("MINICHI_LINE_LOGIN_CHANNEL_SECRET is required");
  if (!callbackUrl) throw new Error("MINICHI_LINE_LOGIN_CALLBACK_URL is required");
  let parsedCallback;
  try {
    parsedCallback = new URL(callbackUrl);
  } catch (_error) {
    throw new Error("MINICHI_LINE_LOGIN_CALLBACK_URL must be an absolute URL");
  }
  if (!new Set(["http:", "https:"]).has(parsedCallback.protocol)) {
    throw new Error("MINICHI_LINE_LOGIN_CALLBACK_URL must use HTTP or HTTPS");
  }
  if (
    String(process.env.NODE_ENV || "development") === "production"
    && parsedCallback.protocol !== "https:"
  ) {
    throw new Error("MINICHI_LINE_LOGIN_CALLBACK_URL must use HTTPS in production");
  }
  const botPrompt = String(
    process.env.MINICHI_LINE_LOGIN_BOT_PROMPT || "aggressive",
  ).trim().toLowerCase();
  if (!["normal", "aggressive"].includes(botPrompt)) {
    throw new Error("MINICHI_LINE_LOGIN_BOT_PROMPT must be normal or aggressive");
  }
  return {
    ...ingress,
    botPrompt,
    callbackUrl: parsedCallback.toString(),
    channelSecret,
  };
}

function isLineBindingIngressConfigured() {
  return Boolean(
    configuredEnv("MINICHI_LINE_LOGIN_CHANNEL_ID")
    && configuredEnv("MINICHI_LINE_LOGIN_DB_URL"),
  );
}

function isLineLoginWebConfigured() {
  return Boolean(
    isLineBindingIngressConfigured()
    && configuredEnv("MINICHI_LINE_LOGIN_CHANNEL_SECRET")
    && configuredEnv("MINICHI_LINE_LOGIN_CALLBACK_URL"),
  );
}

function shouldUseSecureCookies(requestUrl) {
  if (String(process.env.NODE_ENV || "development") === "production") return true;
  if (requestUrl && new URL(requestUrl).protocol === "https:") return true;
  const override = String(process.env.MINICHI_LINE_LOGIN_COOKIE_SECURE || "").trim();
  if (override) return override === "true";
  return process.env.VERCEL === "1";
}

module.exports = {
  databaseConfig,
  isLineBindingIngressConfigured,
  isLineLoginWebConfigured,
  lineBindingIngressConfig,
  lineLoginWebConfig,
  shouldUseSecureCookies,
};
