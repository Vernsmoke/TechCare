# Server backend map

The API code is kept under `src/app/api/` so endpoint behavior is easy to find.
Shared services live in one flat folder, `src/lib/server/`, to avoid deep
folder trees.

## Where to make changes

| File/folder                          | Responsibility                                                                                                                                     | Change it when you need to...                                                                    |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `src/app/api/[...path]/route.ts`     | Next.js route entry; forwards GET and POST to the handler.                                                                                         | Change supported HTTP methods or runtime settings.                                               |
| `src/app/api/handlers.mjs`           | API request checks, endpoint mapping, GET/POST behavior, and responses. Sections are labeled by account, community, content, and staff operations. | Add or change an endpoint, request/response behavior, or endpoint authorization.                 |
| `src/lib/server/db.mjs`              | MySQL pool, query helpers, transactions, and media directory.                                                                                      | Change database connection or persistence behavior.                                              |
| `src/lib/server/auth.mjs`            | Sessions, passwords, roles, privacy, relationships, and throttling.                                                                                | Change shared authentication/access rules.                                                       |
| `src/lib/server/validation.mjs`      | Reusable request input rules.                                                                                                                      | Add or change a validator.                                                                       |
| `src/lib/server/media.mjs`           | Upload validation, processing, storage, and access checks.                                                                                         | Change media limits or replace local disk storage.                                               |
| `src/lib/server/mail.mjs`            | SMTP email delivery.                                                                                                                               | Configure or replace the email provider.                                                         |
| `src/lib/server/announcements.mjs`   | Announcement publishing workflow.                                                                                                                  | Change announcement behavior.                                                                    |
| `src/lib/server/managed-content.mjs` | Guide, resource, and booth publishing workflows.                                                                                                   | Change managed-content behavior.                                                                 |
| `src/lib/server/discussion.mjs`      | Discussion vote operations.                                                                                                                        | Change discussion voting behavior.                                                               |
| `database.sql`                       | Initial MySQL schema and starter content.                                                                                                          | Change schema for a fresh database. Use a separate versioned migration for an existing database. |

## Common changes

- **Production configuration:** Set database, media directory, SMTP, app
  origin, secure-cookie, Google OAuth, and FFprobe environment variables in `.env.local`.
  `.env.example` lists the supported variables. Code has `CHANGE FOR YOUR
DEPLOYMENT` comments at the settings that need deployment-specific setup.
- **Google sign-in:** Create a Google OAuth 2.0 Web application client and
  register the exact `TECHCARE_GOOGLE_REDIRECT_URI` as an authorized redirect
  URI. Set the client ID, client secret, and redirect URI in the server
  environment. Only Google-verified email addresses can create an account.
- **Business limits:** Upload/storage limits are constants in `media.mjs`.
  API body/rate limits, staff roles, and page-size behavior are marked in
  `handlers.mjs`. If changing page size, also update the matching SQL
  `LIMIT N+1` query.
- **Endpoint behavior:** Add a path branch in `get()` or `post()` in
  `handlers.mjs`. Authenticate and authorize writes server-side, validate
  inputs, and use a transaction for related database changes.
- **Reusable behavior:** If a rule or workflow is used by multiple endpoints
  or grows beyond straightforward request handling, put it in the matching
  helper in `src/lib/server/`.
- **Schema:** Update `database.sql` for new installations and add a versioned
  migration for deployed databases. `database.sql` initializes a fresh
  database; it is not an upgrade mechanism.
- **Tests:** Update or add tests under `tests/`. Integration tests provision
  a temporary MySQL database.

## Request flow

1. `src/app/api/[...path]/route.ts` forwards GET and POST to
   `handle()` in `src/app/api/handlers.mjs`. The Node.js runtime is required
   for MySQL, filesystem, and Node-library access.
2. `handle()` applies request checks and resolves the current user, then
   dispatches to `get()` or `post()`.
3. Endpoint code validates input and authorization, then calls shared helpers
   from `src/lib/server/` as needed.
4. Database calls are asynchronous. Await every query, including every query
   inside an async `transaction()` callback.

## Production reminders

- Use a dedicated least-privilege MySQL account, not `root`.
- Set `TECHCARE_ORIGIN` to the canonical HTTPS origin and
  `TECHCARE_SECURE_COOKIES=1` when serving over HTTPS.
- Configure an approved SMTP provider and keep `TECHCARE_DEV_VERIFY` disabled
  in production.
- OAuth identities are stored by Google subject in `oauth_accounts`. Existing
  accounts with the same email are deliberately not linked automatically.
  Apply `database/migrations/001-oauth-accounts.sql` to an existing MySQL
  database; fresh databases get the table from `database.sql`.
- Local media is suitable only for a single instance with persistent storage.
  Use shared object storage before scaling to multiple instances.
- Importing `database.sql` does not migrate the former SQLite pilot's users,
  content, media metadata, or uploaded files.
- Review [operations guidance](./OPERATIONS.md) before public deployment or
  storing real users' data.
