const PDFDocument = require("pdfkit");
const db = require("../config/db");

/* =======================
   HELPER DASAR (RESPONSIVE)
======================= */

function formatDateIndo(dateString) {
  if (!dateString || dateString === "0000-00-00") return "-";
  const d = new Date(dateString);
  if (isNaN(d)) return dateString;

  const bulanIndo = [
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

  return `${d.getDate()} ${bulanIndo[d.getMonth()]} ${d.getFullYear()}`;
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
  let cleaned = text.toString();
  cleaned = cleaned
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u00A0/g, " ");
  cleaned = cleaned.replace(/[^\x20-\x7E\n\r\t]/g, "");
  return cleaned.trim() || "-";
}

function autoRowHeight(doc, text, width, min = 18) {
  const content = cleanText(text);
  if (content === "-") return min;
  const textHeight = doc.heightOfString(content, {
    width: width - 10,
    lineBreak: true,
    lineGap: 2,
  });
  return Math.max(min, textHeight + 12);
}

function checkPage(doc, y, need = 50) {
  if (y + need > 750) {
    doc.addPage();
    return 40;
  }
  return y;
}

/* =======================
   CELL STYLING
======================= */
function cell(doc, x, y, w, h, text, opt = {}) {
  const content = cleanText(text);
  doc.lineWidth(0.6).strokeColor("#000");
  doc.rect(x, y, w, h).stroke();
  doc
    .font(opt.bold ? "Helvetica-Bold" : "Helvetica")
    .fontSize(8)
    .fillColor("#000");
  doc.text(content, x + 5, y + 6, {
    width: w - 10,
    align: opt.align || "left",
    lineBreak: true,
    lineGap: 2,
  });
}

function headerCell(doc, x, y, w, h, text) {
  doc.rect(x, y, w, h).fill("#E7E6E6").stroke("#000");
  doc.font("Helvetica-Bold").fontSize(8).fillColor("#000");
  doc.text(text, x, y + (h - 8) / 2, { width: w, align: "center" });
}

function sectionTitle(doc, x, y, w, text) {
  doc.rect(x, y, w, 18).fill("#92D050").stroke("#000");
  doc
    .font("Helvetica-Bold")
    .fontSize(9)
    .fillColor("#000")
    .text(text, x, y + 5, { width: w, align: "center" });
}

