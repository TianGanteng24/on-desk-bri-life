const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, HeadingLevel, VerticalAlign } = require("docx");
const db = require("../config/db");

/* =======================
   HELPER DASAR
======================= */

function formatDateIndo(dateString) {
  if (!dateString || dateString === "0000-00-00") return "-";
  const d = new Date(dateString);
  if (isNaN(d)) return dateString;

  const bulan = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];

  return `${d.getDate()} ${bulan[d.getMonth()]} ${d.getFullYear()}`;
}

function formatDate(dateString) {
  if (!dateString || dateString === "0000-00-00") return "-";
  const d = new Date(dateString);
  if (isNaN(d)) return dateString;
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
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

/* =======================
   UI COMPONENTS
======================= */

const createTableCell = (text, options = {}) => {
  return new TableCell({
    children: [
      new Paragraph({
        alignment: options.align || AlignmentType.LEFT,
        children: [
          new TextRun({
            text: cleanText(text),
            bold: options.bold || false,
            size: options.size || 16, // 16 half-points = 8pt
            font: "Arial",
          }),
        ],
      }),
    ],
    width: options.width ? { size: options.width, type: WidthType.PERCENTAGE } : undefined,
    shading: options.shading ? { fill: options.shading } : undefined,
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 100, bottom: 100, left: 100, right: 100 },
  });
};

const createSectionTitle = (text) => {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          createTableCell(text, { bold: true, align: AlignmentType.CENTER, shading: "92D050", size: 18 }),
        ],
      }),
    ],
  });
};

const createHeaderCell = (text, width) => {
  return createTableCell(text, { bold: true, align: AlignmentType.CENTER, shading: "E7E6E6", size: 16, width });
};

/* =======================
   CONTROLLER
======================= */

