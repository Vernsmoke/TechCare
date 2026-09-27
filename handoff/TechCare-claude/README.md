# TechCare: Claude-inspired edition

An independent copy with cream surfaces, serif headings, blue controls, larger text, and admin-managed image announcements. The original TechCare project is unchanged. See [design notes](DESIGN-NOTES.md) for implementation choices.

This edition starts on **http://127.0.0.1:3002** using `npm run dev`. It has its own empty database, uploads directory, and session/appearance cookies. Install dependencies with `npm ci`, then copy `.env.example` to `.env.local` for the local classroom preview.

A working Next.js campus and community support portal, built from the supplied TechCare specification. This is a local pilot, not an approved public service or official University website.

## Run locally

Requires Node.js 24 or later. The project uses Next.js 16, React 19, TypeScript, SQLite through `node:sqlite`, Radix Dialog, Phosphor icons, Sharp, and Nodemailer.

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

Open [TechCare](http://127.0.0.1:3002). Use the same hostname as `TECHCARE_ORIGIN`.

The supplied example enables **local classroom verification**: the verification dialog shows a six-digit code. It exercises the workflow but does not establish mailbox ownership. Production startup refuses this mode. No accounts or passwords are shared by default.

Create your own administrator from an interactive terminal:

```powershell
npm run create-admin
```

The password input is hidden. Members register through Create Account, verify, and sign in separately. An administrator can then assign moderator roles.

The app writes its local SQLite database and protected uploads to ignored `data/`. Configure a different persistent directory with `TECHCARE_DATA_DIR`. No source data from the original Python project is used automatically.

## Working features

- [Homepage announcements](docs/ANNOUNCEMENTS.md): image previews, titles, descriptions, event dates, details links, private drafts, publish/hide, ordering, and deletion. Visitors browse one card at a time and can enlarge images.

- Home, four safe troubleshooting guides, credited learning resources, and qualified booth information.
- Saved light/dark appearance through the sun/moon button in the top bar, including forms, dialogs, navigation, and the help assistant.
- Admin → App logo supports PNG/JPEG/WebP uploads up to 3 MB, previews, saving, and restoring the original TechCare logo. The navigation and browser favicon follow the saved logo; uploaded images are validated and resized without stretching.
- Inline form validation for required fields, email addresses, HTTPS links, length limits, verification codes, and file types/sizes, with keyboard focus on the first invalid field. Server validation remains enforced.
- A bottom-right help chatbot covering app features, accounts, friends, messaging, privacy, moderation, and device guides, with basic follow-up steps and community/support links. Uses editable built-in content, with no personal ChatGPT account, AI API, or AI usage fees. Chat is temporary and is cleared on refresh or account changes.
- Separate account creation, verification, sign-in, verification recovery, password recovery, and reset dialogs.
- Persistent accounts, hashed passwords and sessions, server-side roles, dashboard, profile editing, and private avatars.
- Searchable and paginated discussions, moderated questions/member replies, immediate staff replies, and atomic Approve & Answer.
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
```

Browser testing uses locally installed Microsoft Edge in headless mode. It starts an isolated app on port 3012 with temporary synthetic data and a separate `.next-e2e` output. It does not test against the preview database. Close other processes using port 3012 before running it. Results and screenshots go in ignored `artifacts/`.

`node scripts/browser-check.mjs` checks the running preview on port 3002, captures desktop/mobile screenshots, tests a guide dialog/mobile navigation, and runs accessibility scans. It does not create accounts.

`node scripts/chatbot-check.mjs` checks the guide assistant on the running preview: topic matching, fallback and safety replies, keyboard controls, support links, temporary history, responsive sizing, and accessibility.

## Before broader use

Configure approved SMTP for real verification and recovery, set an approved HTTPS origin and secure cookies, and disable classroom mode. Direct MP4/WebM upload requires a maintained FFprobe executable configured as `TECHCARE_FFPROBE`; without it, the server refuses video files and staff can still publish direct HTTPS video links. External videos and licensing have not been independently reviewed.

The production build is verified. Public readiness still depends on the institutional, operational, privacy, deployment, and capacity work listed in [operations](docs/OPERATIONS.md). No deployment or real-data migration has been performed.

## Documentation

- [Implementation decisions and code map](docs/IMPLEMENTATION.md)
- [Account-independent assistant handoff](docs/ASSISTANT_HANDOFF.md)
- [Acceptance results and limitations](docs/ACCEPTANCE.md)
- [Migration and rollback](docs/MIGRATION.md)
- [Operations and release gates](docs/OPERATIONS.md)
- [Supplied product specification and build addendum](docs/TECHCARE_CODEX_SPECIFICATION.md)

The original reference project at `C:\1 Sir mund\TechCare\Project_TechCare` remains unchanged. Its illustration and device-care flyer are carried over with their existing attribution. Runtime data, uploads, secrets, and generated test artifacts are excluded from Git.

