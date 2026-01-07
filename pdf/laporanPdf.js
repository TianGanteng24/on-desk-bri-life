const PDFDocument = require("pdfkit");
const db = require("../config/db");

/* =======================
   HELPER DASAR (RESPONSIVE)
======================= */

// Fungsi Format Tanggal Indonesia (Misal: 10 Januari 2025)
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

// Digunakan untuk kolom yang lebih ringkas (misal tabel atas)
function formatDate(dateString) {
  if (!dateString || dateString === "0000-00-00") return "-";
  const d = new Date(dateString);
  if (isNaN(d)) return dateString;
  return `${String(d.getDate()).padStart(2, "0")}/${String(
    d.getMonth() + 1
  ).padStart(2, "0")}/${d.getFullYear()}`;
}

/**
 * Membersihkan teks dari karakter Non-ASCII yang merusak PDF
 */
function cleanText(text) {
  if (text === null || text === undefined) return "-";

  let cleaned = text.toString();

  cleaned = cleaned
    .replace(/[\u2018\u2019]/g, "'") // Smart quotes single
    .replace(/[\u201C\u201D]/g, '"') // Smart quotes double
    .replace(/[\u2013\u2014]/g, "-") // En/Em dash
    .replace(/\u00A0/g, " "); // Non-breaking space

  // Hapus karakter Non-ASCII agar tidak error font di PDFKit
  cleaned = cleaned.replace(/[^\x20-\x7E\n\r\t]/g, "");

  return cleaned.trim() || "-";
}

/**
 * MENGHITUNG TINGGI DINAMIS BARIS
 */
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

/**
 * CEK PINDAH HALAMAN OTOMATIS
 */
function checkPage(doc, y, need = 50) {
  if (y + need > 750) {
    doc.addPage();
    return 40; // Margin atas halaman baru
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
    const doc = new PDFDocument({ size: "A4", margin: 25, bufferPages: true });
    res.setHeader("Content-Type", "application/pdf");
    doc.pipe(res);

    const id = req.params.id;

    // QUERY DATA
    const [[lap]] = await db.query(
      `SELECT * FROM laporan_investigasi WHERE id=?`,
      [id]
    );
    if (!lap) return res.status(404).send("Laporan tidak ditemukan");

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
    const headerHeight = 25;
    doc.rect(x, y, W, headerHeight).fill("#E7E6E6").stroke("#000");
    doc.font("Helvetica-Bold").fontSize(12).fillColor("#000");
    doc.text("FORMULIR INVESTIGASI BRI LIFE", x, y + 7, {
      width: W,
      align: "center",
    });
    y += headerHeight + 25;

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
    y = checkPage(doc, y, 150);
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
    const teksKron = cleanText(lap?.kronologis);
    const hKron = autoRowHeight(doc, teksKron, W, 40);
    y = checkPage(doc, y, hKron + 40);
    sectionTitle(doc, x, y, W, "CATATAN INFORMASI DATA POLIS");
    y += 18;
    headerCell(doc, x, y, W, 18, "Diagnosa / Kronologis Kematian");
    y += 18;
    cell(doc, x, y, W, hKron, teksKron);
    y += hKron + 15;

    // 5. HASIL KONFIRMASI / INVESTIGASI (TABEL)
    y = checkPage(doc, y, 100);
    sectionTitle(doc, x, y, W, "HASIL KONFIRMASI / INVESTIGASI");
    y += 18;

    // Lebar Kolom: Tgl & Jam (110), Act (45), Petugas (65), Faskes (75), Hasil (145), Analisa (105)
    const wT = [110, 45, 65, 75, 145, 105];
    const headers = [
      "Tanggal / Jam",
      "Activity",
      "Petugas",
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
      const txtHasil = cleanText(d.hasil_investigasi);
      const txtAnalisa = cleanText(d.analisa);

      // Gabungkan Tanggal Format Indo dan Jam
      const tglIndo = formatDateIndo(d.tanggal_investigasi); // Hasil: 10 Januari 2025
      const jam = d.jam_telepon || "--:--";
      const txtTglJam = `${tglIndo}\nJam ${jam}`;

      // Hitung tinggi baris berdasarkan teks terpanjang (Hasil, Analisa, atau TglJam)
      const hHasil = doc.heightOfString(txtHasil, {
        width: wT[4] - 10,
        lineGap: 2,
      });
      const hAnalisa = doc.heightOfString(txtAnalisa, {
        width: wT[5] - 10,
        lineGap: 2,
      });
      const hTgl = doc.heightOfString(txtTglJam, {
        width: wT[0] - 10,
        lineGap: 2,
      });

      // Pastikan hRow mengambil nilai tertinggi agar kotak sel tidak tumpang tindih
      const hRow = Math.max(hHasil, hAnalisa, hTgl, 25) + 12;

      y = checkPage(doc, y, hRow);

      let curX = x;
      // Kolom 1: Tanggal & Jam
      cell(doc, curX, y, wT[0], hRow, txtTglJam, { align: "center" });
      curX += wT[0];

      // Kolom 2-6
      cell(doc, curX, y, wT[1], hRow, d.activity);
      curX += wT[1];
      cell(doc, curX, y, wT[2], hRow, d.nama_petugas);
      curX += wT[2];
      cell(doc, curX, y, wT[3], hRow, d.nama_faskes);
      curX += wT[3];
      cell(doc, curX, y, wT[4], hRow, txtHasil);
      curX += wT[4];
      cell(doc, curX, y, wT[5], hRow, txtAnalisa);

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
    ];

    finalAnl.forEach((s) => {
      const val = cleanText(s.v);
      const h = autoRowHeight(doc, val, W, 40);
      y = checkPage(doc, y, h + 30);
      y += 15;
      sectionTitle(doc, x, y, W, s.t);
      y += 18;
      cell(doc, x, y, W, h, val);
      y += h;
    });

    // 8. PUTUSAN KLAIM
    const anlPutusan = cleanText(lap?.analisa_putusan);
    const hPut = autoRowHeight(doc, anlPutusan, W - 150, 40);
    y = checkPage(doc, y, hPut + 70);
    y += 15;
    sectionTitle(doc, x, y, W, "PUTUSAN KLAIM");
    y += 18;
    cell(doc, x, y, 150, 20, "STATUS", { bold: true });
    cell(doc, x + 150, y, W - 150, 20, lap?.putusan_klaim || "-");
    y += 20;
    cell(doc, x, y, 150, hPut, "ANALISA PUTUSAN", { bold: true });
    cell(doc, x + 150, y, W - 150, hPut, anlPutusan);

    doc.end();
  } catch (err) {
    console.error("PDF Error: ", err);
    res.status(500).send("Terjadi kesalahan saat membuat PDF: " + err.message);
  }
};
