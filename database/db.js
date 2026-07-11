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

  const adminCols = db.prepare("PRAGMA table_info(admin_users)").all().map(c => c.name);
  if (!adminCols.includes('failed_attempts')) {
    db.exec('ALTER TABLE admin_users ADD COLUMN failed_attempts INTEGER DEFAULT 0');
  }
  if (!adminCols.includes('lockout_until')) {
    db.exec('ALTER TABLE admin_users ADD COLUMN lockout_until TEXT');
  }

  const count = db.prepare('SELECT COUNT(*) c FROM admin_users').get().c;
  if (count === 0) {
    db.prepare('INSERT INTO admin_users (username, password_hash) VALUES (?, ?)')
      .run('admin', bcrypt.hashSync('admin123', 10));
    console.log('Default admin created (admin / admin123)');
  }

  // Auto-seed categories and software on fresh database startup if empty
  const countCats = db.prepare('SELECT COUNT(*) c FROM categories').get().c;
  if (countCats === 0) {
    const slugify = require('slugify');
    const slug = s => slugify(s, { lower: true, strict: true });
    const catsList = ['Browsers','Utilities','Media','Development','Security','Office','Graphics','Communication','File Mgmt','System Tools','Education','Gaming'];
    const insCat = db.prepare('INSERT OR IGNORE INTO categories (name, slug) VALUES (?, ?)');
    catsList.forEach(c => insCat.run(c, slug(c)));
    const catId = n => (db.prepare('SELECT id FROM categories WHERE name=?').get(n) || {}).id;

    const apps = [
      ['VLC Media Player','Media','Plays most formats, DVDs, and streams.','Free open-source cross-platform multimedia player.','3.0.20','42 MB',1,0],
      ['7-Zip','File Mgmt','High compression file archiver for 7z, ZIP, RAR.','File archiver with a high compression ratio and AES-256.','23.01','1.5 MB',1,0],
      ['Notepad++','Development','Source code editor with syntax highlighting.','Free source code editor supporting 80+ languages.','8.6.2','4.2 MB',1,0],
      ['ShareX','Utilities','Screen capture, recording, and file sharing.','Capture or record any area of your screen and share it.','16.0','8 MB',0,1],
      ['OBS Studio','Media','Recording and live streaming software.','Free software for video recording and live streaming.','30.1','98 MB',1,1],
      ['Firefox','Browsers','Fast, privacy-focused web browser.','Privacy-focused browser backed by a non-profit.','127.0','55 MB',0,0],
      ['GIMP','Graphics','Open-source image editor, Photoshop alternative.','Cross-platform image editor, free software.','2.10.36','230 MB',0,1],
      ['qBittorrent','File Mgmt','Lightweight, ad-free BitTorrent client.','Advanced BitTorrent client with a clean Qt UI.','4.6.3','32 MB',0,1]
    ];

    const insSw = db.prepare(`INSERT OR IGNORE INTO software
      (name, slug, category_id, short_description, full_description, version, size, file_path, is_featured, is_new)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

    const storageSoftwareDir = path.resolve(__dirname, '../storage/software');
    fs.mkdirSync(storageSoftwareDir, { recursive: true });

    apps.forEach(a => {
      const appSlug = slug(a[0]);
      const dummyFileName = `${appSlug}-setup.exe`;
      const dummyFilePath = 'storage/software/' + dummyFileName;
      const absoluteDummyFilePath = path.resolve(__dirname, '..', dummyFilePath);
      if (!fs.existsSync(absoluteDummyFilePath)) {
        fs.writeFileSync(absoluteDummyFilePath, `Dummy installer file for ${a[0]} version ${a[4]}`);
      }
      insSw.run(a[0], appSlug, catId(a[1]), a[2], a[3], a[4], a[5], dummyFilePath, a[6], a[7]);
    });
    console.log('Auto-seeded categories and software with dummy executable installer files.');
  }

  return db;
}
module.exports = { initDatabase };
