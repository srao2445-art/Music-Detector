const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

loadEnv();
const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const UPLOAD_DIR = path.join(PUBLIC_DIR, 'uploads');
const DB_FILE = path.join(ROOT, 'data', 'database.json');
const sessions = new Map();
const resetRequests = new Map();
const MAX_BODY = 7 * 1024 * 1024;

const defaults = {
  admin: { email: process.env.ADMIN_EMAIL || 'admin@example.com', passwordHash: hashPassword(process.env.ADMIN_PASSWORD || 'ChangeMe123!') },
  content: {
    brand: 'The Creator Studio',
    navCta: 'Explore projects',
    heroEyebrow: 'Independent digital creator',
    heroTitle: 'I shape bold ideas into digital experiences.',
    heroText: 'A curated collection of experiments, thoughtful products, and visual stories. Every project begins with curiosity and ends with something worth sharing.',
    heroPrimary: 'View my work',
    heroSecondary: 'About the studio',
    heroStatOne: '12+', heroStatOneLabel: 'Projects shipped',
    heroStatTwo: '04', heroStatTwoLabel: 'Creative disciplines',
    heroStatThree: '∞', heroStatThreeLabel: 'Ideas brewing',
    workEyebrow: 'Selected work',
    workTitle: 'Projects with a point of view.',
    workText: 'A growing archive of things I have designed, built, and explored.',
    aboutEyebrow: 'About the studio',
    aboutTitle: 'Small studio. Big creative energy.',
    aboutText: 'The Creator Studio is my digital playground — a home for the projects, concepts, and collaborations that keep me curious. I care about expressive details, useful ideas, and work that feels distinctly human.',
    aboutQuote: 'Make something that leaves a little spark behind.',
    contactEyebrow: 'Start a conversation',
    contactTitle: 'Have a project in mind?',
    contactText: 'I am always open to thoughtful collaborations and interesting ideas. Let’s make something memorable.',
    contactEmail: 'hello@creatorstudio.dev',
    contactButton: 'Say hello',
    footerText: 'Built with curiosity and a little bit of caffeine.',
    instagramUrl: 'https://instagram.com/',
    linkedinUrl: 'https://linkedin.com/',
    githubUrl: 'https://github.com/'
  },
  projects: [
    { id: crypto.randomUUID(), title: 'Lumin', category: 'Brand system', description: 'A luminous visual identity for a culture-forward creative collective.', image: 'https://images.unsplash.com/photo-1558655146-d09347e92766?auto=format&fit=crop&w=1000&q=85', link: '#', featured: true },
    { id: crypto.randomUUID(), title: 'Still / Moving', category: 'Editorial experiment', description: 'A study of rhythm, negative space, and the feeling of a printed page.', image: 'https://images.unsplash.com/photo-1545235617-9465d2a55698?auto=format&fit=crop&w=1000&q=85', link: '#', featured: false },
    { id: crypto.randomUUID(), title: 'Arca Notes', category: 'Digital product', description: 'A quiet, focused note-taking concept built for wandering minds.', image: 'https://images.unsplash.com/photo-1559028012-481c04fa702d?auto=format&fit=crop&w=1000&q=85', link: '#', featured: false }
  ]
};

fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
if (!fs.existsSync(DB_FILE)) writeDb(defaults);

