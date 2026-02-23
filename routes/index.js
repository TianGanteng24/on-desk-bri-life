const express = require('express');
const db = require('../config/db');
const generatePdf = require('../pdf/laporanPdf');
const generateWord = require('../word/laporanWord');
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
      req.flash('error', 'User tidak ditemukan');
      return res.redirect('/login');
    }

    const user = rows[0];
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      req.flash('error', 'Password salah');
      return res.redirect('/login');
    }

    // ✅ Set session user (no database update needed)
    req.session.user = {
      id: user.id,
      username: user.username,
      role: user.role
    };

    console.log(`✅ User ${user.id} (${user.username}) logged in`);
    req.flash('success', 'Selamat datang, ' + user.username);
    res.redirect('/laporan');
  } catch (error) {
    console.log(error);
    req.flash('error', 'Terjadi kesalahan pada server');
    res.redirect('/login');
  }
});


router.get('/logout', auth, async (req, res) => {
  const userId = req.session?.user?.id;
  req.session.destroy(() => {
    console.log(`✅ User ${userId} logged out (session destroyed)`);
    res.redirect('/login');
  });
});

// 1. GET: Menampilkan Daftar User
router.get('/users', async (req, res) => {
    try {
       const currentUser = req.session.user; 

        if (!currentUser || currentUser.role !== 'admin') {
            return res.redirect('/login'); // Lempar ke login jika tidak ada user/bukan admin
        }

        // Ambil semua data user dari database
        const [users] = await db.query('SELECT id, username, role FROM users');
        
        res.render('users/index', { 
            user: currentUser, // Mengirim data user yang login 
            users: users    // Mengirim daftar user hasil query
        });
    } catch (error) {
        console.error(error);
        req.flash('error', 'Terjadi kesalahan pada server');
        res.redirect('/laporan');
    }
});

// 2. GET: Menampilkan Form Tambah User
router.get('/users/create', (req, res) => {
    res.render('users/create', { user: req.user });
});

// 3. POST: Menyimpan User Baru ke Database
router.post('/users/create', async (req, res) => {
    try {
        const { username, password, role } = req.body;
        
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Logika simpan ke database (password sebaiknya di-hash dengan bcrypt)
        await db.query(
            'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
            [username, hashedPassword, role]
        );

        req.flash('success', 'User berhasil ditambahkan');
        res.redirect('/users'); // Kembali ke daftar user setelah berhasil
    } catch (error) {
        console.log(error);
        req.flash('error', 'Gagal menambah user: ' + error.message);
        res.redirect('/users/create');
    }
});

// Route Update (POST)
router.post('/users/update', async (req, res) => {
    try {
        const { id, username, password, role } = req.body;
        let query = "UPDATE users SET username=?, role=? WHERE id=?";
        let params = [username, role, id];

        if (password) {
            const hashedPassword = await bcrypt.hash(password, 10);
            query = "UPDATE users SET username=?, role=?, password=? WHERE id=?";
            params = [username, role, hashedPassword, id]; 
        }

        await db.query(query, params);
        req.flash('success', 'User berhasil diperbarui');
        res.redirect('/users');
    } catch (error) {
        console.error(error);
        req.flash('error', 'Gagal memperbarui user');
        res.redirect('/users');
    }
});

