const assert = require("node:assert/strict");
const test = require("node:test");

const repository = require("../src/server/line-login-security-repository");

function databaseReturning(value) {
  const calls = [];
  return {
    calls,
    async query(sql, params) {
      calls.push({ params, sql });
      return { rows: [{ [Object.keys(value)[0]]: Object.values(value)[0] }] };
    },
  };
}

test("security repository calls only the narrowly granted private RPCs", async () => {
  const database = databaseReturning({ allowed: true });
  assert.equal(await repository.consumeLineLoginRateLimit(database, "line_start_ip", "a".repeat(64)), true);
  assert.match(database.calls[0].sql, /private\.consume_line_login_rate_limit/);
  assert.deepEqual(database.calls[0].params, ["line_start_ip", "a".repeat(64)]);

  const issuer = databaseReturning({ issued: true });
  assert.equal(await repository.issueLineLoginStartToken(issuer, "b".repeat(64), "c".repeat(64)), true);
  assert.match(issuer.calls[0].sql, /private\.issue_line_login_start_token/);

  const consumer = databaseReturning({ consumed: true });
  assert.equal(await repository.consumeLineLoginStartToken(consumer, "c".repeat(64)), true);
  assert.match(consumer.calls[0].sql, /private\.consume_line_login_start_token/);
});
