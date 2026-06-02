require('dotenv').config();
const express = require('express');
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);
const bcrypt = require('bcryptjs');
const multer = require('multer');
const { v2: cloudinary } = require('cloudinary');
const path = require('path');
const { pool } = require('./db');

if (!process.env.SESSION_SECRET) throw new Error('SESSION_SECRET is required. Set a long random secret in your environment.');
const app = express();
const PORT = Number(process.env.PORT) || 3000;
if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1);

cloudinary.config({ cloud_name: process.env.CLOUDINARY_CLOUD_NAME, api_key: process.env.CLOUDINARY_API_KEY, api_secret: process.env.CLOUDINARY_API_SECRET, secure: true });
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 10 }, fileFilter: (_req, file, cb) => cb(null, /^image\/(png|jpe?g|gif|webp|svg\+xml)$/.test(file.mimetype)) });
const projectUpload = upload.fields([{ name: 'thumbnail', maxCount: 1 }, { name: 'gallery', maxCount: 8 }]);
const singleImageUpload = upload.single('image');

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  store: new PgSession({ pool, tableName: 'session', createTableIfMissing: false }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 1000 * 60 * 60 * 8 }
}));

const asyncHandler = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
const one = async (text, values = []) => (await pool.query(text, values)).rows[0];
const many = async (text, values = []) => (await pool.query(text, values)).rows;
const splitList = (value) => Array.isArray(value) ? value : String(value || '').split(/\||\r?\n|,/).map((item) => item.trim()).filter(Boolean);
const parseSocials = (value) => String(value || '').split(/\r?\n/).map((line) => line.split('|').map((item) => item.trim())).filter((item) => item.length >= 2 && item[0] && item[1]);
const extras = (page) => page?.extra_json || {};
const slugify = (value) => String(value || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || `project-${Date.now()}`;
const withMessage = (req, type, message) => { req.session.notice = { type, message }; };
const requireAdmin = (req, res, next) => req.session.admin ? next() : res.redirect('/admin/login');

async function uploadToCloudinary(file) {
  if (!file) return '';
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) throw new Error('Cloudinary credentials are required before uploading files.');
  const result = await new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({ folder: 'creator-studio', resource_type: 'image' }, (error, uploaded) => error ? reject(error) : resolve(uploaded));
    stream.end(file.buffer);
  });
  await pool.query('INSERT INTO uploads (public_id, secure_url, original_name, resource_type, bytes) VALUES ($1, $2, $3, $4, $5)', [result.public_id, result.secure_url, file.originalname, result.resource_type, result.bytes]);
  return result.secure_url;
}

app.use(asyncHandler(async (req, res, next) => {
  res.locals.settings = await one('SELECT * FROM site_settings WHERE id = 1');
  res.locals.currentPath = req.path;
  res.locals.admin = req.session.admin || null;
  res.locals.notice = req.session.notice || null;
  delete req.session.notice;
  res.locals.splitList = splitList;
  res.locals.parseSocials = parseSocials;
  res.locals.extras = extras;
  next();
}));

