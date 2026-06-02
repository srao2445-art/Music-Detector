require('dotenv').config();
const path = require('path');
const fs = require('fs');
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const multer = require('multer');
const { db, ensureAdmin } = require('./db');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
if (process.env.NODE_ENV === 'production' && !process.env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET is required when NODE_ENV=production.');
}
const uploadDir = path.join(__dirname, 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 10 },
  fileFilter: (_req, file, cb) => cb(null, /^image\/(png|jpe?g|gif|webp|svg\+xml)$/.test(file.mimetype))
});
const projectUpload = upload.fields([{ name: 'thumbnail', maxCount: 1 }, { name: 'gallery', maxCount: 8 }]);
const singleImageUpload = upload.single('image');

app.set('view engine', 'ejs');
if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1);
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use('/uploads', express.static(uploadDir));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: process.env.SESSION_SECRET || 'development-only-change-this-session-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 1000 * 60 * 60 * 8 }
}));

function getSettings() { return db.prepare('SELECT * FROM site_settings WHERE id = 1').get(); }
function getPage(slug) { return db.prepare('SELECT * FROM pages WHERE slug = ?').get(slug); }
function extras(page) { try { return JSON.parse(page?.extra_json || '{}'); } catch { return {}; } }
function splitList(value) { return String(value || '').split(/\||\r?\n|,/).map((v) => v.trim()).filter(Boolean); }
function parseSocials(value) { return String(value || '').split(/\r?\n/).map((line) => line.split('|').map((v) => v.trim())).filter((item) => item.length >= 2 && item[0] && item[1]); }
function slugify(value) { return String(value || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || `project-${Date.now()}`; }
function rememberUpload(file) {
  if (!file) return '';
  db.prepare('INSERT INTO uploads (filename, original_name, mime_type, size) VALUES (?, ?, ?, ?)').run(file.filename, file.originalname, file.mimetype, file.size);
  return `/uploads/${file.filename}`;
}
function withMessage(req, type, message) { req.session.notice = { type, message }; }

app.use((req, res, next) => {
  res.locals.settings = getSettings();
  res.locals.currentPath = req.path;
  res.locals.admin = req.session.admin || null;
  res.locals.notice = req.session.notice || null;
  delete req.session.notice;
  res.locals.splitList = splitList;
  res.locals.parseSocials = parseSocials;
  res.locals.extras = extras;
  next();
});

function requireAdmin(req, res, next) {
  if (!req.session.admin) return res.redirect('/admin/login');
  next();
}

// Public pages
app.get('/', (_req, res) => {
  res.render('public/home', { page: getPage('home'), projects: db.prepare('SELECT * FROM projects WHERE featured = 1 ORDER BY updated_at DESC LIMIT 6').all(), services: db.prepare('SELECT * FROM services WHERE featured = 1 ORDER BY updated_at DESC LIMIT 6').all() });
});
app.get('/projects', (req, res) => {
  const category = String(req.query.category || '');
  const search = String(req.query.search || '');
  let sql = 'SELECT * FROM projects WHERE 1 = 1';
  const params = [];
  if (category) { sql += ' AND category = ?'; params.push(category); }
  if (search) { sql += ' AND (title LIKE ? OR short_description LIKE ? OR tags LIKE ?)'; params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
  sql += ' ORDER BY featured DESC, updated_at DESC';
  res.render('public/projects', { projects: db.prepare(sql).all(...params), categories: db.prepare('SELECT DISTINCT category FROM projects ORDER BY category').all().map((row) => row.category), category, search });
});
app.get('/projects/:slug', (req, res) => {
  const project = db.prepare('SELECT * FROM projects WHERE slug = ?').get(req.params.slug);
  if (!project) return res.status(404).render('public/404');
  res.render('public/project-detail', { project });
});
app.get('/services', (_req, res) => res.render('public/services', { services: db.prepare('SELECT * FROM services ORDER BY featured DESC, updated_at DESC').all() }));
app.get('/about', (_req, res) => res.render('public/about', { page: getPage('about') }));
app.get('/contact', (_req, res) => res.render('public/contact', { page: getPage('contact') }));
app.post('/contact', (req, res) => {
  withMessage(req, 'success', `Thanks${req.body.name ? `, ${req.body.name}` : ''}! Your message is ready to send. Please use the email link below to get in touch.`);
  res.redirect('/contact');
});

// Authentication
app.get('/admin/login', (req, res) => req.session.admin ? res.redirect('/admin/dashboard') : res.render('admin/login', { layout: false }));
app.post('/admin/login', async (req, res) => {
  const user = db.prepare('SELECT * FROM admin_users WHERE email = ?').get(String(req.body.email || '').toLowerCase().trim());
  if (!user || !(await bcrypt.compare(String(req.body.password || ''), user.password_hash))) {
    withMessage(req, 'error', 'Invalid email or password.');
    return res.redirect('/admin/login');
  }
  req.session.regenerate((error) => {
    if (error) return res.status(500).send('Unable to create session.');
    req.session.admin = { id: user.id, email: user.email };
    res.redirect('/admin/dashboard');
  });
});
app.post('/admin/logout', requireAdmin, (req, res) => req.session.destroy(() => res.redirect('/admin/login')));

// Admin dashboard
app.get('/admin/dashboard', requireAdmin, (_req, res) => res.render('admin/dashboard', {
  counts: {
    projects: db.prepare('SELECT COUNT(*) AS count FROM projects').get().count,
    services: db.prepare('SELECT COUNT(*) AS count FROM services').get().count,
    pages: db.prepare('SELECT COUNT(*) AS count FROM pages').get().count,
    uploads: db.prepare('SELECT COUNT(*) AS count FROM uploads').get().count
  },
  recentProjects: db.prepare('SELECT * FROM projects ORDER BY updated_at DESC LIMIT 5').all()
}));

// Project CMS
app.get('/admin/projects', requireAdmin, (_req, res) => res.render('admin/projects', { projects: db.prepare('SELECT * FROM projects ORDER BY updated_at DESC').all() }));
app.get('/admin/projects/new', requireAdmin, (_req, res) => res.render('admin/project-form', { project: null }));
app.get('/admin/projects/:id/edit', requireAdmin, (req, res) => res.render('admin/project-form', { project: db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id) }));
app.post('/admin/projects', requireAdmin, projectUpload, (req, res) => {
  const thumbnail = rememberUpload(req.files?.thumbnail?.[0]);
  const gallery = (req.files?.gallery || []).map(rememberUpload).join('|');
  const slug = slugify(req.body.slug || req.body.title);
  db.prepare(`INSERT INTO projects (slug, title, category, short_description, description, thumbnail, live_link, source_link, status, tags, features, tech_stack, gallery, featured)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(slug, req.body.title, req.body.category, req.body.short_description, req.body.description || '', thumbnail, req.body.live_link || '', req.body.source_link || '', req.body.status || 'active', req.body.tags || '', req.body.features || '', req.body.tech_stack || '', gallery, req.body.featured ? 1 : 0);
  withMessage(req, 'success', 'Project created.'); res.redirect('/admin/projects');
});
app.post('/admin/projects/:id', requireAdmin, projectUpload, (req, res) => {
  const current = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!current) return res.status(404).send('Project not found');
  const thumbnail = rememberUpload(req.files?.thumbnail?.[0]) || current.thumbnail;
  const newGallery = (req.files?.gallery || []).map(rememberUpload);
  const gallery = req.body.clear_gallery ? newGallery.join('|') : [...splitList(current.gallery), ...newGallery].join('|');
  db.prepare(`UPDATE projects SET slug=?, title=?, category=?, short_description=?, description=?, thumbnail=?, live_link=?, source_link=?, status=?, tags=?, features=?, tech_stack=?, gallery=?, featured=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`)
    .run(slugify(req.body.slug || req.body.title), req.body.title, req.body.category, req.body.short_description, req.body.description || '', thumbnail, req.body.live_link || '', req.body.source_link || '', req.body.status || 'active', req.body.tags || '', req.body.features || '', req.body.tech_stack || '', gallery, req.body.featured ? 1 : 0, req.params.id);
  withMessage(req, 'success', 'Project updated.'); res.redirect('/admin/projects');
});
app.post('/admin/projects/:id/delete', requireAdmin, (req, res) => { db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id); withMessage(req, 'success', 'Project deleted.'); res.redirect('/admin/projects'); });

// Service CMS
app.get('/admin/services', requireAdmin, (_req, res) => res.render('admin/services', { services: db.prepare('SELECT * FROM services ORDER BY updated_at DESC').all() }));
app.get('/admin/services/new', requireAdmin, (_req, res) => res.render('admin/service-form', { service: null }));
app.get('/admin/services/:id/edit', requireAdmin, (req, res) => res.render('admin/service-form', { service: db.prepare('SELECT * FROM services WHERE id = ?').get(req.params.id) }));
app.post('/admin/services', requireAdmin, singleImageUpload, (req, res) => {
  db.prepare('INSERT INTO services (title, description, price_text, image, cta_text, cta_link, featured) VALUES (?, ?, ?, ?, ?, ?, ?)').run(req.body.title, req.body.description, req.body.price_text || '', rememberUpload(req.file), req.body.cta_text || 'Let’s talk', req.body.cta_link || '/contact', req.body.featured ? 1 : 0);
  withMessage(req, 'success', 'Service created.'); res.redirect('/admin/services');
});
app.post('/admin/services/:id', requireAdmin, singleImageUpload, (req, res) => {
  const current = db.prepare('SELECT * FROM services WHERE id = ?').get(req.params.id);
  if (!current) return res.status(404).send('Service not found');
  db.prepare('UPDATE services SET title=?, description=?, price_text=?, image=?, cta_text=?, cta_link=?, featured=?, updated_at=CURRENT_TIMESTAMP WHERE id=?').run(req.body.title, req.body.description, req.body.price_text || '', rememberUpload(req.file) || current.image, req.body.cta_text || 'Let’s talk', req.body.cta_link || '/contact', req.body.featured ? 1 : 0, req.params.id);
  withMessage(req, 'success', 'Service updated.'); res.redirect('/admin/services');
});
app.post('/admin/services/:id/delete', requireAdmin, (req, res) => { db.prepare('DELETE FROM services WHERE id = ?').run(req.params.id); withMessage(req, 'success', 'Service deleted.'); res.redirect('/admin/services'); });

// Page and site settings CMS
app.get('/admin/pages', requireAdmin, (_req, res) => res.render('admin/pages', { pages: db.prepare('SELECT * FROM pages ORDER BY slug').all(), siteSettings: getSettings() }));
app.post('/admin/settings', requireAdmin, (req, res) => {
  db.prepare(`UPDATE site_settings SET site_name=?, tagline=?, hero_title=?, hero_intro=?, hero_primary_text=?, hero_primary_link=?, hero_secondary_text=?, hero_secondary_link=?, footer_text=?, updated_at=CURRENT_TIMESTAMP WHERE id=1`).run(req.body.site_name, req.body.tagline, req.body.hero_title, req.body.hero_intro, req.body.hero_primary_text, req.body.hero_primary_link, req.body.hero_secondary_text, req.body.hero_secondary_link, req.body.footer_text);
  withMessage(req, 'success', 'Site settings updated.'); res.redirect('/admin/pages');
});
app.get('/admin/pages/:slug/edit', requireAdmin, (req, res) => res.render('admin/page-form', { page: getPage(req.params.slug), pageExtras: extras(getPage(req.params.slug)) }));
app.post('/admin/pages/:slug', requireAdmin, singleImageUpload, (req, res) => {
  const page = getPage(req.params.slug); if (!page) return res.status(404).send('Page not found');
  const currentExtras = extras(page);
  let extra = {};
  if (req.params.slug === 'about') extra = { skills: req.body.skills || '', tools: req.body.tools || '', image: rememberUpload(req.file) || currentExtras.image || '' };
  if (req.params.slug === 'contact') extra = { email: req.body.email || '', whatsapp: req.body.whatsapp || '', social_links: req.body.social_links || '' };
  db.prepare('UPDATE pages SET title=?, content=?, extra_json=?, updated_at=CURRENT_TIMESTAMP WHERE slug=?').run(req.body.title, req.body.content || '', JSON.stringify(extra), req.params.slug);
  withMessage(req, 'success', `${req.params.slug} page updated.`); res.redirect('/admin/pages');
});

// Security
app.get('/admin/settings/security', requireAdmin, (_req, res) => res.render('admin/security'));
app.post('/api/admin/change-password', requireAdmin, async (req, res) => {
  const { current_password: current, new_password: password, confirm_password: confirm } = req.body;
  const user = db.prepare('SELECT * FROM admin_users WHERE id = ?').get(req.session.admin.id);
  if (!user || !(await bcrypt.compare(String(current || ''), user.password_hash))) { withMessage(req, 'error', 'Current password is incorrect.'); return res.redirect('/admin/settings/security'); }
  if (String(password || '').length < 8) { withMessage(req, 'error', 'New password must be at least 8 characters.'); return res.redirect('/admin/settings/security'); }
  if (password !== confirm) { withMessage(req, 'error', 'New passwords do not match.'); return res.redirect('/admin/settings/security'); }
  const passwordHash = await bcrypt.hash(password, 12);
  db.prepare('UPDATE admin_users SET password_hash=?, updated_at=CURRENT_TIMESTAMP WHERE id=?').run(passwordHash, user.id);
  req.session.destroy(() => res.redirect('/admin/login?changed=1'));
});

app.use((error, req, res, _next) => {
  console.error(error);
  if (error instanceof multer.MulterError) return res.status(400).send(`Upload error: ${error.message}`);
  res.status(500).send('Something went wrong. Please try again.');
});
app.use((_req, res) => res.status(404).render('public/404'));

ensureAdmin().then((created) => {
  if (created) console.log('Initial admin account created with a bcrypt password hash. Remove INITIAL_ADMIN_PASSWORD from the environment.');
  app.listen(PORT, () => console.log(`The Creator Studio running at http://localhost:${PORT}`));
}).catch((error) => { console.error(`Startup failed: ${error.message}`); process.exit(1); });
