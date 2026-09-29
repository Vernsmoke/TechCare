# TechCare

A working Next.js campus and community support portal, built from the supplied TechCare specification. This is a local pilot, not an approved public service or official University website.

The main project includes the updated blue design, larger text, campus day/night backgrounds, and [admin-managed announcements](docs/ANNOUNCEMENTS.md). Run this folder to use the app on port 5000. The separate `handoff/TechCare-claude` copy still uses port 3002.

## Run locally

Requires Node.js 24 or later and MySQL 8.0.16 or later. The project uses Next.js 16, React 19, TypeScript, MySQL through `mysql2`, Radix Dialog, Phosphor icons, Sharp, and Nodemailer.

```powershell
npm install
Copy-Item .env.example .env.local
# In MySQL Workbench, open database.sql and execute it on your local server.
# Set TECHCARE_DB_* in .env.local to match the MySQL connection.
npm run dev
```

Open [TechCare](http://localhost:5000). Use the same hostname as `TECHCARE_ORIGIN`.

The supplied example enables **local classroom verification**: the verification dialog shows a six-digit code. It exercises the workflow but does not establish mailbox ownership. Production startup refuses this mode. No accounts or passwords are shared by default.

Optional Google sign-in uses `http://localhost:5000/api/auth/google/callback`
as its local callback. Register that exact URI in Google Cloud Console, then
set the `TECHCARE_GOOGLE_CLIENT_ID` and `TECHCARE_GOOGLE_CLIENT_SECRET` values
in `.env.local`.

Create your own administrator from an interactive terminal:

```powershell
npm run create-admin
```

The password input is hidden. Members register through Create Account, verify, and sign in separately. An administrator can then assign moderator roles.

The app connects to the MySQL database configured by `TECHCARE_DB_*`. Uploaded files are still stored locally under ignored `data/`; set `TECHCARE_MEDIA_DIR` to choose another directory. Importing `database.sql` creates a fresh schema and starter content. Existing SQLite data is not migrated automatically.

## Working features

- Home, troubleshooting guides, credited learning resources, and booth information, with [admin content editing](docs/PAGE-CONTENT.md), drafts, publishing, hiding, and deletion. Existing content is preserved as editable records.
- Saved light/dark appearance through the sun/moon button in the top bar, including forms, dialogs, navigation, and the help assistant.
- Admin → App logo supports PNG/JPEG/WebP uploads up to 3 MB, previews, saving, and restoring the original TechCare logo. The navigation and browser favicon follow the saved logo; uploaded images are validated and resized without stretching.
- Inline form validation for required fields, email addresses, HTTPS links, length limits, verification codes, and file types/sizes, with keyboard focus on the first invalid field. Server validation remains enforced.
- A bottom-right help chatbot covering app features, accounts, friends, messaging, privacy, moderation, and device guides, with basic follow-up steps and community/support links. Uses editable built-in content, with no personal ChatGPT account, AI API, or AI usage fees. Chat is temporary and is cleared on refresh or account changes.
- Separate email account creation/verification/sign-in/recovery dialogs, plus optional Google OAuth sign-in with verified-email accounts.
- Persistent accounts, hashed passwords and sessions, server-side roles, dashboard, profile editing, and private avatars.
- Searchable and paginated discussions, moderated questions/member replies, immediate staff replies, and atomic Approve & Answer.
- A [discussion feed with dedicated question pages](docs/DISCUSSIONS.md), inline comments, question/comment upvotes and downvotes, and Newest/Top sorting.
- Optional question photos from upload or live camera, with preview, retake, and removal. Photos follow question moderation and are public only after approval. Live camera needs browser permission and HTTPS or localhost; a device photo-picker fallback is available.
- Independent follows, mutual friendships, private messaging, blocking, and narrow message reporting.
- Reviewed Lost & Found notices that omit reporter identity; staff-only feedback.
- Staff resource publishing, protected administrator accounts, role assignment, and hero replacement.
- Image decoding/re-encoding, bounded uploads, persistent abuse limits, same-origin mutation checks, security headers, and nonce-based HTML script CSP.

## Verification

```powershell
npm test
npm run typecheck
npm run build
npm run test:browser
npm run test:content
npm run test:discussion
```

Tests and browser check scripts create and delete randomly named MySQL test
databases. The configured MySQL account therefore needs `CREATE DATABASE` and
`DROP DATABASE` privileges for those test commands. The production app itself
should use a restricted account limited to its application database.

Browser testing uses locally installed Microsoft Edge in headless mode. It starts an isolated app on port 3001 with temporary synthetic data and a separate `.next-e2e` output. It does not test against the preview database. Close other processes using port 3001 before running it. Results and screenshots go in ignored `artifacts/`.

`node scripts/browser-check.mjs` checks the running preview on port 3000, captures desktop/mobile screenshots, tests a guide dialog/mobile navigation, and runs accessibility scans. It does not create accounts.

`node scripts/chatbot-check.mjs` checks the guide assistant on the running preview: topic matching, fallback and safety replies, keyboard controls, support links, temporary history, responsive sizing, and accessibility.

## Before broader use

Configure approved SMTP for real verification and recovery, set an approved HTTPS origin and secure cookies, and disable classroom mode. Optional Google sign-in requires a Google OAuth 2.0 Web client configured in `TECHCARE_GOOGLE_CLIENT_ID`, `TECHCARE_GOOGLE_CLIENT_SECRET`, and `TECHCARE_GOOGLE_REDIRECT_URI`; apply the Google OAuth database migration to existing MySQL installations. Google OAuth accounts are not automatically linked to existing TechCare accounts. Direct MP4/WebM upload requires a maintained FFprobe executable configured as `TECHCARE_FFPROBE`; without it, the server refuses video files and staff can still publish direct HTTPS video links. External videos and licensing have not been independently reviewed.

The production build is verified. Public readiness still depends on the institutional, operational, privacy, deployment, and capacity work listed in [operations](docs/OPERATIONS.md). No deployment or real-data migration has been performed.

## Documentation

- [Implementation decisions and code map](docs/IMPLEMENTATION.md)
- [Server backend guide and extension points](docs/SERVER-BACKEND.md)
- [Account-independent assistant handoff](docs/ASSISTANT_HANDOFF.md)
- [Acceptance results and limitations](docs/ACCEPTANCE.md)
- [Migration and rollback](docs/MIGRATION.md)
- [Operations and release gates](docs/OPERATIONS.md)
- [Supplied product specification and build addendum](docs/TECHCARE_CODEX_SPECIFICATION.md)

The original reference project at `C:\1 Sir mund\TechCare\Project_TechCare` remains unchanged. Its illustration and device-care flyer are carried over with their existing attribution. Runtime data, uploads, secrets, and generated test artifacts are excluded from Git.