module.exports = async (req, res) => {
  try {
    const id = req.params.id;

    // Fetch data
    const [[lap]] = await db.query("SELECT * FROM laporan_investigasi WHERE id=?", [id]);
    if (!lap) return res.status(404).send("Data tidak ditemukan");

    const [[deswa]] = await db.query("SELECT * FROM deswa WHERE laporan_id=? LIMIT 1", [id]);
    const [[bri]] = await db.query("SELECT * FROM bri WHERE laporan_id=? LIMIT 1", [id]);
    const [desk] = await db.query("SELECT * FROM hasil_on_desk WHERE laporan_id=? ORDER BY tanggal_investigasi", [id]);
    const [deskLanjutan] = await db.query("SELECT * FROM hasil_ondesk_lanjutan WHERE laporan_id=? ORDER BY tanggal_investigasi", [id]);
    const [[resumeInv]] = await db.query("SELECT * FROM resume_investigasi WHERE laporan_id=? LIMIT 1", [id]);
    const [resumeInterview] = await db.query("SELECT hasil_interview FROM resume_hasil_interview WHERE laporan_id=?", [id]);

    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          // Header Utama
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  createTableCell("FORMULIR INVESTIGASI BRI LIFE", { bold: true, align: AlignmentType.CENTER, shading: "E7E6E6", size: 24 }),
                ],
              }),
            ],
          }),
          new Paragraph({ text: "" }),

          // Investigator Section
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  createTableCell("INTERNAL BRI LIFE", { bold: true, align: AlignmentType.CENTER, shading: "E7E6E6", width: 46 }),
                  createTableCell("VENDOR (DESWA)", { bold: true, align: AlignmentType.CENTER, shading: "E7E6E6", width: 54 }),
                ],
              }),
            ],
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              // Row 1
              new TableRow({
                children: [
                  createTableCell("1", { align: AlignmentType.CENTER, width: 4 }),
                  createTableCell("PIC Investigator (BRI)", { width: 25 }),
                  createTableCell(bri?.pic_investigator, { width: 17 }),
                  createTableCell("1", { align: AlignmentType.CENTER, width: 4 }),
                  createTableCell("PIC Investigator (Vendor)", { width: 27 }),
                  createTableCell(deswa?.pic_investigator, { width: 23 }),
                ],
              }),
              // Row 2
              new TableRow({
                children: [
                  createTableCell("2", { align: AlignmentType.CENTER, width: 4 }),
                  createTableCell("Tgl Submit Analis", { width: 25 }),
                  createTableCell(formatDate(bri?.tanggal_submit_pic_analis), { width: 17 }),
                  createTableCell("2", { align: AlignmentType.CENTER, width: 4 }),
                  createTableCell("Tanggal Terima", { width: 27 }),
                  createTableCell(formatDate(deswa?.tanggal_mulai), { width: 23 }),
                ],
              }),
              // Row 3
              new TableRow({
                children: [
                  createTableCell("3", { align: AlignmentType.CENTER, width: 4 }),
                  createTableCell("Tgl Submit Inv", { width: 25 }),
                  createTableCell(formatDate(bri?.tanggal_submit_pic_investigator), { width: 17 }),
                  createTableCell("3", { align: AlignmentType.CENTER, width: 4 }),
                  createTableCell("Tanggal Selesai", { width: 27 }),
                  createTableCell(formatDate(deswa?.tanggal_selesai), { width: 23 }),
                ],
              }),
              // Row 4
              new TableRow({
                children: [
                  createTableCell("4", { align: AlignmentType.CENTER, width: 4 }),
                  createTableCell("SLA BRI", { width: 25 }),
                  createTableCell(bri?.sla, { width: 17 }),
                  createTableCell("4", { align: AlignmentType.CENTER, width: 4 }),
                  createTableCell("SLA Vendor", { width: 27 }),
                  createTableCell(deswa?.sla_proses, { width: 23 }),
                ],
              }),
            ],
          }),
          new Paragraph({ text: "" }),

          // Data Polis Section
          createSectionTitle("INFORMASI DATA POLIS"),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              // Row 1
              new TableRow({
                children: [
                  createTableCell("1", { align: AlignmentType.CENTER, width: 4 }),
                  createTableCell("Pemegang Polis", { width: 25 }),
                  createTableCell(lap?.nama_pemegang_polis, { width: 17 }),
                  createTableCell("7", { align: AlignmentType.CENTER, width: 4 }),
                  createTableCell("Jenis Klaim", { width: 27 }),
                  createTableCell(lap?.jenis_klaim, { width: 23 }),
                ],
              }),
              // Row 2
              new TableRow({
                children: [
                  createTableCell("2", { align: AlignmentType.CENTER, width: 4 }),
                  createTableCell("Tertanggung", { width: 25 }),
                  createTableCell(lap?.nama_tertanggung, { width: 17 }),
                  createTableCell("8", { align: AlignmentType.CENTER, width: 4 }),
                  createTableCell("Jenis Produk", { width: 27 }),
                  createTableCell(lap?.jenis_produk, { width: 23 }),
                ],
              }),
              // Row 3
              new TableRow({
                children: [
                  createTableCell("3", { align: AlignmentType.CENTER, width: 4 }),
                  createTableCell("Nomor Polis", { width: 25 }),
                  createTableCell(lap?.no_peserta, { width: 17 }),
                  createTableCell("9", { align: AlignmentType.CENTER, width: 4 }),
                  createTableCell("UP / Nilai Klaim", { width: 27 }),
                  createTableCell(lap?.uang_pertanggungan, { width: 23 }),
                ],
              }),
              // Row 4
              new TableRow({
                children: [
                  createTableCell("4", { align: AlignmentType.CENTER, width: 4 }),
                  createTableCell("Mulai Asuransi", { width: 25 }),
                  createTableCell(formatDate(lap?.tgl_mulai_asuransi), { width: 17 }),
                  createTableCell("10", { align: AlignmentType.CENTER, width: 4 }),
                  createTableCell("No KTP", { width: 27 }),
                  createTableCell(lap?.no_identitas, { width: 23 }),
                ],
              }),
              // Row 5
              new TableRow({
                children: [
                  createTableCell("5", { align: AlignmentType.CENTER, width: 4 }),
                  createTableCell("Akhir Asuransi", { width: 25 }),
                  createTableCell(formatDate(lap?.tgl_akhir_asuransi), { width: 17 }),
                  createTableCell("11", { align: AlignmentType.CENTER, width: 4 }),
                  createTableCell("Tgl Meninggal", { width: 27 }),
                  createTableCell(formatDate(lap?.tanggal_meninggal), { width: 23 }),
                ],
              }),
              // Row 6
              new TableRow({
                children: [
                  createTableCell("6", { align: AlignmentType.CENTER, width: 4 }),
                  createTableCell("Usia Polis", { width: 25 }),
                  createTableCell(lap?.usia_polis, { width: 17 }),
                  createTableCell("12", { align: AlignmentType.CENTER, width: 4 }),
                  createTableCell("Rekomendasi", { width: 27 }),
                  createTableCell(lap?.rekomendasi, { width: 23 }),
                ],
              }),
            ],
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  createTableCell("Detail Alamat", { bold: true, width: 29 }),
                  createTableCell(lap?.alamat, { width: 71 }),
                ],
              }),
            ],
          }),
          new Paragraph({ text: "" }),

          // Kronologis
          createSectionTitle("CATATAN INFORMASI DATA POLIS"),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [createHeaderCell("Diagnosa / Kronologis Kematian", 100)],
              }),
              new TableRow({
                children: [createTableCell(lap?.kronologis, { width: 100 })],
              }),
            ],
          }),
          new Paragraph({ text: "" }),

          // Hasil Investigasi
          createSectionTitle("HASIL KONFIRMASI / INVESTIGASI"),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  createHeaderCell("Tanggal / Jam", 17),
                  createHeaderCell("Activity", 8),
                  createHeaderCell("Petugas", 12),
                  createHeaderCell("No Kontak", 12),
                  createHeaderCell("Faskes", 14),
                  createHeaderCell("Alamat Faskes", 18),
                  createHeaderCell("Hasil", 19),
                ],
              }),
              ...desk.map(d => new TableRow({
                children: [
                  createTableCell(`${formatDateIndo(d.tanggal_investigasi)}\nJam ${d.jam_telepon || "--:--"}`, { align: AlignmentType.CENTER }),
                  createTableCell(d.activity),
                  createTableCell(d.nama_petugas),
                  createTableCell(d.no_kontak),
                  createTableCell(d.nama_faskes),
                  createTableCell(d.alamat_faskes),
                  createTableCell(d.hasil_investigasi),
                ],
              })),
            ],
          }),
          new Paragraph({ text: "" }),

          // Hasil Investigasi Lanjutan
          ...(deskLanjutan && deskLanjutan.length > 0 ? [
            createSectionTitle("HASIL INVESTIGASI LANJUTAN"),
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                new TableRow({
                  children: [
                    createHeaderCell("Tanggal / Jam", 17),
                    createHeaderCell("Activity", 8),
                    createHeaderCell("Petugas", 12),
                    createHeaderCell("No Kontak", 12),
                    createHeaderCell("Faskes", 14),
                    createHeaderCell("Alamat Faskes", 18),
                    createHeaderCell("Hasil", 19),
                  ],
                }),
                ...deskLanjutan.map(d => new TableRow({
                  children: [
                    createTableCell(`${formatDateIndo(d.tanggal_investigasi)}\nJam ${d.jam_telepon || "--:--"}`, { align: AlignmentType.CENTER }),
                    createTableCell(d.activity || "-"),
                    createTableCell(d.nama_petugas),
                    createTableCell(d.no_kontak || "-"),
                    createTableCell(d.nama_faskes),
                    createTableCell(d.alamat_faskes || "-"),
                    createTableCell(d.hasil_investigasi),
                  ],
                })),
              ],
            }),
            new Paragraph({ text: "" }),
          ] : []),

          // Resume Interview
          ...(resumeInterview.length > 0 ? [
            createSectionTitle("RESUME HASIL WAWANCARA AHLI WARIS"),
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: resumeInterview.map(r => new TableRow({
                children: [createTableCell(r.hasil_interview, { width: 100 })],
              })),
            }),
            new Paragraph({ text: "" }),
          ] : []),

          // Analisa Akhir
          ...[
            ["ANALISA INVESTIGATOR INDEPENDENT", resumeInv?.hasil],
            ["ANALISA PIC INVESTIGATOR", lap?.analisa_pic_investigator],
            ["ANALISA MA", lap?.analisa_ma],
            ["PUTUSAN DEPARTEMENT HEAD", lap?.putusan_klaim],
            ["KEPUTUSAN TEAM LEADER", lap?.analisa_putusan],
          ].map(s => [
            createSectionTitle(s[0]),
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [new TableRow({ children: [createTableCell(s[1], { width: 100 })] })],
            }),
            new Paragraph({ text: "" }),
          ]).flat(),

          // Metadata Deswa Awal
          ...(deswa ? [
            createSectionTitle("DATA DESWA - INVESTIGASI AWAL"),
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                new TableRow({
                  children: [
                    createTableCell("Tgl Mulai Ondesk", { width: 50 }),
                    createTableCell(formatDate(deswa?.tanggal_mulai), { width: 50 }),
                  ],
                }),
                new TableRow({
                  children: [
                    createTableCell("Tgl Selesai Ondesk", { width: 50 }),
                    createTableCell(formatDate(deswa?.tanggal_selesai), { width: 50 }),
                  ],
                }),
                new TableRow({
                  children: [
                    createTableCell("SLA Ondesk (hari)", { width: 50 }),
                    createTableCell(deswa?.sla_proses || "-", { width: 50 }),
                  ],
                }),
                new TableRow({
                  children: [
                    createTableCell("PIC Investigator", { width: 50 }),
                    createTableCell(deswa?.pic_investigator || "-", { width: 50 }),
                  ],
                }),
                ...(deswa?.tanggal_kirim_laporan || deswa?.tanggal_terima_konfirmasi_bri ? [
                  new TableRow({
                    children: [
                      createTableCell("Tgl Kirim Laporan", { width: 50 }),
                      createTableCell(formatDate(deswa?.tanggal_kirim_laporan), { width: 50 }),
                    ],
                  }),
                  new TableRow({
                    children: [
                      createTableCell("Tgl Terima Konfirmasi BRI", { width: 50 }),
                      createTableCell(formatDate(deswa?.tanggal_terima_konfirmasi_bri), { width: 50 }),
                    ],
                  }),
                  new TableRow({
                    children: [
                      createTableCell("SLA Konfirmasi (hari)", { width: 50 }),
                      createTableCell(deswa?.sla_konfirmasi || "-", { width: 50 }),
                    ],
                  }),
                ] : []),
              ],
            }),
            new Paragraph({ text: "" }),
          ] : []),

          // Metadata Deswa Lanjutan
          ...(deswa && (deswa?.tanggal_mulai_ondesk_lanjutan || deswa?.tanggal_selesai_ondesk_lanjutan) ? [
            createSectionTitle("DATA DESWA - INVESTIGASI LANJUTAN"),
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                new TableRow({
                  children: [
                    createTableCell("Tgl Mulai Ondesk Lanjutan", { width: 50 }),
                    createTableCell(formatDate(deswa?.tanggal_mulai_ondesk_lanjutan), { width: 50 }),
                  ],
                }),
                new TableRow({
                  children: [
                    createTableCell("Tgl Selesai Ondesk Lanjutan", { width: 50 }),
                    createTableCell(formatDate(deswa?.tanggal_selesai_ondesk_lanjutan), { width: 50 }),
                  ],
                }),
                new TableRow({
                  children: [
                    createTableCell("SLA Ondesk Lanjutan (hari)", { width: 50 }),
                    createTableCell(deswa?.sla_ondesk_lanjutan || "-", { width: 50 }),
                  ],
                }),
                ...(deswa?.tanggal_kirim_laporan_lanjutan || deswa?.tanggal_terima_konfirmasi_lanjutan_bri ? [
                  new TableRow({
                    children: [
                      createTableCell("Tgl Kirim Laporan Lanjutan", { width: 50 }),
                      createTableCell(formatDate(deswa?.tanggal_kirim_laporan_lanjutan), { width: 50 }),
                    ],
                  }),
                  new TableRow({
                    children: [
                      createTableCell("Tgl Terima Konfirmasi Lanjutan", { width: 50 }),
                      createTableCell(formatDate(deswa?.tanggal_terima_konfirmasi_lanjutan_bri), { width: 50 }),
                    ],
                  }),
                  new TableRow({
                    children: [
                      createTableCell("SLA Konfirmasi Lanjutan (hari)", { width: 50 }),
                      createTableCell(deswa?.sla_konfirmasi_lanjutan || "-", { width: 50 }),
                    ],
                  }),
                ] : []),
              ],
            }),
            new Paragraph({ text: "" }),
          ] : []),

          // Persetujuan
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [createHeaderCell("PERSETUJUAN HASIL INVESTIGASI", 100)],
              }),
            ],
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  createTableCell("Departement Head", { bold: true, align: AlignmentType.CENTER, width: 33 }),
                  createTableCell("Team Leader", { bold: true, align: AlignmentType.CENTER, width: 33 }),
                  createTableCell("MA", { bold: true, align: AlignmentType.CENTER, width: 34 }),
                ],
              }),
              new TableRow({
                children: [
                  createTableCell("\n\n\n\n", { width: 33 }),
                  createTableCell("\n\n\n\n", { width: 33 }),
                  createTableCell("\n\n\n\n", { width: 34 }),
                ],
              }),
            ],
          }),
        ],
      }],
    });

    const buffer = await Packer.toBuffer(doc);
    
    const fileName = `${cleanText(lap?.nama_tertanggung)
      .replace(/[\/\\?%*:|"<>]/g, "")
      .replace(/\s+/g, " ")
      .trim()} - ${id}.docx`;

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.send(buffer);

  } catch (err) {
    console.error(err);
    res.status(500).send("Gagal generate Word");
  }
};