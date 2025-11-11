const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: "localhost",
  user: "root",     // change to your MySQL user
  password: "1234",     // change to your MySQL password
  database: "lost_found" // change to your DB name
});

module.exports = pool;
