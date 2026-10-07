# Operations and remaining release work

This build is a runnable local pilot. A successful production compile is not public launch approval. The October 16, 2026 date remains a plan; venue, hours, branding, and service scope remain subject to College approval.

## Local configuration

`.env.local` is ignored. `.env.example` contains only names and harmless local defaults. Bind the pilot to `127.0.0.1`. Classroom verification is enabled only in the local example and is refused by production startup. No credentials were installed for real email.

For real mail set `TECHCARE_SMTP_HOST`, `TECHCARE_SMTP_PORT` (587 default), `TECHCARE_SMTP_FROM`, and optional user/password. STARTTLS is required. SMTP configuration and delivery failure are covered with a fake transport in tests; no real provider or mailbox was contacted. Monitor delivery failures without logging codes, credentials, message bodies, or tokens.

`TECHCARE_FFPROBE` must point to an operator-installed maintained FFprobe executable to accept MP4/WebM uploads. It is not configured in the supplied local preview. Direct HTTPS video links and decoded image uploads work. Caption/transcript suitability and media licensing remain staff review duties; the app does not claim automated accessibility or license verification.

## Production process

`npm run build` produces the Next server build. `npm start` checks that classroom mode is off, an HTTPS origin is set, secure cookies are enabled, the production MySQL connection settings are complete, and private object storage is configured before binding Next to loopback behind an approved edge. These checks must also be respected by service managers; bypassing the wrapper is not the deployment procedure. The API independently refuses production classroom mode. Production never falls back to SQLite.

Create the MySQL 8.0.16+ database and grant the application account only the required database privileges. Apply `backend/schema/mysql.sql` to that selected database before deploying the app. Configure `TECHCARE_DB_HOST`, `TECHCARE_DB_PORT` (3306 default), `TECHCARE_DB_NAME`, `TECHCARE_DB_USER`, `TECHCARE_DB_PASSWORD`, and `TECHCARE_DB_SSL=1` (required for production). `TECHCARE_DB_POOL_SIZE` (10 default, 1–100) and `TECHCARE_DB_CONNECT_TIMEOUT_MS` (10,000 default) tune the pool. TLS certificate verification is enabled by default.

Create a private Backblaze B2 bucket and a least-privilege application key for that bucket. Set `TECHCARE_B2_BUCKET`, `TECHCARE_B2_ENDPOINT` (HTTPS S3-compatible endpoint), `TECHCARE_B2_REGION`, `TECHCARE_B2_KEY_ID`, and `TECHCARE_B2_APPLICATION_KEY`. Set `TECHCARE_JWT_SECRET` to a randomly generated secret of at least 32 bytes and keep it stable across application instances and restarts so issued tokens remain verifiable. Keep all environment files and credentials out of source control. The DB service must provide durable backups, retention, monitoring, and recovery separately from the application process.

Production startup also requires `TECHCARE_SMTP_HOST` and `TECHCARE_SMTP_FROM` so account verification and recovery mail can be delivered. Configure `TECHCARE_SMTP_PORT` (587 by default) and both SMTP user/password values when the provider requires authentication. SMTP uses STARTTLS.

For an existing SQLite pilot, follow the one-time export, dry-run, cutover, and rollback procedure in [Migration and rollback](MIGRATION.md). Do not run the importer against a non-empty MySQL application database.

The HTTPS edge must enforce approved hosts, reject or replace client-supplied forwarding headers, restrict application access, enforce request-size and connection limits, and own certificate renewal/HSTS policy. Set `TECHCARE_ORIGIN` to the exact approved public origin and `TECHCARE_SECURE_COOKIES=1`. No edge, domain, DNS, certificate, monitoring account, or server has been provisioned here.

## Required before public operation

- Approved audience, affiliation policy, domain, logo/visual identity, booth date/venue/hours, and launch authorization.
- Named project, moderation, IT, and privacy owners with coverage and escalation contacts.
- Approved privacy notice; retention/deletion/anonymization rules; message-history/report handling; blocking, appeals, and incident procedures.
- An IT-managed durable MySQL service with tested backup/restore, least-privilege access, monitoring, and connection-pool capacity appropriate for the deployment.
- A trusted-edge per-source rate-limit policy, load targets, capacity testing, and tuning. Current aggregate/per-account limits are single-node pilot defaults.
- Storage monitoring and reviewed cleanup for replaced/orphaned assets, report retention, and data lifecycle. Quotas alone are not a complete operational policy.
- Validated video processing, caption/transcript workflow, media licensing checks, and resource processing isolation appropriate to the final audience.
- Staging with real SMTP, HTTPS/proxy negative tests, security review, cross-browser and assistive-technology testing, and end-to-end device testing.
- Backup/restore and rollback drills with responsible owners, recovery-point/time targets, and encrypted restricted backups. Synthetic migration checks do not substitute for a live restore drill.
- Final academic deliverables and updated recorded demo if required. The original DOCX/video were not regenerated and should not be represented as this build.

## Troubleshooting

| Symptom                                 | Check                                                                                                         |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Mutation rejected after opening the app | Use the same origin as `TECHCARE_ORIGIN`, normally `http://127.0.0.1:3000`; do not alternate with `localhost` |
| Registration fails in real-mail mode    | SMTP host/from, STARTTLS, sender approval, credentials, outbound delivery access                              |
| Verification code unavailable           | In local demo mode, use loopback; otherwise check email and the 60-second resend cooldown                     |
| Video upload refused                    | Configure FFprobe; check 20 MB, 4K, and 30-minute bounds; use a specific HTTPS video link if unavailable      |
| Private avatar denied                   | Expected for non-friends, blocked users, or old replaced URLs; it must not be made public to fix this         |
| Stale moderation decision               | Refresh the queue; another moderator may already have decided                                                 |
| Startup sees legacy data                | Use the copy migration procedure and explicitly select the verification policy                                |
| Test cleanup blocked on Windows         | Ensure the test instance has exited and all SQLite connections are closed; never remove active user data      |
