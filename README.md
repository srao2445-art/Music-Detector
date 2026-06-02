# The Creator Studio — Firebase Static Edition

A Firebase Spark-plan compatible business portfolio and content-management website built with plain HTML, modern CSS, vanilla JavaScript, Cloud Firestore, Firebase Authentication, and Firebase Hosting.

There is no Express server, Node runtime, PostgreSQL database, EJS rendering layer, session middleware, Cloud Function, or paid backend dependency. Firebase Hosting serves the static files directly, public pages load content from Firestore in the browser, and the private dashboard uses Firebase Authentication email/password login.

## Features

### Public website

- Premium responsive dark-theme homepage.
- Featured projects and services loaded from Firestore.
- Searchable and category-filterable project portfolio.
- Project detail pages with description, links, image URL, gallery URLs, features, and technology stack.
- Services, About, and Contact pages loaded from Firestore.
- Contact inquiry form that writes validated messages into the `contact_messages` collection.
- Editable SEO title, SEO description, footer, email, WhatsApp URL, and social links.
- Mobile hamburger navigation.

### Admin dashboard

Open `/admin.html` after deployment.

- Firebase Authentication email/password login and logout.
- Overview counts and one-click starter-content seeding.
- Create, edit, and delete projects.
- Create, edit, and delete services.
- Edit homepage, About, and Contact page content.
- Edit site settings, contact details, footer, and SEO metadata.
- View and delete contact inquiries.

## Firebase collections

The application uses these Firestore collections:

| Collection | Purpose |
| --- | --- |
| `site_settings` | Global configuration in the `main` document. |
| `pages` | Editable `home`, `about`, and `contact` documents. |
| `projects` | Public portfolio projects. |
| `services` | Public service cards. |
| `contact_messages` | Customer inquiries submitted from the contact form. |

## Security model

The browser Firebase configuration is public by design. It identifies your Firebase web app but is not a server secret. Access control is enforced by `firestore.rules`.

- Everyone can read public site content.
- Anyone can submit a structurally validated contact inquiry with size limits.
- Only an authenticated Firebase user with the exact administrator email `srao2445@gmail.com` can edit content or read and delete inquiries.
- Passwords are managed by Firebase Authentication and never stored in HTML, CSS, browser JavaScript, JSON data files, or Firestore.

If you want to use a different administrator email, update both `ADMIN_EMAIL` in `public/js/firebase-config.js` and the email check in `firestore.rules` before deployment.

## Initial Firebase setup

### 1. Create a Firebase project

1. Open [Firebase Console](https://console.firebase.google.com/).
2. Create a project. The Spark plan is sufficient.
3. Add a Web App to the project.
4. Copy the Firebase web configuration into `public/js/firebase-config.js`.

### 2. Enable Firebase Authentication

1. In Firebase Console, open **Authentication → Sign-in method**.
2. Enable **Email/Password**.
3. Open **Authentication → Users** and create the admin user with email `srao2445@gmail.com`.
4. Set the administrator password privately in Firebase Console. Do not commit it to this repository.

Firebase Authentication securely owns password hashing and login verification. The application never receives or stores a reusable password outside the sign-in request handled by the Firebase SDK.

### 3. Create Firestore

1. Open **Firestore Database** in Firebase Console.
2. Create a database.
3. Choose a production location close to your customers.
4. Deploy the included `firestore.rules` before using the dashboard.

### 4. Configure Firebase CLI

Install the Firebase CLI globally and sign in:

```bash
npm install -g firebase-tools
firebase login
```

Initialize Hosting and Firestore if you are starting from a fresh checkout:

```bash
firebase init hosting firestore
```

When prompted:

- Select your Firebase project.
- Use `public` as the Hosting directory.
- Do **not** overwrite `public/index.html`.
- Keep `firestore.rules` and `firestore.indexes.json` as the Firestore configuration files.

Alternatively, copy the example project mapping and edit it:

```bash
cp .firebaserc.example .firebaserc
```

Replace `your-firebase-project-id` with your real Firebase project ID.

### 5. Deploy

```bash
firebase deploy
```

### 6. Seed starter content

1. Visit `https://YOUR_PROJECT.web.app/admin.html`.
2. Log in using the Firebase Authentication admin account.
3. Click **Seed starter content** once from the dashboard.

The dashboard writes the default site settings, editable pages, sample project, and starter services to Firestore. It uses merge-safe writes for fixed documents and does not duplicate project or service starter content after those collections contain records.

## Local preview

Install the Firebase CLI globally, then run:

```bash
firebase emulators:start --only hosting,firestore
```

For a quick Hosting-only preview against your configured remote Firestore project, you may also run:

```bash
firebase serve --only hosting
```

## Editing images on the Spark plan

The static dashboard stores image URLs rather than uploading binary files. Paste HTTPS URLs from your preferred image host into project thumbnail, project gallery, service image, or About image fields. This keeps the site Spark-plan compatible and avoids depending on a server or Cloud Function for upload processing.

## Deployment checklist

1. Replace the placeholders in `public/js/firebase-config.js`.
2. Enable Firebase Authentication Email/Password.
3. Create the admin Firebase Authentication user privately.
4. Create Firestore.
5. Run `firebase deploy` to publish Hosting and rules.
6. Sign in at `/admin.html` and seed starter content once.
7. Use the admin dashboard for ongoing edits.

## Repository structure

```text
public/
  index.html              Public homepage
  projects.html           Searchable projects page
  project.html            Project details page
  services.html           Services page
  about.html              About page
  contact.html            Contact form page
  admin.html              Private admin dashboard
  css/style.css           Responsive premium dark theme
  js/firebase-config.js   Firebase web configuration placeholders
  js/firebase.js          Firebase initialization
  js/defaults.js          Starter content used by dashboard seeding
  js/site.js              Public Firestore rendering
  js/admin.js             Firebase Auth dashboard and Firestore CRUD
firebase.json             Firebase Hosting and Firestore configuration
firestore.rules           Public-read and admin-write security rules
firestore.indexes.json    Firestore index configuration
```

## Important warnings

- Never commit private passwords, service-account JSON files, or Firebase Admin SDK credentials.
- Do not loosen `firestore.rules` to allow public content writes.
- Firebase web configuration is intentionally public; Firebase service-account credentials are not.
- This project does not require a Node server in production.
