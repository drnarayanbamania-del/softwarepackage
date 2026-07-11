const express = require('express');
const router = express.Router();
router.get('/file/:slug', (req, res) => {
  const db = req.app.locals.db;
  const sw = db.prepare('SELECT * FROM software WHERE slug=?').get(req.params.slug);
  if (!sw || !sw.file_path) return res.status(404).json({ error: 'File not available' });
  res.download(require('path').resolve(sw.file_path));
});
module.exports = router;
