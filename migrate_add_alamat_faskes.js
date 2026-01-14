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
  
  const sql = 'ALTER TABLE hasil_on_desk ADD COLUMN alamat_faskes VARCHAR(255) AFTER nama_faskes';
  
  connection.query(sql, (error, results) => {
    if (error) {
      // Check if column already exists
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('✓ Kolom alamat_faskes sudah ada di database');
      } else {
        console.error('Error:', error.message);
      }
    } else {
      console.log('✓ Kolom alamat_faskes berhasil ditambahkan ke tabel hasil_on_desk');
    }
    
    connection.end(() => {
      console.log('Database connection closed');
      process.exit(0);
    });
  });
});
