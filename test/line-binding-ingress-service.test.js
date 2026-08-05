const assert = require("node:assert/strict");
const test = require("node:test");

const {
  createLineBindingIngressService,
} = require("../src/server/line-binding-ingress-service");

function baseRepository(overrides = {}) {
  const submissions = [];
  return {
    submissions,
    normalizeCustomerAlias(value) { return String(value || "").normalize("NFKC").trim().toLowerCase(); },
    async submitLineBindingRequest(_database, input, requestTtlMinutes) {
      submissions.push({ input, requestTtlMinutes });
      return {
        disposition: "created",
        expires_at: "2030-01-01T01:00:00.000Z",
        request_id: "request_1",
        row_version: 1,
        status: "pending",
      };
    },
    ...overrides,
  };
}

function input(overrides = {}) {
  return {
    claimedAlias: " 小明 ",
    displayNameSnapshot: "Ming",
    providerScope: "channel_123",
    providerSubject: "U123",
    ...overrides,
  };
}

test("a no-collision result is returned as an auto-approved binding", async () => {
  const repository = baseRepository({
    async submitLineBindingRequest() {
      return {
        disposition: "auto_approved",
        expires_at: null,
        request_id: "request_auto_1",
        row_version: 2,
        status: "bound",
      };
    },
  });
  const service = createLineBindingIngressService({
    repository,
    requestTtlMinutes: 60,
  });
  const result = await service.submit({}, input({ claimedAlias: "新客人" }));
  assert.equal(result.status, "bound");
  assert.equal(result.disposition, "auto_approved");
  assert.equal(result.request.request_id, "request_auto_1");
});

test("a duplicate community nickname remains a pending administrator review request", async () => {
  const repository = baseRepository();
  const service = createLineBindingIngressService({
    repository,
    requestTtlMinutes: 60,
  });
  const result = await service.submit({}, input());
  assert.equal(result.status, "pending");
  assert.equal(result.disposition, "created");
  assert.equal(repository.submissions.length, 1);
  assert.equal(repository.submissions[0].input.provider, "line");
  assert.equal(repository.submissions[0].input.normalizedClaimedAlias, "小明");
  assert.equal(repository.submissions[0].input.providerSubject, "U123");
  assert.equal(repository.submissions[0].requestTtlMinutes, 60);
});

test("the public service never sends a candidate customer id to the ingress RPC", async () => {
  const repository = baseRepository();
  const service = createLineBindingIngressService({ repository });
  await service.submit({}, input({ claimedAlias: "新客人" }));
  assert.equal(Object.hasOwn(repository.submissions[0].input, "candidateCustomerId"), false);
});

test("already-bound LINE subject is idempotent and creates no public request result", async () => {
  const repository = baseRepository({
    async submitLineBindingRequest() {
      return { disposition: "already_bound", status: "bound" };
    },
  });
  const service = createLineBindingIngressService({ repository });
  const result = await service.submit({}, input());
  assert.deepEqual(result, { disposition: "already_bound", request: null, status: "bound" });
});

test("an unexpired pending result is reused without changing its status", async () => {
  const repository = baseRepository({
    async submitLineBindingRequest() {
      return {
        disposition: "reused",
        expires_at: "2030-01-02T00:00:00.000Z",
        request_id: "request_existing",
        status: "pending",
      };
    },
  });
  const service = createLineBindingIngressService({ repository });
  const result = await service.submit({}, input());
  assert.equal(result.disposition, "reused");
  assert.equal(result.request.request_id, "request_existing");
  assert.equal(result.status, "pending");
});

test("invalid public alias is rejected before calling the ingress RPC", async () => {
  const repository = baseRepository();
  const service = createLineBindingIngressService({ repository });
  await assert.rejects(
    service.submit({}, input({ claimedAlias: "" })),
    (error) => error.code === "invalid_alias",
  );
  assert.equal(repository.submissions.length, 0);
});
