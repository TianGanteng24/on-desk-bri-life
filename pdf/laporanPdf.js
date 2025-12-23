const PDFDocument = require('pdfkit');
const db = require('../config/db');
const path = require('path');

/* =======================
   HELPER DASAR
======================= */
function formatDate(dateString) {
    if (!dateString) return '-';
    const d = new Date(dateString);
    if (isNaN(d)) return dateString;
    return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
}

function getTextHeight(doc, text, width, fontSize = 8) {
    doc.fontSize(fontSize);
    return doc.heightOfString(text || '-', {
        width: width - 8,
        lineBreak: true
    }) + 12;
}

/* =======================
   CELL
======================= */
function labelCell(doc, x, y, w, h, text) {
    doc.lineWidth(0.7);
    doc.rect(x, y, w, h).stroke();
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#000')
        .text(text || '', x + 4, y + 6, { width: w - 8 });
}

function valueCell(doc, x, y, w, h, text, align = 'left') {
    doc.lineWidth(0.7);
    doc.rect(x, y, w, h).stroke();
    doc.font('Helvetica').fontSize(8).fillColor('#000')
        .text(text || '-', x + 4, y + 6, {
            width: w - 8,
            align,
            lineBreak: true
        });
}

function sectionHeader(doc, x, y, w, text, color) {
    doc.rect(x, y, w, 18).fill(color).stroke();
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#000')
        .text(text, x, y + 5, { width: w, align: 'center' });
}

/* =======================
   ROW DINAMIS
======================= */
function dynamicRow4(doc, x, y, colW, a, b) {
    const h = Math.max(
        getTextHeight(doc, a.label, colW),
        getTextHeight(doc, a.value, colW),
        getTextHeight(doc, b.label, colW),
        getTextHeight(doc, b.value, colW)
    );

    labelCell(doc, x, y, colW, h, a.label);
    valueCell(doc, x + colW, y, colW, h, a.value);
    labelCell(doc, x + colW * 2, y, colW, h, b.label);
    valueCell(doc, x + colW * 3, y, colW, h, b.value);

    return h;
}

function dynamicRow2(doc, x, y, colW, label, value) {
    const h = Math.max(
        getTextHeight(doc, label, colW),
        getTextHeight(doc, value, colW * 3)
    );

    labelCell(doc, x, y, colW, h, label);
    valueCell(doc, x + colW, y, colW * 3, h, value);

    return h;
}

/* =======================
   MERGE 2 KOLOM TANPA GARIS TENGAH
======================= */
function spanTwoColumnsNoMiddleLine(doc, x, y, colW, h) {
    doc.lineWidth(0.7);
    doc.moveTo(x, y).lineTo(x + colW * 2, y).stroke();
    doc.moveTo(x, y + h).lineTo(x + colW * 2, y + h).stroke();
    doc.moveTo(x, y).lineTo(x, y + h).stroke();
    doc.moveTo(x + colW * 2, y).lineTo(x + colW * 2, y + h).stroke();
}

