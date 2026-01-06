const PDFDocument = require('pdfkit');
const db = require('../config/db');

/* =======================
   HELPER DASAR
======================= */
function formatDate(dateString) {
    if (!dateString || dateString === '0000-00-00') return '-';
    const d = new Date(dateString);
    if (isNaN(d)) return dateString;
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function cleanText(text) {
    if (!text) return '-';
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
    doc.font(opt.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(8).fillColor('#000');
    const textHeight = doc.heightOfString(cleaned, { width: w - 8 });
    const textY = y + (h - textHeight) / 2;
    doc.text(cleaned, x + 4, textY, { width: w - 8, align: opt.align || 'left', lineBreak: true });
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

    // 2. INFO INTERNAL & VENDOR
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

    // 3. INFORMASI DATA POLIS (12 Nomor Urut)
    y = checkPage(doc, y, 40);
    sectionTitle(doc, x, y, W, 'INFORMASI DATA POLIS');
    y += 18;
    const polisMap = [
        ['1', 'Nama Pemegang Polis', lap?.nama_pemegang_polis, '7', 'Jenis Klaim', lap?.jenis_klaim],
        ['2', 'Nama Tertanggung', lap?.nama_tertanggung, '8', 'Jenis Produk', lap?.jenis_produk],
        ['3', 'Nomor Polis', lap?.no_peserta, '9', 'Uang Pertanggungan', lap?.uang_pertanggungan],
        ['4', 'Tgl Mulai Asuransi', formatDate(lap?.tgl_mulai_asuransi), '10', 'No KTP/Pasport', lap?.no_identitas],
        ['5', 'Tgl Akhir Asuransi', formatDate(lap?.tgl_akhir_asuransi), '11', 'Tgl Meninggal Dunia', formatDate(lap?.tanggal_meninggal)],
        ['6', 'Usia Polis', lap?.usia_polis, '12', 'Rekomendasi', lap?.rekomendasi]
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

    const hAdr = autoRowHeight(doc, lap?.alamat, W - 160, 20);
    y = checkPage(doc, y, hAdr);
    cell(doc, x, y, 160, hAdr, 'Alamat', { bold: true });
    cell(doc, x + 160, y, W - 160, hAdr, lap?.alamat || '-');
    y += hAdr + 15;

    // 4. CATATAN INFORMASI DATA POLIS (KRONOLOGIS)
    const teksKronologis = lap?.kronologis || '-';
    const hKronContent = autoRowHeight(doc, teksKronologis, W, 80);
    y = checkPage(doc, y, hKronContent + 50);
    sectionTitle(doc, x, y, W, 'CATATAN INFORMASI DATA POLIS'); y += 18;
    headerCell(doc, x, y, W, 18, 'Diagnosa / ICD 10'); y += 18;
    
    doc.lineWidth(0.6).rect(x, y, W, hKronContent).stroke();
    doc.font('Helvetica-Bold').fontSize(8).text('Kronologis Sampai Kematian:', x + 8, y + 8);
    doc.font('Helvetica').fontSize(8).text(cleanText(teksKronologis), x + 8, y + 22, { width: W - 16, align: 'justify', lineGap: 2 });
    y += hKronContent + 15;

    // 5. RESUME HASIL INVESTIGASI (AHLI WARIS)
    const teksAhliWaris = resumeInt?.hasil_interview || '-';
    const hAhliWaris = autoRowHeight(doc, teksAhliWaris, W, 30);
    y = checkPage(doc, y, hAhliWaris + 40);
    sectionTitle(doc, x, y, W, 'RESUME HASIL INVESTIGASI'); y += 18;
    headerCell(doc, x, y, W, 18, 'AHLI WARIS'); y += 18;
    cell(doc, x, y, W, hAhliWaris, teksAhliWaris);
    y += hAhliWaris + 15;

    // 6. HASIL KONFIRMASI (TABEL)
    y = checkPage(doc, y, 50);
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

    // 7. ANALISA INVESTIGATOR INDEPENDENT
    const hResInv = autoRowHeight(doc, resumeInv?.hasil, W, 40);
    y = checkPage(doc, y, hResInv + 25);
    sectionTitle(doc, x, y, W, 'ANALISA INVESTIGATOR INDEPENDENT'); y += 18;
    cell(doc, x, y, W, hResInv, resumeInv?.hasil || '-');
    y += hResInv + 15;

    // 8. ANALISA PIC INVESTIGATOR (SATU HALAMAN)
    const hAnlPic = autoRowHeight(doc, lap?.analisa_pic_investigator, W, 40);
    y = checkPage(doc, y, hAnlPic + 25);
    sectionTitle(doc, x, y, W, 'ANALISA PIC INVESTIGATOR'); y += 18;
    cell(doc, x, y, W, hAnlPic, lap?.analisa_pic_investigator || '-');
    y += hAnlPic + 15;

    // 9. ANALISA MA
    const hAnlMa = autoRowHeight(doc, lap?.analisa_ma, W, 40);
    y = checkPage(doc, y, hAnlMa + 25);
    sectionTitle(doc, x, y, W, 'ANALISA MA'); y += 18;
    cell(doc, x, y, W, hAnlMa, lap?.analisa_ma || '-');
    y += hAnlMa + 15;

    // 10. PUTUSAN KLAIM
    const hAnlPut = autoRowHeight(doc, lap?.analisa_putusan, W - 150, 40);
    y = checkPage(doc, y, hAnlPut + 60);
    sectionTitle(doc, x, y, W, 'ANALISA DAN PUTUSAN'); y += 18;
    cell(doc, x, y, 150, 25, 'PUTUSAN KLAIM', { bold: true });
    cell(doc, x + 150, y, W - 150, 25, lap?.putusan_klaim || '-', { bold: true, align: 'center' });
    y += 25;
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