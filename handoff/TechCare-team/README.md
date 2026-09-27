# TechCare — team handoff

A campus/community technology-support web app. This copy contains the application source, public assets, dependency lockfile, configuration templates, development scripts, and tests. It is a local pilot, not an approved public service or official University website.

No personal ChatGPT account, OpenAI API key, or paid AI service is required. Local credentials, accounts, messages, uploaded photos, Git history, agent/skill files, build output, dependencies, and historical development documents are excluded. The bundled public illustrations remain included; review their source attribution and permissions before public distribution. Custom branding saved through Admin lives in the excluded database/uploads and must be configured again.

## Start locally

Install Node.js **24 or later** with npm. Extract the ZIP first, then open a terminal in this folder:

```powershell
npm.cmd ci
Copy-Item .env.example .env.local
npm.cmd run dev
```

On macOS/Linux, use `npm` instead of `npm.cmd` and `cp .env.example .env.local`.

Open **http://127.0.0.1:3000**. Use that exact origin; do not alternate with `localhost`. A new SQLite database and media directory are created in `data/`. Never commit `.env.local` or `data/`.

The example configuration enables a local classroom demonstration: verification codes appear in the interface. This does not verify ownership of a real mailbox. Production startup refuses classroom mode. To run on a different port, update `TECHCARE_ORIGIN` to the same origin and pass the port to the dev command.

## Create an administrator

Leave the dev server running and open another terminal in this folder:

```powershell
npm.cmd run create-admin
```

Enter a display name, an email not already registered in this app, and a password of 12–128 characters. Password input is hidden. There are no default credentials. Sign in through the website, then open **Admin** (`/admin`) or **Moderator** (`/moderate`).

Admin manages moderator roles and site branding. Moderator reviews questions, replies, Lost & Found, feedback, and message reports, and publishes learning resources. Ordinary users register through Create Account and verify their email before signing in.

## Development map

| Location | Purpose |
| --- | --- |
| `src/app/` | Next.js App Router pages, API route, global styles |
| `src/components/shell.tsx` | Navigation, sign-in/registration, question form, themes |
| `src/components/community.tsx` | Discussions, members, friendships, private messaging |
| `src/components/views.tsx` | Dashboard, resources, booth, Lost & Found, feedback, staff pages |
| `src/components/question-photo.tsx` | Photo upload, camera capture, preview, and attachment display |
| `src/components/ui.tsx` | Shared forms, validation, dialogs, data fetching |
| `src/lib/server/` | SQLite, authentication, permissions, mail, media, API behavior |
| `src/lib/assistant-knowledge.ts` | Editable public answers about app features |
| `src/lib/guide-assistant.ts` | Rule-based help matching and limited follow-up handling |
| `src/lib/content.ts` | Troubleshooting guides and default learning resources |
| `public/` | Bundled public images and favicon |
| `tests/`, `scripts/` | Verification, admin creation, builds, and migration tools |

Stack: Next.js 16, React 19, TypeScript, Node SQLite, Radix Dialog, Phosphor icons, Sharp, and Nodemailer. Keep `package-lock.json` to preserve dependency versions. Installed Next.js documentation is available under `node_modules/next/dist/docs/`. Next.js may generate optional agent instruction files when run through an AI coding tool; none are required or included in this handoff.

The built-in assistant uses prepared project content, without an external model or chat endpoint. Update its knowledge and matching rules when features change. Its conversation stays in browser memory and clears on refresh, account changes, or Clear chat. It does not inspect accounts or perform actions for users.

Questions support one optional photo. The client resizes it; the server independently validates and re-encodes it. Unpublished photos are visible only to the author and staff; approved photos are public. Live camera requires HTTPS or localhost, device support, and browser permission. Camera tracks stop on capture, cancel, and closing the form. Browser automation uses a simulated camera; test real phones and webcams separately.

## Verification

```powershell
npm.cmd test
npm.cmd run build
npm.cmd run typecheck
npm.cmd run test:browser
```

The build generates `.next-production/`, separately from the development server's `.next/`. Type checking is best run after the first build/dev startup, which generates Next.js types. Server tests use temporary databases. Browser tests require locally installed Microsoft Edge and an available port 3001; they start an isolated server with synthetic accounts and data. Screenshots/reports go into ignored `artifacts/`.

Optional scripts: `browser-check.mjs`, `chatbot-check.mjs`, and `navigation-check.mjs` under `scripts/` check the running local preview. `production-check.mjs` checks a compiled build using an isolated local instance.

## Configuration and deployment

Use `.env.example` as the variable reference and supply credentials owned by the receiving team:

- Real verification/recovery email needs `TECHCARE_SMTP_HOST`, `TECHCARE_SMTP_PORT`, `TECHCARE_SMTP_FROM`, and the provider's authentication settings. STARTTLS is required. No mail provider credentials are included.
- Direct video uploads require an installed FFprobe executable configured through `TECHCARE_FFPROBE`. Without it, use external HTTPS video links.
- Production requires `TECHCARE_DEV_VERIFY=0`, an approved HTTPS `TECHCARE_ORIGIN`, and `TECHCARE_SECURE_COOKIES=1`. Run `npm run build`, then `npm start` behind an appropriately configured HTTPS reverse proxy. The app binds to loopback.
- Use a persistent, protected `TECHCARE_DATA_DIR`. SQLite is intended for the single-node pilot; plan a managed database migration before multiple workers or horizontal scaling.
- Before public operation, approve branding/affiliation and booth information, name moderation/privacy owners, establish retention and deletion processes, configure rate limits at the trusted edge, review media permissions/accessibility, and test SMTP, HTTPS, devices, security, backup/restore, and operational monitoring.

The planned booth date, venue, and hours are not a confirmed service commitment. There is no appointment booking, payment processing, general AI service, or self-service account deletion workflow.

## Data migration and backups

No original data is bundled. Normal startup creates a new versioned database. Existing Next.js pilot databases are upgraded transactionally; schema version 2 adds moderated question photos while preserving existing posts and media. Back up the complete stopped data directory before upgrading or transferring real data.

The optional legacy Python migration tool requires a stopped source, a **new destination**, and an explicit verification trust decision:

```powershell
node scripts/migrate-legacy.mjs --source "PATH_TO_OLD_DATA" --dest "NEW_DATA_DIRECTORY" --verification reset --source-stopped
```

`reset` requires accounts to verify again; `preserve` keeps their verification status only when the source is trusted. The tool copies instead of modifying the source, preserves IDs/password compatibility, revokes sessions, and converts supported media. Review its report, data counts, permissions, and sample workflows before changing `TECHCARE_DATA_DIR`. A failed migration can leave a `.migrating-*` directory containing private data; inspect before cleanup. Retain a restricted backup and test restoration in a new directory. Rolling back after new writes requires reconciling those writes.

## Common issues

- **Mutation rejected:** check that the browser origin exactly matches `TECHCARE_ORIGIN`.
- **Registration/email fails:** use local demo mode on loopback or configure approved SMTP for real delivery.
- **Admin creation fails:** use a unique email and a valid name/password; enter the password directly in the terminal.
- **Camera unavailable:** allow permission, use HTTPS/localhost, close other camera apps, or use Upload photo/device picker.
- **Video refused:** configure FFprobe and observe upload limits.
- **Port in use:** stop the other instance or choose a port and update the configured origin.

Only this README is included as Markdown documentation. All application code and test scripts remain available for the next team to continue development.
