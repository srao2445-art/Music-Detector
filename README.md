# The Creator Studio

A modern creator portfolio with a full admin CMS, protected login, editable website copy, project management, cover-image uploads, and email OTP password reset.

## Run locally

```bash
npm install
cp .env.example .env
npm start
```

Open `http://localhost:3000` for the public website and `http://localhost:3000/admin` for the admin studio.

Default local credentials (unless changed in `.env` before first launch):

- Email: `admin@example.com`
- Password: `ChangeMe123!`

## Password-reset email setup

Update `.env` with your Resend API key and sender address. If email delivery is not configured and `DEV_SHOW_OTP=true`, reset codes are printed in the server console for local development only.

## Data storage

Website content and credentials are persisted to `data/database.json`, which is created automatically and intentionally gitignored. Uploaded images are saved under `public/uploads/` and are also intentionally gitignored.
