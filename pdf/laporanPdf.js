const PDFDocument = require("pdfkit");
const db = require("../config/db");

/* =======================
   HELPER DASAR
======================= */

function formatDateIndo(dateString) {
  if (!dateString || dateString === "0000-00-00") return "-";
  const d = new Date(dateString);
  if (isNaN(d)) return dateString;

  const bulan = [
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember",
  ];

  return `${d.getDate()} ${bulan[d.getMonth()]} ${d.getFullYear()}`;
}

function formatDate(dateString) {
  if (!dateString || dateString === "0000-00-00") return "-";
  const d = new Date(dateString);
  if (isNaN(d)) return dateString;
  return `${String(d.getDate()).padStart(2, "0")}/${String(
    d.getMonth() + 1
  ).padStart(2, "0")}/${d.getFullYear()}`;
}

function cleanText(text) {
  if (text === null || text === undefined) return "-";
  let t = text.toString();
  t = t
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u00A0/g, " ")
    .replace(/[^\x20-\x7E\n\r\t]/g, "");
  return t.trim() || "-";
}

function autoRowHeight(doc, text, width, min = 18) {
  const c = cleanText(text);
  const h = doc.heightOfString(c, {
    width: width - 10,
    lineBreak: true,
    lineGap: 2,
  });
  return Math.max(min, h + 12);
}

function checkPage(doc, y, need = 40) {
  if (y + need > 750) {
    doc.addPage();
    return 40;
  }
  return y;
}

/* =======================
   CELL & HEADER
======================= */

function cell(doc, x, y, w, h, text, opt = {}) {
  doc.lineWidth(0.6).strokeColor("#000").rect(x, y, w, h).stroke();

  doc
    .fillColor("#000") // WAJIB HITAM
    .font(opt.bold ? "Helvetica-Bold" : "Helvetica")
    .fontSize(8)
    .text(cleanText(text), x + 5, y + 6, {
      width: w - 10,
      align: opt.align || "left",
      lineBreak: true,
      lineGap: 2,
    });
}

function headerCell(doc, x, y, w, h, text) {
  doc.fillColor("#E7E6E6").rect(x, y, w, h).fill().stroke("#000");

  doc
    .fillColor("#000") // RESET HITAM
    .font("Helvetica-Bold")
    .fontSize(8)
    .text(text, x, y + (h - 8) / 2, {
      width: w,
      align: "center",
    });
}

function sectionTitle(doc, x, y, w, text) {
  doc.fillColor("#92D050").rect(x, y, w, 18).fill().stroke("#000");

  doc
    .fillColor("#000") // RESET HITAM
    .font("Helvetica-Bold")
    .fontSize(9)
    .text(text, x, y + 5, {
      width: w,
      align: "center",
    });
}

/* =======================
   ROW DINAMIS
======================= */

function dynamicRow(doc, y, cols) {
  const heights = cols.map((c) => autoRowHeight(doc, c.text, c.w, c.min || 20));
  const hRow = Math.max(...heights);

  y = checkPage(doc, y, hRow);

  let curX = cols[0].x;
  cols.forEach((c) => {
    cell(doc, curX, y, c.w, hRow, c.text, c.opt || {});
    curX += c.w;
  });

  return y + hRow;
}

/* =======================
   CONTROLLER
======================= */

