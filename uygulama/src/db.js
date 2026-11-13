const mysql = require('mysql2/promise');
const config = require('./config');

const primary = mysql.createPool({
  ...config.primary,
  waitForConnections: true,
  connectionLimit: 10
});

const replica = mysql.createPool({
  ...config.replica,
  waitForConnections: true,
  connectionLimit: 10
});

async function read(sql, params = []) {
  const [rows] = await replica.execute(sql, params);
  return rows;
}

async function write(sql, params = []) {
  const [rows] = await primary.execute(sql, params);
  return rows;
}

async function call(sql, params = []) {
  const [rows] = await primary.execute(sql, params);
  return rows;
}

module.exports = { primary, replica, read, write, call };
