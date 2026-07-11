const express = require('express');
const router = express.Router();

const withCat = `SELECT s.*, c.name AS category_name, c.slug AS category_slug
  FROM software s LEFT JOIN categories c ON s.category_id = c.id`;

router.get('/', (req, res) => {
  const db = req.app.locals.db;
  const featured = db.prepare(withCat + ' WHERE s.is_featured=1 ORDER BY s.updated_at DESC LIMIT 8').all();
  const fresh    = db.prepare(withCat + ' WHERE s.is_new=1 ORDER BY s.created_at DESC LIMIT 8').all();
  const all      = db.prepare(withCat + ' ORDER BY s.name LIMIT ?').all(req.app.locals.config.site.itemsPerPage);
  const cats     = db.prepare(`SELECT c.*, COUNT(s.id) n FROM categories c
                   LEFT JOIN software s ON s.category_id=c.id GROUP BY c.id ORDER BY c.name`).all();
  const totals = {
    software: db.prepare('SELECT COUNT(*) c FROM software').get().c,
    downloads: db.prepare('SELECT COALESCE(SUM(download_count),0) c FROM software').get().c,
    categories: cats.length
  };
  res.render('home', { title: res.locals.config.site.name, featured, fresh, all, cats, totals });
});

router.get('/software/:slug', (req, res) => {
  const db = req.app.locals.db;
  const sw = db.prepare(withCat + ' WHERE s.slug=?').get(req.params.slug);
  if (!sw) return res.status(404).render('404', { title: 'Not found' });
  db.prepare('UPDATE software SET view_count=view_count+1 WHERE id=?').run(sw.id);
  const related = db.prepare(withCat + ' WHERE s.category_id=? AND s.id!=? LIMIT 4').all(sw.category_id, sw.id);
  res.render('detail', { title: sw.name, sw, related });
});

router.get('/search', (req, res) => {
  const db = req.app.locals.db;
  const q = (req.query.q || '').trim();
  const cat = (req.query.cat || '').trim();
  let sql = withCat, where = [], params = [];
  if (q)   { where.push('(s.name LIKE ? OR s.short_description LIKE ?)'); params.push('%'+q+'%','%'+q+'%'); }
  if (cat) { where.push('c.slug = ?'); params.push(cat); }
  if (where.length) sql += ' WHERE ' + where.join(' AND ');
  sql += ' ORDER BY s.name';
  const results = db.prepare(sql).all(...params);
  const cats = db.prepare('SELECT * FROM categories ORDER BY name').all();
  res.render('search', { title: q ? 'Search: '+q : 'Browse', q, cat, results, cats });
});

router.get('/download/:slug', (req, res) => {
  const db = req.app.locals.db;
  const sw = db.prepare('SELECT * FROM software WHERE slug=?').get(req.params.slug);
  if (!sw) return res.status(404).render('404', { title: 'Not found' });
  db.prepare('UPDATE software SET download_count=download_count+1 WHERE id=?').run(sw.id);
  db.prepare('INSERT INTO download_logs (software_id) VALUES (?)').run(sw.id);
  const suggestions = db.prepare(withCat + ' WHERE s.id!=? ORDER BY RANDOM() LIMIT ?')
    .all(sw.id, req.app.locals.config.download.suggestionsCount);
  res.render('download', { title: 'Downloading ' + sw.name, sw, suggestions, layout: false });
});

module.exports = router;
