const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const slugify = require('slugify');
const config = require('../config.json');
const slug = s => slugify(s, { lower: true, strict: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.resolve(config.paths.storage, file.fieldname === 'file' ? 'software' : 'images')),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, '_'))
});
const upload = multer({ storage });
const uploadFields = upload.fields([{ name: 'icon' }, { name: 'file' }, { name: 'screenshot' }]);

function auth(req, res, next){ if (req.session.admin) return next(); res.redirect('/9300/admin/login'); }

router.get('/login', (req, res) => res.render('admin/login', { title: 'Admin Login', error: null, layout: false }));
router.post('/login', (req, res) => {
  const db = req.app.locals.db;
  const username = req.body.username;
  const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;

  // 1. IP Rate Limiting: max 15 attempts in 5 minutes
  const ipLimitTime = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const ipAttempts = db.prepare('SELECT COUNT(*) c FROM admin_login_logs WHERE ip_address=? AND timestamp > ?').get(ip, ipLimitTime).c;
  if (ipAttempts >= 15) {
    return res.render('admin/login', { title: 'Admin Login', error: 'Too many attempts from this IP. Try again in 5 minutes.', layout: false });
  }

  // 2. Lookup user
  const u = db.prepare('SELECT * FROM admin_users WHERE username=?').get(username);

  // 3. Check Account Lockout
  if (u && u.lockout_until) {
    const lockoutTime = new Date(u.lockout_until).getTime();
    if (lockoutTime > Date.now()) {
      const minutesLeft = Math.ceil((lockoutTime - Date.now()) / (60 * 1000));
      db.prepare('INSERT INTO admin_login_logs (username, ip_address, status) VALUES (?, ?, ?)')
        .run(username, ip, 'LOCKED');
      return res.render('admin/login', { title: 'Admin Login', error: `Account is locked. Try again in ${minutesLeft} minutes.`, layout: false });
    } else {
      // Lockout expired, reset failed attempts
      db.prepare('UPDATE admin_users SET failed_attempts=0, lockout_until=NULL WHERE id=?').run(u.id);
      u.failed_attempts = 0;
      u.lockout_until = null;
    }
  }

  // 4. Verify credentials
  if (!u || !bcrypt.compareSync(req.body.password, u.password_hash)) {
    if (u) {
      const newFailedAttempts = (u.failed_attempts || 0) + 1;
      let lockoutTimeStr = null;
      let errorMsg = 'Invalid credentials';
      if (newFailedAttempts >= 5) {
        const lockoutUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 mins
        lockoutTimeStr = lockoutUntil.toISOString();
        errorMsg = 'Account locked due to too many failed attempts. Try again in 15 minutes.';
      } else {
        errorMsg = `Invalid credentials. ${5 - newFailedAttempts} attempts remaining.`;
      }
      db.prepare('UPDATE admin_users SET failed_attempts=?, lockout_until=? WHERE id=?')
        .run(newFailedAttempts, lockoutTimeStr, u.id);
    }
    db.prepare('INSERT INTO admin_login_logs (username, ip_address, status) VALUES (?, ?, ?)')
      .run(username, ip, 'FAILED');
    return res.render('admin/login', { title: 'Admin Login', error: 'Invalid credentials', layout: false });
  }

  // 5. Successful login
  db.prepare('UPDATE admin_users SET failed_attempts=0, lockout_until=NULL WHERE id=?').run(u.id);
  db.prepare('INSERT INTO admin_login_logs (username, ip_address, status) VALUES (?, ?, ?)')
    .run(username, ip, 'SUCCESS');

  req.session.admin = { id: u.id, username: u.username };
  res.redirect('/9300/admin');
});
router.get('/logout', (req, res) => { req.session.destroy(() => res.redirect('/9300/admin/login')); });

router.use(auth);

router.get('/', (req, res) => {
  const db = req.app.locals.db;
  const stats = {
    software: db.prepare('SELECT COUNT(*) c FROM software').get().c,
    categories: db.prepare('SELECT COUNT(*) c FROM categories').get().c,
    downloads: db.prepare('SELECT COALESCE(SUM(download_count),0) c FROM software').get().c,
    views: db.prepare('SELECT COALESCE(SUM(view_count),0) c FROM software').get().c
  };
  const top = db.prepare('SELECT name, slug, download_count FROM software ORDER BY download_count DESC LIMIT 10').all();
  res.render('admin/dashboard', { title: 'Dashboard', stats, top, layout: 'admin/layout' });
});