// Public website
app.get('/', asyncHandler(async (_req, res) => res.render('public/home', { page: await one("SELECT * FROM pages WHERE slug = 'home'"), projects: await many('SELECT * FROM projects WHERE featured = TRUE ORDER BY updated_at DESC LIMIT 6'), services: await many('SELECT * FROM services WHERE featured = TRUE ORDER BY updated_at DESC LIMIT 6') })));
app.get('/projects', asyncHandler(async (req, res) => {
  const category = String(req.query.category || '');
  const search = String(req.query.search || '');
  const projects = await many(`SELECT * FROM projects WHERE ($1 = '' OR category = $1) AND ($2 = '' OR title ILIKE '%' || $2 || '%' OR short_description ILIKE '%' || $2 || '%' OR tags ILIKE '%' || $2 || '%') ORDER BY featured DESC, updated_at DESC`, [category, search]);
  const categories = (await many('SELECT DISTINCT category FROM projects ORDER BY category')).map((row) => row.category);
  res.render('public/projects', { projects, categories, category, search });
}));
app.get('/projects/:slug', asyncHandler(async (req, res) => { const project = await one('SELECT * FROM projects WHERE slug = $1', [req.params.slug]); return project ? res.render('public/project-detail', { project }) : res.status(404).render('public/404'); }));
app.get('/services', asyncHandler(async (_req, res) => res.render('public/services', { services: await many('SELECT * FROM services ORDER BY featured DESC, updated_at DESC') })));
app.get('/about', asyncHandler(async (_req, res) => res.render('public/about', { page: await one("SELECT * FROM pages WHERE slug = 'about'") })));
app.get('/contact', asyncHandler(async (_req, res) => res.render('public/contact', { page: await one("SELECT * FROM pages WHERE slug = 'contact'") })));
app.post('/contact', asyncHandler(async (req, res) => { await pool.query('INSERT INTO contact_messages (name, email, subject, message) VALUES ($1, $2, $3, $4)', [req.body.name, req.body.email, req.body.subject, req.body.message]); withMessage(req, 'success', `Thanks${req.body.name ? `, ${req.body.name}` : ''}! Your message has been received.`); res.redirect('/contact'); }));

// Authentication
app.get('/admin/login', (req, res) => req.session.admin ? res.redirect('/admin/dashboard') : res.render('admin/login'));
app.post('/admin/login', asyncHandler(async (req, res) => { const user = await one('SELECT * FROM admin_users WHERE email = $1', [String(req.body.email || '').toLowerCase().trim()]); if (!user || !(await bcrypt.compare(String(req.body.password || ''), user.password_hash))) { withMessage(req, 'error', 'Invalid email or password.'); return res.redirect('/admin/login'); } req.session.regenerate((error) => { if (error) return res.status(500).send('Unable to create session.'); req.session.admin = { id: user.id, email: user.email }; res.redirect('/admin/dashboard'); }); }));
const logout = (req, res) => req.session.destroy(() => res.redirect('/admin/login'));
app.get('/admin/logout', requireAdmin, logout);
app.post('/admin/logout', requireAdmin, logout);

// Admin dashboard
app.get('/admin/dashboard', requireAdmin, asyncHandler(async (_req, res) => res.render('admin/dashboard', { counts: { projects: (await one('SELECT COUNT(*)::int AS count FROM projects')).count, services: (await one('SELECT COUNT(*)::int AS count FROM services')).count, pages: (await one('SELECT COUNT(*)::int AS count FROM pages')).count, uploads: (await one('SELECT COUNT(*)::int AS count FROM uploads')).count }, recentProjects: await many('SELECT * FROM projects ORDER BY updated_at DESC LIMIT 5') })));

