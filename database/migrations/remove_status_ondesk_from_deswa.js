// Migration untuk menghapus kolom status_ondesk dari tabel deswa_process_metadatas
// Jalankan: knex migrate:latest

exports.up = function(knex) {
  return knex.schema.alterTable('deswa_process_metadatas', function(table) {
    table.dropColumn('status_ondesk');
  });
};

exports.down = function(knex) {
  return knex.schema.alterTable('deswa_process_metadatas', function(table) {
    table.enum('status_ondesk', ['on going', 'closed', 'review', 're open']).nullable();
  });
};
