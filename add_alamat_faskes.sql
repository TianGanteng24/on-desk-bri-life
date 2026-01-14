-- Tambahkan kolom alamat_faskes ke tabel hasil_on_desk
ALTER TABLE hasil_on_desk ADD COLUMN alamat_faskes VARCHAR(255) AFTER nama_faskes;
