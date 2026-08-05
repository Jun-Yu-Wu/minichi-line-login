const assert = require("node:assert/strict");
const test = require("node:test");

const repository = require("../src/server/line-binding-ingress-repository");

test("RPC submission keeps provider identity and TTL parameterized", async () => {
  let captured;
  const result = await repository.submitLineBindingRequest({
    async query(sql, params) {
      captured = { params, sql };
      return { rows: [{ disposition: "created", status: "pending", request_id: "request_1" }] };
    },
  }, {
    claimedAlias: "小明",
    displayNameSnapshot: "Ming",
    normalizedClaimedAlias: "小明",
    providerScope: "channel_123",
    providerSubject: "U123",
  }, 1440);
  assert.equal(result.request_id, "request_1");
  assert.deepEqual(captured.params, ["channel_123", "U123", "Ming", "小明", "小明", 1440]);
  assert.match(captured.sql, /private\.submit_line_binding_request/);
  assert.doesNotMatch(captured.sql, /U123/);
});

test("RPC call does not expose a candidate customer input", async () => {
  let captured;
  await repository.submitLineBindingRequest({
    async query(sql, params) {
      captured = { params, sql };
      return { rows: [] };
    },
  }, {
    claimedAlias: "小明",
    displayNameSnapshot: null,
    normalizedClaimedAlias: "小明",
    providerScope: "channel_123",
    providerSubject: "U123",
  }, 60);
  assert.equal(captured.params.length, 6);
  assert.doesNotMatch(captured.sql, /candidate_customer_id/);
});