module.exports = async (req, res) => {
  try {
    const id = req.params.id;

    const [[lap]] = await db.query(
      "SELECT * FROM laporan_investigasi WHERE id=?",
      [id]
    );
    if (!lap) return res.status(404).send("Data tidak ditemukan");

    const [[deswa]] = await db.query(
      "SELECT * FROM deswa WHERE laporan_id=? LIMIT 1",
      [id]
    );
    const [[bri]] = await db.query(
      "SELECT * FROM bri WHERE laporan_id=? LIMIT 1",
      [id]
    );
    const [desk] = await db.query(
      "SELECT * FROM hasil_on_desk WHERE laporan_id=? ORDER BY tanggal_investigasi",
      [id]
    );
    const [[resumeInv]] = await db.query(
      "SELECT * FROM resume_investigasi WHERE laporan_id=? LIMIT 1",
      [id]
    );
    const [resumeInterview] = await db.query(
      "SELECT hasil_interview FROM resume_hasil_interview WHERE laporan_id=?",
      [id]
    );

    const fileName = `${cleanText(lap?.nama_tertanggung)
  .replace(/[\/\\?%*:|"<>]/g, "")
  .replace(/\s+/g, " ")
  .trim()} - ${id}.pdf`;

    const doc = new PDFDocument({ size: "A4", margin: 25 });
      res.setHeader("Content-Type", "application/pdf");
      doc.pipe(res);

    const x = 25;
    const W = 545;
    let y = 30;

    /* ===== HEADER ===== */
    doc.fillColor("#E7E6E6").rect(x, y, W, 25).fill().stroke("#000");

    doc
      .fillColor("#000")
      .font("Helvetica-Bold")
      .fontSize(12)
      .text("FORMULIR INVESTIGASI BRI LIFE", x, y + 7, {
        width: W,
        align: "center",
      });

    y += 45;

    /* ===== INVESTIGATOR ===== */
    headerCell(doc, x, y, 252, 18, "INTERNAL BRI LIFE");
    headerCell(doc, x + 252, y, 293, 18, "VENDOR (DESWA)");
    y += 18;

    const infoRows = [
      [
        "1",
        "PIC Investigator (BRI)",
        bri?.pic_investigator,
        "1",
        "PIC Investigator (Vendor)",
        deswa?.pic_investigator,
      ],
      [
        "2",
        "Tgl Submit Analis",
        formatDate(bri?.tanggal_submit_pic_analis),
        "2",
        "Tanggal Terima",
        formatDate(deswa?.tanggal_mulai),
      ],
      [
        "3",
        "Tgl Submit Inv",
        formatDate(bri?.tanggal_submit_pic_investigator),
        "3",
        "Tanggal Selesai",
        formatDate(deswa?.tanggal_selesai),
      ],
      ["4", "SLA BRI", bri?.sla, "4", "SLA Vendor", deswa?.sla_proses],
    ];

    infoRows.forEach((r) => {
      y = dynamicRow(doc, y, [
        { x, w: 20, text: r[0], opt: { align: "center" } },
        { x, w: 140, text: r[1] },
        { x, w: 92, text: r[2] },
        { x, w: 20, text: r[3], opt: { align: "center" } },
        { x, w: 150, text: r[4] },
        { x, w: 123, text: r[5] },
      ]);
    });

    /* ===== DATA POLIS ===== */
    y += 15;
    sectionTitle(doc, x, y, W, "INFORMASI DATA POLIS");
    y += 18;

    const polis = [
      [
        "1",
        "Pemegang Polis",
        lap?.nama_pemegang_polis,
        "7",
        "Jenis Klaim",
        lap?.jenis_klaim,
      ],
      [
        "2",
        "Tertanggung",
        lap?.nama_tertanggung,
        "8",
        "Jenis Produk",
        lap?.jenis_produk,
      ],
      [
        "3",
        "Nomor Polis",
        lap?.no_peserta,
        "9",
        "UP / Nilai Klaim",
        lap?.uang_pertanggungan,
      ],
      [
        "4",
        "Mulai Asuransi",
        formatDate(lap?.tgl_mulai_asuransi),
        "10",
        "No KTP",
        lap?.no_identitas,
      ],
      [
        "5",
        "Akhir Asuransi",
        formatDate(lap?.tgl_akhir_asuransi),
        "11",
        "Tgl Meninggal",
        formatDate(lap?.tanggal_meninggal),
      ],
      [
        "6",
        "Usia Polis",
        lap?.usia_polis,
        "12",
        "Rekomendasi",
        lap?.rekomendasi,
      ],
    ];

    polis.forEach((r) => {
      y = dynamicRow(doc, y, [
        { x, w: 20, text: r[0], opt: { align: "center" } },
        { x, w: 140, text: r[1] },
        { x, w: 92, text: r[2] },
        { x, w: 20, text: r[3], opt: { align: "center" } },
        { x, w: 150, text: r[4] },
        { x, w: 123, text: r[5] },
      ]);
    });

    /* ===== ALAMAT ===== */
    y = dynamicRow(doc, y, [
      { x, w: 160, text: "Detail Alamat", opt: { bold: true } },
      { x, w: W - 160, text: lap?.alamat },
    ]);

    /* ===== KRONOLOGIS ===== */
    y += 15;
    sectionTitle(doc, x, y, W, "CATATAN INFORMASI DATA POLIS");
    y += 18;
    headerCell(doc, x, y, W, 18, "Diagnosa / Kronologis Kematian");
    y += 18;
    y = dynamicRow(doc, y, [{ x, w: W, text: lap?.kronologis, min: 40 }]);

    /* ===== HASIL INVESTIGASI ===== */
    y += 15;
    sectionTitle(doc, x, y, W, "HASIL KONFIRMASI / INVESTIGASI");
    y += 18;

    const wT = [90, 45, 65, 65, 75, 95, 95];
    [
      "Tanggal / Jam",
      "Activity",
      "Petugas",
      "No Kontak",
      "Faskes",
      "Alamat Faskes",
      "Hasil",
    ].forEach((h, i) => {
      headerCell(
        doc,
        x + wT.slice(0, i).reduce((a, b) => a + b, 0),
        y,
        wT[i],
        18,
        h
      );
    });
    y += 18;

    desk.forEach((d) => {
      y = dynamicRow(doc, y, [
        {
          x,
          w: wT[0],
          text: `${formatDateIndo(d.tanggal_investigasi)}\nJam ${
            d.jam_telepon || "--:--"
          }`,
          opt: { align: "center" },
        },
        { x, w: wT[1], text: d.activity },
        { x, w: wT[2], text: d.nama_petugas },
        { x, w: wT[3], text: d.no_kontak },
        { x, w: wT[4], text: d.nama_faskes },
        { x, w: wT[5], text: d.alamat_faskes },
        { x, w: wT[6], text: d.hasil_investigasi },
      ]);
    });

    /* ===== RESUME ===== */
    if (resumeInterview.length) {
      y += 15;
      sectionTitle(doc, x, y, W, "RESUME HASIL WAWANCARA AHLI WARIS");
      y += 18;
      resumeInterview.forEach((r) => {
        y = dynamicRow(doc, y, [{ x, w: W, text: r.hasil_interview, min: 30 }]);
      });
    }

    /* ===== ANALISA AKHIR ===== */
    [
      ["ANALISA INVESTIGATOR INDEPENDENT", resumeInv?.hasil],
      ["ANALISA PIC INVESTIGATOR", lap?.analisa_pic_investigator],
      ["ANALISA MA", lap?.analisa_ma],
      ["PUTUSAN DEPARTEMENT HEAD", lap?.putusan_klaim],
      ["KEPUTUSAN TEAM LEADER", lap?.analisa_putusan],
    ].forEach((s) => {
      y += 15;
      sectionTitle(doc, x, y, W, s[0]);
      y += 18;
      y = dynamicRow(doc, y, [{ x, w: W, text: s[1], min: 40 }]);
    });

    /* ===== PERSETUJUAN ===== */
    y += 20;
    headerCell(doc, x, y, W, 18, "PERSETUJUAN HASIL INVESTIGASI");
    y += 18;

    y = dynamicRow(doc, y, [
      {
        x,
        w: 180,
        text: "Departement Head",
        opt: { align: "center", bold: true },
      },
      { x, w: 180, text: "Team Leader", opt: { align: "center", bold: true } },
      { x, w: 185, text: "MA", opt: { align: "center", bold: true } },
    ]);

    y = dynamicRow(doc, y, [
      { x, w: 180, text: "", min: 80 },
      { x, w: 180, text: "", min: 80 },
      { x, w: 185, text: "", min: 80 },
    ]);

    doc.end();
  } catch (err) {
    console.error(err);
    res.status(500).send("Gagal generate PDF");
  }
};
