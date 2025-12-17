const db = require('./config/db');

(async () => {
  try {
    const [columns] = await db.query('DESCRIBE resume_hasil_interview');
    console.log('resume_hasil_interview columns:');
    columns.forEach(col => {
      console.log(`  - ${col.Field}: ${col.Type} ${col.Null === 'NO' ? 'NOT NULL' : 'NULL'}`);
    });
  } catch (err) {
    console.error('Error:', err.message);
  }
  process.exit(0);
})();
