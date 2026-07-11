const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const config = require('../config.json');

function initDatabase() {
  const dbPath = path.resolve(config.paths.database);
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));

  // lightweight migration: add screenshot column if upgrading an older db
  const cols = db.prepare("PRAGMA table_info(software)").all().map(c => c.name);
  if (!cols.includes('screenshot')) db.exec('ALTER TABLE software ADD COLUMN screenshot TEXT');

  const count = db.prepare('SELECT COUNT(*) c FROM admin_users').get().c;
  if (count === 0) {
    db.prepare('INSERT INTO admin_users (username, password_hash) VALUES (?, ?)')
      .run('admin', bcrypt.hashSync('admin123', 10));
    console.log('Default admin created (admin / admin123)');
  }
  return db;
}
module.exports = { initDatabase };