// Route Delete (GET)
router.get('/users/delete/:id', async (req, res) => {
    try {
        await db.query("DELETE FROM users WHERE id = ?", [req.params.id]);
        req.flash('success', 'User berhasil dihapus');
        res.redirect('/users');
    } catch (error) {
        console.error(error);
        req.flash('error', 'Gagal menghapus user');
        res.redirect('/users');
    }
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
/* HALAMAN DAFTAR LAPORAN (BY ROLE) */
router.get('/laporan', auth, async (req, res) => {
  try {
    const user = req.session.user;
    let query = '';
    let params = [];

    // Cek Role User
    if (user.role === 'admin' || user.role === 'bri') {
      // Jika Admin atau BRI: Tarik semua data laporan
      query = `
        SELECT l.*, u.username as created_by_name 
        FROM laporan_investigasi l
        LEFT JOIN users u ON l.created_by = u.id 
        ORDER BY l.created_at DESC
      `;
    } else {
      // Jika User Biasa: Tarik data miliknya saja
      query = `
        SELECT l.*, u.username as created_by_name 
        FROM laporan_investigasi l
        LEFT JOIN users u ON l.created_by = u.id 
        WHERE l.created_by = ?
        ORDER BY l.created_at DESC
      `;
      params = [user.id];
    }

    const [rows] = await db.query(query, params);
    res.render('laporan/index', { data: rows, user });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Gagal memuat daftar laporan');
    res.redirect('/login');
  }
});

/* CREATE */
router.get('/laporan/create', auth, (req, res) => {
  res.render('laporan/create', { user: req.session.user });
});

/* SHOW */
router.get('/laporan/:id', auth, async (req, res) => {
  try {
    const laporanId = req.params.id;
    const user = req.session.user; // Pastikan nama variabel konsisten (user)

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
        d.tanggal_sla_awal,
        d.jam_sla_awal,
        d.tanggal_kirim_laporan,
        d.jam_kirim_laporan,
        d.tanggal_terima_konfirmasi_bri,
        d.jam_terima_konfirmasi_bri,
        d.tanggal_mulai_ondesk_lanjutan,
        d.jam_mulai_ondesk_lanjutan,
        d.tanggal_selesai_ondesk_lanjutan,
        d.jam_selesai_ondesk_lanjutan,
        d.tanggal_kirim_laporan_lanjutan,
        d.jam_kirim_laporan_lanjutan,
        d.tanggal_terima_konfirmasi_lanjutan_bri,
        d.jam_terima_konfirmasi_lanjutan_bri,
        -- BRI
        b.pic_investigator       AS pic_brilife,
        b.tanggal_submit_pic_analis       AS tanggal_submit_pic,
        b.jam_submit_pic_analis,
        b.tanggal_submit_pic_investigator AS tanggal_submit_investigator,
        b.jam_submit_pic_investigator,
        b.sla                    AS sla_brilife
      FROM laporan_investigasi l
      LEFT JOIN users u ON u.id = l.created_by
      LEFT JOIN deswa d ON d.laporan_id = l.id
      LEFT JOIN bri b   ON b.laporan_id = l.id
      WHERE l.id = ?
      LIMIT 1
    `, [laporanId]);

    if (!laporanRows.length) {
      req.flash('error', 'Laporan tidak ditemukan');
      return res.redirect('/laporan');
    }

    const dataLaporan = laporanRows[0];

    // ===============================
    // PROTEKSI / AKSES KONTROL
    // ===============================
    // Gunakan dataLaporan.created_by (bukan laporan.created_by)
    // Gunakan user.role (sesuai definisi di atas)
    if (user.role !== 'admin' && user.role !== 'bri' && dataLaporan.created_by !== user.id) {
      req.flash('error', 'Anda tidak memiliki akses ke laporan ini');
      return res.redirect('/laporan');
    }

    // ===============================
    // 2. DATA LAINNYA
    // ===============================
    const [penelponanRows] = await db.query(`
      SELECT * FROM penelponan WHERE laporan_id = ? ORDER BY id ASC
    `, [laporanId]);

    const [resumeRows] = await db.query(`
      SELECT * FROM resume_hasil_interview WHERE laporan_id = ? LIMIT 1
    `, [laporanId]);

    const [desk] = await db.query(
      `SELECT * FROM hasil_on_desk WHERE laporan_id = ? ORDER BY created_at DESC`, 
      [laporanId]
    );

    const [hasilOndeskLanjutan] = await db.query(
  'SELECT * FROM hasil_ondesk_lanjutan WHERE laporan_id=? ORDER BY created_at DESC',
  [req.params.id]
);

    // ===============================
    // 3. RENDER
    // ===============================
    // Logic Encryption untuk Public URL (QR Code) - Reversible
    // Gunakan AES-256-CBC
    const algorithm = 'aes-256-cbc';
    const secretKey = crypto.createHash('sha256').update('secret_key_anda').digest(); // 32 bytes
    const iv = crypto.randomBytes(16);
    
    const cipher = crypto.createCipheriv(algorithm, secretKey, iv);
    let encrypted = cipher.update(laporanId.toString(), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const token = `${iv.toString('hex')}:${encrypted}`;
    const publicUrl = `http://localhost:3000/view/laporan/${token}`;

    res.render('laporan/show', {
      dataLaporan,
      data: dataLaporan,
      publicUrl, // Pass publicUrl ke view
      penelponan: penelponanRows || [],
      resume_interview: resumeRows || [],
      hasilOndeskLanjutan,
      user: user, // Kirim variabel user yang benar
      desk: desk,
      created_by: dataLaporan.created_by
    });

  } catch (err) {
    console.error('DETAIL LAPORAN ERROR:', err);
    req.flash('error', 'Terjadi kesalahan saat memuat detail laporan');
    res.redirect('/laporan');
  }
});

/* STORE LAPORAN */
router.post('/laporan/store', auth, async (req, res) => {
  try {
    const d = req.body;

    // ✅ VALIDASI: Cek apakah tanggal_meninggal lebih awal dari tgl_mulai_asuransi
    if (d.tanggal_meninggal && d.tgl_mulai_asuransi) {
      const tglMeninggal = new Date(d.tanggal_meninggal);
      const tglMulai = new Date(d.tgl_mulai_asuransi);
      if (tglMeninggal < tglMulai) {
        return res.status(400).json({
          error: true,
          message: 'Tanggal Meninggal tidak boleh lebih awal dari Tanggal Mulai Asuransi!'
        });
      }
    }

    // Proteksi: Jika status_asuransi terkirim dua kali (array), ambil satu saja.
    const status_fix = Array.isArray(d.status_asuransi) ? d.status_asuransi[0] : d.status_asuransi;

    // Susun array values secara manual agar urutan masuk ke database tepat
    const values = [
      d.nama_pemegang_polis,       // 1
      d.no_peserta,                // 2
      d.nama_tertanggung,          // 3
      d.no_telepon,                // 4
      d.alamat,                    // 5
      d.uang_pertanggungan,        // 6
      d.tanggal_lahir || null,     // 7
      d.tanggal_meninggal || null,  // 8
      d.date_claim || null,  // 8
      d.lama_dirawat || null,  // 8
      status_fix,                  // 9
      d.kronologis,                // 10
      d.kelengkapan_dokumen,       // 11
      d.pengisi_form_kronologis,   // 12
      d.tgl_mulai_asuransi || null,// 13
      d.tgl_akhir_asuransi || null, // 14
      d.usia_polis,                // 15
      d.jenis_klaim,               // 16
      d.jenis_produk,              // 17
      d.no_identitas,              // 18
      d.rekomendasi,               // 19
      req.session.user.id          // 20
    ];

    const sql = `
      INSERT INTO laporan_investigasi (
        nama_pemegang_polis, no_peserta, nama_tertanggung, no_telepon,
        alamat, uang_pertanggungan, tanggal_lahir, tanggal_meninggal, date_claim, lama_dirawat,
        status_asuransi, kronologis, kelengkapan_dokumen, pengisi_form_kronologis,
        tgl_mulai_asuransi, tgl_akhir_asuransi, usia_polis, jenis_klaim,
        jenis_produk, no_identitas, rekomendasi, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await db.query(sql, values);

    req.flash('success', 'Laporan berhasil disimpan');
    res.redirect('/laporan');
  } catch (err) {
    console.error("SQL Error Detail:", err);
    req.flash('error', 'Gagal menyimpan laporan: ' + err.message);
    res.redirect('/laporan/create');
  }
});

// Route untuk menyimpan data Analisa (PIC, MA, dan Putusan)
router.post('/laporan/:id/analisa-store', auth, async (req, res) => {
    try {
        const { id } = req.params;
        const { 
            analisa_pic_investigator, 
            analisa_ma, 
            putusan_klaim, 
            analisa_putusan 
        } = req.body;

        // Menyimpan data ke tabel laporan_investigasi (Sesuai kolom di PDF Anda)
        await db.query(`
            UPDATE laporan_investigasi SET 
                analisa_pic_investigator = ?, 
                analisa_ma = ?, 
                putusan_klaim = ?, 
                analisa_putusan = ? 
            WHERE id = ?`, 
            [analisa_pic_investigator, analisa_ma, putusan_klaim, analisa_putusan, id]
        );

        res.redirect(`/laporan/${id}`);
    } catch (err) {
        console.error(err);
        req.flash('error', 'Gagal menyimpan analisa');
        res.redirect(`/laporan/${id}`);
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
    console.error(error);
    req.flash('error', 'Terjadi kesalahan pada server');
    res.redirect('/laporan');
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
      uang_pertanggungan,
      tanggal_lahir,
      tanggal_meninggal,
      date_claim,
      lama_dirawat,
      status_asuransi,
      kronologis,
      kelengkapan_dokumen,
      pengisi_form_kronologis,
      tgl_mulai_asuransi,
      tgl_akhir_asuransi,
      usia_polis,
      jenis_klaim,
      jenis_produk,
      no_identitas,
      rekomendasi
    } = req.body;

    // ✅ VALIDASI: Cek apakah tanggal_meninggal lebih awal dari tgl_mulai_asuransi
    if (tanggal_meninggal && tgl_mulai_asuransi) {
      const tglMeninggal = new Date(tanggal_meninggal);
      const tglMulai = new Date(tgl_mulai_asuransi);

      if (tglMeninggal < tglMulai) {
        return res.status(400).json({
          error: true,
          message: 'Tanggal Meninggal tidak boleh lebih awal dari Tanggal Mulai Asuransi!'
        });
      }
    }

    await db.query(`
      UPDATE laporan_investigasi SET
        nama_pemegang_polis = ?,
        no_peserta = ?,
        nama_tertanggung = ?,
        no_telepon = ?,
        alamat = ?,
        uang_pertanggungan = ?,
        tanggal_lahir = ?,
        tanggal_meninggal = ?,
        date_claim = ?,
        lama_dirawat = ?,
        status_asuransi = ?,
        kronologis = ?,
        kelengkapan_dokumen = ?,
        pengisi_form_kronologis = ?,
        tgl_mulai_asuransi = ?,
        tgl_akhir_asuransi = ?,
        usia_polis = ?,
        jenis_klaim = ?,
        jenis_produk = ?,
        no_identitas = ?,
        rekomendasi = ?
      WHERE id = ?
    `, [
      nama_pemegang_polis,
      no_peserta,
      nama_tertanggung,
      no_telepon,
      alamat,
      uang_pertanggungan,
      tanggal_lahir,
      tanggal_meninggal,
      date_claim,
      lama_dirawat,
      status_asuransi,
      kronologis,
      kelengkapan_dokumen,
      pengisi_form_kronologis,
      tgl_mulai_asuransi,
      tgl_akhir_asuransi,
      usia_polis,
      jenis_klaim,
      jenis_produk,
      no_identitas,
      rekomendasi,
      req.params.id
    ]);

    req.flash('success', 'Laporan berhasil diperbarui');
    res.redirect('/laporan/' + req.params.id);
  } catch (err) {
    console.error("UPDATE ERROR:", err);
    req.flash('error', 'Gagal memperbarui laporan: ' + err.message);
    res.redirect('/laporan/' + req.params.id);
  }
});

/* DELETE */
router.get('/laporan/delete/:id', auth, async (req, res) => {
  try {
    await db.query(
      'DELETE FROM laporan_investigasi WHERE id=?',
      [req.params.id]
    );
    req.flash('success', 'Laporan berhasil dihapus');
    res.redirect('/laporan');
  } catch (error) {
    console.log(error);
    req.flash('error', 'Gagal menghapus laporan');
    res.redirect('/laporan');
  }
});

/* PDF PREVIEW */
router.get('/laporan/pdf/:id', auth, (req, res) => {
  generatePdf(req, res);
});
// Endpoint publik untuk akses PDF via QR (Tanpa Login)
router.get('/view/laporan/:token', async (req, res) => {
    try {
        const { token } = req.params;
        const [ivHex, encryptedData] = token.split(':');
        
        if (!ivHex || !encryptedData) {
            return res.status(400).send('Format token tidak valid');
        }

        // Decryption Logic
        const algorithm = 'aes-256-cbc';
        const secretKey = crypto.createHash('sha256').update('secret_key_anda').digest();
        const iv = Buffer.from(ivHex, 'hex');
        
        const decipher = crypto.createDecipheriv(algorithm, secretKey, iv);
        let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        // Pastikan ID valid
        const targetId = parseInt(decrypted);
        if (isNaN(targetId)) {
            return res.status(400).send('Token rusak atau tidak valid');
        }

        // Panggil fungsi generatePdf dengan mock request object
        // generatePdf mengharapkan req.params.id
        const mockReq = { 
            params: { id: targetId },
            // Tambahkan properti lain jika diperlukan oleh generatePdf
        };
        
        await generatePdf(mockReq, res);
        
    } catch (err) {
        console.error('QR Access Error:', err);
        res.status(500).send('Link kadaluarsa atau tidak valid');
    }
});

/* WORD PREVIEW */
router.get('/laporan/word/:id', auth, (req, res) => {
  generateWord(req, res);
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

// API untuk Input Hasil On-Desk (Hasil Konfirmasi)
router.post('/laporan/:id/hasil-ondesk', auth, async (req, res) => {
  try {
        const { tanggal_investigasi, jam_telepon, nama_petugas, no_kontak, nama_faskes, alamat_faskes, hasil_investigasi, analisa, activity } = req.body;
        const laporanId = req.params.id;

        await db.query(
            `INSERT INTO hasil_on_desk 
            (laporan_id, tanggal_investigasi, jam_telepon, nama_petugas, no_kontak, nama_faskes, alamat_faskes, hasil_investigasi, analisa, activity) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [laporanId, tanggal_investigasi, jam_telepon, nama_petugas, no_kontak, nama_faskes, alamat_faskes, hasil_investigasi, analisa, activity]
        );
        req.flash('success', 'Hasil investigasi berhasil disimpan');
        res.redirect('/laporan/' + laporanId);
    } catch (err) {
        console.error(err);
        if (err.code === 'ER_DUP_ENTRY') {
            req.flash('error', 'Data investigasi ini sudah ada (Duplikat)');
        } else {
            req.flash('error', 'Gagal menyimpan hasil investigasi');
        }
        res.redirect('/laporan/' + req.params.id);
    }
});

// UPDATE HASIL ONDESK
router.post('/laporan/ondesk/update/:id', auth, async (req, res) => {
    try {
        const { tanggal_investigasi, nama_petugas, no_kontak, nama_faskes, alamat_faskes, hasil_investigasi, analisa, activity, laporan_id } = req.body;
        
        await db.query(
            `UPDATE hasil_on_desk SET 
                tanggal_investigasi=?, nama_petugas=?, no_kontak=?, nama_faskes=?, alamat_faskes=?,
                hasil_investigasi=?, analisa=?, activity=?
             WHERE id=?`,
            [tanggal_investigasi, nama_petugas, no_kontak, nama_faskes, alamat_faskes, hasil_investigasi, analisa, activity, req.params.id]
        );
        
        req.flash('success', 'Hasil investigasi berhasil diperbarui');
        res.redirect('/laporan/' + laporan_id);
    } catch (err) {
        console.error(err);
        req.flash('error', 'Gagal memperbarui hasil investigasi');
        res.redirect('back');
    }
});

// DELETE HASIL ONDESK
router.get('/laporan/ondesk/delete/:id/:laporan_id', auth, async (req, res) => {
    try {
        await db.query('DELETE FROM hasil_on_desk WHERE id=?', [req.params.id]);
        req.flash('success', 'Hasil investigasi berhasil dihapus');
        res.redirect('/laporan/' + req.params.laporan_id);
    } catch (err) {
        console.error(err);
        req.flash('error', 'Gagal menghapus hasil investigasi');
        res.redirect('/laporan/' + req.params.laporan_id);
    }
});

// Route untuk menyimpan Analisa Internal (PIC Investigator, MA, Putusan)
router.post('/laporan/:id/analisa-internal', auth, async (req, res) => {
    try {
        const id = req.params.id;
        const { 
            analisa_pic_investigator, 
            analisa_ma, 
            putusan_klaim, 
            analisa_putusan 
        } = req.body;

        await db.query(
            `UPDATE laporan_investigasi SET 
             analisa_pic_investigator = ?, 
             analisa_ma = ?, 
             putusan_klaim = ?, 
             analisa_putusan = ? 
             WHERE id = ?`,
            [analisa_pic_investigator, analisa_ma, putusan_klaim, analisa_putusan, id]
        );

        req.flash('success', 'Analisa internal berhasil disimpan');
        res.redirect(`/laporan/${id}`); 
    } catch (err) {
        console.error(err);
        req.flash('error', 'Gagal menyimpan analisa internal');
        res.redirect(`/laporan/${req.params.id}`);
    }
});

// ==========================================
// HASIL ONDESK LANJUTAN (FULL BACKEND)
// ==========================================

// GET: Ambil data untuk ditampilkan (AJAX/API)
router.get('/laporan/:id/hasil-ondesk-lanjutan', auth, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM hasil_ondesk_lanjutan WHERE laporan_id=? ORDER BY created_at DESC',
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// POST: Simpan Data Baru
router.post('/laporan/:id/hasil-ondesk-lanjutan', auth, async (req, res) => {
  try {
    const {
      nama_faskes,
      activity,
      tanggal_investigasi,
      jam_telepon,
      nama_petugas,
      no_kontak,
      hasil_investigasi,
      analisa
    } = req.body;

    await db.query(
      `INSERT INTO hasil_ondesk_lanjutan
       (laporan_id, nama_faskes, activity, tanggal_investigasi, jam_telepon,
        nama_petugas, no_kontak, hasil_investigasi, analisa, created_by)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [
        req.params.id,
        nama_faskes,
        activity,
        tanggal_investigasi,
        jam_telepon,
        nama_petugas,
        no_kontak,
        hasil_investigasi,
        analisa,
        req.session.user.id // Memperbaiki error req.user.id
      ]
    );

    res.json({ success: true, message: 'Data berhasil disimpan' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Gagal menyimpan data: ' + err.message });
  }
});

// PUT: Update Data
router.put('/laporan/:laporanId/hasil-ondesk-lanjutan/:id', auth, async (req, res) => {
  try {
    const {
      nama_faskes,
      activity,
      tanggal_investigasi,
      jam_telepon,
      nama_petugas,
      no_kontak,
      hasil_investigasi,
      analisa
    } = req.body;

    await db.query(
      `UPDATE hasil_ondesk_lanjutan SET
        nama_faskes=?,
        activity=?,
        tanggal_investigasi=?,
        jam_telepon=?,
        nama_petugas=?,
        no_kontak=?,
        hasil_investigasi=?,
        analisa=?
       WHERE id=?`,
      [
        nama_faskes,
        activity,
        tanggal_investigasi,
        jam_telepon,
        nama_petugas,
        no_kontak,
        hasil_investigasi,
        analisa,
        req.params.id
      ]
    );

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Gagal update data' });
  }
});

// DELETE: Hapus Data
router.delete('/laporan/:laporanId/hasil-ondesk-lanjutan/:id', auth, async (req, res) => {
  try {
    await db.query(
      'DELETE FROM hasil_ondesk_lanjutan WHERE id=?',
      [req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Gagal menghapus data' });
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



/* ===============================
   RESUME INTERVIEW (SATU DATA)
================================ */

/* GET */
router.get('/laporan/:id/resume-interview', auth, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM resume_hasil_interview WHERE laporan_id = ? LIMIT 1',
      [req.params.id]
    );
    res.json(rows.length ? rows[0] : {});
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

/* POST */
router.post('/laporan/:id/resume-interview', auth, async (req, res) => {
  try {
    const { hasil_interview } = req.body;

    await db.query(
      `INSERT INTO resume_hasil_interview (laporan_id, hasil_interview)
       VALUES (?, ?)`,
      [req.params.id, hasil_interview]
    );

    res.json({ message: 'Resume interview berhasil disimpan' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Gagal menyimpan data' });
  }
});

/* PUT */
router.put('/laporan/:id/resume-interview/:resumeId', auth, async (req, res) => {
  try {
    const { hasil_interview } = req.body;

    await db.query(
      `UPDATE resume_hasil_interview
       SET hasil_interview = ?
       WHERE id = ?`,
      [hasil_interview, req.params.resumeId]
    );

    res.json({ message: 'Resume interview berhasil diperbarui' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Gagal update data' });
  }
});

/* ===============================
   RESUME INVESTIGASI (LIST)
================================ */

/* GET */
router.get('/laporan/:id/resume-investigasi', auth, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM resume_investigasi WHERE laporan_id = ? ORDER BY id ASC',
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

/* POST */
router.post('/laporan/:id/resume-investigasi', auth, async (req, res) => {
  try {
    const { hasil } = req.body;

    await db.query(
      `INSERT INTO resume_investigasi (laporan_id, hasil)
       VALUES (?, ?)`,
      [req.params.id, hasil]
    );

    res.json({ message: 'Resume investigasi berhasil ditambahkan' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Gagal simpan data' });
  }
});

/* PUT */
router.put('/laporan/:id/resume-investigasi/:investigasiId', auth, async (req, res) => {
  try {
    const { hasil } = req.body;

    await db.query(
      `UPDATE resume_investigasi
       SET hasil = ?
       WHERE id = ?`,
      [hasil, req.params.investigasiId]
    );

    res.json({ message: 'Resume investigasi berhasil diperbarui' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Gagal update data' });
  }
});

/* DELETE */
router.delete('/laporan/:id/resume-investigasi/:investigasiId', auth, async (req, res) => {
  try {
    await db.query(
      'DELETE FROM resume_investigasi WHERE id = ?',
      [req.params.investigasiId]
    );

    res.json({ message: 'Resume investigasi berhasil dihapus' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Gagal hapus data' });
  }
});

module.exports = router;


router.post('/laporan/:id/hasil-on-desk', auth, async (req, res) => {
  try {
    const { tanggal_investigasi, jam_telepon, nama_petugas, no_kontak, nama_faskes, alamat_faskes, hasil_investigasi, analisa, activity } = req.body;
    const laporan_id = req.params.id;

    // Gunakan ON DUPLICATE KEY UPDATE (hanya update, tidak insert baru)
    // Karena hanya 1 data per laporan untuk hasil_on_desk
    await db.query(
      `INSERT INTO hasil_on_desk (
        laporan_id, tanggal_investigasi, jam_telepon, nama_petugas, no_kontak, 
        nama_faskes, alamat_faskes, hasil_investigasi, analisa, activity
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE 
       tanggal_investigasi=?, jam_telepon=?, nama_petugas=?, no_kontak=?, 
       nama_faskes=?, alamat_faskes=?, hasil_investigasi=?, analisa=?, activity=?`,
      [
        laporan_id, tanggal_investigasi, jam_telepon, nama_petugas, no_kontak,
        nama_faskes, alamat_faskes, hasil_investigasi, analisa, activity,
        tanggal_investigasi, jam_telepon, nama_petugas, no_kontak,
        nama_faskes, alamat_faskes, hasil_investigasi, analisa, activity
      ]
    );

    res.json({ success: true });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: 'Database error: ' + err.message });
  }
});

/* PUT HASIL ON DESK (UPDATE VIA AJAX) */
router.put('/laporan/hasil-on-desk/:id', auth, async (req, res) => {
  try {
    const { tanggal_investigasi, jam_telepon, nama_petugas, no_kontak, nama_faskes, alamat_faskes, hasil_investigasi, analisa, activity } = req.body;
    
    await db.query(
      `UPDATE hasil_on_desk SET 
        tanggal_investigasi=?, jam_telepon=?, nama_petugas=?, no_kontak=?, nama_faskes=?, alamat_faskes=?,
        hasil_investigasi=?, analisa=?, activity=?
       WHERE id=?`,
      [tanggal_investigasi, jam_telepon, nama_petugas, no_kontak, nama_faskes, alamat_faskes, hasil_investigasi, analisa, activity, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
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

// Perbaikan untuk Vendor Deswa (Poin 4) - UPDATE ONLY (tidak insert baru)
router.post('/laporan/:id/deswa', auth, async (req, res) => {
    try {
        const { 
            pic_investigator, tanggal_mulai, jam_mulai, tanggal_selesai, jam_selesai, sla_proses,
            tanggal_sla_awal, jam_sla_awal,
            tanggal_kirim_laporan, jam_kirim_laporan, tanggal_terima_konfirmasi_bri, jam_terima_konfirmasi_bri, sla_konfirmasi,
            tanggal_mulai_ondesk_lanjutan, jam_mulai_ondesk_lanjutan, tanggal_selesai_ondesk_lanjutan, jam_selesai_ondesk_lanjutan, sla_ondesk_lanjutan, 
            tanggal_kirim_laporan_lanjutan, jam_kirim_laporan_lanjutan, tanggal_terima_konfirmasi_lanjutan_bri, jam_terima_konfirmasi_lanjutan_bri, sla_konfirmasi_lanjutan 
        } = req.body;
        const laporan_id = req.params.id;

        // Cek apakah data sudah ada
        const [existing] = await db.query(
            `SELECT id FROM deswa WHERE laporan_id = ?`,
            [laporan_id]
        );

        if (existing.length > 0) {
            // Jika sudah ada, UPDATE saja
            // UPDATE hanya field yang dikirim, jangan paksa field awal jadi NULL
            const updateFields = [];
            const updateValues = [];

            // Daftar field yang mungkin diupdate
            const allowedFields = [
                'pic_investigator', 'tanggal_mulai', 'jam_mulai', 'tanggal_selesai', 'jam_selesai', 'sla_proses',
                'tanggal_sla_awal', 'jam_sla_awal',
                'tanggal_kirim_laporan', 'jam_kirim_laporan', 'tanggal_terima_konfirmasi_bri', 'jam_terima_konfirmasi_bri', 'sla_konfirmasi',
                'tanggal_mulai_ondesk_lanjutan', 'jam_mulai_ondesk_lanjutan', 'tanggal_selesai_ondesk_lanjutan', 'jam_selesai_ondesk_lanjutan', 'sla_ondesk_lanjutan',
                'tanggal_kirim_laporan_lanjutan', 'jam_kirim_laporan_lanjutan', 'tanggal_terima_konfirmasi_lanjutan_bri', 'jam_terima_konfirmasi_lanjutan_bri', 'sla_konfirmasi_lanjutan'
            ];

            // Hanya tambah ke query jika field tersebut ada di req.body dan tidak kosong
            allowedFields.forEach(field => {
                if (req.body.hasOwnProperty(field) && req.body[field] !== undefined && req.body[field] !== null && req.body[field] !== '') {
                    updateFields.push(`${field} = ?`);
                    updateValues.push(req.body[field]);
                }
            });

            // Hanya execute jika ada field yang akan diupdate
            if (updateFields.length > 0) {
                updateValues.push(laporan_id);
                const updateQuery = `UPDATE deswa SET ${updateFields.join(', ')} WHERE laporan_id = ?`;
                await db.query(updateQuery, updateValues);
            }
        } else {
            // Jika belum ada, INSERT baru dengan nilai awal (untuk investigasi awal)
            // Untuk lanjutan, data harus sudah ada terlebih dahulu
            await db.query(
                `INSERT INTO deswa (
                    laporan_id, pic_investigator, tanggal_mulai, jam_mulai, tanggal_selesai, jam_selesai, sla_proses,
                    tanggal_sla_awal, jam_sla_awal,
                    tanggal_kirim_laporan, jam_kirim_laporan, tanggal_terima_konfirmasi_bri, jam_terima_konfirmasi_bri, sla_konfirmasi,
                    tanggal_mulai_ondesk_lanjutan, jam_mulai_ondesk_lanjutan, tanggal_selesai_ondesk_lanjutan, jam_selesai_ondesk_lanjutan, sla_ondesk_lanjutan,
                    tanggal_kirim_laporan_lanjutan, jam_kirim_laporan_lanjutan, tanggal_terima_konfirmasi_lanjutan_bri, jam_terima_konfirmasi_lanjutan_bri, sla_konfirmasi_lanjutan
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    laporan_id, 
                    pic_investigator || '', 
                    tanggal_mulai || null, 
                    jam_mulai || null,
                    tanggal_selesai || null, 
                    jam_selesai || null,
                    sla_proses || null,
                    tanggal_sla_awal || null,
                    jam_sla_awal || null,
                    tanggal_kirim_laporan || null,
                    jam_kirim_laporan || null,
                    tanggal_terima_konfirmasi_bri || null,
                    jam_terima_konfirmasi_bri || null,
                    sla_konfirmasi || null,
                    tanggal_mulai_ondesk_lanjutan || null,
                    jam_mulai_ondesk_lanjutan || null,
                    tanggal_selesai_ondesk_lanjutan || null,
                    jam_selesai_ondesk_lanjutan || null,
                    sla_ondesk_lanjutan || null,
                    tanggal_kirim_laporan_lanjutan || null,
                    jam_kirim_laporan_lanjutan || null,
                    tanggal_terima_konfirmasi_lanjutan_bri || null,
                    jam_terima_konfirmasi_lanjutan_bri || null,
                    sla_konfirmasi_lanjutan || null
                ]
            );
        }
        res.json({ success: true });
    } catch (err) { 
        console.error(err);
        res.status(500).json({ error: err.message }); 
    }
});

// Endpoint untuk membuat deswa awal jika belum ada
router.post('/laporan/:id/deswa/init', auth, async (req, res) => {
    try {
        const laporan_id = req.params.id;

        // Cek apakah data sudah ada
        const [existing] = await db.query(
            `SELECT id FROM deswa WHERE laporan_id = ?`,
            [laporan_id]
        );

        if (existing.length === 0) {
            // Jika belum ada, CREATE dengan nilai default
            await db.query(
                `INSERT INTO deswa (laporan_id, pic_investigator, tanggal_mulai, tanggal_selesai, sla_proses) 
                 VALUES (?, '', NULL, NULL, NULL)`,
                [laporan_id]
            );
            res.json({ success: true, message: 'Deswa data initialized' });
        } else {
            res.json({ success: true, message: 'Deswa data already exists' });
        }
    } catch (err) { 
        console.error(err);
        res.status(500).json({ error: err.message }); 
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
        const { pic_investigator, tanggal_submit_pic_analis, tanggal_submit_pic_investigator, jam_mulai, jam_selesai } = req.body;
        
        // Logika Hitung SLA (Selisih Hari)
        const tgl1 = new Date(tanggal_submit_pic_analis);
        const tgl2 = new Date(tanggal_submit_pic_investigator);
        const diffInMs = Math.abs(tgl2 - tgl1);
        const sla = Math.ceil(diffInMs / (1000 * 60 * 60 * 24));

        await db.query(
            'INSERT INTO bri_submission (laporan_id, pic_investigator, tanggal_submit_pic_analis, tanggal_submit_pic_investigator, jam_mulai, jam_selesai, sla) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [req.params.id, pic_investigator, tanggal_submit_pic_analis, tanggal_submit_pic_investigator, jam_mulai, jam_selesai, sla]
        );
        req.flash('success', 'Data BRI berhasil disimpan');
        res.redirect('back');
    } catch (err) {
        console.error(err);
        res.redirect('back');
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
        
        if (rows[0].total >= 3) {
            req.flash('error', 'Kuota On-Desk Penuh');
            return res.redirect('back');
        }

        await db.query(
            'INSERT INTO penelponan (hasil_on_desk_id, tanggal_telepon, jam_telepon, hasil_telepon) VALUES (?, ?, ?, ?)',
            [ondeskId, tanggal_telepon, jam_telepon, hasil_telepon]
        );
        req.flash('success', 'Penelponan berhasil disimpan');
        res.redirect('back');
    } catch (err) { 
        console.error(err);
        req.flash('error', 'Terjadi kesalahan pada server');
        res.redirect('back'); 
    }
});

router.post('/laporan/interview/:interview_id/resume', auth, async (req, res) => {
    try {
        const { tanggal_telepon, jam_telepon, hasil_interview } = req.body;
        const interviewId = req.params.interview_id;

        // Cek kuota interview (Max 3)
        const [rows] = await db.query('SELECT COUNT(*) as total FROM resume_hasil_interview WHERE interview_id = ?', [interviewId]);
        
        if (rows[0].total >= 3) {
            req.flash('error', 'Kuota Interview Penuh');
            return res.redirect('back');
        }

        await db.query(
            'INSERT INTO resume_hasil_interview (interview_id, tanggal_telepon, jam_telepon, hasil_interview) VALUES (?, ?, ?, ?)',
            [interviewId, tanggal_telepon, jam_telepon, hasil_interview]
        );
        req.flash('success', 'Resume interview berhasil disimpan');
        res.redirect('back');
    } catch (err) { 
        console.error(err);
        req.flash('error', 'Terjadi kesalahan pada server');
        res.redirect('back'); 
    }
});

module.exports = router;

