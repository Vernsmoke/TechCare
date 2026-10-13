# Migration and rollback

## Existing Next.js pilot databases

On the next app startup, schema migration 2 adds an optional `posts.photo` field and expands the media access classification to include moderated question photos. It runs transactionally, preserving existing post IDs, content, users, and media rows. Existing posts remain photo-free. As with any schema update, back up the complete stopped data directory before deploying to another instance. Unversioned Python databases still require the explicit copy migration below.

No real source database has been moved, changed, or adopted. The new preview uses its own ignored `data/` directory. An unversioned legacy database is refused by application startup rather than silently inheriting trust decisions.

## Legacy migration

1. Stop the source application. Make an operator backup of its database **and media**, with restricted access. Database snapshotting alone cannot make concurrent media changes consistent.
2. Pick a new, nonexistent destination directory. Do not point this at the active preview database.
3. Explicitly choose the verification policy. `preserve` carries recorded `verified` values forward only when that column exists; `reset` marks every account unverified and creates expired challenges that can be resumed through Verify a pending account and Send a new code. The latter includes administrators, who will need approved email delivery to reverify.
4. Run the migration:

```powershell
node scripts/migrate-legacy.mjs --source 'C:\path\old-data' --dest 'C:\path\new-data' --verification reset --source-stopped
```

The helper uses SQLite's backup API to create a copy, preserves IDs/content/password hashes, merges inverse friendship duplicates into one logical pair (accepted if either pair was accepted), applies supporting tables/indexes, revokes old sessions, and validates/re-encodes referenced images into authorized media storage. No live database is deleted. Referenced legacy videos require `TECHCARE_FFPROBE`; malformed legacy media causes migration to stop rather than accepting the old signature-only validation.

The output directory is published only after the migration finishes and a count report is written. A failed migration leaves a clearly named `.migrating-<uuid>` sibling for operator inspection; it must not be used as application data and may contain private data. Remove it only after checking the path and deciding no recovery information is needed.

5. Inspect `migration-report.json`, foreign keys, account counts, content, and relationships. Use synthetic staging checks before adopting any real database. The new schema adds checks for fresh tables; legacy table constraints are not rebuilt wholesale, so direct operator writes still require care.
6. Set `TECHCARE_DATA_DIR` to the new directory, configure mail, restart, and rerun acceptance checks with approved test identities. Keep the old app and its source data intact for rollback.

## Backup, restore, and rollback

For the pilot, stop the app before taking a consistent copy of its complete data directory. For a live database snapshot, use the supported SQLite backup API and coordinate media quiescence; do not blindly copy an active SQLite file without its transactional state. Encrypt/restrict backups and maintain a separate copy under the eventual service owner's approved retention policy.

Restore into a new directory, not over active data. Point a restricted test instance at it and verify sign-in, profiles, protected media, relationships, discussion publication, and message permissions. No live restore has been demonstrated in this task. Synthetic migration tests demonstrate that the original source remains byte-for-byte unchanged and that stable IDs, password compatibility, media classification, content, and logical relationships survive a copy migration.

Rollback before cutover is simply continuing to use the unchanged original. After new writes, rollback requires reconciliation of those writes; switching back to the old snapshot without reconciliation would lose them. Keep both copies and document the cutover timestamp. Never casually roll back to the legacy server on a public network because its known privacy/security gaps remain.

## SQLite pilot to MySQL

Application runtime uses MySQL-compatible databases only. Production requires MySQL 8.0.16 or later through `mysql2/promise`; MariaDB is supported for local development. SQLite remains only as the read-only source format for this one-time importer and for isolated automated tests. A fresh database has no sample resources, guides, booths, or announcements; settings and static UI fallbacks provide any display defaults. The import preserves explicitly existing rows from the source, including user/content IDs and relationships. It does not alter the SQLite source. Take a restricted offline copy first and keep it until the new database is verified.

1. Stop the source TechCare process so the SQLite database and media cannot change during export. Existing sessions are revoked during cutover because pre-JWT pilot sessions cannot be safely distinguished from JWT sessions; all users must sign in again.
2. Provision an empty MySQL-compatible application database and least-privilege account (production requires MySQL 8.0.16+). Apply the complete current schema:

   ```powershell
   Get-Content backend/schema/mysql.sql | mysql --default-character-set=utf8mb4 -h $env:TECHCARE_DB_HOST -P $env:TECHCARE_DB_PORT -u $env:TECHCARE_DB_USER -p $env:TECHCARE_DB_NAME
   ```

   Set `TECHCARE_DB_DRIVER=mysql`, `TECHCARE_DB_HOST`, `TECHCARE_DB_PORT`, `TECHCARE_DB_NAME`, `TECHCARE_DB_USER`, and `TECHCARE_DB_PASSWORD` in the protected environment before running either command. Configure all `TECHCARE_B2_*` values when migrating media to B2. For a local cutover without B2, existing media files stay in `data/media`; the importer verifies those files and does not overwrite them.

3. Set `TECHCARE_DATA_DIR` to the source SQLite data directory. If the database file is not `techcare.sqlite3` inside it, set `TECHCARE_SQLITE_FILE` to the exact file. First run a read-only dry run:

   ```powershell
   node scripts/migrate-sqlite-to-mysql.mjs
   ```

   Inspect the listed table counts and correct any schema, media, credential, or storage issue before applying. The MySQL schema must already be applied and all application tables must be empty; the importer refuses to merge or overwrite target data.

4. Apply the one-time import:

   ```powershell
   node scripts/migrate-sqlite-to-mysql.mjs --apply
   ```

   The importer copies explicit identities and writable columns in foreign-key order inside one MySQL transaction, excluding revocable sessions. It verifies each inserted batch against the source values and counts, rolls back database writes on any mismatch/error, and cleans up media objects it created if the import fails. It refuses to run against a populated application schema; do not run it a second time.

5. Before public traffic, verify account sign-in/password reset, consent, profile visibility, public and protected media, content/moderation, discussion votes, friendship/message access, and the source/target counts with synthetic staging identities. Set `NODE_ENV=production`, the approved HTTPS/cookie settings, JWT secret, MySQL settings, and object-storage settings; `npm start` fails fast if MySQL config is incomplete.
6. Keep the original SQLite snapshot untouched until the new service has passed the approved observation period and backup/restore checks. Before any production writes, rollback is a return to the unchanged source deployment. After writes begin, switching back without reconciling the new MySQL writes will lose them; document the cutover timestamp and reconcile before any rollback. Retain and secure both systems according to the approved retention policy.
