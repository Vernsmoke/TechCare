# TechCare

A working Next.js campus and community support portal, built from the supplied TechCare specification. This is a local pilot, not an approved public service or official University website.

The project includes the updated blue design, larger text, campus day/night backgrounds, and [admin-managed announcements](docs/ANNOUNCEMENTS.md). Run this folder to use the app on port 3000. Start with [Windows setup](SETUP-INSTRUCTIONS.md) and the [development team handoff](docs/TEAM-HANDOFF.md).

## Run locally

Requires Node.js 24 or later. The project uses Next.js 16, React 19, TypeScript, SQLite through `node:sqlite`, Radix Dialog, Phosphor icons, Sharp, and Nodemailer.

```powershell
npm ci
npm run setup
npm run dev
```

Open [TechCare](http://127.0.0.1:3000). Use the same hostname as `TECHCARE_ORIGIN`.

`npm run setup` creates the ignored root `.env.local` without overwriting an existing file. `npm run dev` checks the local configuration first and explicitly uses port 3000 so it cannot silently switch to a port that fails the API origin check. Run `npm run check:setup` to diagnose settings without starting the app. If port 3000 is occupied, stop the existing server or use that server's terminal; do not open an unrelated process on that port.

The app uses the Webpack build path because this workspace is inside OneDrive, where Turbopack can fail while canonicalizing or memory-mapping its cache. The application's database and uploads in `data/` are unaffected.

The supplied example enables **local classroom verification**: the verification dialog shows a six-digit code. It exercises the workflow but does not establish mailbox ownership. Production startup refuses this mode. No accounts or passwords are shared by default.

Create your own administrator from an interactive terminal:

```powershell
npm run create-admin
```

The password input is hidden. Members register through Create Account, verify, and sign in separately. An administrator can then assign moderator roles.

The app writes its local SQLite database and protected uploads to ignored `data/`. Configure a different persistent directory with `TECHCARE_DATA_DIR`. No source data from the original Python project is used automatically.

## Project structure

The repository follows a full-stack layout while keeping Next.js as the web runtime:

```text
TechCare/
├─ frontend/
│  ├─ public/                  public images, icons, and favicon
│  └─ src/
│     ├─ app/                  pages, layouts, and the API route adapter
│     ├─ assets/styles/        global and feature stylesheets
│     ├─ components/
│     │  ├─ common/            shared content and media components
│     │  ├─ features/          feature screens and editors
│     │  ├─ layout/            shell, navigation, and consent
│     │  └─ ui/                reusable controls and form primitives
│     ├─ context/              shared application state
│     ├─ hooks/                reusable data-fetching hooks
│     ├─ services/             API requests and upload progress
│     └─ utils/                browser-safe content and assistant helpers
├─ backend/src/
│  ├─ config/                  SQLite connection, schema, and migrations
│  ├─ controllers/             API request handling
│  ├─ middleware/              authentication and authorization
│  ├─ services/                domain, media, mail, and business logic
│  └─ validations/             request validation
├─ shared/src/                 types, consent, defaults, and image metadata
├─ tests/                      API and domain tests
├─ scripts/                    build, migration, and verification scripts
└─ data/                       ignored database and protected uploads
```

The root `package.json` owns the project commands, dependencies, and lockfile. Run all npm commands from this root folder. `frontend/README.md`, `backend/README.md`, and `shared/README.md` describe each area’s import boundaries. Build output lives in `frontend/.next-production/`, with development and browser-test output in `frontend/.next/` and `frontend/.next-e2e/`.

## Working features

- Home, troubleshooting guides, credited learning resources, and booth information, with [admin content editing](docs/PAGE-CONTENT.md), drafts, publishing, hiding, and deletion. Existing content is preserved as editable records.
- Saved light/dark appearance through the sun/moon button in the top bar, including forms, dialogs, navigation, and the help assistant.
- Admin → App logo supports PNG/JPEG/WebP uploads up to 3 MB, previews, saving, and restoring the original TechCare logo. The navigation and browser favicon follow the saved logo; uploaded images are validated and resized without stretching.
- Inline form validation for required fields, email addresses, HTTPS links, length limits, verification codes, and file types/sizes, with keyboard focus on the first invalid field. Server validation remains enforced.
- A bottom-right help chatbot covering app features, accounts, friends, messaging, privacy, moderation, and device guides, with basic follow-up steps and community/support links. Uses editable built-in content, with no personal ChatGPT account, AI API, or AI usage fees. Chat is temporary and is cleared on refresh or account changes.
- Separate account creation, verification, sign-in, verification recovery, password recovery, and reset dialogs.
- Persistent accounts, hashed passwords and sessions, server-side roles, dashboard, profile editing, and private avatars.
- Searchable and paginated discussions, moderated questions/member replies, immediate staff replies, and atomic Approve & Answer.
- A [discussion feed with dedicated question pages](docs/DISCUSSIONS.md), inline comments, question/comment upvotes and downvotes, and Newest/Top sorting.
- Optional question photos from upload or live camera, with preview, retake, and removal. Photos follow question moderation and are public only after approval. Live camera needs browser permission and HTTPS or localhost; a device photo-picker fallback is available.
- Independent follows, mutual friendships, private messaging, blocking, and narrow message reporting.
- Reviewed Lost & Found notices with up to four photos, an optional date, a Returned status, and private messages and responses between the sender, reporter, and project team. Public notices omit reporter identity; feedback remains staff-only.
- Full-page admin editors with drafts, previews, upload progress, and guide-step images. Media accepts images, uploaded videos, and HTTPS website links, including YouTube and Vimeo.
- Discussion comment images, replies to replies, author editing/deletion, reply notifications, and staff content-report review.
- Staff resource publishing, protected administrator accounts, role assignment, and hero replacement.
- Image decoding/re-encoding, bounded uploads, persistent abuse limits, same-origin mutation checks, security headers, and nonce-based HTML script CSP.

## Verification

```powershell
npm test
npm run typecheck
npm run build
npm run test:production
npm run test:browser
npm run test:content
npm run test:discussion
```

Browser testing uses locally installed Microsoft Edge in headless mode. It starts an isolated app on port 3001 with temporary synthetic data and a separate `.next-e2e` output. It does not test against the preview database. Close other processes using port 3001 before running it. Results and screenshots go in ignored `artifacts/`.

`node scripts/browser-check.mjs` checks the running preview on port 3000, captures desktop/mobile screenshots, tests a guide dialog/mobile navigation, and runs accessibility scans. It does not create accounts.

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
