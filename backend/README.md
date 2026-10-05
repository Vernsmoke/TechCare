# Backend

Server code is grouped by responsibility under `src/`:

- `config/db.mjs`: SQLite connection, schema, and migrations.
- `controllers/api.mjs`: request handling and endpoint dispatch.
- `middleware/auth.mjs`: authentication, authorization, and abuse controls.
- `services/`: discussion, content, announcements, media, and email logic.
- `validations/validation.mjs`: input validation.

Next.js hosts this backend through `frontend/src/app/api/[...path]/route.ts`.
Run commands from the repository root; there is no separate Express server.
Persistent data and protected uploads remain in root `data/` (or `TECHCARE_DATA_DIR`).
Only server components and route handlers may import backend modules.