function loadEnv() {
  const file = path.join(__dirname, '.env');
  if (!fs.existsSync(file)) return;
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx < 1) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (!(key in process.env)) process.env[key] = value;
  }
}
function readDb() { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); }
function writeDb(db) { fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2)); }
function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) { return `${salt}:${crypto.scryptSync(password, salt, 64).toString('hex')}`; }
function verifyPassword(password, stored) { const [salt, key] = stored.split(':'); return crypto.timingSafeEqual(Buffer.from(key, 'hex'), crypto.scryptSync(password, salt, 64)); }
function json(res, status, body) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body)); }
function parseCookies(req) { return Object.fromEntries((req.headers.cookie || '').split(';').filter(Boolean).map(v => { const i = v.indexOf('='); return [v.slice(0, i).trim(), decodeURIComponent(v.slice(i + 1))]; })); }
function getSession(req) { const token = parseCookies(req).studio_session; const session = token && sessions.get(token); if (session && session.expiresAt > Date.now()) return session; if (token) sessions.delete(token); return null; }
function requireAdmin(req, res) { if (!getSession(req)) { json(res, 401, { error: 'Please sign in to continue.' }); return false; } return true; }
function body(req) { return new Promise((resolve, reject) => { let raw = ''; req.on('data', c => { raw += c; if (raw.length > MAX_BODY) reject(new Error('Request is too large.')); }); req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch { reject(new Error('Invalid request body.')); } }); req.on('error', reject); }); }
function clean(value, max = 1000) { return String(value ?? '').trim().slice(0, max); }
function publicData() { const db = readDb(); return { content: db.content, projects: db.projects }; }
function sendFile(res, file) {
  const ext = path.extname(file).toLowerCase();
  const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };
  fs.readFile(file, (err, data) => { if (err) return json(res, 404, { error: 'Not found.' }); res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' }); res.end(data); });
}
async function sendOtp(email, otp) {
  if (!process.env.RESEND_API_KEY) {
    if (process.env.DEV_SHOW_OTP !== 'false') console.log(`[DEV OTP] Password reset code for ${email}: ${otp}`);
    return false;
  }
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || 'The Creator Studio <onboarding@resend.dev>', to: [email],
      subject: 'Your Creator Studio password reset code',
      text: `Your password reset code is ${otp}. It expires in 10 minutes.`,
      html: `<div style="font-family:Arial,sans-serif;padding:24px"><h2>The Creator Studio</h2><p>Use this code to reset your password:</p><p style="font-size:32px;font-weight:bold;letter-spacing:8px">${otp}</p><p>This code expires in 10 minutes.</p></div>`
    })
  });
  if (!response.ok) throw new Error('Email delivery failed. Check your email provider configuration.');
  return true;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const route = url.pathname;
  try {
    if (req.method === 'GET' && route === '/api/content') return json(res, 200, publicData());
    if (req.method === 'GET' && route === '/api/admin/session') { const session = getSession(req); return json(res, 200, { authenticated: !!session, email: session?.email }); }
    if (req.method === 'POST' && route === '/api/admin/login') {
      const input = await body(req); const db = readDb();
      if (clean(input.email, 200).toLowerCase() !== db.admin.email.toLowerCase() || !verifyPassword(String(input.password || ''), db.admin.passwordHash)) return json(res, 401, { error: 'Email or password is incorrect.' });
      const token = crypto.randomBytes(32).toString('hex'); sessions.set(token, { email: db.admin.email, expiresAt: Date.now() + 24 * 60 * 60 * 1000 });
      res.setHeader('Set-Cookie', `studio_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=86400`); return json(res, 200, { ok: true, email: db.admin.email });
    }
    if (req.method === 'POST' && route === '/api/admin/logout') { const token = parseCookies(req).studio_session; if (token) sessions.delete(token); res.setHeader('Set-Cookie', 'studio_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'); return json(res, 200, { ok: true }); }
    if (req.method === 'POST' && route === '/api/admin/forgot-password') {
      const input = await body(req); const email = clean(input.email, 200).toLowerCase(); const db = readDb();
      if (email === db.admin.email.toLowerCase()) { const otp = String(crypto.randomInt(100000, 1000000)); resetRequests.set(email, { hash: crypto.createHash('sha256').update(otp).digest('hex'), expiresAt: Date.now() + 10 * 60 * 1000, attempts: 0 }); await sendOtp(email, otp); }
      return json(res, 200, { message: 'If that email is registered, a reset code has been sent.' });
    }
    if (req.method === 'POST' && route === '/api/admin/reset-password') {
      const input = await body(req); const email = clean(input.email, 200).toLowerCase(); const request = resetRequests.get(email); const otpHash = crypto.createHash('sha256').update(clean(input.otp, 10)).digest('hex'); const password = String(input.password || '');
      if (!request || request.expiresAt < Date.now() || request.attempts >= 5 || request.hash !== otpHash) { if (request) request.attempts += 1; return json(res, 400, { error: 'That reset code is invalid or has expired.' }); }
      if (password.length < 8) return json(res, 400, { error: 'Use a password with at least 8 characters.' });
      const db = readDb(); db.admin.passwordHash = hashPassword(password); writeDb(db); resetRequests.delete(email); sessions.clear(); return json(res, 200, { message: 'Password updated. You can sign in now.' });
    }
    if (req.method === 'GET' && route === '/api/admin/data') { if (!requireAdmin(req, res)) return; return json(res, 200, publicData()); }
    if (req.method === 'PUT' && route === '/api/admin/content') {
      if (!requireAdmin(req, res)) return; const input = await body(req); const db = readDb();
      for (const key of Object.keys(db.content)) if (key in input) db.content[key] = clean(input[key], 3000);
      writeDb(db); return json(res, 200, { message: 'Website copy saved.', content: db.content });
    }
    if (req.method === 'POST' && route === '/api/admin/projects') {
      if (!requireAdmin(req, res)) return; const input = await body(req); const db = readDb();
      const project = { id: crypto.randomUUID(), title: clean(input.title, 100), category: clean(input.category, 100), description: clean(input.description, 500), image: clean(input.image, 500), link: clean(input.link, 500) || '#', featured: !!input.featured };
      if (!project.title || !project.description) return json(res, 400, { error: 'Project title and description are required.' });
      db.projects.push(project); writeDb(db); return json(res, 201, project);
    }
    if (req.method === 'PUT' && route.startsWith('/api/admin/projects/')) {
      if (!requireAdmin(req, res)) return; const id = route.split('/').pop(); const input = await body(req); const db = readDb(); const project = db.projects.find(p => p.id === id);
      if (!project) return json(res, 404, { error: 'Project not found.' });
      for (const key of ['title', 'category', 'description', 'image', 'link']) if (key in input) project[key] = clean(input[key], key === 'description' ? 500 : 500);
      project.featured = !!input.featured; writeDb(db); return json(res, 200, project);
    }
    if (req.method === 'DELETE' && route.startsWith('/api/admin/projects/')) { if (!requireAdmin(req, res)) return; const id = route.split('/').pop(); const db = readDb(); db.projects = db.projects.filter(p => p.id !== id); writeDb(db); return json(res, 200, { ok: true }); }
    if (req.method === 'POST' && route === '/api/admin/upload') {
      if (!requireAdmin(req, res)) return; const input = await body(req); const match = String(input.data || '').match(/^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/);
      if (!match) return json(res, 400, { error: 'Choose a PNG, JPG, or WEBP image.' });
      const ext = match[1] === 'jpeg' ? 'jpg' : match[1]; const filename = `${Date.now()}-${crypto.randomBytes(5).toString('hex')}.${ext}`; fs.writeFileSync(path.join(UPLOAD_DIR, filename), Buffer.from(match[2], 'base64')); return json(res, 201, { url: `/uploads/${filename}` });
    }
    if (route === '/admin' || route === '/admin/') return sendFile(res, path.join(PUBLIC_DIR, 'admin.html'));
    const relative = route === '/' ? 'index.html' : decodeURIComponent(route.slice(1)); const file = path.normalize(path.join(PUBLIC_DIR, relative));
    if (!file.startsWith(PUBLIC_DIR)) return json(res, 403, { error: 'Forbidden.' });
    return sendFile(res, file);
  } catch (error) { console.error(error); return json(res, 500, { error: error.message || 'Something went wrong.' }); }
});
server.listen(PORT, () => console.log(`The Creator Studio is running at http://localhost:${PORT}`));