// Projects
app.get('/admin/projects', requireAdmin, asyncHandler(async (_req, res) => res.render('admin/projects', { projects: await many('SELECT * FROM projects ORDER BY updated_at DESC') })));
app.get('/admin/projects/new', requireAdmin, (_req, res) => res.render('admin/project-form', { project: null }));
app.get('/admin/projects/:id/edit', requireAdmin, asyncHandler(async (req, res) => res.render('admin/project-form', { project: await one('SELECT * FROM projects WHERE id = $1', [req.params.id]) })));
app.post('/admin/projects', requireAdmin, projectUpload, asyncHandler(async (req, res) => { const thumbnail = await uploadToCloudinary(req.files?.thumbnail?.[0]); const gallery = await Promise.all((req.files?.gallery || []).map(uploadToCloudinary)); await pool.query(`INSERT INTO projects (slug,title,category,short_description,description,thumbnail_url,live_link,source_link,status,tags,features,tech_stack,gallery_json,featured) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`, [slugify(req.body.slug || req.body.title), req.body.title, req.body.category, req.body.short_description, req.body.description || '', thumbnail, req.body.live_link || '', req.body.source_link || '', req.body.status || 'active', req.body.tags || '', req.body.features || '', req.body.tech_stack || '', JSON.stringify(gallery), Boolean(req.body.featured)]); withMessage(req, 'success', 'Project created.'); res.redirect('/admin/projects'); }));
app.post('/admin/projects/:id', requireAdmin, projectUpload, asyncHandler(async (req, res) => { const current = await one('SELECT * FROM projects WHERE id = $1', [req.params.id]); if (!current) return res.status(404).send('Project not found'); const thumbnail = await uploadToCloudinary(req.files?.thumbnail?.[0]) || current.thumbnail_url; const additions = await Promise.all((req.files?.gallery || []).map(uploadToCloudinary)); const gallery = req.body.clear_gallery ? additions : [...splitList(current.gallery_json), ...additions]; await pool.query(`UPDATE projects SET slug=$1,title=$2,category=$3,short_description=$4,description=$5,thumbnail_url=$6,live_link=$7,source_link=$8,status=$9,tags=$10,features=$11,tech_stack=$12,gallery_json=$13,featured=$14,updated_at=NOW() WHERE id=$15`, [slugify(req.body.slug || req.body.title), req.body.title, req.body.category, req.body.short_description, req.body.description || '', thumbnail, req.body.live_link || '', req.body.source_link || '', req.body.status || 'active', req.body.tags || '', req.body.features || '', req.body.tech_stack || '', JSON.stringify(gallery), Boolean(req.body.featured), req.params.id]); withMessage(req, 'success', 'Project updated.'); res.redirect('/admin/projects'); }));
app.post('/admin/projects/:id/delete', requireAdmin, asyncHandler(async (req, res) => { await pool.query('DELETE FROM projects WHERE id = $1', [req.params.id]); withMessage(req, 'success', 'Project deleted.'); res.redirect('/admin/projects'); }));

// Services
app.get('/admin/services', requireAdmin, asyncHandler(async (_req, res) => res.render('admin/services', { services: await many('SELECT * FROM services ORDER BY updated_at DESC') })));
app.get('/admin/services/new', requireAdmin, (_req, res) => res.render('admin/service-form', { service: null }));
app.get('/admin/services/:id/edit', requireAdmin, asyncHandler(async (req, res) => res.render('admin/service-form', { service: await one('SELECT * FROM services WHERE id = $1', [req.params.id]) })));
app.post('/admin/services', requireAdmin, singleImageUpload, asyncHandler(async (req, res) => { await pool.query('INSERT INTO services (title,description,price_text,image_url,cta_text,cta_link,featured) VALUES ($1,$2,$3,$4,$5,$6,$7)', [req.body.title, req.body.description, req.body.price_text || '', await uploadToCloudinary(req.file), req.body.cta_text || 'Let’s talk', req.body.cta_link || '/contact', Boolean(req.body.featured)]); withMessage(req, 'success', 'Service created.'); res.redirect('/admin/services'); }));
app.post('/admin/services/:id', requireAdmin, singleImageUpload, asyncHandler(async (req, res) => { const current = await one('SELECT * FROM services WHERE id = $1', [req.params.id]); if (!current) return res.status(404).send('Service not found'); await pool.query('UPDATE services SET title=$1,description=$2,price_text=$3,image_url=$4,cta_text=$5,cta_link=$6,featured=$7,updated_at=NOW() WHERE id=$8', [req.body.title, req.body.description, req.body.price_text || '', await uploadToCloudinary(req.file) || current.image_url, req.body.cta_text || 'Let’s talk', req.body.cta_link || '/contact', Boolean(req.body.featured), req.params.id]); withMessage(req, 'success', 'Service updated.'); res.redirect('/admin/services'); }));
app.post('/admin/services/:id/delete', requireAdmin, asyncHandler(async (req, res) => { await pool.query('DELETE FROM services WHERE id = $1', [req.params.id]); withMessage(req, 'success', 'Service deleted.'); res.redirect('/admin/services'); }));

