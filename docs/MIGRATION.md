# Database setup and migration

## New MySQL installation

1. Install and start MySQL Server 8.0.16 or later.
2. Import [`database.sql`](../database.sql) using MySQL Workbench. It creates
   the `techcare` database, all application tables/indexes, and starter
   resources, guides, and booth content.
3. Set `TECHCARE_DB_HOST`, `TECHCARE_DB_PORT`, `TECHCARE_DB_NAME`,
   `TECHCARE_DB_USER`, and `TECHCARE_DB_PASSWORD` in `.env.local`.
4. Create the administrator with `npm run create-admin`.
5. Start the app and verify the configured SMTP/local verification mode.

The schema script uses `CREATE TABLE IF NOT EXISTS`; it is for initialization,
not an upgrade mechanism. Add future schema changes to a versioned migration
script before applying them to an already-used database.

## Google OAuth accounts

New installations receive the `oauth_accounts` table from `database.sql`.
For an existing MySQL installation, execute
[`database/migrations/001-oauth-accounts.sql`](../database/migrations/001-oauth-accounts.sql)
against the application's database before enabling Google sign-in.

Configure `TECHCARE_GOOGLE_CLIENT_ID`, `TECHCARE_GOOGLE_CLIENT_SECRET`, and
`TECHCARE_GOOGLE_REDIRECT_URI` on the server. Register the exact redirect URI
in the Google Cloud OAuth client configuration. Use HTTPS in production; HTTP
is allowed only for localhost development. Existing TechCare accounts are not
automatically linked to Google accounts with the same email.

## Existing SQLite pilot data

The application has switched to MySQL. Importing `database.sql` creates a clean
database and does **not** copy account records, messages, content edits, media
metadata, or uploads from the previous SQLite pilot. Keep the previous SQLite
database and media folder backed up until you decide how to handle that data.
Do not point the MySQL application at an existing SQLite data directory.

No automatic SQLite-to-MySQL migration tool is included in this change.
Transferring real accounts or user-generated content requires a separately
reviewed migration plan, including verification status, password compatibility,
foreign-key ordering, file paths, and media access/privacy checks.

## Backups

Back up MySQL with a supported MySQL dump or managed database snapshot and
include the separate media directory configured by `TECHCARE_MEDIA_DIR`.
Restrict and encrypt backups. Test restores into a separate database and media
directory before relying on them. Never restore over an active database.
