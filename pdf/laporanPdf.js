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

function cleanText(text) {
    if (!text) return '-';
    // Menghapus karakter non-standar namun tetap mendukung baris baru
    return text.toString().replace(/[^a-zA-Z0-9.,/()'"\-\s\n]/g, '').trim();
}

function autoRowHeight(doc, text, width, min = 18) {
    if (!text) return min;
    const h = doc.heightOfString(cleanText(text), { width: width - 8, lineBreak: true }) + 10;
    return Math.max(min, h);
}

function checkPage(doc, y, need = 50) {
    if (y + need > 760) {
        doc.addPage();
        return 40;
    }
    return y;
}

/* =======================
   CELL STYLING
======================= */
function cell(doc, x, y, w, h, text, opt = {}) {
    doc.lineWidth(0.6);
    doc.rect(x, y, w, h).stroke();
    
    const cleaned = cleanText(text);
    doc.font(opt.bold ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(8)
        .fillColor('#000');

    const textHeight = doc.heightOfString(cleaned, { width: w - 8 });
    const textY = y + (h - textHeight) / 2;

    doc.text(cleaned, x + 4, textY, { 
        width: w - 8, 
        align: opt.align || 'left',
        lineBreak: true 
    });
}

function headerCell(doc, x, y, w, h, text) {
    doc.rect(x, y, w, h).fill('#E7E6E6').stroke();
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#000');
    const textHeight = doc.heightOfString(text, { width: w });
    doc.text(text, x, y + (h - textHeight) / 2, { width: w, align: 'center' });
}

function sectionTitle(doc, x, y, w, text) {
    doc.rect(x, y, w, 18).fill('#92D050').stroke();
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#000')
        .text(text, x, y + 5, { width: w, align: 'center' });
}

/* =======================
   CONTROLLER
======================= */
module.exports = async (req, res) => {
    const doc = new PDFDocument({ size: 'A4', margin: 25 });
    res.setHeader('Content-Type', 'application/pdf');
    doc.pipe(res);

    const id = req.params.id;

    // Fetch Data
    const [[lap]] = await db.query(`SELECT * FROM laporan_investigasi WHERE id=?`, [id]);
    const [[deswa]] = await db.query(`SELECT * FROM deswa WHERE laporan_id=? LIMIT 1`, [id]);
    const [[bri]] = await db.query(`SELECT * FROM bri WHERE laporan_id=? LIMIT 1`, [id]);
    const [desk] = await db.query(`SELECT * FROM hasil_on_desk WHERE laporan_id=?`, [id]);
    const [[resumeInv]] = await db.query(`SELECT * FROM resume_investigasi WHERE laporan_id=? LIMIT 1`, [id]);
    const [[resumeInt]] = await db.query(`SELECT * FROM resume_hasil_interview WHERE laporan_id=? LIMIT 1`, [id]);

    const x = 25;
    const W = 545;
    let y = 30;

    // 1. HEADER
    doc.font('Helvetica-Bold').fontSize(11).text('FORMULIR INVESTIGASI BRI LIFE', x, y);
    y += 15;
    doc.fontSize(8).font('Helvetica-Bold').text('BRI LIFE', x, y);
    doc.text('VENDOR', x + 300, y);
    doc.font('Helvetica').text('PT DESWA INVISCO MULTITAMA', x + 350, y);
    y += 20;

    // 2. INTERNAL & VENDOR INFO
    const infoRows = [
        ['1', 'PIC Investigator', bri?.pic_investigator, '1', 'PIC Investigator', deswa?.pic_investigator],
        ['2', 'Tgl Submit PIC Analis', formatDate(bri?.tanggal_submit_pic_analis), '2', 'Tanggal Terima', formatDate(deswa?.tanggal_mulai)],
        ['3', 'Tgl Submit PIC Investigator', formatDate(bri?.tanggal_submit_pic_investigator), '3', 'Tanggal Selesai', formatDate(deswa?.tanggal_selesai)],
        ['4', 'SLA', bri?.sla, '4', 'SLA Proses (hari)', deswa?.sla_proses]
    ];

    infoRows.forEach(r => {
        const hRow = Math.max(autoRowHeight(doc, r[2], 92), autoRowHeight(doc, r[5], 123), 18);
        y = checkPage(doc, y, hRow);
        cell(doc, x, y, 20, hRow, r[0], { align: 'center' });
        cell(doc, x + 20, y, 140, hRow, r[1]);
        cell(doc, x + 160, y, 92, hRow, r[2]);
        cell(doc, x + 252, y, 20, hRow, r[3], { align: 'center' });
        cell(doc, x + 272, y, 150, hRow, r[4]);
        cell(doc, x + 422, y, 123, hRow, r[5]);
        y += hRow;
    });
    y += 15;

    // 3. INFORMASI DATA POLIS
    sectionTitle(doc, x, y, W, 'INFORMASI DATA POLIS');
    y += 18;
    const polisMap = [
        ['1', 'Nama Pemegang Polis', lap?.nama_pemegang_polis, '6', 'Jenis Klaim', lap?.jenis_klaim],
        ['2', 'Nama Tertanggung', lap?.nama_tertanggung, '7', 'Jenis Produk', lap?.jenis_produk],
        ['3', 'Nomor Polis', lap?.no_peserta, '8', 'JUP / Nilai Klaim', lap?.uang_pertanggungan],
        ['4', 'Tgl Mulai Asuransi', formatDate(lap?.tgl_mulai_asuransi), '9', 'Alamat Ahli Waris', ''],
        ['5', 'Tgl Akhir Asuransi', formatDate(lap?.tgl_akhir_asuransi), '10', 'No KTP/Pasport', lap?.no_identitas]
    ];

    polisMap.forEach(r => {
        const hRow = Math.max(autoRowHeight(doc, r[2], 92), autoRowHeight(doc, r[5], 123), 18);
        y = checkPage(doc, y, hRow);
        cell(doc, x, y, 20, hRow, r[0], { align: 'center' });
        cell(doc, x + 20, y, 140, hRow, r[1]);
        cell(doc, x + 160, y, 92, hRow, r[2]);
        cell(doc, x + 252, y, 20, hRow, r[3], { align: 'center' });
        cell(doc, x + 272, y, 150, hRow, r[4]);
        cell(doc, x + 422, y, 123, hRow, r[5]);
        y += hRow;
    });

    // Tgl Meninggal & Alamat
    const hAdr = autoRowHeight(doc, lap?.alamat, 123, 25);
    y = checkPage(doc, y, hAdr);
    cell(doc, x, y, 20, hAdr, '6', { align: 'center' });
    cell(doc, x + 20, y, 140, hAdr, 'Tanggal Meninggal Dunia');
    cell(doc, x + 160, y, 92, hAdr, formatDate(lap?.tanggal_meninggal));
    cell(doc, x + 252, y, 20, hAdr, '');
    cell(doc, x + 272, y, 150, hAdr, 'Detail Alamat', { bold: true });
    cell(doc, x + 422, y, 123, hAdr, lap?.alamat);
    y += hAdr;

    // Usia Polis & Rekomendasi
    const hRek = autoRowHeight(doc, lap?.rekomendasi, 103, 18);
    y = checkPage(doc, y, hRek);
    cell(doc, x, y, 20, hRek, '7', { align: 'center' });
    cell(doc, x + 20, y, 140, hRek, 'Usia Polis');
    cell(doc, x + 160, y, 92, hRek, lap?.usia_polis);
    cell(doc, x + 252, y, 20, hRek, '11', { align: 'center' });
    cell(doc, x + 272, y, 170, hRek, 'Rekomendasi');
    cell(doc, x + 442, y, 103, hRek, lap?.rekomendasi);
    y += hRek + 15;

    // =========================================================
    // 4. CATATAN INFORMASI DATA POLIS (KRONOLOGIS & DIAGNOSA)
    // =========================================================
    const teksKronologis = lap?.kronologis || '-';
    // Hitung tinggi kronologis + tinggi title + tinggi subtitle
    const hKronContent = autoRowHeight(doc, teksKronologis, W, 80);
    const totalBlockHeight = hKronContent + 18 + 18 + 10; 

    // Cek halaman agar Title, Subtitle, dan Value tidak terpisah
    y = checkPage(doc, y, totalBlockHeight);

    // Judul Utama (Section Title)
    sectionTitle(doc, x, y, W, 'CATATAN INFORMASI DATA POLIS');
    y += 18;

    // Sub-Judul (Subtitle) - Diagnosa / ICD 10
    headerCell(doc, x, y, W, 18, 'Diagnosa / ICD 10');
    y += 18;

    // Isi Kronologis
    doc.lineWidth(0.6);
    doc.rect(x, y, W, hKronContent).stroke();
    
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#000');
    doc.text('Kronologis Sampai Kematian:', x + 8, y + 8); // Label di dalam kotak
    
    doc.font('Helvetica').fontSize(8).fillColor('#000');
    doc.text(cleanText(teksKronologis), x + 8, y + 22, { 
        width: W - 16, 
        align: 'justify', 
        lineGap: 2 
    });

    y += hKronContent + 15;

    // 5. RESUME HASIL INVESTIGASI (AHLI WARIS)
    sectionTitle(doc, x, y, W, 'RESUME HASIL INVESTIGASI');
    y += 18;
    headerCell(doc, x, y, W, 18, 'AHLI WARIS');
    y += 18;
    const teksAhliWaris = resumeInt?.hasil_interview || '-';
    const hAhliWaris = autoRowHeight(doc, teksAhliWaris, W, 30);
    y = checkPage(doc, y, hAhliWaris);
    cell(doc, x, y, W, hAhliWaris, teksAhliWaris);
    y += hAhliWaris + 15;

    // 6. HASIL KONFIRMASI / INVESTIGASI (Tabel on_desk)
    sectionTitle(doc, x, y, W, 'HASIL KONFIRMASI / INVESTIGASI'); y += 18;
    const wT = [50, 60, 70, 80, 145, 140];
    const headers = ['Tanggal', 'Activity', 'Nama Petugas', 'Nama Faskes', 'Hasil Investigasi', 'Analisa'];
    headers.forEach((h, i) => {
        const px = x + wT.slice(0, i).reduce((a, b) => a + b, 0);
        headerCell(doc, px, y, wT[i], 18, h);
    });
    y += 18;

    desk.forEach(d => {
        const hRow = Math.max(autoRowHeight(doc, d.hasil_investigasi, wT[4]), autoRowHeight(doc, d.analisa, wT[5]), 18);
        y = checkPage(doc, y, hRow);
        let curX = x;
        cell(doc, curX, y, wT[0], hRow, formatDate(d.tanggal_investigasi), {align:'center'}); curX += wT[0];
        cell(doc, curX, y, wT[1], hRow, d.activity || 'Visit'); curX += wT[1];
        cell(doc, curX, y, wT[2], hRow, d.nama_petugas); curX += wT[2];
        cell(doc, curX, y, wT[3], hRow, d.nama_faskes); curX += wT[3];
        cell(doc, curX, y, wT[4], hRow, d.hasil_investigasi); curX += wT[4];
        cell(doc, curX, y, wT[5], hRow, d.analisa || '-');
        y += hRow;
    });
    y += 15;

    // 7. ANALISA INVESTIGATOR INDEPENDENT (Resume Investigasi)
    sectionTitle(doc, x, y, W, 'ANALISA INVESTIGATOR INDEPENDENT');
    y += 18;
    const teksAnalisaInv = resumeInv?.hasil || '-';
    const hResInv = autoRowHeight(doc, teksAnalisaInv, W, 40);
    y = checkPage(doc, y, hResInv);
    cell(doc, x, y, W, hResInv, teksAnalisaInv);
    y += hResInv + 15;

   // 8. ANALISA PIC INVESTIGATOR (INTERNAL BRI)
    const teksAnlPic = lap?.analisa_pic_investigator || '-';
    const hAnlPic = autoRowHeight(doc, teksAnlPic, W, 40);
    
    // LOGIKA PENYATUAN: Cek apakah (Tinggi Judul 18 + Padding 2 + Tinggi Isi hAnlPic) muat di sisa halaman
    // Jika tidak muat, checkPage akan membuat halaman baru sebelum Judul digambar
    y = checkPage(doc, y, hAnlPic + 20); 

    sectionTitle(doc, x, y, W, 'ANALISA PIC INVESTIGATOR'); 
    y += 18; // Pindah ke bawah judul
    
    cell(doc, x, y, W, hAnlPic, teksAnlPic);
    y += hAnlPic + 15;

    // 9. ANALISA MA
    sectionTitle(doc, x, y, W, 'ANALISA MA'); y += 18;
    const hAnlMa = autoRowHeight(doc, lap?.analisa_ma, W, 40);
    y = checkPage(doc, y, hAnlMa);
    cell(doc, x, y, W, hAnlMa, lap?.analisa_ma || '-');
    y += hAnlMa + 15;

    // 10. PUTUSAN KLAIM
    sectionTitle(doc, x, y, W, 'ANALISA DAN PUTUSAN'); y += 18;
    cell(doc, x, y, 150, 25, 'PUTUSAN KLAIM', { bold: true });
    cell(doc, x + 150, y, W - 150, 25, lap?.putusan_klaim || '-', { bold: true, align: 'center' });
    y += 25;

    const hAnlPut = autoRowHeight(doc, lap?.analisa_putusan, W - 150, 40);
    y = checkPage(doc, y, hAnlPut);
    cell(doc, x, y, 150, hAnlPut, 'ANALISA PUTUSAN', { bold: true });
    cell(doc, x + 150, y, W - 150, hAnlPut, lap?.analisa_putusan || '-');
    y += hAnlPut + 30;

    // 11. TANDA TANGAN
    y = checkPage(doc, y, 100);
    const tW = W / 3;
    ['Department Head', 'Team Leader', 'MA'].forEach((t, i) => {
        headerCell(doc, x + (tW * i), y, tW, 18, t);
        cell(doc, x + (tW * i), y + 18, tW, 65, '');
    });

    doc.end();
};