router.get('/software', (req, res) => {
  const db = req.app.locals.db;
  const rows = db.prepare(`SELECT s.*, c.name category_name FROM software s
    LEFT JOIN categories c ON s.category_id=c.id ORDER BY s.created_at DESC`).all();
  res.render('admin/software', { title: 'Software', rows, layout: 'admin/layout' });
});
router.get('/software/new', (req, res) => {
  const cats = req.app.locals.db.prepare('SELECT * FROM categories ORDER BY name').all();
  res.render('admin/software-form', { title: 'Add Software', sw: null, cats, layout: 'admin/layout' });
});
router.post('/software/new', uploadFields, (req, res) => {
  const db = req.app.locals.db; const b = req.body;
  const icon = req.files.icon ? 'storage/images/'+req.files.icon[0].filename : null;
  const shot = req.files.screenshot ? 'storage/images/'+req.files.screenshot[0].filename : null;
  const file = req.files.file ? 'storage/software/'+req.files.file[0].filename : null;
  db.prepare(`INSERT INTO software (name,slug,category_id,short_description,full_description,version,size,icon_image,screenshot,file_path,is_featured,is_new)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(b.name, slug(b.name), b.category_id||null, b.short_description, b.full_description,
      b.version, b.size, icon, shot, file, b.is_featured?1:0, b.is_new?1:0);
  res.redirect('/9300/admin/software');
});
router.get('/software/:id/edit', (req, res) => {
  const db = req.app.locals.db;
  const sw = db.prepare('SELECT * FROM software WHERE id=?').get(req.params.id);
  const cats = db.prepare('SELECT * FROM categories ORDER BY name').all();
  res.render('admin/software-form', { title: 'Edit Software', sw, cats, layout: 'admin/layout' });
});
router.post('/software/:id/edit', uploadFields, (req, res) => {
  const db = req.app.locals.db; const b = req.body;
  const cur = db.prepare('SELECT * FROM software WHERE id=?').get(req.params.id);
  const icon = req.files.icon ? 'storage/images/'+req.files.icon[0].filename : cur.icon_image;
  const shot = req.files.screenshot ? 'storage/images/'+req.files.screenshot[0].filename : cur.screenshot;
  const file = req.files.file ? 'storage/software/'+req.files.file[0].filename : cur.file_path;
  db.prepare(`UPDATE software SET name=?,slug=?,category_id=?,short_description=?,full_description=?,version=?,size=?,
    icon_image=?,screenshot=?,file_path=?,is_featured=?,is_new=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`)
    .run(b.name, slug(b.name), b.category_id||null, b.short_description, b.full_description, b.version, b.size,
      icon, shot, file, b.is_featured?1:0, b.is_new?1:0, req.params.id);
  res.redirect('/9300/admin/software');
});
router.post('/software/:id/delete', (req, res) => {
  const db = req.app.locals.db;
  const sw = db.prepare('SELECT * FROM software WHERE id=?').get(req.params.id);
  if (sw) {
    [sw.icon_image, sw.screenshot, sw.file_path].forEach(p => { if (p && fs.existsSync(path.resolve(p))) fs.unlinkSync(path.resolve(p)); });
    db.prepare('DELETE FROM software WHERE id=?').run(req.params.id);
  }
  res.redirect('/9300/admin/software');
});

router.get('/categories', (req, res) => {
  const db = req.app.locals.db;
  const rows = db.prepare(`SELECT c.*, COUNT(s.id) n FROM categories c
    LEFT JOIN software s ON s.category_id=c.id GROUP BY c.id ORDER BY c.name`).all();
  res.render('admin/categories', { title: 'Categories', rows, layout: 'admin/layout' });
});
router.post('/categories/new', (req, res) => {
  try { req.app.locals.db.prepare('INSERT INTO categories (name,slug) VALUES (?,?)').run(req.body.name, slug(req.body.name)); } catch(e){}
  res.redirect('/9300/admin/categories');
});
router.post('/categories/:id/delete', (req, res) => {
  const db = req.app.locals.db;
  db.prepare('UPDATE software SET category_id=NULL WHERE category_id=?').run(req.params.id);
  db.prepare('DELETE FROM categories WHERE id=?').run(req.params.id);
  res.redirect('/9300/admin/categories');
});

router.get('/settings', (req, res) => res.render('admin/settings', { title: 'Settings', cfg: config, saved: req.query.saved, layout: 'admin/layout' }));
router.post('/settings', (req, res) => {
  const b = req.body;
  config.site.name = b.site_name; config.site.tagline = b.tagline;
  config.site.itemsPerPage = parseInt(b.itemsPerPage)||6;
  config.download.loaderDurationSeconds = parseInt(b.loaderDuration)||5;
  ['popunder','smartlink','nativeBanner','banner','socialBar'].forEach(k => {
    config.ads[k].enabled = !!b['ad_'+k];
    if (b['zone_'+k] !== undefined) config.ads[k].zoneId = b['zone_'+k];
  });
  fs.writeFileSync(path.resolve(__dirname, '..', 'config.json'), JSON.stringify(config, null, 2));
  res.redirect('/9300/admin/settings?saved=1');
});

router.get('/audit-logs', (req, res) => {
  const db = req.app.locals.db;
  const logs = db.prepare('SELECT * FROM admin_login_logs ORDER BY timestamp DESC LIMIT 100').all();
  res.render('admin/audit-logs', { title: 'Audit Logs', logs, layout: 'admin/layout' });
});

module.exports = router;