function centerTextBetweenColumns(doc, x, y, w, h, text) {
    doc.font('Helvetica-Bold').fontSize(8)
        .text(text || '-', x, y + (h / 2) - 4, {
            width: w,
            align: 'center'
        });
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
       HEADER + LOGO
    ======================= */
    const logoSize = 50;
    const labelW = W - logoSize * 2 - 20;

    doc.image(path.join(__dirname,'../public/img/DIG.jpeg'), x, y, { width: logoSize });
    doc.rect(x + logoSize + 10, y + 5, labelW, 40).fill('#FFF200').stroke();
    doc.font('Helvetica-Bold').fontSize(12)
        .text('LAPORAN HASIL ON DESK INVESTIGASI', x + logoSize + 10, y + 18, {
            width: labelW,
            align: 'center'
        });
    doc.image(path.join(__dirname,'../public/img/dsm.jpeg'), x + W - logoSize, y, { width: logoSize });

    y += 65;

    /* =======================
       DATA PENGAJUAN
    ======================= */
    sectionHeader(doc, x, y, W, 'DATA PENGAJUAN INVESTIGASI', '#92D050');
    y += 18;

    let h = Math.max(
        getTextHeight(doc, lap?.nama_pemegang_polis, COL),
        getTextHeight(doc, 'PT DESWA INVISCO MULTITAMA', COL * 2)
    );

    labelCell(doc, x, y, COL, h, '1. Nama Pemegang Polis');
    valueCell(doc, x + COL, y, COL, h, lap?.nama_pemegang_polis);
    spanTwoColumnsNoMiddleLine(doc, x + COL * 2, y, COL, h);
    centerTextBetweenColumns(doc, x + COL * 2, y, COL * 2, h, 'PT DESWA INVISCO MULTITAMA');
    y += h;

    y += dynamicRow4(doc, x, y, COL,
        { label: '2. No Peserta', value: lap?.no_peserta },
        { label: 'PIC Investigator', value: deswa?.pic_investigator }
    );

    y += dynamicRow4(doc, x, y, COL,
        { label: '3. Nama Tertanggung', value: lap?.nama_tertanggung },
        { label: 'Tanggal Terima', value: formatDate(deswa?.tanggal_mulai) }
    );

    y += dynamicRow4(doc, x, y, COL,
        { label: '4. Masa Asuransi', value: lap?.masa_asuransi },
        { label: 'Tanggal Selesai', value: formatDate(deswa?.tanggal_selesai) }
    );

    y += dynamicRow4(doc, x, y, COL,
        { label: '5. Uang Pertanggungan', value: lap?.uang_pertanggungan },
        { label: 'SLA Proses', value: deswa?.sla_proses }
    );

    h = Math.max(
        getTextHeight(doc, lap?.tanggal_meninggal, COL),
        getTextHeight(doc, 'BRI LIFE', COL * 2)
    );

    labelCell(doc, x, y, COL, h, '6. Tanggal Meninggal');
    valueCell(doc, x + COL, y, COL, h, formatDate(lap?.tanggal_meninggal));
    spanTwoColumnsNoMiddleLine(doc, x + COL * 2, y, COL, h);
    centerTextBetweenColumns(doc, x + COL * 2, y, COL * 2, h, 'BRI LIFE');
    y += h;

    y += dynamicRow4(doc, x, y, COL,
        { label: '7. Tanggal Lahir', value: formatDate(lap?.tanggal_lahir) },
        { label: 'PIC Investigator', value: bri?.pic_investigator }
    );

    y += dynamicRow4(doc, x, y, COL,
        { label: '8. Pengisi Form Kronologis', value: lap?.kronologis },
        { label: 'Tanggal Submit Analis Klaim', value: formatDate(bri?.tgl_submit_analis_klaim) }
    );

    y += dynamicRow4(doc, x, y, COL,
        { label: '9. Status', value: lap?.status_asuransi },
        { label: 'Tanggal Submit PIC Investigator', value: formatDate(bri?.tgl_submit_pic_investigator) }
    );

    y += dynamicRow4(doc, x, y, COL,
        { label: '10. No Telpon', value: lap?.no_telepon },
        { label: 'SLA', value: bri?.sla }
    );

    y += dynamicRow2(doc, x, y, COL, '11. Alamat', lap?.alamat);
    y += dynamicRow2(doc, x, y, COL, '12. Kelengkapan Dokumen', lap?.kelengkapan_dokumen);

    /* =======================
       RESUME INTERVIEW
    ======================= */
    sectionHeader(doc, x, y + 10, W, 'RESUME HASIL INTERVIEW', '#92D050');
    y += 28;
    y += dynamicRow2(doc, x, y, COL, '', interview?.hasil_interview);

    /* =======================
       HASIL ON DESK
    ======================= */
    sectionHeader(doc, x, y + 10, W, 'HASIL ON DESK INVESTIGASI', '#92D050');
    y += 28;

    desk.forEach(d => {
        y += dynamicRow4(doc, x, y, COL,
            { label: 'Tgl Investigasi', value: formatDate(d.tanggal_investigasi) },
            { label: 'Nama Petugas', value: d.nama_petugas }
        );

        y += dynamicRow2(doc, x, y, COL, 'Nama Faskes', d.nama_faskes);
        y += dynamicRow2(doc, x, y, COL, 'Alamat Faskes', d.alamat_faskes);

        let temuan = d.hasil_investigasi || '-';
        (telpMap[d.id] || []).forEach((p,i) => {
            temuan += `\n${i+1}. ${formatDate(p.tanggal_telepon)} ${p.jam_telepon || ''}`;
        });

        y += dynamicRow2(doc, x, y, COL, 'Temuan Investigasi', temuan);
    });

    /* =======================
       RESUME AKHIR
    ======================= */
    sectionHeader(doc, x, y + 10, W, 'RESUME HASIL INVESTIGASI', '#92D050');
    y += 28;
    valueCell(doc, x, y, W, getTextHeight(doc, resume?.hasil, W), resume?.hasil);

    doc.end();
};
