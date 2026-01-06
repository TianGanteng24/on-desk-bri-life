const PDFDocument = require('pdfkit');
const db = require('../config/db');

/* =======================
   HELPER DASAR (RESPONSIVE)
======================= */
function formatDate(dateString) {
    if (!dateString || dateString === '0000-00-00') return '-';
    const d = new Date(dateString);
    if (isNaN(d)) return dateString;
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

/**
 * Membersihkan teks agar aman untuk PDFKit dan mencegah error rendering
 */
function cleanText(text) {
    if (!text) return '-';
    return text.toString().trim();
}

/**
 * MENGHITUNG TINGGI DINAMIS
 * Ditambahkan padding ekstra dan lineGap agar teks tidak mepet border
 */
function autoRowHeight(doc, text, width, min = 18) {
    const content = cleanText(text);
    if (content === '-') return min;
    
    const textHeight = doc.heightOfString(content, {
        width: width - 10, // Memberi margin internal 5px kiri + 5px kanan
        lineBreak: true,
        lineGap: 2
    });
    
    return Math.max(min, textHeight + 12); // Tambah 12px untuk padding atas & bawah
}

function checkPage(doc, y, need = 50) {
    if (y + need > 750) {
        doc.addPage();
        return 40; 
    }
    return y;
}

/* =======================
   CELL STYLING (FIX OVERFLOW)
======================= */
function cell(doc, x, y, w, h, text, opt = {}) {
    const content = cleanText(text);
    
    // Gambar Border Kotak
    doc.lineWidth(0.6).strokeColor('#000');
    doc.rect(x, y, w, h).stroke();
    
    // Set Font
    doc.font(opt.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(8).fillColor('#000');
    
    // Tulis Teks di dalam kotak dengan margin internal (indent)
    // lineBreak: true akan otomatis memotong teks ke bawah jika lebar tidak cukup
    doc.text(content, x + 5, y + 6, {
        width: w - 10,
        align: opt.align || 'left',
        lineBreak: true,
        lineGap: 2
    });
}

function headerCell(doc, x, y, w, h, text) {
    doc.rect(x, y, w, h).fill('#E7E6E6').stroke('#000');
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#000');
    doc.text(text, x, y + (h - 8) / 2, { width: w, align: 'center' });
}

function sectionTitle(doc, x, y, w, text) {
    doc.rect(x, y, w, 18).fill('#92D050').stroke('#000');
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#000')
        .text(text, x, y + 5, { width: w, align: 'center' });
}

/* =======================
   CONTROLLER
======================= */
module.exports = async (req, res) => {
    const doc = new PDFDocument({ size: 'A4', margin: 25, bufferPages: true });
    res.setHeader('Content-Type', 'application/pdf');
    doc.pipe(res);

    const id = req.params.id;

    const [[lap]] = await db.query(`SELECT * FROM laporan_investigasi WHERE id=?`, [id]);
    const [[deswa]] = await db.query(`SELECT * FROM deswa WHERE laporan_id=? LIMIT 1`, [id]);
    const [[bri]] = await db.query(`SELECT * FROM bri WHERE laporan_id=? LIMIT 1`, [id]);
    const [desk] = await db.query(`SELECT * FROM hasil_on_desk WHERE laporan_id=? ORDER BY tanggal_investigasi ASC`, [id]);
    const [[resumeInv]] = await db.query(`SELECT * FROM resume_investigasi WHERE laporan_id=? LIMIT 1`, [id]);
    const [[resumeInt]] = await db.query(`SELECT * FROM resume_hasil_interview WHERE laporan_id=? LIMIT 1`, [id]);

// =========================================================
    // 1. HEADER (Hanya Baris Judul)
    // =========================================================
    const x = 25;
    const W = 545;
    let y = 30;

    // Header Utama: Rata Tengah & Background Abu-abu
    const headerHeight = 25;
    doc.rect(x, y, W, headerHeight).fill('#E7E6E6').stroke('#000');
    
    doc.font('Helvetica-Bold').fontSize(12).fillColor('#000');
    
    // y + 7 adalah offset manual agar teks berada di tengah kotak secara vertikal
    doc.text('FORMULIR INVESTIGASI BRI LIFE', x, y + 7, { 
        width: W, 
        align: 'center' 
    });

    // Tambahkan jarak (space) ke bawah setelah header
    y += headerHeight + 25;

// =========================================================
    // 2. DATA INVESTIGATOR (Header Sejajar Kolom)
    // =========================================================
    y = checkPage(doc, y, 60);

    // Total Lebar (W) = 545
    // Kolom Kiri: 20 (No) + 140 (Label) + 92 (Ket) = 252
    // Jarak Pemisah: Header Kanan dimulai dari x + 252
    // Kolom Kanan: 20 (No) + 150 (Label) + 123 (Ket) = 293
    // Total: 252 + 293 = 545 (PAS)

    // Header Tabel (Abu-abu)
    headerCell(doc, x, y, 252, 18, 'INTERNAL BRI LIFE'); // Lebar gabungan kolom kiri
    headerCell(doc, x + 252, y, 293, 18, 'VENDOR (DESWA)'); // Lebar gabungan kolom kanan
    y += 18;

    const infoRows = [
        ['1', 'PIC Investigator (BRI)', bri?.pic_investigator, '1', 'PIC Investigator (Vendor)', deswa?.pic_investigator],
        ['2', 'Tgl Submit Analis', formatDate(bri?.tanggal_submit_pic_analis), '2', 'Tanggal Terima', formatDate(deswa?.tanggal_mulai)],
        ['3', 'Tgl Submit Inv', formatDate(bri?.tanggal_submit_pic_investigator), '3', 'Tanggal Selesai', formatDate(deswa?.tanggal_selesai)],
        ['4', 'SLA BRI', bri?.sla, '4', 'SLA Vendor', deswa?.sla_proses]
    ];

    infoRows.forEach(r => {
        const hRow = Math.max(autoRowHeight(doc, r[2], 92), autoRowHeight(doc, r[5], 123), 20);
        y = checkPage(doc, y, hRow);

        // Kolom INTERNAL BRI (Total Lebar 252)
        cell(doc, x, y, 20, hRow, r[0], { align: 'center' });
        cell(doc, x + 20, y, 140, hRow, r[1]);
        cell(doc, x + 160, y, 92, hRow, r[2]);

        // Kolom VENDOR (Total Lebar 293)
        // Dimulai tepat setelah kolom kiri (x + 252)
        cell(doc, x + 252, y, 20, hRow, r[3], { align: 'center' });
        cell(doc, x + 272, y, 150, hRow, r[4]);
        cell(doc, x + 422, y, 123, hRow, r[5]);
        
        y += hRow;
    });
    y += 10;
    // 3. INFORMASI DATA POLIS (12 NOMOR)
    y += 15;
    y = checkPage(doc, y, 40);
    sectionTitle(doc, x, y, W, 'INFORMASI DATA POLIS');
    y += 18;

    const polisMap = [
        ['1', 'Pemegang Polis', lap?.nama_pemegang_polis, '7', 'Jenis Klaim', lap?.jenis_klaim],
        ['2', 'Tertanggung', lap?.nama_tertanggung, '8', 'Jenis Produk', lap?.jenis_produk],
        ['3', 'Nomor Polis', lap?.no_peserta, '9', 'UP / Nilai Klaim', lap?.uang_pertanggungan],
        ['4', 'Mulai Asuransi', formatDate(lap?.tgl_mulai_asuransi), '10', 'No KTP/Pasport', lap?.no_identitas],
        ['5', 'Akhir Asuransi', formatDate(lap?.tgl_akhir_asuransi), '11', 'Tgl Meninggal', formatDate(lap?.tanggal_meninggal)],
        ['6', 'Usia Polis', lap?.usia_polis, '12', 'Rekomendasi', lap?.rekomendasi]
    ];

    polisMap.forEach(r => {
        const hRow = Math.max(autoRowHeight(doc, r[2], 92), autoRowHeight(doc, r[5], 123), 20);
        y = checkPage(doc, y, hRow);
        cell(doc, x, y, 20, hRow, r[0], { align: 'center' });
        cell(doc, x + 20, y, 140, hRow, r[1]);
        cell(doc, x + 160, y, 92, hRow, r[2]);
        cell(doc, x + 252, y, 20, hRow, r[3], { align: 'center' });
        cell(doc, x + 272, y, 150, hRow, r[4]);
        cell(doc, x + 422, y, 123, hRow, r[5]);
        y += hRow;
    });

    const hAdr = autoRowHeight(doc, lap?.alamat, W - 160, 20);
    y = checkPage(doc, y, hAdr);
    cell(doc, x, y, 160, hAdr, 'Detail Alamat', { bold: true });
    cell(doc, x + 160, y, W - 160, hAdr, lap?.alamat || '-');
    y += hAdr + 15;

    // 4. KRONOLOGIS
    const teksKron = lap?.kronologis || '-';
    const hKron = autoRowHeight(doc, teksKron, W, 60);
    y = checkPage(doc, y, hKron + 40);
    sectionTitle(doc, x, y, W, 'CATATAN INFORMASI DATA POLIS'); y += 18;
    headerCell(doc, x, y, W, 18, 'Diagnosa / Kronologis Kematian'); y += 18;
    cell(doc, x, y, W, hKron, teksKron);
    y += hKron + 15;

    // 5. HASIL KONFIRMASI (TABEL)
    y = checkPage(doc, y, 50);
    sectionTitle(doc, x, y, W, 'HASIL KONFIRMASI / INVESTIGASI'); y += 18;
    const wT = [55, 65, 75, 85, 135, 130];
    const headers = ['Tanggal', 'Activity', 'Petugas', 'Faskes', 'Hasil', 'Analisa'];
    headers.forEach((h, i) => {
        const px = x + wT.slice(0, i).reduce((a, b) => a + b, 0);
        headerCell(doc, px, y, wT[i], 18, h);
    });
    y += 18;

    desk.forEach(d => {
        const hRow = Math.max(
            autoRowHeight(doc, d.hasil_investigasi, wT[4]), 
            autoRowHeight(doc, d.analisa, wT[5]), 
            25
        );
        y = checkPage(doc, y, hRow);
        let curX = x;
        cell(doc, curX, y, wT[0], hRow, formatDate(d.tanggal_investigasi), {align:'center'}); curX += wT[0];
        cell(doc, curX, y, wT[1], hRow, d.activity); curX += wT[1];
        cell(doc, curX, y, wT[2], hRow, d.nama_petugas); curX += wT[2];
        cell(doc, curX, y, wT[3], hRow, d.nama_faskes); curX += wT[3];
        cell(doc, curX, y, wT[4], hRow, d.hasil_investigasi); curX += wT[4];
        cell(doc, curX, y, wT[5], hRow, d.analisa || '-');
        y += hRow;
    });

    // 6. ANALISA AKHIR
    const finalAnl = [
        { t: 'ANALISA INVESTIGATOR INDEPENDENT', v: resumeInv?.hasil },
        { t: 'ANALISA PIC INVESTIGATOR', v: lap?.analisa_pic_investigator },
        { t: 'ANALISA MA', v: lap?.analisa_ma }
    ];

    finalAnl.forEach(s => {
        const h = autoRowHeight(doc, s.v, W, 40);
        y = checkPage(doc, y, h + 30);
        y += 15; sectionTitle(doc, x, y, W, s.t); y += 18;
        cell(doc, x, y, W, h, s.v || '-');
        y += h;
    });

    // 7. PUTUSAN
    const hPut = autoRowHeight(doc, lap?.analisa_putusan, W - 150, 40);
    y = checkPage(doc, y, hPut + 50);
    y += 15; sectionTitle(doc, x, y, W, 'PUTUSAN KLAIM'); y += 18;
    cell(doc, x, y, 150, 20, 'STATUS', { bold: true });
    cell(doc, x + 150, y, W - 150, 20, lap?.putusan_klaim || '-');
    y += 20;
    cell(doc, x, y, 150, hPut, 'ANALISA PUTUSAN', { bold: true });
    cell(doc, x + 150, y, W - 150, hPut, lap?.analisa_putusan || '-');

    doc.end();
};