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
    // Add columns to deswa table
    "ALTER TABLE deswa ADD COLUMN tanggal_sla_awal DATE NULL AFTER sla_proses",
    "ALTER TABLE deswa ADD COLUMN jam_sla_awal VARCHAR(10) NULL AFTER tanggal_sla_awal",
    "ALTER TABLE deswa ADD COLUMN jam_kirim_laporan VARCHAR(10) NULL AFTER tanggal_kirim_laporan",
    "ALTER TABLE deswa ADD COLUMN jam_terima_konfirmasi_bri VARCHAR(10) NULL AFTER tanggal_terima_konfirmasi_bri",
    "ALTER TABLE deswa ADD COLUMN jam_mulai_ondesk_lanjutan VARCHAR(10) NULL AFTER tanggal_mulai_ondesk_lanjutan",
    "ALTER TABLE deswa ADD COLUMN jam_selesai_ondesk_lanjutan VARCHAR(10) NULL AFTER tanggal_selesai_ondesk_lanjutan",
    "ALTER TABLE deswa ADD COLUMN jam_kirim_laporan_lanjutan VARCHAR(10) NULL AFTER tanggal_kirim_laporan_lanjutan",
    "ALTER TABLE deswa ADD COLUMN jam_terima_konfirmasi_lanjutan_bri VARCHAR(10) NULL AFTER tanggal_terima_konfirmasi_lanjutan_bri",
    
    // Add columns to bri table
    "ALTER TABLE bri ADD COLUMN jam_submit_pic_analis VARCHAR(10) NULL AFTER tanggal_submit_pic_analis",
    "ALTER TABLE bri ADD COLUMN jam_submit_pic_investigator VARCHAR(10) NULL AFTER tanggal_submit_pic_investigator"
  ];

  let completed = 0;
  queries.forEach((sql) => {
    connection.query(sql, (error) => {
      if (error) {
        if (error.code === 'ER_DUP_FIELDNAME' || error.errno === 1060) {
          // Column already exists, ignore
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
