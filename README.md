# The Creator Studio

A complete portfolio website and private content-management dashboard built with Node.js, Express, SQLite, EJS, bcrypt, `express-session`, and Multer. Customers can browse projects, services, studio information, and contact details while the site owner manages content through a protected admin dashboard.

## Features

### Public website
- Premium responsive dark-theme home page with hero content, featured projects, featured services, and calls to action.
- Searchable and filterable project portfolio with individual detail pages, galleries, features, tags, technology stacks, live links, and optional source links.
- Editable services, about page, contact details, WhatsApp URL, and social links.
- Responsive mobile navigation and layouts.

### Admin dashboard
- Session-based admin login at `/admin/login`.
- Overview dashboard with content counts and quick actions.
- Full create, edit, and delete workflows for projects and services.
- Editable home hero, global site settings, about content, contact information, and page content.
- Image uploads for project thumbnails, project galleries, service images, and the about image.
- Password change workflow that verifies the current password, hashes the new password, updates SQLite, and logs the user out.

## Requirements

- Node.js 18 or later
- npm
- A persistent filesystem for SQLite and uploaded files in production

## Local setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create your private environment file:

   ```bash
   cp .env.example .env
   ```

3. Set a long random `SESSION_SECRET` and set `INITIAL_ADMIN_PASSWORD` in `.env` to the initial password supplied privately by the site owner. The default initial login email is `srao2445@gmail.com`; change `INITIAL_ADMIN_EMAIL` before first run if needed.

4. Start the site:

   ```bash
   npm start
   ```

5. Open `http://localhost:3000`, then sign in at `http://localhost:3000/admin/login`.

6. After the first successful startup, remove `INITIAL_ADMIN_PASSWORD` from `.env`. It is only required while creating the first administrator.

You can explicitly initialize the database before starting the web server:

```bash
npm run init-db
```

## Secure admin bootstrap and login

When the application initializes an empty database, `ensureAdmin()` reads `INITIAL_ADMIN_PASSWORD` from the runtime environment, immediately hashes it with bcrypt using 12 salt rounds, and stores only the resulting `password_hash`. The plain password is never written into application source files, frontend JavaScript, templates, JSON, or SQLite. If the database has no admin and the environment variable is missing, startup fails with a clear message rather than creating an insecure account.

Login uses a server-side session. The browser receives only an HTTP-only, same-site session cookie. In production, the cookie is also marked secure. All dashboard routes, content-editing routes, upload handlers, the password endpoint, and logout route require an authenticated admin session.

> **Important:** Never commit `.env`, expose the SQLite database publicly, place the database inside a public web directory, or publish the upload filesystem as writable by untrusted services. `.env` and SQLite files are ignored by Git.

## Changing the password

1. Log in to the admin dashboard.
2. Open **Security** in the sidebar.
3. Enter the current password, a new password with at least 8 characters, and confirmation.
4. Submit the form.

The backend verifies the current password with `bcrypt.compare()`, hashes the new password with `bcrypt.hash()`, stores the replacement hash, and destroys the active session. Sign in again with the new password.

## Content and uploads

- SQLite defaults to `./data/creator-studio.db`. Override this with `DATABASE_PATH`.
- Uploads are stored in `./uploads` and served under `/uploads/...`.
- Images are limited to 5 MB each. Project galleries accept up to 8 uploaded images at a time.
- Uploaded image metadata is recorded in the `uploads` table.
- The contact form is intentionally UI-only and does not store visitor messages. Visitors are directed to the configured email link.

## Deployment

### Render

1. Create a new Web Service from this repository.
2. Use `npm install` as the build command and `npm start` as the start command.
3. Add `SESSION_SECRET`, `NODE_ENV=production`, `INITIAL_ADMIN_EMAIL`, and `INITIAL_ADMIN_PASSWORD` as secret environment variables before the first deploy.
4. Attach a persistent disk and set `DATABASE_PATH` to a path on that disk, such as `/var/data/creator-studio.db`.
5. Ensure the `uploads` directory also lives on persistent storage, for example by mounting or linking it to the persistent disk.
6. After the initial admin has been created, remove `INITIAL_ADMIN_PASSWORD` from the service environment and redeploy.

### Railway

1. Deploy the repository as a Railway service.
2. Add the same environment variables described above.
3. Attach a Railway volume and point `DATABASE_PATH` to the mounted volume.
4. Keep uploaded files on a persistent volume or replace local upload storage with an object storage service for multi-instance deployments.
5. Remove `INITIAL_ADMIN_PASSWORD` after the first successful bootstrap.

### VPS

1. Install Node.js 18+, clone the repository, and run `npm install --omit=dev`.
2. Create a private `.env`, run `npm run init-db`, remove `INITIAL_ADMIN_PASSWORD`, and launch with `npm start` or a process manager such as PM2 or systemd.
3. Put Nginx or Caddy in front of the Node.js process and enable HTTPS.
4. Back up the SQLite database and `uploads` directory regularly.
5. Keep `.env`, the database, and upload write permissions private.

## Useful commands

```bash
npm start          # Start the production server
npm run dev        # Start with Node's watch mode
npm run init-db    # Initialize database content and first admin
npm run check      # Run JavaScript syntax checks
```

## Database tables

- `admin_users`
- `site_settings`
- `projects`
- `services`
- `pages`
- `uploads`
