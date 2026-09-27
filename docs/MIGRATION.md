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
