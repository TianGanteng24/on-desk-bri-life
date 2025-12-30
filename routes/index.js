const express = require('express');
const db = require('../config/db');
const generatePdf = require('../pdf/laporanPdf');
const crypto = require('crypto');


const router = express.Router();

async function auth(req, res, next) {
  // Check if user session exists
  if (!req.session.user) {
    return res.redirect('/login');
  }

  // Session is valid, proceed
  next();
}

function adminOnly(req, res, next) {
  if (req.session.user.role !== 'admin') {
    return res.redirect('/laporan');
  }
  next();
}

const bcrypt = require('bcrypt');

/* LOGIN FORM */
router.get('/login', (req, res) => {
  res.render('auth/login');
});

/* LOGIN PROCESS */
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    const [rows] = await db.query(
      'SELECT * FROM users WHERE username=?',
      [username]
    );
    if (!rows.length) {
      return res.render('auth/login', { error: 'User tidak ditemukan' });
    }

    const user = rows[0];
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      return res.render('auth/login', { error: 'Password salah' });
    }

    // ✅ Set session user (no database update needed)
    req.session.user = {
      id: user.id,
      username: user.username,
      role: user.role
    };

    console.log(`✅ User ${user.id} (${user.username}) logged in`);
    res.redirect('/laporan');
  } catch (error) {
    console.log(error);
    res.status(500).send('Database error');
  }
});


router.get('/logout', auth, async (req, res) => {
  const userId = req.session?.user?.id;
  req.session.destroy(() => {
    console.log(`✅ User ${userId} logged out (session destroyed)`);
    res.redirect('/login');
  });
});


router.post('/auto-logout', async (req, res) => {
  const userId = req.session?.user?.id;
  
  if (!userId) {
    console.log('⚠️ Auto logout: No user in session');
    return res.status(200).json({ status: 'no-session' });
  }

  try {
    // Simply destroy the session (no database update needed)
    if (req.session) {
      req.session.destroy((err) => {
        if (err) {
          console.error('❌ Session destroy error:', err);
        } else {
          console.log(`✅ User ${userId} auto-logged out (session destroyed)`);
        }
      });
    }

    res.status(200).json({ status: 'logged-out', userId });
  } catch (err) {
    console.error('❌ Auto logout error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/heartbeat', auth, async (req, res) => {
  await db.query(
    'UPDATE users SET last_activity=NOW() WHERE id=?',
    [req.session.user.id]
  );
  res.sendStatus(204);
});


/* =========================
   ROOT
========================= */
router.get('/', (req, res) => {
  res.redirect('/login');
});

/* INDEX */
router.get('/laporan', auth, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM laporan_investigasi ORDER BY id DESC'
    );
    res.render('laporan/index', { rows, user: req.session.user });
  } catch (error) {
    console.log(error);
    res.status(500).send('Database error');
  }
});

/* CREATE */
router.get('/laporan/create', auth, (req, res) => {
  res.render('laporan/create', { user: req.session.user });
});

