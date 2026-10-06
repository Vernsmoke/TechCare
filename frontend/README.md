# Frontend

- `public/`: public images and favicon, served at their existing URLs.
- `src/app/`: Next.js App Router pages, layouts, and the API route adapter.
- `src/assets/styles/`: global styles and feature stylesheets.
- `src/components/common/`: reusable content and image components.
- `src/components/ui/`: reusable UI controls.
- `src/components/layout/`: application shell, navigation, and consent gate.
- `src/components/features/`: feature-specific screens and editors.
- `src/context/`: shared session and application context.
- `src/hooks/`: reusable data-fetching hooks.
- `src/services/`: API requests and upload progress handling.
- `src/utils/`: browser-safe content and assistant helpers.
- `src/proxy.ts`: Next.js request proxy.

Run `npm ci`, `npm run setup`, `npm run dev`, and all checks from the repository root. Setup creates the root `.env.local` without overwriting existing settings. Open the exact address printed by the startup check.
Dependencies and the lockfile are managed there. Root `.env.local` is loaded
by `next.config.mjs`; existing data stays in root `data/`.
Use `@/` for frontend imports, `@shared/` for shared contracts, and
`@backend/` only in server-side code.
