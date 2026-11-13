async function consumeLineLoginRateLimit(database, bucket, keyHash) {
  const result = await database.query(`
    select private.consume_line_login_rate_limit($1, $2) as allowed
  `, [bucket, keyHash]);
  return result.rows[0]?.allowed === true;
}

async function issueLineLoginStartToken(database, ipHash, tokenHash) {
  const result = await database.query(`
    select private.issue_line_login_start_token($1, $2) as issued
  `, [ipHash, tokenHash]);
  return result.rows[0]?.issued === true;
}

async function consumeLineLoginStartToken(database, tokenHash) {
  const result = await database.query(`
    select private.consume_line_login_start_token($1) as consumed
  `, [tokenHash]);
  return result.rows[0]?.consumed === true;
}

module.exports = {
  consumeLineLoginRateLimit,
  consumeLineLoginStartToken,
  issueLineLoginStartToken,
};
