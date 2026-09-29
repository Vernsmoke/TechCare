# Operations and remaining release work

This build is a runnable local pilot. A successful production compile is not public launch approval. The October 16, 2026 date remains a plan; venue, hours, branding, and service scope remain subject to College approval.

## Local configuration

`.env.local` is ignored. `.env.example` contains only names and harmless local defaults. Bind the pilot to `127.0.0.1`. Classroom verification is enabled only in the local example and is refused by production startup. No credentials were installed for real email.

For real mail set `TECHCARE_SMTP_HOST`, `TECHCARE_SMTP_PORT` (587 default), `TECHCARE_SMTP_FROM`, and optional user/password. STARTTLS is required. SMTP configuration and delivery failure are covered with a fake transport in tests; no real provider or mailbox was contacted. Monitor delivery failures without logging codes, credentials, message bodies, or tokens.

`TECHCARE_FFPROBE` must point to an operator-installed maintained FFprobe executable to accept MP4/WebM uploads. It is not configured in the supplied local preview. Direct HTTPS video links and decoded image uploads work. Caption/transcript suitability and media licensing remain staff review duties; the app does not claim automated accessibility or license verification.

## Production process

`npm run build` produces the Next server build. `npm start` checks that classroom mode is off, an HTTPS origin is set, and secure cookies are enabled before binding Next to loopback behind an approved edge. These checks must also be respected by service managers; bypassing the wrapper is not the deployment procedure. The API independently refuses production classroom mode.

The HTTPS edge must enforce approved hosts, reject or replace client-supplied forwarding headers, restrict application access, enforce request-size and connection limits, and own certificate renewal/HSTS policy. Set `TECHCARE_ORIGIN` to the exact approved public origin and `TECHCARE_SECURE_COOKIES=1`. No edge, domain, DNS, certificate, monitoring account, or server has been provisioned here.

## Required before public operation

- Approved audience, affiliation policy, domain, logo/visual identity, booth date/venue/hours, and launch authorization.
- Named project, moderation, IT, and privacy owners with coverage and escalation contacts.
- Approved privacy notice; retention/deletion/anonymization rules; message-history/report handling; blocking, appeals, and incident procedures.
- A supported durable storage/deployment plan. Review MySQL backup, failover, access control, and capacity before public use or horizontal scaling. Uploaded media also needs a durable shared storage plan.
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
| Database connection fails               | Confirm MySQL is running, `TECHCARE_DB_*` matches the server, and `database.sql` was imported                 |
| Media upload is unavailable             | Confirm `TECHCARE_MEDIA_DIR` exists and the app process can write to it                                       |
