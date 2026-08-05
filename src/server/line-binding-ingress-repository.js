function normalizeCustomerAlias(value) {
  return String(value || "").normalize("NFKC").trim().toLocaleLowerCase("zh-TW");
}

/**
 * The public app is intentionally limited to USAGE on the private schema and
 * EXECUTE on this function. The function is created in the administrator schema migration as a
 * SECURITY DEFINER and owns the transaction, RLS boundary, idempotency check,
 * expiry, collision decision, and bounded no-collision auto-approval.
 */
async function submitLineBindingRequest(database, input, requestTtlMinutes) {
  const result = await database.query(`
    select disposition, status, request_id, expires_at, row_version
    from private.submit_line_binding_request($1, $2, $3, $4, $5, $6)
  `, [
    input.providerScope,
    input.providerSubject,
    input.displayNameSnapshot,
    input.claimedAlias,
    input.normalizedClaimedAlias,
    Math.max(1, Number(requestTtlMinutes) || 1440),
  ]);
  return result.rows[0] || null;
}

module.exports = {
  normalizeCustomerAlias,
  submitLineBindingRequest,
};
