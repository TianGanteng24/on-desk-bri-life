const PDFDocument = require('pdfkit');
const db = require('../config/db');

function cell(doc, x, y, w, h, text, opt = {}) {
  doc.rect(x, y, w, h).stroke();
  doc.fontSize(8).text(text || '', x + 4, y + 4, {
    width: w - 8,
    align: opt.align || 'left'
  });
}

module.exports = async (req, res) => {
  const doc = new PDFDocument({ margin: 20, size: 'A4' });
  res.setHeader('Content-Type', 'application/pdf');
  doc.pipe(res);

  const [[lap]] = await db.query(
    'SELECT * FROM laporan_investigasi WHERE id=?',
    [req.params.id]
  );

  const [desk] = await db.query(
    'SELECT * FROM hasil_on_desk WHERE laporan_id=?',
    [req.params.id]
  );

  /* JUDUL */
  doc.rect(20, 20, 555, 25).fill('#FFF200');
  doc.fillColor('#000').fontSize(14)
     .text('LAPORAN INVESTIGASI', 20, 27, { align: 'center' });

  let y = 55;

  /* HEADER DATA */
  cell(doc, 20, y, 180, 20, 'Nama Pemegang Polis');
  cell(doc, 200, y, 375, 20, lap.nama_pemegang_polis); y+=20;

  cell(doc, 20, y, 180, 20, 'No Peserta');
  cell(doc, 200, y, 375, 20, lap.no_peserta); y+=20;

  /* ===== HASIL ON DESK ===== */
  doc.rect(20, y, 555, 18).fill('#92D050');
  doc.fillColor('#000').fontSize(9)
     .text('HASIL ON DESK INVESTIGASI', 20, y+4, { align: 'center' });

  y+=18;

  desk.forEach((d, i) => {
    cell(doc, 20, y, 150, 18, 'Nama Faskes');
    cell(doc, 170, y, 405, 18, d.nama_faskes); y+=18;

    cell(doc, 20, y, 150, 36, 'Hasil Investigasi');
    cell(doc, 170, y, 405, 36, d.hasil_investigasi); y+=36;

    if (y > 760) {
      doc.addPage();
      y = 30;
    }
  });

  doc.fontSize(7)
   .fillColor('gray')
   .text(
     'Dokumen ini dihasilkan otomatis oleh sistem. Tidak diperkenankan mengubah isi laporan.',
     20,
     800,
     { align: 'center' }
   );


  doc.end();
};