/* =========================
   LAPORAN INVESTIGASI
========================= */
/* SHOW */
router.get('/laporan/:id', auth, async (req, res) => {
  try {
    const laporanId = req.params.id;

    // ===============================
    // 1. DATA UTAMA LAPORAN
    // ===============================
    const [laporanRows] = await db.query(`
      SELECT 
        l.*,
        u.username AS created_by_name,

        -- DESWA
        d.pic_investigator       AS pic_investigator_deswa,
        d.tanggal_mulai          AS tanggal_mulai_deswa,
        d.tanggal_selesai        AS tanggal_selesai_deswa,
        d.sla_proses             AS sla_deswa,

        -- BRI
        b.pic_investigator       AS pic_brilife,
        b.tanggal_submit_pic_analis       AS tanggal_submit_pic,
        b.tanggal_submit_pic_investigator AS tanggal_submit_investigator,
        b.sla                    AS sla_brilife

      FROM laporan_investigasi l
      LEFT JOIN users u ON u.id = l.created_by
      LEFT JOIN deswa d ON d.laporan_id = l.id
      LEFT JOIN bri b   ON b.laporan_id = l.id
      WHERE l.id = ?
      LIMIT 1
    `, [laporanId]);

    if (!laporanRows.length) {
      return res.status(404).send('Laporan tidak ditemukan');
    }

    const dataLaporan = laporanRows[0];

    // ===============================
    // 2. LOG PENELPONAN (FULL)
    // ===============================
    const [penelponanRows] = await db.query(`
      SELECT *
      FROM penelponan
      WHERE laporan_id = ?
      ORDER BY id ASC
    `, [laporanId]);

    // ===============================
    // 3. RESUME INTERVIEW
    // ===============================
    const [resumeRows] = await db.query(`
      SELECT *
      FROM resume_hasil_interview
      WHERE laporan_id = ?
      LIMIT 1
    `, [laporanId]);

    // ===============================
    // 4. RENDER (SEMUA VARIABEL TERISI)
    // ===============================
    res.render('laporan/show', {
      dataLaporan,
      data: dataLaporan,
      penelponan: penelponanRows || [],
      resume_interview: resumeRows || [],
      user: req.session.user,
      created_by: dataLaporan.created_by // ID user pembuat
    });

  } catch (err) {
    console.error('DETAIL LAPORAN ERROR:', err);
    res.status(500).send(err.message);
  }
});

