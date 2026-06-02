const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required. Create a PostgreSQL database and set DATABASE_URL before running the app.');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const schema = `
CREATE TABLE IF NOT EXISTS admin_users (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
  email TEXT NOT NULL DEFAULT 'srao2445@gmail.com',
  whatsapp TEXT NOT NULL DEFAULT '',
  social_links TEXT NOT NULL DEFAULT '',
  footer_text TEXT NOT NULL DEFAULT 'Building digital experiences with clarity and craft.',
  seo_title TEXT NOT NULL DEFAULT 'The Creator Studio — Digital Products & Experiences',
  seo_description TEXT NOT NULL DEFAULT 'Explore websites, tools, apps, and creative digital services from The Creator Studio.',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS pages (
  id SERIAL PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  extra_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS projects (
  id SERIAL PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  short_description TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  thumbnail_url TEXT NOT NULL DEFAULT '',
  live_link TEXT NOT NULL DEFAULT '',
  source_link TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'beta', 'archived')),
  tags TEXT NOT NULL DEFAULT '',
  features TEXT NOT NULL DEFAULT '',
  tech_stack TEXT NOT NULL DEFAULT '',
  gallery_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  featured BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS services (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  price_text TEXT NOT NULL DEFAULT '',
  image_url TEXT NOT NULL DEFAULT '',
  cta_text TEXT NOT NULL DEFAULT 'Let’s talk',
  cta_link TEXT NOT NULL DEFAULT '/contact',
  featured BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS uploads (
  id SERIAL PRIMARY KEY,
  public_id TEXT NOT NULL,
  secure_url TEXT NOT NULL,
  original_name TEXT NOT NULL,
  resource_type TEXT NOT NULL DEFAULT 'image',
  bytes INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS contact_messages (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS "session" (
  sid VARCHAR NOT NULL PRIMARY KEY,
  sess JSON NOT NULL,
  expire TIMESTAMP(6) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_session_expire ON "session" (expire);
CREATE INDEX IF NOT EXISTS idx_projects_category ON projects (category);
CREATE INDEX IF NOT EXISTS idx_projects_featured ON projects (featured);
`;

async function seedContent(client = pool) {
  await client.query('INSERT INTO site_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING');
  await client.query(`INSERT INTO pages (slug, title, content, extra_json) VALUES
    ('home', 'Home', 'Every project begins with a clear problem and ends with an experience people enjoy using.', '{}'::jsonb),
    ('about', 'About the studio', 'The Creator Studio is an independent digital practice focused on turning good ideas into polished, useful experiences.', '{"skills":"Web Design, UI/UX, Full-stack Development, Product Strategy","tools":"Node.js, Express, PostgreSQL, JavaScript, Figma","image":""}'::jsonb),
    ('contact', 'Let’s build something great', 'Have a project in mind, a problem worth solving, or simply want to say hello? Reach out and start a conversation.', '{}'::jsonb)
    ON CONFLICT (slug) DO NOTHING`);
  await client.query(`INSERT INTO projects (slug, title, category, short_description, description, live_link, status, tags, features, tech_stack, featured)
    SELECT 'creator-studio', 'The Creator Studio', 'Website', 'A polished portfolio and content management platform for creative work.', 'A complete business portfolio with a public showcase and secure private dashboard.', '#', 'active', 'Portfolio, CMS, Responsive', 'Responsive portfolio|Secure dashboard|Project and service management', 'Node.js|Express|PostgreSQL|EJS', TRUE
    WHERE NOT EXISTS (SELECT 1 FROM projects)`);
  await client.query(`INSERT INTO services (title, description, price_text, cta_text, cta_link, featured)
    SELECT * FROM (VALUES
      ('Website design & build', 'Modern, responsive websites shaped around your goals and your audience.', 'Custom quote', 'Plan a website', '/contact', TRUE),
      ('Product prototyping', 'From early idea to a focused interactive prototype ready for feedback.', 'Let’s discuss', 'Start a prototype', '/contact', TRUE),
      ('Digital tools & apps', 'Purpose-built tools that streamline work and solve real operational problems.', 'Custom quote', 'Build a tool', '/contact', TRUE)
    ) AS defaults(title, description, price_text, cta_text, cta_link, featured)
    WHERE NOT EXISTS (SELECT 1 FROM services)`);
}

async function ensureAdmin(client = pool) {
  const email = (process.env.INITIAL_ADMIN_EMAIL || 'srao2445@gmail.com').toLowerCase().trim();
  const { rowCount } = await client.query('SELECT id FROM admin_users WHERE email = $1', [email]);
  if (rowCount) return false;
  if (!process.env.INITIAL_ADMIN_PASSWORD) throw new Error('INITIAL_ADMIN_PASSWORD is required to create the first admin. Set it privately, initialize the database, then remove it.');
  const passwordHash = await bcrypt.hash(process.env.INITIAL_ADMIN_PASSWORD, 12);
  await client.query('INSERT INTO admin_users (email, password_hash) VALUES ($1, $2)', [email, passwordHash]);
  return true;
}

async function initializeDatabase() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(schema);
    await seedContent(client);
    const createdAdmin = await ensureAdmin(client);
    await client.query('COMMIT');
    return createdAdmin;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { pool, initializeDatabase };
