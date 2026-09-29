# Build acceptance report

> Historical report for the SQLite-based build on 2026-09-25. It does not
> validate the later MySQL backend conversion or its import schema.

Executed 2026-09-25 in the new TechCare workspace on Windows, Node.js 24.19.0, Next.js 16.3.6, React 19.3.0. Tests at that time used synthetic identities and isolated temporary SQLite databases.

## Results

| Check                                 | Actual result                                                                                                                                                                                                                  |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Original Python `test_system.py`      | All 22 scenario assertions passed; cleanup then failed with Windows `WinError 32` on an open temporary SQLite file. This is not a clean test-process pass. Source was not changed.                                             |
| Original `node --check static/app.js` | Passed                                                                                                                                                                                                                         |
| `npm test`                            | 30 tests passed, 0 failed (26 API scenarios, 3 migration tests, and the parent test)                                                                                                                                           |
| `npm run typecheck`                   | Passed                                                                                                                                                                                                                         |
| `npm run build`                       | Passed, optimized production build. Build output is isolated in `.next-production` to avoid Windows locks from the running preview.                                                                                            |
| `npm run test:browser`                | 17 end-to-end workflow checks passed, no browser JavaScript errors                                                                                                                                                             |
| Authenticated accessibility scans     | No axe WCAG 2 A/AA and 2.1 AA rule violations across Home, Guides, Media, Discussion, Members, Booth, Lost & Found, Feedback, Profile, Privacy, Moderator, and Admin                                                           |
| Preview browser check                 | Desktop 1440×1050 and mobile 390×844; no JavaScript errors, no horizontal overflow, no detected accessibility rule violations on Home and registration dialog                                                                  |
| Keyboard                              | Dialog focus containment, Escape dismissal, focus return, and mobile navigation checked                                                                                                                                        |
| `node scripts/production-check.mjs`   | Compiled app served successfully on isolated loopback instance; unique HTML nonces, strict script CSP, no production eval/inline-script allowance, DENY framing, old media route 404, classroom mode absent; no browser errors |
| `npm audit --omit=dev`                | 0 reported vulnerabilities at time of check                                                                                                                                                                                    |

Screenshots and detailed machine-readable reports are in ignored `artifacts/`: `home-desktop.png`, `home-mobile.png`, `register-dialog.png`, `thread-mobile.png`, `browser-check.json`, `workflow-check.json`, and `production-check.json`. Failed intermediate runs were corrected and rerun; `workflow-failure.log`, if present, describes an earlier run rather than the final outcome.

## End-to-end browser coverage

1. Create Account → six-digit verification → separate Sign In → Dashboard.
2. Edit profile and set private visibility.
3. Submit a question through its modal and see pending status.
4. Administrator performs atomic Approve & Answer.
5. Member reads the staff answer and submits a reply for review.
6. Friend request → recipient acceptance → private message.
7. Recipient reports a specific message.
8. Submit Lost & Found report.
9. Submit private feedback and clear the form.
10. Staff review reply, item report, feedback, and reported-message evidence.
11. Publish a credited HTTPS learning resource.
12. Assign/remove moderator role.
13. Upload validated homepage illustration.
14. Keyboard focus containment and restoration.
15. Mobile navigation and discussion dialog without overflow.
16. Sign out and verify that private screens require authentication.
17. An unsent message survives a background friendship-access check.

## API/security coverage

Includes strict/expired/leading-zero verification, five-attempt lockout, resend cooldown and code replacement; missing/failing SMTP account rollback and successful fake SMTP delivery without leaking codes; cookie/session/logout/expiry; direct guest/member authorization; same-origin/custom-header checks; overlong/malformed/oversized input; atomic moderation rollback and concurrent retry; publication filtering and parent checks; private feedback and anonymous public item reports; independent follows; inverse-pair friendship uniqueness; private profile serialization and saved media authorization; message participant/friendship checks, report scope, unfriend/block revocation; admin continuity and immediate demotion; safe HTTPS links; valid decoded versus malformed/oversized images; video fail-closed behavior; single-use/expired password reset and session revocation; throttling and pagination.

Synthetic migration tests prove source-file preservation, stable record IDs, password compatibility, relationships/content retention, accepted inverse-pair consolidation, private media conversion, session revocation, explicit verification policy, resumable reset verification, and no overwrite of a destination. No real user database was migrated.

## Limits of this evidence

- These checks are not a formal accessibility certification or exhaustive security audit. No screen-reader session, physical mobile device, Safari/Firefox, production load test, or public HTTPS edge was tested.
- Real SMTP, external video availability/licensing, FFprobe acceptance of real MP4/WebM uploads, caption tracks, and infrastructure remain unverified/unconfigured.
- No production deployment, live restore drill, official privacy review, launch authorization, or academic DOCX/video regeneration was performed.
- Rate-limit values and storage quotas are pilot defaults. Full retention/deletion tooling, media orphan cleanup, report resolution procedures, and scaled persistence remain release work.
- Development preview is loopback-only and intentionally uses classroom codes. The production check used a separate loopback-only instance solely to verify the compiled build; it is not the approved HTTPS deployment.

See [operations](OPERATIONS.md) for the remaining release gates and [migration](MIGRATION.md) for cutover/rollback constraints.