/* STORE */
router.post('/laporan/store', auth, async (req, res) => {
  try {
    const {
      nama_pemegang_polis,
      no_peserta,
      nama_tertanggung,
      no_telepon,
      alamat,
      masa_asuransi,
      uang_pertanggungan,
      tanggal_lahir,
      tanggal_meninggal,
      status_asuransi,
      kronologis,
      kelengkapan_dokumen,
      pengisi_form_kronologis  // ⬅️ BARU
    } = req.body;

    await db.query(`
      INSERT INTO laporan_investigasi (
        nama_pemegang_polis,
        no_peserta,
        nama_tertanggung,
        no_telepon,
        alamat,
        masa_asuransi,
        uang_pertanggungan,
        tanggal_lahir,
        tanggal_meninggal,
        status_asuransi,
        kronologis,
        kelengkapan_dokumen,
        pengisi_form_kronologis,   -- ⬅️ BARU
        created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      nama_pemegang_polis,
      no_peserta,
      nama_tertanggung,
      no_telepon,
      alamat,
      masa_asuransi,
      uang_pertanggungan,
      tanggal_lahir,
      tanggal_meninggal,
      status_asuransi,
      kronologis,
      kelengkapan_dokumen,
      pengisi_form_kronologis,     // ⬅️ BARU
      req.session.user.id
    ]);

    res.redirect('/laporan');
  } catch (err) {
    console.log(err);
    res.status(500).send('Gagal menyimpan laporan');
  }
});


/* EDIT FORM */
router.get('/laporan/edit/:id', auth, async (req, res) => {
  try {
    const [row] = await db.query(
      'SELECT * FROM laporan_investigasi WHERE id=?',
      [req.params.id]
    );
    res.render('laporan/edit', { data: row[0], user: req.session.user });
  } catch (error) {
    console.log(error);
    res.status(500).send('Database error');
  }
});

/* UPDATE */
router.post('/laporan/update/:id', auth, async (req, res) => {
  try {
    const {
      nama_pemegang_polis,
      no_peserta,
      nama_tertanggung,
      no_telepon,
      alamat,
      masa_asuransi,
      uang_pertanggungan,
      tanggal_lahir,
      tanggal_meninggal,
      status_asuransi,
      kronologis,
      kelengkapan_dokumen,
      pengisi_form_kronologis   // ⬅️ BARU
    } = req.body;

    await db.query(`
      UPDATE laporan_investigasi SET
        nama_pemegang_polis = ?,
        no_peserta = ?,
        nama_tertanggung = ?,
        no_telepon = ?,
        alamat = ?,
        masa_asuransi = ?,
        uang_pertanggungan = ?,
        tanggal_lahir = ?,
        tanggal_meninggal = ?,
        status_asuransi = ?,
        kronologis = ?,
        kelengkapan_dokumen = ?,
        pengisi_form_kronologis = ?   -- ⬅️ BARU
      WHERE id = ?
    `, [
      nama_pemegang_polis,
      no_peserta,
      nama_tertanggung,
      no_telepon,
      alamat,
      masa_asuransi,
      uang_pertanggungan,
      tanggal_lahir,
      tanggal_meninggal,
      status_asuransi,
      kronologis,
      kelengkapan_dokumen,
      pengisi_form_kronologis,        // ⬅️ BARU
      req.params.id
    ]);

    res.redirect('/laporan/' + req.params.id);
  } catch (err) {
    console.error("UPDATE ERROR:", err);
    res.status(500).send('Gagal mengupdate laporan: ' + err.message);
  }
});


/* DELETE */
router.get('/laporan/delete/:id', auth, async (req, res) => {
  try {
    await db.query(
      'DELETE FROM laporan_investigasi WHERE id=?',
      [req.params.id]
    );
    res.redirect('/laporan');
  } catch (error) {
    console.log(error);
    res.status(500).send('Database error');
  }
});

/* PDF PREVIEW */
router.get('/laporan/pdf/:id', auth, (req, res) => {
  generatePdf(req, res);
});

/* =========================
   HASIL ON DESK INVESTIGATION
========================= */

/* GET HASIL ON DESK */
router.get('/laporan/:id/hasil-on-desk', auth, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM hasil_on_desk WHERE laporan_id=? ORDER BY id DESC',
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: 'Database error' });
  }
});


router.post('/hasil-on-desk/:onDeskId/penelponan', auth, async (req, res) => {
  try {
    const { tanggal_telepon, jam_telepon, hasil_telepon } = req.body;

    // Get laporan_id from hasil_on_desk table
    const [onDeskRows] = await db.query(
      'SELECT laporan_id FROM hasil_on_desk WHERE id = ?',
      [req.params.onDeskId]
    );

    if (!onDeskRows.length) {
      return res.status(404).json({ error: 'Hasil on desk tidak ditemukan' });
    }

    const laporanId = onDeskRows[0].laporan_id;

    // Check for duplicate (same on-desk, same date and time)
    const [existing] = await db.query(
      'SELECT id FROM penelponan WHERE hasil_on_desk_id = ? AND tanggal_telepon = ? AND jam_telepon = ?',
      [req.params.onDeskId, tanggal_telepon, jam_telepon]
    );

    if (existing.length) {
      return res.status(409).json({
        error: 'Log penelponan dengan tanggal dan jam yang sama sudah ada untuk on-desk ini'
      });
    }

    const [result] = await db.query(
      `INSERT INTO penelponan
       (laporan_id, hasil_on_desk_id, tanggal_telepon, jam_telepon, hasil_telepon)
       VALUES (?, ?, ?, ?, ?)`,
      [
        laporanId,
        req.params.onDeskId,
        tanggal_telepon,
        jam_telepon,
        hasil_telepon
      ]
    );

    res.json({ success: true, id: result.insertId });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: 'Database error: ' + err.message });
  }
});

router.get('/hasil-on-desk/:onDeskId/penelponan', auth, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM penelponan WHERE hasil_on_desk_id=? ORDER BY id ASC',
      [req.params.onDeskId]
    );
    res.json(rows);
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: 'Database error' });
  }
});


/* GET PENELPONAN */
router.get('/laporan/:id/penelponan', auth, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM penelponan WHERE laporan_id=? ORDER BY id ASC',
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: 'Database error' });
  }
});

/* DELETE PENELPONAN */
router.delete('/laporan/:id/penelponan/:penelponan_id', auth, async (req, res) => {
  try {
    await db.query(
      'DELETE FROM penelponan WHERE id=? AND laporan_id=?',
      [req.params.penelponan_id, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: 'Database error' });
  }
});

/* =========================
   RESUME INVESTIGASI
========================= */

/* GET RESUME INVESTIGASI */
router.get('/laporan/:id/resume-investigasi', auth, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM resume_investigasi WHERE laporan_id=? ORDER BY id DESC',
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: 'Database error' });
  }
});

/* POST RESUME INVESTIGASI */
router.post('/laporan/:id/resume-investigasi', auth, async (req, res) => {
  try {
    const { hasil } = req.body;
    const [result] = await db.query(
      'INSERT INTO resume_investigasi (laporan_id, hasil) VALUES (?, ?)',
      [req.params.id, hasil]
    );
    res.json({ id: result.insertId });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: 'Database error' });
  }
});

/* DELETE RESUME INVESTIGASI */
router.delete('/laporan/:id/resume-investigasi/:resume_id', auth, async (req, res) => {
  try {
    await db.query(
      'DELETE FROM resume_investigasi WHERE id=? AND laporan_id=?',
      [req.params.resume_id, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: 'Database error' });
  }
});

/* GET RESUME INTERVIEW */
router.get('/laporan/:id/resume-interview', auth, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM resume_hasil_interview WHERE laporan_id=? LIMIT 1',
      [req.params.id]
    );
    res.json(rows.length ? rows[0] : {});
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: 'Database error' });
  }
});

/* POST RESUME INTERVIEW - Initial create or update */
router.post('/laporan/:id/resume-interview', auth, async (req, res) => {
  try {
    const { hasil_interview, redaksional } = req.body;
    console.log('POST /resume-interview', { id: req.params.id, hasil_interview, redaksional });
    
    // Check if exists
    const [existing] = await db.query(
      'SELECT id FROM resume_hasil_interview WHERE laporan_id=?',
      [req.params.id]
    );
    
    if (existing.length) {
      // Update existing
      await db.query(
        'UPDATE resume_hasil_interview SET hasil_interview=?, redaksional=? WHERE laporan_id=?',
        [hasil_interview, redaksional, req.params.id]
      );
      console.log('Updated existing resume record');
      res.json({ id: existing[0].id });
    } else {
      // Create new
      const [result] = await db.query(
        'INSERT INTO resume_hasil_interview (laporan_id, hasil_interview, redaksional) VALUES (?, ?, ?)',
        [req.params.id, hasil_interview, redaksional]
      );
      console.log('Created new resume record with id:', result.insertId);
      res.json({ id: result.insertId });
    }
  } catch (err) {
    console.log('POST /resume-interview ERROR:', err);
    res.status(500).json({ error: 'Database error: ' + err.message });
  }
});

/* POST PHONE CALL DATA - Update based on telepon_ke (1/2/3) */
router.post('/laporan/:id/resume-interview/phone', auth, async (req, res) => {
  try {
    const { telepon_ke, tanggal_telepon, jam_telepon } = req.body;
    console.log('POST /resume-interview/phone', { id: req.params.id, telepon_ke, tanggal_telepon, jam_telepon });
    
    // Validate telepon_ke is 1, 2, or 3
    if (![1, 2, 3].includes(parseInt(telepon_ke))) {
      return res.status(400).json({ error: 'Telepon ke harus 1, 2, atau 3' });
    }

    // Check if resume_hasil_interview exists for this laporan
    const [existing] = await db.query(
      'SELECT id FROM resume_hasil_interview WHERE laporan_id=?',
      [req.params.id]
    );

    if (!existing.length) {
      // Create default record if doesn't exist
      console.log('Creating default resume record');
      await db.query(
        'INSERT INTO resume_hasil_interview (laporan_id, hasil_interview, redaksional) VALUES (?, ?, ?)',
        [req.params.id, '', '']
      );
    }

    // Update phone columns based on telepon_ke
    const dateCol = `tgl_telpon_${telepon_ke}`;
    const timeCol = `jam_telpon_${telepon_ke}`;
    const query = `UPDATE resume_hasil_interview SET ${dateCol}=?, ${timeCol}=? WHERE laporan_id=?`;
    console.log('Executing query:', query, [tanggal_telepon, jam_telepon, req.params.id]);
    await db.query(query, [tanggal_telepon, jam_telepon, req.params.id]);
    
    console.log('Phone data saved successfully');
    res.json({ success: true });
  } catch (err) {
    console.log('POST /resume-interview/phone ERROR:', err);
    res.status(500).json({ error: 'Database error: ' + err.message });
  }
});

/* RESUME INTERVIEW - Legacy */
router.post('/laporan/:id/resume', auth, async (req, res) => {
  // Redirect to new endpoint
  try {
    const { hasil_interview, redaksional } = req.body;
    const [existing] = await db.query(
      'SELECT id FROM resume_hasil_interview WHERE laporan_id=?',
      [req.params.id]
    );
    
    if (existing.length) {
      await db.query(
        'UPDATE resume_hasil_interview SET hasil_interview=?, redaksional=? WHERE laporan_id=?',
        [hasil_interview, redaksional, req.params.id]
      );
      res.json({ id: existing[0].id });
    } else {
      const [result] = await db.query(
        'INSERT INTO resume_hasil_interview (laporan_id, hasil_interview, redaksional) VALUES (?, ?, ?)',
        [req.params.id, hasil_interview, redaksional]
      );
      res.json({ id: result.insertId });
    }
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: 'Database error' });
  }
});


router.post('/laporan/:id/hasil-on-desk', auth, async (req, res) => {
  try {
    const {
      nama_faskes,
      no_kontak,
      alamat_faskes,
      tanggal_investigasi,
      nama_petugas,
      hasil_investigasi
    } = req.body;

    const [result] = await db.query(`
      INSERT INTO hasil_on_desk (
        laporan_id,
        nama_faskes,
        no_kontak,
        alamat_faskes,
        tanggal_investigasi,
        nama_petugas,
        hasil_investigasi
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      req.params.id,
      nama_faskes,
      no_kontak,
      alamat_faskes,
      tanggal_investigasi,
      nama_petugas,
      hasil_investigasi
    ]);

    res.json({ success: true, id: result.insertId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        error: 'Data hasil on desk sudah ada'
      });
    }
    console.log(err);
    res.status(500).json({ error: 'Database error' });
  }
});

