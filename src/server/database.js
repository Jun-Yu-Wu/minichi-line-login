const { Pool } = require("pg");

const config = require("./config");

let pool;

function getDatabasePool() {
  if (!pool) pool = new Pool(config.databaseConfig());
  return pool;
}

async function closeDatabasePool() {
  if (!pool) return;
  const current = pool;
  pool = null;
  await current.end();
}

module.exports = {
  closeDatabasePool,
  getDatabasePool,
};
