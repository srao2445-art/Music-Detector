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

The reset form sends a real six-digit OTP email when Resend is configured. Create a Resend account, verify your sending domain, then update `.env`:

```bash
RESEND_API_KEY=re_your_api_key
EMAIL_FROM="The Creator Studio <hello@your-verified-domain.com>"
DEV_SHOW_OTP=false
```

If `RESEND_API_KEY` is empty and `DEV_SHOW_OTP=true`, reset codes are printed in the Node server terminal for local development only. The reset form clearly reports when this development fallback is being used.

## Data storage

Website content and credentials are persisted to `data/database.json`, which is created automatically and intentionally gitignored. Uploaded images are saved under `public/uploads/` and are also intentionally gitignored.