/* =======================
   CONTROLLER
======================= */
module.exports = async (req, res) => {
  try {
    const id = req.params.id;

    // 1. QUERY DATA
    const [[lap]] = await db.query(
      `SELECT * FROM laporan_investigasi WHERE id=?`,
      [id]
    );
    if (!lap) return res.status(404).send("Laporan tidak ditemukan");

    // Persiapkan Dokumen (Hanya pipe jika data ditemukan)
    const doc = new PDFDocument({ size: "A4", margin: 25, bufferPages: true });
    res.setHeader("Content-Type", "application/pdf");
    doc.pipe(res);

    const [[deswa]] = await db.query(
      `SELECT * FROM deswa WHERE laporan_id=? LIMIT 1`,
      [id]
    );
    const [[bri]] = await db.query(
      `SELECT * FROM bri WHERE laporan_id=? LIMIT 1`,
      [id]
    );
    const [desk] = await db.query(
      `SELECT * FROM hasil_on_desk WHERE laporan_id=? ORDER BY tanggal_investigasi ASC`,
      [id]
    );
    const [[resumeInv]] = await db.query(
      `SELECT * FROM resume_investigasi WHERE laporan_id=? LIMIT 1`,
      [id]
    );
    const [resumeInterview] = await db.query(
      `SELECT hasil_interview FROM resume_hasil_interview WHERE laporan_id = ? ORDER BY id ASC`,
      [id]
    );

    const x = 25;
    const W = 545;
    let y = 30;

    // 1. HEADER
    doc.rect(x, y, W, 25).fill("#E7E6E6").stroke("#000");
    doc
      .font("Helvetica-Bold")
      .fontSize(12)
      .fillColor("#000")
      .text("FORMULIR INVESTIGASI BRI LIFE", x, y + 7, {
        width: W,
        align: "center",
      });
    y += 50;

    // 2. DATA INVESTIGATOR
    y = checkPage(doc, y, 100);
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
      const hRow = Math.max(
        autoRowHeight(doc, r[2], 92),
        autoRowHeight(doc, r[5], 123),
        20
      );
      y = checkPage(doc, y, hRow);
      cell(doc, x, y, 20, hRow, r[0], { align: "center" });
      cell(doc, x + 20, y, 140, hRow, r[1]);
      cell(doc, x + 160, y, 92, hRow, r[2]);
      cell(doc, x + 252, y, 20, hRow, r[3], { align: "center" });
      cell(doc, x + 272, y, 150, hRow, r[4]);
      cell(doc, x + 422, y, 123, hRow, r[5]);
      y += hRow;
    });

    // 3. INFORMASI DATA POLIS
    y += 15;
    sectionTitle(doc, x, y, W, "INFORMASI DATA POLIS");
    y += 18;
    const polisMap = [
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
        "No KTP/Pasport",
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

    polisMap.forEach((r) => {
      const hRow = Math.max(
        autoRowHeight(doc, r[2], 92),
        autoRowHeight(doc, r[5], 123),
        20
      );
      y = checkPage(doc, y, hRow);
      cell(doc, x, y, 20, hRow, r[0], { align: "center" });
      cell(doc, x + 20, y, 140, hRow, r[1]);
      cell(doc, x + 160, y, 92, hRow, r[2]);
      cell(doc, x + 252, y, 20, hRow, r[3], { align: "center" });
      cell(doc, x + 272, y, 150, hRow, r[4]);
      cell(doc, x + 422, y, 123, hRow, r[5]);
      y += hRow;
    });

    const hAdr = autoRowHeight(doc, lap?.alamat, W - 160, 20);
    y = checkPage(doc, y, hAdr);
    cell(doc, x, y, 160, hAdr, "Detail Alamat", { bold: true });
    cell(doc, x + 160, y, W - 160, hAdr, lap?.alamat);
    y += hAdr + 15;

    // 4. KRONOLOGIS
    y = checkPage(doc, y, 100);
    sectionTitle(doc, x, y, W, "CATATAN INFORMASI DATA POLIS");
    y += 18;
    headerCell(doc, x, y, W, 18, "Diagnosa / Kronologis Kematian");
    y += 18;
    const hKron = autoRowHeight(doc, lap?.kronologis, W, 40);
    cell(doc, x, y, W, hKron, lap?.kronologis);
    y += hKron + 15;

    // 5. HASIL KONFIRMASI / INVESTIGASI (7 Kolom)
    y = checkPage(doc, y, 100);
    sectionTitle(doc, x, y, W, "HASIL KONFIRMASI / INVESTIGASI");
    y += 18;

    // Lebar Kolom (Total 545): Tgl(90), Act(45), Petugas(65), NoKontak(65), Faskes(75), Hasil(110), Analisa(95)
    const wT = [90, 45, 65, 65, 75, 110, 95];
    const headers = [
      "Tanggal / Jam",
      "Activity",
      "Petugas",
      "No Kontak",
      "Faskes",
      "Hasil Investigasi",
      "Analisa",
    ];

    let headerX = x;
    headers.forEach((h, i) => {
      headerCell(doc, headerX, y, wT[i], 18, h);
      headerX += wT[i];
    });
    y += 18;

    desk.forEach((d) => {
      const txtTglJam = `${formatDateIndo(d.tanggal_investigasi)}\nJam ${
        d.jam_telepon || "--:--"
      }`;
      const txtHasil = cleanText(d.hasil_investigasi);
      const txtAnalisa = cleanText(d.analisa);
      const txtPetugas = cleanText(d.nama_petugas);
      const txtNoKontak = cleanText(d.no_kontak);
      const txtFaskes = cleanText(d.nama_faskes);

      const hRow =
        Math.max(
          doc.heightOfString(txtTglJam, { width: wT[0] - 10 }),
          doc.heightOfString(txtHasil, { width: wT[5] - 10 }),
          doc.heightOfString(txtAnalisa, { width: wT[6] - 10 }),
          doc.heightOfString(txtPetugas, { width: wT[2] - 10 }),
          doc.heightOfString(txtNoKontak, { width: wT[3] - 10 }),
          25
        ) + 12;

      y = checkPage(doc, y, hRow);
      let curX = x;

      cell(doc, curX, y, wT[0], hRow, txtTglJam, { align: "center" });
      curX += wT[0];
      cell(doc, curX, y, wT[1], hRow, d.activity);
      curX += wT[1];
      cell(doc, curX, y, wT[2], hRow, txtPetugas);
      curX += wT[2];
      cell(doc, curX, y, wT[3], hRow, txtNoKontak);
      curX += wT[3];
      cell(doc, curX, y, wT[4], hRow, txtFaskes);
      curX += wT[4];
      cell(doc, curX, y, wT[5], hRow, txtHasil);
      curX += wT[5];
      cell(doc, curX, y, wT[6], hRow, txtAnalisa);

      y += hRow;
    });

    // 6. RESUME HASIL INTERVIEW
    if (resumeInterview.length > 0) {
      y += 15;
      y = checkPage(doc, y, 60);
      sectionTitle(doc, x, y, W, "RESUME HASIL WAWANCARA AHLI WARIS");
      y += 18;
      resumeInterview.forEach((ri) => {
        const content = cleanText(ri.hasil_interview);
        const hContent = autoRowHeight(doc, content, W, 30);
        y = checkPage(doc, y, hContent);
        cell(doc, x, y, W, hContent, content);
        y += hContent;
      });
    }

    // 7. ANALISA AKHIR
    const finalAnl = [
      { t: "ANALISA INVESTIGATOR INDEPENDENT", v: resumeInv?.hasil },
      { t: "ANALISA PIC INVESTIGATOR", v: lap?.analisa_pic_investigator },
      { t: "ANALISA MA", v: lap?.analisa_ma },
      { t: "ANALISAN DAN PUTUSAN DEPARTEMENT HEAD", v: lap?.putusan_klaim },
      { t: "ANALISAN DAN KEPUTUSAN TEAM LEADER", v: lap?.analisa_putusan },
    ];

    finalAnl.forEach((s) => {
      const val = cleanText(s.v);
      const h = autoRowHeight(doc, val, W, 40);
      y = checkPage(doc, y, h + 40);
      y += 15;
      sectionTitle(doc, x, y, W, s.t);
      y += 18;
      cell(doc, x, y, W, h, val);
      y += h;
    });

    /* =======================
   PERSETUJUAN HASIL INVESTIGASI
======================= */

y += 25;
y = checkPage(doc, y, 220);

// Judul Section
doc.rect(x, y, W, 20).fill("#E7E6E6").stroke("#000");
doc
  .font("Helvetica-Bold")
  .fontSize(9)
  .fillColor("#000")
  .text("PERSETUJUAN HASIL INVESTIGASI", x, y + 6, {
    width: W,
    align: "center",
  });

y += 20;

// Lebar kolom (total 545)
const colDeptHead = 180;
const colTeamLeader = 180;
const colMA = 185;
const headerHeight = 18;
const signHeight = 120;

// Header kolom
headerCell(doc, x, y, colDeptHead, headerHeight, "Departement Head");
headerCell(
  doc,
  x + colDeptHead,
  y,
  colTeamLeader,
  headerHeight,
  "Team Leader"
);
headerCell(
  doc,
  x + colDeptHead + colTeamLeader,
  y,
  colMA,
  headerHeight,
  "MA"
);

y += headerHeight;

// Area tanda tangan (kosong)
cell(doc, x, y, colDeptHead, signHeight, "", { align: "center" });
cell(
  doc,
  x + colDeptHead,
  y,
  colTeamLeader,
  signHeight,
  "",
  { align: "center" }
);
cell(
  doc,
  x + colDeptHead + colTeamLeader,
  y,
  colMA,
  signHeight,
  "",
  { align: "center" }
);

y += signHeight;


    doc.end();
  } catch (err) {
    console.error("PDF Error: ", err);
    if (!res.headersSent) {
      res
        .status(500)
        .send("Terjadi kesalahan saat membuat PDF: " + err.message);
    }
  }
};