// Pages and settings
app.get('/admin/pages', requireAdmin, asyncHandler(async (_req, res) => res.render('admin/pages', { pages: await many('SELECT * FROM pages ORDER BY slug') })));
app.get('/admin/pages/:slug/edit', requireAdmin, asyncHandler(async (req, res) => { const page = await one('SELECT * FROM pages WHERE slug = $1', [req.params.slug]); return page ? res.render('admin/page-form', { page, pageExtras: extras(page) }) : res.status(404).send('Page not found'); }));
app.post('/admin/pages/:slug', requireAdmin, singleImageUpload, asyncHandler(async (req, res) => { const page = await one('SELECT * FROM pages WHERE slug = $1', [req.params.slug]); if (!page) return res.status(404).send('Page not found'); let extra = page.extra_json || {}; if (req.params.slug === 'about') extra = { skills: req.body.skills || '', tools: req.body.tools || '', image: await uploadToCloudinary(req.file) || extra.image || '' }; await pool.query('UPDATE pages SET title=$1,content=$2,extra_json=$3,updated_at=NOW() WHERE slug=$4', [req.body.title, req.body.content || '', JSON.stringify(extra), req.params.slug]); withMessage(req, 'success', `${req.params.slug} page updated.`); res.redirect('/admin/pages'); }));
app.get('/admin/settings', requireAdmin, (_req, res) => res.render('admin/settings'));
app.post('/admin/settings', requireAdmin, asyncHandler(async (req, res) => { await pool.query(`UPDATE site_settings SET site_name=$1,tagline=$2,hero_title=$3,hero_intro=$4,hero_primary_text=$5,hero_primary_link=$6,hero_secondary_text=$7,hero_secondary_link=$8,email=$9,whatsapp=$10,social_links=$11,footer_text=$12,seo_title=$13,seo_description=$14,updated_at=NOW() WHERE id=1`, [req.body.site_name, req.body.tagline, req.body.hero_title, req.body.hero_intro, req.body.hero_primary_text, req.body.hero_primary_link, req.body.hero_secondary_text, req.body.hero_secondary_link, req.body.email, req.body.whatsapp || '', req.body.social_links || '', req.body.footer_text, req.body.seo_title, req.body.seo_description]); withMessage(req, 'success', 'Site settings updated.'); res.redirect('/admin/settings'); }));
app.get('/admin/settings/security', requireAdmin, (_req, res) => res.render('admin/security'));
app.post('/api/admin/change-password', requireAdmin, asyncHandler(async (req, res) => { const user = await one('SELECT * FROM admin_users WHERE id = $1', [req.session.admin.id]); if (!user || !(await bcrypt.compare(String(req.body.current_password || ''), user.password_hash))) { withMessage(req, 'error', 'Current password is incorrect.'); return res.redirect('/admin/settings/security'); } if (String(req.body.new_password || '').length < 8) { withMessage(req, 'error', 'New password must be at least 8 characters.'); return res.redirect('/admin/settings/security'); } if (req.body.new_password !== req.body.confirm_password) { withMessage(req, 'error', 'New passwords do not match.'); return res.redirect('/admin/settings/security'); } await pool.query('UPDATE admin_users SET password_hash=$1,updated_at=NOW() WHERE id=$2', [await bcrypt.hash(req.body.new_password, 12), user.id]); req.session.destroy(() => res.redirect('/admin/login?changed=1')); }));

app.use((error, _req, res, _next) => { console.error(error); if (error instanceof multer.MulterError) return res.status(400).send(`Upload error: ${error.message}`); res.status(500).send('Something went wrong. Please try again.'); });
app.use((_req, res) => res.status(404).render('public/404'));
app.listen(PORT, () => console.log(`The Creator Studio running at http://localhost:${PORT}`));
