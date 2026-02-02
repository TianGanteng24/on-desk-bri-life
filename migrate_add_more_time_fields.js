const mysql = require('mysql2');

const connection = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'project-bri'
});

connection.connect((err) => {
  if (err) {
    console.error('Error connecting to database:', err);
    process.exit(1);
  }
  
  console.log('Connected to database');
  
  const queries = [
    "ALTER TABLE deswa ADD COLUMN jam_mulai VARCHAR(10) NULL AFTER tanggal_mulai",
    "ALTER TABLE deswa ADD COLUMN jam_selesai VARCHAR(10) NULL AFTER tanggal_selesai"
  ];

  let completed = 0;
  queries.forEach((sql) => {
    connection.query(sql, (error) => {
      if (error) {
        if (error.code === 'ER_DUP_FIELDNAME' || error.errno === 1060) {
          console.log('✓ Column already exists:', sql.split(' ')[5]);
        } else {
          console.error('Error executing query:', sql, error.message);
        }
      } else {
        console.log('✓ Success:', sql);
      }
      
      completed++;
      if (completed === queries.length) {
        connection.end(() => {
          console.log('Database migration completed and connection closed');
          process.exit(0);
        });
      }
    });
  });
});