/* DELETE HASIL ON DESK */
router.delete('/laporan/:laporan_id/hasil-on-desk/:id', auth, async (req, res) => {
  try {
    await db.query(
      'DELETE FROM hasil_on_desk WHERE id=? AND laporan_id=?',
      [req.params.id, req.params.laporan_id]
    );
    res.json({ success: true });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: 'Database error' });
  }
});

/* =========================
   FASKES / MASTER NAMA FASKES
========================= */

router.get('/faskes', auth, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM faskes ORDER BY nama_faskes'
    );
    res.json(rows);
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: 'Database error' });
  }
});

router.post('/faskes', auth, async (req, res) => {
  try {
    const { nama_faskes } = req.body;
    const [result] = await db.query(
      'INSERT INTO faskes (nama_faskes) VALUES (?)',
      [nama_faskes]
    );
    res.json({ id: result.insertId, nama_faskes });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: 'Database error' });
  }
});

/* =========================
   DESWA (On Desk process metadata)
   Note: requires `deswa.laporan_id` column to exist.
========================= */

router.get('/laporan/:id/deswa', auth, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM deswa WHERE laporan_id=? ORDER BY id DESC',
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: 'Database error' });
  }
});

router.post('/laporan/:id/deswa', auth, async (req, res) => {
  try {
    const {
      pic_investigator,
      tanggal_mulai,
      tanggal_selesai
    } = req.body;

    // Auto-calculate SLA (hari) = tanggal_selesai - tanggal_mulai
    const start = new Date(tanggal_mulai);
    const end = new Date(tanggal_selesai);
    const sla_proses = Math.ceil((end - start) / (1000 * 60 * 60 * 24));

    await db.query(`
      INSERT INTO deswa (
        laporan_id,
        pic_investigator,
        tanggal_mulai,
        tanggal_selesai,
        sla_proses
      ) VALUES (?, ?, ?, ?, ?)
    `, [
      req.params.id,
      pic_investigator,
      tanggal_mulai,
      tanggal_selesai,
      sla_proses
    ]);

    res.json({ success: true });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: 'Database error' });
  }
});

