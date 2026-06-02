const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const Database = require('better-sqlite3');

const defaultDbPath = path.join(__dirname, 'data', 'creator-studio.db');
const dbPath = path.resolve(process.env.DATABASE_PATH || defaultDbPath);
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const schema = `
CREATE TABLE IF NOT EXISTS admin_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS site_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  site_name TEXT NOT NULL DEFAULT 'The Creator Studio',
  tagline TEXT NOT NULL DEFAULT 'Digital experiences, crafted with purpose.',
  hero_title TEXT NOT NULL DEFAULT 'Ideas transformed into digital experiences.',
  hero_intro TEXT NOT NULL DEFAULT 'A curated studio for modern websites, useful tools, and thoughtful digital products.',
  hero_primary_text TEXT NOT NULL DEFAULT 'Explore projects',
  hero_primary_link TEXT NOT NULL DEFAULT '/projects',
  hero_secondary_text TEXT NOT NULL DEFAULT 'Start a conversation',
  hero_secondary_link TEXT NOT NULL DEFAULT '/contact',
  footer_text TEXT NOT NULL DEFAULT 'Building digital experiences with clarity and craft.',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS pages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  extra_json TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  short_description TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  thumbnail TEXT NOT NULL DEFAULT '',
  live_link TEXT NOT NULL DEFAULT '',
  source_link TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'beta', 'archived')),
  tags TEXT NOT NULL DEFAULT '',
  features TEXT NOT NULL DEFAULT '',
  tech_stack TEXT NOT NULL DEFAULT '',
  gallery TEXT NOT NULL DEFAULT '',
  featured INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS services (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  price_text TEXT NOT NULL DEFAULT '',
  image TEXT NOT NULL DEFAULT '',
  cta_text TEXT NOT NULL DEFAULT 'Let’s talk',
  cta_link TEXT NOT NULL DEFAULT '/contact',
  featured INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS uploads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  filename TEXT NOT NULL,
  original_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);`;

db.exec(schema);

function seedContent() {
  db.prepare(`INSERT OR IGNORE INTO site_settings (id) VALUES (1)`).run();
  const addPage = db.prepare('INSERT OR IGNORE INTO pages (slug, title, content, extra_json) VALUES (?, ?, ?, ?)');
  addPage.run('home', 'Home', 'Every project begins with a clear problem and ends with an experience people enjoy using.', '{}');
  addPage.run('about', 'About the studio', 'The Creator Studio is an independent digital practice focused on turning good ideas into polished, useful experiences.', JSON.stringify({ skills: 'Web Design, UI/UX, Full-stack Development, Product Strategy', tools: 'Node.js, Express, SQLite, JavaScript, Figma', image: '' }));
  addPage.run('contact', 'Let’s build something great', 'Have a project in mind, a problem worth solving, or simply want to say hello? Reach out and start a conversation.', JSON.stringify({ email: 'srao2445@gmail.com', whatsapp: '', social_links: '' }));
  const projectCount = db.prepare('SELECT COUNT(*) AS count FROM projects').get().count;
  if (!projectCount) {
    db.prepare(`INSERT INTO projects (slug, title, category, short_description, description, live_link, status, tags, features, tech_stack, featured)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run('creator-studio', 'The Creator Studio', 'Website', 'A polished portfolio and content management platform for creative work.', 'A complete portfolio experience with a public showcase and a secure private dashboard for managing content without touching code.', '#', 'active', 'Portfolio, CMS, Responsive', 'Responsive portfolio|Secure content dashboard|Project and service management', 'Node.js|Express|SQLite|EJS', 1);
  }
  const serviceCount = db.prepare('SELECT COUNT(*) AS count FROM services').get().count;
  if (!serviceCount) {
    const addService = db.prepare('INSERT INTO services (title, description, price_text, cta_text, cta_link, featured) VALUES (?, ?, ?, ?, ?, ?)');
    addService.run('Website design & build', 'Modern, responsive websites shaped around your goals and your audience.', 'Custom quote', 'Plan a website', '/contact', 1);
    addService.run('Product prototyping', 'From early idea to a focused interactive prototype ready for feedback.', 'Let’s discuss', 'Start a prototype', '/contact', 1);
    addService.run('Digital tools & apps', 'Purpose-built tools that streamline work and solve real operational problems.', 'Custom quote', 'Build a tool', '/contact', 1);
  }
}

async function ensureAdmin() {
  const existing = db.prepare('SELECT COUNT(*) AS count FROM admin_users').get().count;
  if (existing) return false;
  const password = process.env.INITIAL_ADMIN_PASSWORD;
  const email = process.env.INITIAL_ADMIN_EMAIL || 'srao2445@gmail.com';
  if (!password) {
    throw new Error('INITIAL_ADMIN_PASSWORD is required for first-time setup. Set it in your environment, run the app once, then remove it.');
  }
  const passwordHash = await bcrypt.hash(password, 12);
  db.prepare('INSERT INTO admin_users (email, password_hash) VALUES (?, ?)').run(email.toLowerCase().trim(), passwordHash);
  return true;
}

seedContent();
module.exports = { db, dbPath, ensureAdmin };
