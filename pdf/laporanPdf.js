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
    }) + 8;
}

/* Membersihkan teks dari karakter aneh */
function cleanText(text) {
  if (!text) return '-';
  return text
    .replace(/[^a-zA-Z0-9.,/()'"\-\s\n]/g, '') // buang karakter aneh
    .replace(/\r\n/g, '\n')
    .trim();
}

/* =======================
   CELL
======================= */
function labelCell(doc, x, y, w, h, text) {
    doc.lineWidth(0.7);
    doc.rect(x, y, w, h).stroke();
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#000')
        .text(text || '', x + 4, y + 5, { width: w - 8 });
}

function valueCell(doc, x, y, w, h, text, align = 'left') {
    doc.lineWidth(0.7);
    doc.rect(x, y, w, h).stroke();
    doc.font('Helvetica').fontSize(8).fillColor('#000')
        .text(cleanText(text) || '-', x + 4, y + 5, {
            width: w - 8,
            align,
            lineBreak: true
        });
}

function sectionHeader(doc, x, y, w, text, color) {
    doc.rect(x, y, w, 18).fill(color).stroke();
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#000')
        .text(text, x, y + 4, { width: w, align: 'center' });
}

/* =======================
   ROW
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

function fullWidthValueRow(doc, x, y, w, text, align = 'left') {
    const h = getTextHeight(doc, text, w);
    valueCell(doc, x, y, w, h, cleanText(text), align);
    return h;
}

/* =======================
   MERGE 2 KOLOM
======================= */
function spanTwoColumnsNoMiddleLine(doc, x, y, colW, h) {
    doc.lineWidth(0.7);
    doc.rect(x, y, colW * 2, h).stroke();
}

function centerTextBetweenColumns(doc, x, y, w, h, text) {
    doc.font('Helvetica-Bold').fontSize(8)
        .text(text || '-', x, y + (h / 2) - 4, {
            width: w,
            align: 'center'
        });
}

/* =======================
   INTERVIEW
======================= */
function interviewRow(doc, x, y, w, text) {
    const labelW = 30;
    const valueW = w - labelW;
    const h = Math.max(20, getTextHeight(doc, text, valueW));
    labelCell(doc, x, y, labelW, h, 'Ket :');
    valueCell(doc, x + labelW, y, valueW, h, cleanText(text));
    return h;
}

/* =======================
   CONTROLLER (FULL)
======================= */
module.exports = async (req, res) => {
    const doc = new PDFDocument({ size: 'A4', margin: 20 });
    res.setHeader('Content-Type', 'application/pdf');
    doc.pipe(res);

    const id = req.params.id;

    const [[lap]] = await db.query(`SELECT l.*, u.username AS created_by_name FROM laporan_investigasi l LEFT JOIN users u ON u.id = l.created_by WHERE l.id=?`, [id]);
    const [[deswa]] = await db.query(`SELECT * FROM deswa WHERE laporan_id=?`, [id]);
    const [[bri]] = await db.query(`SELECT * FROM bri WHERE laporan_id=?`, [id]);
    const [[interview]] = await db.query(`SELECT * FROM resume_hasil_interview WHERE laporan_id=?`, [id]);
    const [[resume]] = await db.query(`SELECT * FROM resume_investigasi WHERE laporan_id=?`, [id]);
    const [desk] = await db.query(`SELECT * FROM hasil_on_desk WHERE laporan_id=?`, [id]);
    const [penelponan] = await db.query(`SELECT * FROM penelponan WHERE laporan_id=? ORDER BY hasil_on_desk_id, tanggal_telepon`, [id]);

    const telpMap = {};
    penelponan.forEach(p => {
        if (!telpMap[p.hasil_on_desk_id]) telpMap[p.hasil_on_desk_id] = [];
        telpMap[p.hasil_on_desk_id].push(p);
    });

    const x = 20, W = 555, COL = 138;
    let y = 20;

    /* HEADER */
    const logo = 50;
    doc.image(path.join(__dirname,'../public/img/DIG.jpeg'), x, y, { width: logo });
    doc.rect(x + logo + 10, y + 5, W - logo * 2 - 20, 40).fill('#FFF200').stroke();
    doc.font('Helvetica-Bold').fontSize(12).fill('#000')
        .text('LAPORAN HASIL ON DESK INVESTIGASI', x + logo + 10, y + 18, {
            width: W - logo * 2 - 20, align: 'center'
        });
    doc.image(path.join(__dirname,'../public/img/dim.jpeg'), x + W - logo, y, { width: logo });
    y += 65;

    /* DATA PENGAJUAN */
    sectionHeader(doc, x, y, W, 'DATA PENGAJUAN INVESTIGASI', '#92D050');
    y += 22;

    let h1 = Math.max(20, getTextHeight(doc, lap?.nama_pemegang_polis, COL));
    labelCell(doc, x, y, COL, h1, '1. Nama Pemegang Polis');
    valueCell(doc, x + COL, y, COL, h1, lap?.nama_pemegang_polis);
    spanTwoColumnsNoMiddleLine(doc, x + COL * 2, y, COL, h1);
    centerTextBetweenColumns(doc, x + COL * 2, y, COL * 2, h1, 'PT DESWA INVISCO MULTITAMA');
    y += h1;

    y += dynamicRow4(doc, x, y, COL, { label: '2. No Peserta', value: lap?.no_peserta }, { label: 'PIC Investigator', value: deswa?.pic_investigator });
    y += dynamicRow4(doc, x, y, COL, { label: '3. Nama Tertanggung', value: lap?.nama_tertanggung }, { label: 'Tanggal Terima', value: formatDate(deswa?.tanggal_mulai) });
    y += dynamicRow4(doc, x, y, COL, { label: '4. Masa Asuransi', value: lap?.masa_asuransi }, { label: 'Tanggal Selesai', value: formatDate(deswa?.tanggal_selesai) });
    y += dynamicRow4(doc, x, y, COL, { label: '5. Uang Pertanggungan', value: lap?.uang_pertanggungan }, { label: 'SLA Proses', value: deswa?.sla_proses });

    let h6 = 20;
    labelCell(doc, x, y, COL, h6, '6. Tanggal Meninggal');
    valueCell(doc, x + COL, y, COL, h6, formatDate(lap?.tanggal_meninggal));
    spanTwoColumnsNoMiddleLine(doc, x + COL * 2, y, COL, h6);
    centerTextBetweenColumns(doc, x + COL * 2, y, COL * 2, h6, 'BRI LIFE');
    y += h6;

    y += dynamicRow4(doc, x, y, COL, { label: '7. Tanggal Lahir', value: formatDate(lap?.tanggal_lahir) },
        { label: 'PIC Investigator', value: bri?.pic_investigator });

    /* =======================
       PATCH TERPENTING
       Pengisi Form Kronologis
    ======================== */
    y += dynamicRow4(
        doc, x, y, COL,
        { label: '8. Pengisi Form Kronologis', value: cleanText(lap?.pengisi_form_kronologis) },
        { label: 'Tanggal Submit Analis Klaim', value: formatDate(bri?.tgl_submit_analis_klaim) }
    );

    y += dynamicRow4(doc, x, y, COL, { label: '9. Status', value: lap?.status_asuransi }, { label: 'Tanggal Submit PIC Investigator', value: formatDate(bri?.tgl_submit_pic_investigator) });

    y += dynamicRow4(doc, x, y, COL, { label: '10. No Telpon', value: lap?.no_telepon }, { label: 'SLA', value: bri?.sla });
    y += dynamicRow2(doc, x, y, COL, '11. Alamat', lap?.alamat);
    y += dynamicRow2(doc, x, y, COL, '12. Kelengkapan Dokumen', cleanText(lap?.kelengkapan_dokumen));

    /* KRONOLOGIS */
    sectionHeader(doc, x, y, W, 'KRONOLOGIS', '#92D050');
    y += 22;
    y += fullWidthValueRow(doc, x, y, W, cleanText(lap?.kronologis));

    /* RESUME INTERVIEW */
    sectionHeader(doc, x, y, W, 'RESUME HASIL INTERVIEW TERTANGGUNG / AHLI WARIS', '#92D050');
    y += 22;

    let interviewText = "-";
    if (interview) {
        const logs = [];
        if (interview.tgl_telpon_1) logs.push(`${formatDate(interview.tgl_telpon_1)} ${interview.jam_telpon_1 || ''}`);
        if (interview.tgl_telpon_2) logs.push(`${formatDate(interview.tgl_telpon_2)} ${interview.jam_telpon_2 || ''}`);
        if (interview.tgl_telpon_3) logs.push(`${formatDate(interview.tgl_telpon_3)} ${interview.jam_telpon_3 || ''}`);
        interviewText =
            (logs.length ? `Waktu Telepon: ${logs.join(', ')}\n` : '') +
            (interview.redaksional ? `Redaksional: ${interview.redaksional}\n\n` : '') +
            (interview.hasil_interview || '-');
    }

    y += interviewRow(doc, x, y, W, interviewText);

    y += fullWidthValueRow(
        doc,
        x,
        y,
        W,
        'Gali informasi mengenai Kronologi kematian / perawatan, Pekerjaan apa dan dimana, Kronologis pinjaman di bank, kondisi keseharian, riwayat Berobat & Obat2 yg di minum, Riwayat Merokok / Miras, life style. Penggalian Domisili - sudah berapa lama disana.',
        'center'
    );

    /* HASIL ON DESK */
    sectionHeader(doc, x, y, W, 'HASIL ON DESK INVESTIGASI', '#92D050');
    y += 22;

    desk.forEach(d => {
        if (y > 700) { doc.addPage(); y = 20; }
        y += dynamicRow4(doc, x, y, COL, { label: 'Tgl Investigasi', value: formatDate(d.tanggal_investigasi) }, { label: 'Nama Petugas', value: d.nama_petugas });
        y += dynamicRow2(doc, x, y, COL, 'Nama Faskes', d.nama_faskes);
        y += dynamicRow2(doc, x, y, COL, 'Alamat Faskes', d.alamat_faskes);

        let temuan = cleanText(d.hasil_investigasi) || '-';
        (telpMap[d.id] || []).forEach((p, i) => {
            temuan += `\n${i + 1}. ${formatDate(p.tanggal_telepon)} ${p.jam_telepon || ''}`;
        });

        y += dynamicRow2(doc, x, y, COL, 'Temuan Investigasi', temuan);
    });

    /* RESUME */
    sectionHeader(doc, x, y, W, 'RESUME HASIL INVESTIGASI', '#92D050');
    y += 22;
    y += interviewRow(doc, x, y, W, resume?.hasil || '-');

    doc.end();
};
