const PDFDocument = require('pdfkit');
const db = require('../config/db');
const path = require('path');

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
    const d = new Date(dateString);
    if (isNaN(d)) return dateString;
    return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
}

/* =======================
   CONTROLLER
======================= */
module.exports = async (req, res) => {
    const doc = new PDFDocument({ size: 'A4', margin: 20 });
    res.setHeader('Content-Type', 'application/pdf');
    doc.pipe(res);

    const id = req.params.id;

    // Database Queries
    const [[lap]] = await db.query(`SELECT * FROM laporan_investigasi WHERE id=?`, [id]);
    const [[deswa]] = await db.query(`SELECT * FROM deswa WHERE laporan_id=?`, [id]);
    const [[bri]] = await db.query(`SELECT * FROM bri WHERE laporan_id=?`, [id]);
    const [[interview]] = await db.query(`SELECT * FROM resume_hasil_interview WHERE laporan_id=?`, [id]);
    const [[resume]] = await db.query(`SELECT * FROM resume_investigasi WHERE laporan_id=?`, [id]);
    const [desk] = await db.query(`SELECT * FROM hasil_on_desk WHERE laporan_id=?`, [id]);
    const [penelponan] = await db.query(
        `SELECT * FROM penelponan WHERE laporan_id=? ORDER BY hasil_on_desk_id, tanggal_telepon`,
        [id]
    );

    const telpMap = {};
    penelponan.forEach(p => {
        if (!telpMap[p.hasil_on_desk_id]) telpMap[p.hasil_on_desk_id] = [];
        telpMap[p.hasil_on_desk_id].push(p);
    });

    const x = 20;
    let y = 20;
    const W = 555;
    const COL = 138;

    /* =======================
        HEADER DENGAN LOGO
    ======================= */
    const logoSize = 50;
    const labelWidth = W - (logoSize * 2) - 20;
    const labelX = x + logoSize + 10;

    const pathLeftLogo = path.join(__dirname, '../public/img/DIG.jpeg');
    const pathRightLogo = path.join(__dirname, '../public/img/dsm.jpeg');

    try {
        doc.image(pathLeftLogo, x, y, { width: logoSize, height: logoSize });
    } catch (e) {
        doc.rect(x, y, logoSize, logoSize).stroke();
    }

    doc.rect(labelX, y + 5, labelWidth, 40).fill('#FFF200').stroke();
    doc.fillColor('#000').fontSize(12).font('Helvetica-Bold')
        .text('LAPORAN HASIL ON DESK INVESTIGASI', labelX, y + 18, { 
            width: labelWidth, 
            align: 'center' 
        });

    try {
        doc.image(pathRightLogo, x + W - logoSize, y, { width: logoSize, height: logoSize });
    } catch (e) {
        doc.rect(x + W - logoSize, y, logoSize, logoSize).stroke();
    }

    doc.font('Helvetica');
    y += 65;

    /* =======================
        DATA PENGAJUAN INVESTIGASI
    ======================= */
    sectionHeader(doc, x, y, W, 'DATA PENGAJUAN INVESTIGASI', '#92D050');
    y += 18;

    labelCell(doc, x, y, COL, 22, '1. Nama Pemegang Polis');
    valueCell(doc, x+COL, y, COL, 22, lap?.nama_pemegang_polis);
    doc.font('Helvetica-Bold').fontSize(8)
        .text('PT DESWA INVISCO MULTITAMA', x+COL*2, y+8, { width: COL, align: 'center' });
    y += 22;

    labelCell(doc, x, y, COL, 22, '2. No. Peserta');
    valueCell(doc, x+COL, y, COL, 22, lap?.no_peserta);
    labelCell(doc, x+COL*2, y, COL, 22, 'PIC Investigator');
    valueCell(doc, x+COL*3, y, COL, 22, deswa?.pic_investigator);
    y += 22;

    labelCell(doc, x, y, COL, 22, '3. Nama Tertanggung');
    valueCell(doc, x+COL, y, COL, 22, lap?.nama_tertanggung);
    labelCell(doc, x+COL*2, y, COL, 22, 'Tanggal Terima');
    valueCell(doc, x+COL*3, y, COL, 22, formatDate(deswa?.tanggal_mulai));
    y += 22;

    labelCell(doc, x, y, COL, 22, '4. Masa Asuransi');
    valueCell(doc, x+COL, y, COL, 22, lap?.masa_asuransi);
    labelCell(doc, x+COL*2, y, COL, 22, 'Tanggal Selesai');
    valueCell(doc, x+COL*3, y, COL, 22, formatDate(deswa?.tanggal_selesai));
    y += 22;

    labelCell(doc, x, y, COL, 22, '5. Uang Pertanggungan');
    valueCell(doc, x+COL, y, COL, 22, lap?.uang_pertanggungan);
    labelCell(doc, x+COL*2, y, COL, 22, 'SLA Proses (hari kerja)');
    valueCell(doc, x+COL*3, y, COL, 22, deswa?.sla_proses);
    y += 22;

    labelCell(doc, x, y, COL, 22, '6. Tanggal Meninggal');
    valueCell(doc, x+COL, y, COL, 22, formatDate(lap?.tanggal_meninggal));
    doc.font('Helvetica-Bold').fontSize(8)
        .text('BRI LIFE', x+COL*2, y+8, { width: COL, align: 'center' });
    y += 22;

    labelCell(doc, x, y, COL, 22, '7. Tanggal Lahir');
    valueCell(doc, x+COL, y, COL, 22, formatDate(lap?.tanggal_lahir));
    labelCell(doc, x+COL*2, y, COL, 22, 'PIC Investigator');
    valueCell(doc, x+COL*3, y, COL, 22, bri?.pic_investigator);
    y += 22;

    labelCell(doc, x, y, COL, 22, '8. Pengisi form Kronologis');
    valueCell(doc, x+COL, y, COL, 22, lap?.pengisi_kronologis);
    labelCell(doc, x+COL*2, y, COL, 22, 'Tanggal Submit PIC Analis Klaim');
    valueCell(doc, x+COL*3, y, COL, 22, formatDate(bri?.tgl_submit_analis_klaim));
    y += 22;

    labelCell(doc, x, y, COL, 22, '9. Status');
    valueCell(doc, x+COL, y, COL, 22, lap?.status);
    labelCell(doc, x+COL*2, y, COL, 22, 'Tanggal Submit PIC Investigator');
    valueCell(doc, x+COL*3, y, COL, 22, formatDate(bri?.tgl_submit_pic_investigator));
    y += 22;

    labelCell(doc, x, y, COL, 22, '10. No Telpon');
    valueCell(doc, x+COL, y, COL, 22, lap?.no_telpon);
    labelCell(doc, x+COL*2, y, COL, 22, 'SLA');
    valueCell(doc, x+COL*3, y, COL, 22, bri?.sla);
    y += 22;

    labelCell(doc, x, y, COL, 22, '11. Alamat');
    valueCell(doc, x+COL, y, COL*3, 22, lap?.alamat);
    y += 22;

    labelCell(doc, x, y, COL, 22, '12. Kelengkapan Dokumen');
    valueCell(doc, x+COL, y, COL*3, 22, lap?.kelengkapan_dokumen);
    y += 30;

    /* =======================
        RESUME INTERVIEW (DENGAN DUA CELL TERPISAH)
    ======================= */
    sectionHeader(doc, x, y, W, 'RESUME HASIL INTERVIEW TERTANGGUNG/AHLI WARIS', '#92D050');
    y += 18;

    // Cell 1: Hasil Resume dari Database
    const hasilInterview = interview?.hasil_interview || '-';
    valueCell(doc, x, y, W, 60, hasilInterview);
    y += 60;

    // Cell 2: Teks Petunjuk (Gali informasi...)
    const petunjukText = "Gali informasi mengenai Kronologi kematian / perawatan, Pekerjaan apa dan dimana, Kronologis pinjaman di bank, kondisi keseharian, riwayat Berobat & Obat2 yg di minum, Riwayat Merokok / Miras, life style. Penggalian Domisili - sudah berapa lama disana.";
    valueCell(doc, x, y, W, 40, petunjukText);
    y += 50;

    /* =======================
        HASIL ON DESK
    ======================= */
    sectionHeader(doc, x, y, W, 'HASIL ON DESK INVESTIGASI', '#92D050');
    y += 18;

    desk.forEach(d => {
        if (y > 650) { doc.addPage(); y = 30; }

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

        let temuanText = d.hasil_investigasi || '-';
        const logs = telpMap[d.id] || [];
        if (logs.length) {
            temuanText = 'Hasil : ' + temuanText + '\n\nLog Telepon:\n';
            logs.forEach((p, i) => {
                temuanText += `- ${i+1}. ${formatDate(p.tanggal_telepon)} ${p.jam_telepon || ''}\n`;
            });
        }

        labelCell(doc, x, y, COL, 70, 'Temuan Investigasi');
        valueCell(doc, x+COL, y, COL*3, 70, temuanText);
        y += 75;
    });

    /* =======================
        RESUME AKHIR
    ======================= */
    if (y > 720) { doc.addPage(); y = 30; }
    sectionHeader(doc, x, y, W, 'RESUME HASIL INVESTIGASI', '#92D050');
    y += 18;
    valueCell(doc, x, y, W, 40, resume?.hasil || '-');

    /* =======================
        FOOTER
    ======================= */
    y += 50;
    doc.fontSize(7).fillColor('gray')
        .text('Dokumen ini dihasilkan secara otomatis. Format redaksional telah distandarisasi sesuai ketentuan.',
            x, y, { width: W, align: 'center' });

    doc.end();
};