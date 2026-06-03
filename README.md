# Simtolite Lighting Firebase Website

A professional, mobile-responsive, Firebase-ready website and secure admin panel for **Simtolite Lighting**, a premium lighting startup.

## Features

- Dark premium lighting theme with subtle glow effects and smooth scroll animations.
- Public website sections for hero, categories, featured products, project gallery, why choose us, testimonials, contact details, social links, and footer.
- WordPress-style admin panel at `/admin.html` or `/admin` for editing website content without code.
- Firebase Authentication based admin login with an approved email allowlist.
- Firestore-backed editable website content.
- Firebase Storage image uploads for products and gallery items.
- Public read-only content with admin-only writes enforced by Firestore and Storage rules.
- Default Simtolite Lighting sample content so the site looks complete before Firestore is populated.

## Project Structure

```text
public/
  index.html                 Public website
  admin.html                 Secure admin panel
  css/styles.css             Website and admin styling
  js/app.js                  Public website renderer
  js/admin.js                Admin CMS logic and image uploads
  js/default-content.js      Sample/default website content
  js/firebase-config.js      Firebase web app config and admin email
firebase.json                Firebase Hosting, Firestore, and Storage config
firestore.rules              Firestore read/write security rules
storage.rules                Firebase Storage image upload rules
.firebaserc.example          Example Firebase project alias file
```

## Firebase Setup

1. Create a Firebase project.
2. Enable **Authentication > Email/Password**.
3. Add the approved admin user in Firebase Authentication.
4. Enable **Firestore Database**.
5. Enable **Storage**.
6. Copy `.firebaserc.example` to `.firebaserc` and replace `YOUR_PROJECT_ID`.
7. Update `public/js/firebase-config.js` with your Firebase web app config.
8. Replace `admin@simtolite.com` in these files with your approved admin email:
   - `public/js/firebase-config.js`
   - `firestore.rules`
   - `storage.rules`
9. Deploy:

```bash
firebase deploy
```

## Admin Usage

1. Open `/admin.html` after deployment.
2. Log in using the approved Firebase Authentication admin account.
3. Edit website name, hero content, categories, products, images, gallery, reviews, contact details, WhatsApp number, social links, and why choose us content.
4. Upload product/gallery images when needed.
5. Click **Save Website Content**.
6. Public users can read the website content, but only the approved admin email can write content or upload images.
