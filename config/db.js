const mysql = require('mysql2');

const db = mysql.createPool({
  host: 'localhost',
  user: 'deswa',
  password: 'Admin@2025',
  database: 'project-bri'
});

module.exports = db.promise();