router.delete('/laporan/:laporan_id/deswa/:id', auth, async (req, res) => {
  try {
    await db.query(
      'DELETE FROM deswa WHERE id=? AND laporan_id=?',
      [req.params.id, req.params.laporan_id]
    );
    res.json({ success: true });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: 'Database error' });
  }
});


/* =========================
   BRI
   Note: requires `bri.laporan_id` column to exist.
========================= */

router.get('/laporan/:id/bri', auth, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM bri WHERE laporan_id=? ORDER BY id DESC',
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: 'Database error' });
  }
});

router.post('/laporan/:id/bri', auth, async (req, res) => {
  try {
    const {
      pic_investigator,
      tanggal_submit_pic_analis,
      tanggal_submit_pic_investigator
    } = req.body;

    // Auto-calculate SLA (hari) = tanggal_submit_pic_investigator - tanggal_submit_pic_analis
    let sla = null;
    if (tanggal_submit_pic_analis && tanggal_submit_pic_investigator) {
      const start = new Date(tanggal_submit_pic_analis);
      const end = new Date(tanggal_submit_pic_investigator);
      sla = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    }

    await db.query(`
      INSERT INTO bri (
        laporan_id,
        pic_investigator,
        tanggal_submit_pic_analis,
        tanggal_submit_pic_investigator,
        sla
      ) VALUES (?, ?, ?, ?, ?)
    `, [
      req.params.id,
      pic_investigator,
      tanggal_submit_pic_analis,
      tanggal_submit_pic_investigator,
      sla
    ]);

    res.json({ success: true });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: 'Database error' });
  }
});

