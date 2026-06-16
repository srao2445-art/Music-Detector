# The Creator Studio

A fresh, animated, dark creator/project portfolio website with a simple Firebase-powered admin CMS.

## Features

- Public pages: Home, Projects, Project detail, Blog/Articles, Article detail, About, Contact, FAQ, Privacy, Terms, Disclaimer, and Maintenance.
- Admin dashboard with Firebase Auth login.
- Edit homepage content.
- Add, edit, and delete projects.
- Add, edit, delete, publish, and unpublish articles.
- Edit site settings: logo text, website title, SEO title, meta description, social links, version text, and maintenance mode.
- Dynamic public content from Firebase Firestore.
- Firebase Hosting support with no backend server and no paid Firebase features required.
- Modern dark glassmorphism UI with neon gradients, animated hero cards, background grid, particles, scroll reveal, glowing buttons, and responsive layouts.

## Project structure

```text
public/
  index.html
  projects.html
  project.html
  blog.html
  article.html
  about.html
  contact.html
  faq.html
  privacy.html
  terms.html
  disclaimer.html
  admin.html
  maintenance.html
  css/
    style.css
    admin.css
  js/
    firebase-config.js
    firebase-services.js
    site.js
    admin.js
  assets/
firebase.json
firestore.rules
README.md
```

## Firebase setup

1. Create a Firebase project at <https://console.firebase.google.com/>.
2. Add a Web App in Firebase project settings.
3. Copy the Firebase config object into `public/js/firebase-config.js` and replace the placeholder values.
4. Enable **Authentication > Sign-in method > Email/Password**.
5. Create the admin user under **Authentication > Users**.
6. Create a Firestore database in production mode.
7. Deploy the included Firestore rules:

```bash
firebase deploy --only firestore:rules
```

8. Deploy the static website:

```bash
firebase deploy --only hosting
```

## Local preview

Install the Firebase CLI if needed:

```bash
npm install -g firebase-tools
```

Log in and run the local hosting emulator:

```bash
firebase login
firebase emulators:start --only hosting
```

Or serve the `public` folder with any static server. Because the app uses ES modules, open it through a local server rather than directly from the filesystem.

## First content edits

1. Visit `/admin.html`.
2. Log in with the Firebase Auth user you created.
3. Save site settings and homepage content.
4. Add projects and articles.
5. Toggle article publishing using the **Published** checkbox.

## Notes

- The public website includes fallback demo content so pages still look complete before Firestore contains documents.
- Firestore public article reads are limited to published articles, while authenticated admins can read drafts.
- Replace the legal placeholder text in Privacy Policy, Terms, and Disclaimer before launching a real production site.
