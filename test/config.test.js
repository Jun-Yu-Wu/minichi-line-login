const assert = require("node:assert/strict");
const test = require("node:test");

const config = require("../src/server/config");

function withEnvironment(values, callback) {
  const previous = {};
  for (const [key, value] of Object.entries(values)) {
    previous[key] = process.env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    return callback();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test("LINE ingress requires the dedicated database URL and channel id", () => {
  withEnvironment({
    MINICHI_LINE_LOGIN_CHANNEL_ID: "channel_123",
    MINICHI_LINE_LOGIN_DB_URL: "postgres://line_login_ingress:secret@db.example/postgres",
  }, () => {
    assert.equal(config.isLineBindingIngressConfigured(), true);
    assert.deepEqual(config.lineBindingIngressConfig(), {
      channelId: "channel_123",
      requestTtlMinutes: 1440,
      verificationTimeoutMs: 5000,
    });
  });
});

test("LINE web login requires secret and callback URL and defaults to aggressive prompt", () => {
  withEnvironment({
    MINICHI_LINE_LOGIN_CALLBACK_URL: "https://line.example.com/api/line-login/callback",
    MINICHI_LINE_LOGIN_CHANNEL_ID: "channel_123",
    MINICHI_LINE_LOGIN_CHANNEL_SECRET: "secret_123",
    MINICHI_LINE_LOGIN_DB_URL: "postgres://configured",
    MINICHI_LINE_LOGIN_BOT_PROMPT: undefined,
    NODE_ENV: "production",
  }, () => {
    assert.equal(config.isLineLoginWebConfigured(), true);
    const value = config.lineLoginWebConfig();
    assert.equal(value.botPrompt, "aggressive");
    assert.equal(value.callbackUrl, "https://line.example.com/api/line-login/callback");
  });
});

test("production LINE callback refuses plain HTTP", () => {
  withEnvironment({
    MINICHI_LINE_LOGIN_CALLBACK_URL: "http://line.example.com/api/line-login/callback",
    MINICHI_LINE_LOGIN_CHANNEL_ID: "channel_123",
    MINICHI_LINE_LOGIN_CHANNEL_SECRET: "secret_123",
    MINICHI_LINE_LOGIN_DB_URL: "postgres://configured",
    NODE_ENV: "production",
  }, () => {
    assert.throws(
      () => config.lineLoginWebConfig(),
      /must use HTTPS in production/,
    );
  });
});

test("database config is isolated from the administrator database variable", () => {
  withEnvironment({
    MINICHI_LINE_LOGIN_DB_URL: undefined,
    SUPABASE_DB_URL: "postgres://administrator-role",
  }, () => {
    assert.throws(() => config.databaseConfig(), /MINICHI_LINE_LOGIN_DB_URL is required/);
  });
});

test("placeholder .env values are reported as not configured", () => {
  withEnvironment({
    MINICHI_LINE_LOGIN_CHANNEL_ID: "replace_with_line_login_channel_id",
    MINICHI_LINE_LOGIN_CHANNEL_SECRET: "replace_with_line_login_channel_secret",
    MINICHI_LINE_LOGIN_DB_URL: "postgresql://line_login_ingress:replace_with_password@replace_with_host:5432/postgres",
  }, () => {
    assert.equal(config.isLineBindingIngressConfigured(), false);
    assert.equal(config.isLineLoginWebConfigured(), false);
  });
});
