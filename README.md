# The Creator Studio

A production-ready business portfolio and content-management website built with Node.js, Express, PostgreSQL, EJS, Cloudinary, bcryptjs, and PostgreSQL-backed sessions. Customers can browse portfolio projects, services, business details, and contact information while an authenticated administrator edits public content without changing code.

## Production architecture

- **Express + EJS:** server-rendered, SEO-friendly public and admin pages.
- **PostgreSQL:** durable storage for content, bcrypt hashes, contact inquiries, upload metadata, and sessions.
- **`connect-pg-simple`:** PostgreSQL session storage instead of the default in-memory development store.
- **Cloudinary:** production image hosting. The application stores Cloudinary URLs and metadata in PostgreSQL rather than relying on local disk uploads.
- **bcryptjs:** portable, pure-JavaScript bcrypt password hashing. Plain passwords are never stored in PostgreSQL or committed to source control.

## Features

### Public website
- Premium responsive dark-theme homepage with editable hero content, featured projects, featured services, and calls to action.
- Searchable and category-filterable project portfolio with project detail pages, galleries, features, technology stacks, live links, and optional source links.
- Editable services, about content, contact details, WhatsApp URL, social links, footer text, SEO title, and SEO description.
- Mobile hamburger navigation and responsive layouts.
- Contact form submissions saved to PostgreSQL in `contact_messages`.

### Private admin dashboard
- Email/password login at `/admin/login` with PostgreSQL-backed server sessions.
- Protected overview, project CRUD, service CRUD, editable pages, global settings, Cloudinary image uploads, password change, and logout.
- HTTP-only, same-site session cookies; production cookies are also marked secure.

## Requirements

- Node.js 18 or later
- npm
- PostgreSQL database
- Cloudinary account for image uploads

## Local setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a private environment file:

   ```bash
   cp .env.example .env
   ```

3. Create a PostgreSQL database and set `DATABASE_URL` in `.env`. Also set a long random `SESSION_SECRET`, your Cloudinary credentials, and the privately supplied `INITIAL_ADMIN_PASSWORD`.

4. Initialize tables, seed default content, and create the first admin:

   ```bash
   npm run init-db
   ```

5. Remove `INITIAL_ADMIN_PASSWORD` from `.env` after initialization. The database now stores only the bcrypt hash.

6. Start the website:

   ```bash
   npm start
   ```

7. Open `http://localhost:3000`. Sign in at `http://localhost:3000/admin/login`.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string, such as `postgresql://user:password@localhost:5432/creator_studio`. |
| `SESSION_SECRET` | Long random value used to sign session cookies. |
| `INITIAL_ADMIN_EMAIL` | First admin email. Defaults to `srao2445@gmail.com`. |
| `INITIAL_ADMIN_PASSWORD` | Private first-run bootstrap password. Remove it after `npm run init-db`. |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary account cloud name. |
| `CLOUDINARY_API_KEY` | Cloudinary API key. |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret. |
| `NODE_ENV` | Use `production` in deployed environments. |
| `PORT` | HTTP port. Defaults to `3000`. |

> **Never commit `.env`.** Never place database credentials, Cloudinary secrets, session secrets, or real passwords in HTML, CSS, browser JavaScript, JSON, or public files. `.env.example` intentionally uses placeholders instead of a real bootstrap password.

## PostgreSQL setup

The initializer creates these required tables:

- `admin_users`
- `site_settings`
- `pages`
- `projects`
- `services`
- `uploads`
- `contact_messages`
- `session`

Create a PostgreSQL database locally, on Render, on Railway, or through another PostgreSQL provider. Copy its connection string into `DATABASE_URL`, then run:

```bash
npm run init-db
```

The initializer is safe to rerun. It creates missing tables and seed content without overwriting content already managed through the dashboard.

## Secure admin login and password hashing

During first-time initialization, the backend checks whether the configured admin email exists. If it does not exist, the initializer reads `INITIAL_ADMIN_PASSWORD` from the runtime environment, hashes it with bcryptjs using 12 salt rounds, and inserts only `password_hash` into PostgreSQL. The clear-text bootstrap password is not written to PostgreSQL or source code.

Login compares the submitted password against the stored bcrypt hash with `bcrypt.compare()`. All admin content-management routes require an authenticated session. Sessions are stored in PostgreSQL through `connect-pg-simple`, while the browser receives only a signed HTTP-only cookie.

### Change the admin password

1. Sign in to `/admin/login`.
2. Open **Security** in the admin sidebar.
3. Enter the current password, a new password with at least 8 characters, and confirmation.
4. Save the form.

The backend verifies the current hash, hashes the replacement password, updates PostgreSQL, destroys the active session, and redirects to login.

## Cloudinary uploads

Project thumbnails, project galleries, service images, and the about image are uploaded to Cloudinary from in-memory Multer buffers. Production does not depend on local upload folders or ephemeral host storage. PostgreSQL stores Cloudinary secure URLs and upload metadata.

Create a Cloudinary account, open the Cloudinary dashboard, and copy the cloud name, API key, and API secret into the corresponding `.env` values. File upload attempts fail with a clear server error until those credentials are configured.

## Deploy on Render

A `render.yaml` Blueprint is included.

1. Push this repository to your Git provider and create a Render Blueprint from it.
2. Render provisions the web service and PostgreSQL database from `render.yaml`.
3. Add `INITIAL_ADMIN_PASSWORD`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` as private Render environment values.
4. Deploy. The build command installs dependencies and runs `npm run init-db`.
5. After the first successful deployment, remove `INITIAL_ADMIN_PASSWORD` from Render and redeploy.

For a manually configured Render service, use:

- Build command: `npm install && npm run init-db`
- Start command: `npm start`
- `NODE_ENV=production`

## Deploy on Railway

1. Create a Railway project and add a PostgreSQL service.
2. Deploy this repository as a service.
3. Set `DATABASE_URL` to the Railway PostgreSQL connection string.
4. Add the remaining environment variables from `.env.example` as private Railway variables.
5. Run `npm run init-db`, deploy with `npm start`, and remove `INITIAL_ADMIN_PASSWORD` after setup.

## Deploy on a VPS

1. Install Node.js 18+, npm, PostgreSQL, and a reverse proxy such as Nginx or Caddy.
2. Clone the repository and run `npm install --omit=dev`.
3. Create a private `.env`, create the PostgreSQL database, and run `npm run init-db`.
4. Remove `INITIAL_ADMIN_PASSWORD` and run `npm start` with PM2 or systemd.
5. Configure HTTPS through Nginx or Caddy so production secure cookies work correctly.
6. Back up PostgreSQL regularly.

## Termux compatibility

The application intentionally uses `pg` and does **not** use `better-sqlite3` or other SQLite native bindings. It uses `bcryptjs`, the pure-JavaScript implementation of the bcrypt algorithm, to avoid native compilation failures on Termux while preserving bcrypt-compatible password hashes.

## Useful commands

```bash
npm start          # Start the server
npm run dev        # Start with Node watch mode
npm run init-db    # Create PostgreSQL tables, seed content, and bootstrap admin
npm run check      # Run JavaScript syntax checks
```
