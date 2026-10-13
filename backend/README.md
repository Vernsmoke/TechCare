# Backend

Server code is grouped by responsibility under `src/`:

- `config/db.mjs`: asynchronous MySQL pool for production and the compatible SQLite adapter for local/test.
- `controllers/api.mjs`: request handling and endpoint dispatch.
- `middleware/auth.mjs`: authentication, authorization, and abuse controls.
- `services/`: discussion, content, announcements, media, and email logic.
- `validations/validation.mjs`: input validation.

Next.js hosts this backend through `frontend/src/app/api/[...path]/route.ts`.
Run commands from the repository root; there is no separate Express server.
Local/test data and protected uploads remain in root `data/` (or `TECHCARE_DATA_DIR`). Production uses MySQL configured with `TECHCARE_DB_*` and private object storage; apply the current schema in `schema/mysql.sql` before startup. A fresh MySQL content catalog starts empty; SQLite pilot migration copies only rows already present at the source.
Only server components and route handlers may import backend modules.
