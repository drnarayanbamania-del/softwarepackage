const express = require('express');
const path = require('path');
const session = require('express-session');
const compression = require('compression');
const expressLayouts = require('express-ejs-layouts');
const config = require('./config.json');
const { initDatabase } = require('./database/db');

const app = express();
const PORT = process.env.PORT || config.site.port || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'partials/layout');

app.use(compression());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1d' }));
app.use('/storage', express.static(path.join(__dirname, 'storage'), { maxAge: '7d' }));

app.use(session({
  secret: config.admin.sessionSecret || 'change-me',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, maxAge: 24 * 60 * 60 * 1000 }
}));

const db = initDatabase();
app.locals.db = db;
app.locals.config = config;

app.use((req, res, next) => {
  res.locals.config = config;
  res.locals.ads = config.ads;
  res.locals.currentPath = req.path;
  res.locals.admin = req.session.admin || null;
  res.locals.year = new Date().getFullYear();
  next();
});

app.use('/', require('./routes/public'));
app.use('/api', require('./routes/api'));
app.use('/admin', require('./routes/admin'));

app.use((req, res) => res.status(404).render('404', { title: 'Not found' }));

app.listen(PORT, () => {
  console.log('\n  Bamania\'s Software Hub');
  console.log('  http://localhost:' + PORT);
  console.log('  Admin: http://localhost:' + PORT + '/admin  (admin / admin123)\n');
});
module.exports = app;