router.delete('/laporan/:laporan_id/bri/:id', auth, async (req, res) => {
  try {
    await db.query(
      'DELETE FROM bri WHERE id=? AND laporan_id=?',
      [req.params.id, req.params.laporan_id]
    );
    res.json({ success: true });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: 'Database error' });
  }
});

router.post('/laporan/ondesk/:ondesk_id/telp', auth, async (req, res) => {
    try {
        const { tanggal_telepon, jam_telepon, hasil_telepon } = req.body;
        const ondeskId = req.params.ondesk_id;

        // Cek kuota penelponan ondesk (Max 3)
        const [rows] = await db.query('SELECT COUNT(*) as total FROM penelponan WHERE hasil_on_desk_id = ?', [ondeskId]);
        
        if (rows[0].total >= 3) return res.status(400).send("Quota On-Desk Penuh");

        await db.query(
            'INSERT INTO penelponan (hasil_on_desk_id, tanggal_telepon, jam_telepon, hasil_telepon) VALUES (?, ?, ?, ?)',
            [ondeskId, tanggal_telepon, jam_telepon, hasil_telepon]
        );
        res.redirect('back');
    } catch (err) { res.status(500).send(err.message); }
});

router.post('/laporan/interview/:interview_id/resume', auth, async (req, res) => {
    try {
        const { tanggal_telepon, jam_telepon, hasil_interview } = req.body;
        const interviewId = req.params.interview_id;

        // Cek kuota interview (Max 3)
        const [rows] = await db.query('SELECT COUNT(*) as total FROM resume_hasil_interview WHERE interview_id = ?', [interviewId]);
        
        if (rows[0].total >= 3) return res.status(400).send("Quota Interview Penuh");

        await db.query(
            'INSERT INTO resume_hasil_interview (interview_id, tanggal_telepon, jam_telepon, hasil_interview) VALUES (?, ?, ?, ?)',
            [interviewId, tanggal_telepon, jam_telepon, hasil_interview]
        );
        res.redirect('back');
    } catch (err) { res.status(500).send(err.message); }
});

module.exports = router;

