# Development team handoff

## Get started

Install Node.js 24 or later. Clone this repository or download its ZIP and extract it. Run commands from the root folder containing `frontend/`, `backend/`, and `package.json`:

```powershell
npm ci
Copy-Item .env.example .env.local
npm run create-admin
npm run dev
```

Create `.env.local` only on first setup; keep any existing local configuration. Open http://127.0.0.1:3000, accept both agreements, and sign in with your new administrator account. Each developer has a separate local database and administrator account. No shared passwords are provided.

## Where to work

- `frontend/src/app/`: Next.js routes, layouts, and API transport.
- `frontend/src/components/`: common, layout, UI, and feature components.
- `frontend/src/assets/styles/`: stylesheets.
- `frontend/src/services/`, `hooks/`, `context/`, `utils/`: browser API calls, data hooks, shared state, and helpers.
- `backend/src/`: configuration/database, request controllers, authorization, services, and validation.
- `shared/src/`: browser-safe types, defaults, consent version, and image metadata.
- `frontend/public/`: runtime images and favicon.
- `tests/` and `scripts/`: tests, startup, builds, admin creation, and migration utilities.

Next.js hosts both the frontend and backend. There is no separate backend process. Install dependencies once at the root; the root manifest and lockfile own them. The frontend configuration loads the root `.env.local`, and relative data paths resolve from the root. No coding-agent tools, skills, or accounts are required.

## Verify changes

```powershell
npm test
npm run build
npm run typecheck
npm run test:production
```

The production browser check requires Microsoft Edge installed and port 3002 free. It creates a temporary test database and verifies the agreement flow, reload, navigation, public images, and browser errors. Build output is generated under `frontend/.next-production/`. Development uses Webpack for compatibility with this project's OneDrive-based Windows setup.

Additional feature/browser scripts are available in `scripts/`. Some older scripts assume acceptance is remembered in the interface; the current interface asks again on every full load, so those scripts may need agreement steps before they can verify their feature.

## Local files and deployment

Git excludes `.env.local`, `data/` databases/uploads, dependencies, build output, test artifacts, coding-agent setup, old project exports, and image-generation originals. Required public images remain included. Repository downloads start with fresh data; any transfer of real records or private uploads must be arranged separately.

The example environment is a local classroom configuration with demonstration verification codes. Before deployment, configure SMTP, an HTTPS origin, secure cookies, and disable classroom verification. `npm start` enforces these production settings. Uploaded video validation needs FFprobe configured with `TECHCARE_FFPROBE`; HTTPS video links can be used without it. See [operations](OPERATIONS.md), [migration](MIGRATION.md), and [implementation](IMPLEMENTATION.md) for details.

For ongoing contributions, request collaborator access from the repository owner and work on a branch before opening a pull request. Repository visibility and collaborator permissions are managed on GitHub.
