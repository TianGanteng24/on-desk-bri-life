const PDFDocument = require('pdfkit');
const db = require('../config/db');

/* =======================
   HELPER
======================= */
function labelCell(doc, x, y, w, h, text) {
    doc.rect(x, y, w, h).fill('#f9f9f9').stroke();
    doc.fillColor('#000').fontSize(8)
       .text(text || '', x + 4, y + 6, { width: w - 8 });
}

function valueCell(doc, x, y, w, h, text, align = 'left') {
    doc.rect(x, y, w, h).stroke();
    doc.fillColor('#000').fontSize(8)
       .text(text || '-', x + 4, y + 6, {
           width: w - 8,
           align
       });
}

function sectionHeader(doc, x, y, w, text, color) {
    doc.rect(x, y, w, 18).fill(color).stroke();
    doc.fillColor('#000')
       .fontSize(9)
       .font('Helvetica-Bold')
       .text(text, x, y + 5, { align: 'center' });
    doc.font('Helvetica');
}

function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
}

/* =======================
   CONTROLLER
======================= */
module.exports = async (req, res) => {
    const doc = new PDFDocument({ size: 'A4', margin: 20 });
    res.setHeader('Content-Type', 'application/pdf');
    doc.pipe(res);

    const id = req.params.id;

    const [[lap]] = await db.query(`SELECT * FROM laporan_investigasi WHERE id=?`, [id]);
    const [[deswa]] = await db.query(`SELECT * FROM deswa WHERE laporan_id=?`, [id]);
    const [[bri]] = await db.query(`SELECT * FROM bri WHERE laporan_id=?`, [id]);
    const [[interview]] = await db.query(`SELECT * FROM resume_hasil_interview WHERE laporan_id=?`, [id]);
    const [[resume]] = await db.query(`SELECT * FROM resume_investigasi WHERE laporan_id=?`, [id]);
    const [desk] = await db.query(`SELECT * FROM hasil_on_desk WHERE laporan_id=?`, [id]);

    const deswaData = deswa || {};
    const briData = bri || {};
    const interviewData = interview || {};
    const resumeData = resume || {};
    const deskData = desk || [];

    let x = 20;
    let y = 20;
    const W = 555;
    const COL = 138; // 4 kolom @25%

    /* =======================
       JUDUL
    ======================= */
    doc.rect(x, y, W, 25).fill('#FFF200').stroke();
    doc.fillColor('#000')
       .fontSize(12)
       .font('Helvetica-Bold')
       .text('LAPORAN INVESTIGASI', x, y + 7, { align: 'center' });
    doc.font('Helvetica');
    y += 30;

    /* =======================
       DATA PENGAJUAN
    ======================= */
    sectionHeader(doc, x, y, W, 'DATA PENGAJUAN INVESTIGASI', '#D9D9D9');
    y += 18;

    labelCell(doc, x, y, COL, 22, '1. Nama Pemegang Polis');
    valueCell(doc, x+COL, y, COL, 22, lap.nama_pemegang_polis);
    labelCell(doc, x+COL*2, y, COL, 22, 'PIC Investigator');
    valueCell(doc, x+COL*3, y, COL, 22, deswaData.pic_investigator);
    y += 22;

    labelCell(doc, x, y, COL, 22, '2. No. Peserta');
    valueCell(doc, x+COL, y, COL, 22, lap.no_peserta);
    labelCell(doc, x+COL*2, y, COL, 22, 'Tanggal Terima');
    valueCell(doc, x+COL*3, y, COL, 22, formatDate(deswaData.tanggal_mulai));
    y += 22;

    labelCell(doc, x, y, COL, 22, '3. Nama Tertanggung');
    valueCell(doc, x+COL, y, COL, 22, lap.nama_tertanggung);
    labelCell(doc, x+COL*2, y, COL, 22, 'Tanggal Selesai');
    valueCell(doc, x+COL*3, y, COL, 22, formatDate(deswaData.tanggal_selesai));
    y += 22;

    labelCell(doc, x, y, COL, 22, '4. Masa Asuransi');
    valueCell(doc, x+COL, y, COL, 22, lap.masa_asuransi);
    labelCell(doc, x+COL*2, y, COL, 22, 'SLA Proses (hari kerja)');
    valueCell(doc, x+COL*3, y, COL, 22, deswaData.sla_proses);
    y += 22;

    labelCell(doc, x, y, COL, 22, '5. Uang Pertanggungan');
    valueCell(doc, x+COL, y, COL, 22, lap.uang_pertanggungan);
    labelCell(doc, x+COL*2, y, COL, 22, 'BRI LIFE');
    valueCell(doc, x+COL*3, y, COL, 22, briData.pic_investigator);
    y += 22;

    labelCell(doc, x, y, COL, 22, '9. Status');
    valueCell(doc, x+COL, y, COL, 22, lap.status_asuransi);
    labelCell(doc, x+COL*2, y, COL, 22, 'Tanggal Submit PIC Investigator');
    valueCell(doc, x+COL*3, y, COL, 22, briData.tanggal_submit_pic_investigator);
    y += 30;

    /* =======================
       RESUME INTERVIEW
    ======================= */
    sectionHeader(
        doc,
        x,
        y,
        W,
        'RESUME HASIL INTERVIEW TERTANGGUNG/AHLI WARIS',
        '#92D050'
    );
    y += 18;

    valueCell(
        doc,
        x,
        y,
        W,
        80,
        `
${interviewData.hasil_interview || '-'}`,
        'left'
    );
    y += 90;

    /* =======================
       HASIL ON DESK
    ======================= */
    sectionHeader(doc, x, y, W, 'HASIL ON DESK INVESTIGASI', '#92D050');
    y += 18;

    deskData.forEach(d => {
        if (y > 720) {
            doc.addPage();
            y = 30;
        }

        labelCell(doc, x, y, COL, 22, 'Tgl Investigasi');
        valueCell(doc, x+COL, y, COL, 22, formatDate(d.tanggal_investigasi));
        labelCell(doc, x+COL*2, y, COL, 22, 'Nama Petugas');
        valueCell(doc, x+COL*3, y, COL, 22, d.nama_petugas);
        y += 22;

        labelCell(doc, x, y, COL, 22, 'Nama Faskes');
        valueCell(doc, x+COL, y, COL*3, 22, d.nama_faskes);
        y += 22;

        labelCell(doc, x, y, COL, 30, 'Alamat Faskes');
        valueCell(doc, x+COL, y, COL*3, 30, d.alamat_faskes);
        y += 30;

        labelCell(doc, x, y, COL, 50, 'Temuan Investigasi');
        valueCell(doc, x+COL, y, COL*3, 50, d.hasil_investigasi);
        y += 55;
    });

    /* =======================
       RESUME AKHIR
    ======================= */
    sectionHeader(doc, x, y, W, 'RESUME HASIL INVESTIGASI', '#92D050');
    y += 18;

    valueCell(doc, x, y, W, 40, resumeData.hasil || '-');

    /* =======================
       FOOTER
    ======================= */
    y += 50;
    doc.fontSize(7)
       .fillColor('gray')
       .text(
           'Dokumen ini dihasilkan secara otomatis. Format redaksional telah distandarisasi sesuai ketentuan.',
           x,
           y,
           { width: W, align: 'center' }
       );

    doc.end();
};
