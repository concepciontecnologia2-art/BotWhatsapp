const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 3,
});

const query = async (text, params) => {
  const res = await pool.query(text, params);
  return res.rows;
};

module.exports = { query };