# TechCare — Product and Implementation Specification

## Priority instructions from the project owner

> Whatever action you can do yourself, Please do yourself, this includes starting apps and verification.

Codex should carry out authorized work end to end, including starting the application, opening previews, running checks, and verifying the resulting behavior whenever its tools and access allow. Do not hand routine steps back to the user when you can complete them yourself. Ask for user input only when genuinely needed for missing access, a material unresolved decision, or required approval. Report what was actually verified and any remaining blocker honestly.

**Required framework: Next.js.** The user will be using Next.js for TechCare. Treat Next.js as the target application framework, preserving the features, workflows, permissions, and privacy requirements in this specification. The Python/vanilla JavaScript implementation described below is the existing reference baseline, not the selected framework for the new implementation. Whether to migrate all backend functionality into Next.js or retain a separate backend is an architectural decision to document; do not assume the framework choice authorizes discarding existing behavior or data.

Version: 1.1  
Prepared: 2026-09-25  
Purpose: persistent project context and implementation instructions for future Codex tasks.

## 1. Authority, evidence, and how to use this document

This document defines the intended TechCare product, preserves the working prototype's behavior, and records improvements required to make it suitable for community use. It is a specification, not a claim that every requirement is already implemented.

Evidence used:

- The full prior **Review Folder Files** conversation, ID `6ab66243-564c-83ec-a72e-967f384d43af`, covering the uploaded `TechCare.zip`, source, documentation, assets, tests, and demo video.
- Read-only inspection of the local project at `C:\1 Sir mund\TechCare\Project_TechCare`, including `server.py`, `static/app.js`, `README.md`, `TECH_STACK_AND_CODE_MAP.md`, and `PRODUCTION_DEPLOYMENT.md`.
- The prior review reports 22 passing integration scenarios and a passing JavaScript syntax check. Those results are historical evidence; tests were not rerun to prepare this specification.
- Video observations and DOCX findings below come from the prior review. The video and DOCX were not independently replayed/rendered for this document. The local source was not proven byte-for-byte identical to the uploaded ZIP.

Status vocabulary:

- **Baseline:** behavior observed in the inspected source or explicitly documented in the reviewed package.
- **Required:** intended improvement or release condition; do not assume it exists.
- **Proposed:** useful extension requiring a scope decision before implementation.
- **Open:** product, policy, or infrastructure detail that has not been established.

Conflict resolution:

1. Follow the user's latest explicit decisions and approved specification changes.
2. Use this specification for intended behavior, including clearly marked Required improvements.
3. Use the latest verified source for exact existing contracts and behavior where this specification is silent. Reinspect source before implementing; this snapshot may become stale.
4. Prefer current Markdown documentation over an older DOCX or demo where source supports it.
5. Treat videos and screenshots as illustrative evidence, not authority to restore obsolete interfaces.

A known defect does not become a requirement merely because it appears in the source. If newer code materially conflicts with intended behavior, record the discrepancy and resolve it explicitly rather than silently changing the product. Keep this document updated with implementation status, decisions, and evidence.

## 2. Product vision and success

TechCare is a campus and community technology-support portal supporting a student community service learning project. It combines safe self-help guidance, moderated technical discussions, supervised booth information, learning media, and community connections. Lost & Found is an additional campus service.

The central experience is:

**Browse guidance → create and verify an account → ask a technical question → moderator reviews and responds → community learns from the published discussion.**

Users should be able to find prior solutions, get reviewed help, understand when to seek supervised assistance, and interact without exposing private information unnecessarily. Moderators need a clear queue and an efficient way to answer questions. Administrators control moderator assignments and approved homepage imagery.

The source advertises an **October 16, 2026** launch. Preserve this as the documented planned date, not a confirmed operational commitment. The College must approve the actual date, venue, hours, service scope, and visual identity before release. The prototype is not an official University website. Do not imply institutional endorsement or use an official logo without authorization.

Success means complete, consistent member/moderator/admin workflows; private data protected at both API and file-delivery layers; usable desktop/mobile screens; synchronized source, documentation, and demo; and an operationally supported deployment appropriate to its audience. Traffic, response-time, and service-response targets remain Open.

## 3. Scope and boundaries

### Included baseline

- Home, troubleshooting guides, Videos & Media, Discussion, Members, Support Booth, Lost & Found, and Feedback.
- Separate registration/sign-in dialogs and six-digit email verification.
- Profile name, bio, avatar, public/private visibility, dashboard, follows, friendships, and direct messages.
- Question and member-reply moderation, immediate staff replies, private feedback review.
- Moderator publication of resource links, images, and videos.
- Administrator role assignment and homepage image replacement.
- Python/SQLite local application and isolated integration tests.

### Required evolution

- Direct **Approve & Answer** moderation workflow.
- Public-release authentication recovery, abuse controls, privacy enforcement, media validation, security headers, auditability, and operational safeguards.
- Consistent documentation/demo and Windows-compatible development utilities.

### Proposed or outside current scope

- Notifications for replies, decisions, and friend requests are Proposed, not implemented.
- Appointment booking, repair ticket tracking, payments, inventory management, automated diagnosis, AI chat, real-time chat infrastructure, and native mobile apps are not established requirements.
- A booth procedure page does not imply a digital device-intake or repair-management module.
- Institutional SSO is conditional on an approved campus-only identity policy; mailbox verification alone does not establish current University affiliation.

## 4. Users, roles, and authorization

Students and community members seek help. Student/faculty moderators review content and contribute support. Administrators manage trusted roles. University IT and the project owner operate and approve the service; they are organizational responsibilities, not additional implemented application roles.

| Capability | Guest | Verified member | Moderator | Administrator |
| --- | --- | --- | --- | --- |
| Browse guides, resources, published discussions/notices | Yes | Yes | Yes | Yes |
| Browse member directory with privacy filtering | Yes | Yes | Yes | Yes |
| Register, verify, sign in | Yes | As applicable | As applicable | Bootstrap/sign in |
| Edit own profile and view own dashboard | No | Yes | Yes | Yes |
| Follow, request friendship, message accepted friends | No | Yes | Yes | Yes |
| Submit questions and Lost & Found reports | No | Pending review | Pending review | Pending review |
| Reply to published questions | No | Pending review | Immediately published | Immediately published |
| Submit feedback | No | Yes | Yes | Yes |
| Review queues and read private feedback | No | No | Yes | Yes |
| Publish resources | No | No | Yes | Yes |
| List accounts with email for role management | No | No | No | Yes |
| Assign/remove moderator role; replace hero | No | No | No | Yes |

All authorization must be enforced server-side on every read and mutation. Hidden buttons are convenience, not protection. Role status must be evaluated from authoritative account state so a demotion takes effect on subsequent requests.

Baseline role rules:

- Registration creates a member, never an administrator or moderator.
- A privileged local `create-admin` command bootstraps an administrator; do not ship shared credentials.
- The web role endpoint accepts `member` or `moderator`, and rejects changing the acting administrator's own role. It does not create administrators.
- The inspected endpoint can change another administrator's role. **Required:** explicitly protect administrator accounts/last-admin continuity and define any administrative demotion procedure; do not present that protection as already implemented.
- Moderator/admin status does not grant blanket access to private messages or override friendship requirements.

## 5. Authentication and email verification

### Baseline workflow

1. Guest selects **Create Account**, separately from **Sign In**.
2. Collect display name, email, and password of at least 12 characters. Normalize email by trimming and lowercasing; enforce uniqueness.
3. Create an unverified member and hashed six-digit code; deliver through configured SMTP.
4. Show **Verify Your Email**, prefill email, accept exactly six digits including leading zeroes, and provide resend.
5. Code expires after 15 minutes. Five incorrect attempts disable that code. Resend is allowed after 60 seconds and replaces the previous code/reset attempt count.
6. Successful verification marks the account verified and removes the verification record. The user then continues to Sign In; verification does not automatically sign them in.
7. Login rejects invalid credentials and unverified accounts. Successful login opens My Dashboard.
8. Logout revokes the active server session and clears its cookie.

Baseline storage uses PBKDF2-HMAC-SHA256 with a random 16-byte salt and 310,000 iterations. Random session tokens are stored only as SHA-256 hashes and expire after seven days. Cookies use `HttpOnly`, `SameSite=Lax`, and `Path=/`; the prototype conditionally sets `Secure` based on `X-Forwarded-Proto`.

SMTP configuration: `TECHCARE_SMTP_HOST`, `TECHCARE_SMTP_PORT` (default 587), `TECHCARE_SMTP_FROM`, and optional `TECHCARE_SMTP_USER`/`TECHCARE_SMTP_PASSWORD`; delivery uses STARTTLS. Missing SMTP setup or delivery failure must not leave a partially registered account committed.

`TECHCARE_DEV_VERIFY=1` is a localhost classroom demonstration mode that displays a code. It does **not** verify mailbox ownership. It must be disabled outside local demonstrations, including behind a reverse proxy. Production startup should fail if this mode is enabled. The old database migration marks preexisting accounts verified; do not silently carry that trust decision into a production migration without review.

### Required additions

- Password recovery using expiring, single-use, securely stored reset tokens, generic responses, delivery through an approved channel, throttling, and session revocation after reset.
- A discoverable way to resume verification for a pending account without restoring the obsolete combined authentication dialog. The code has a verification handler but its accessibility from normal sign-in requires review.
- Per-account and per-source abuse limits for registration, login, verification/resend, and reset; configurable thresholds and accessible retry feedback.
- Safe account-conflict messages without raw database errors. Decide enumeration policy consistently rather than accidentally exposing account existence.
- Exact server validation before truncation; for example, reject malformed or overlong verification codes instead of accepting a truncated prefix.
- Secure cookies enforced by deployment configuration and trusted proxy handling, not arbitrary client-supplied forwarded headers.

## 6. Features and workflows

### 6.1 Home, guides, and support booth

Preserve the blue/gold university-inspired theme, replaceable hero illustration, connection background, and restrained gadget animations. Home directs people to Discuss, Learn, Visit, and Reconnect.

Guides currently cover a slow Windows PC, Wi-Fi without internet, a laptop that will not turn on, and suspicious messages. Each has a category, summary, ordered safe steps, and an entry to discussion. Categories across the product are `General`, `Hardware`, `Operating system`, `Connectivity`, and `Online safety`.

The booth page explains intake and consent, supervised diagnosis, testing and release. Visitors should back up files, bring chargers, and unlock devices themselves without disclosing passwords. No board-level or battery-cell repair, account bypass, or pirated software. Refer unsafe/complex cases. Venue/hours remain pending College approval. Preserve these boundaries in both interface copy and training materials.

### 6.2 Profiles and dashboard

Members can update their own display name, short bio, avatar, and public/private visibility. Email and role are not editable through the profile form. Use an initials fallback when an avatar is absent or concealed.

My Dashboard shows profile editing, following, followers, and the member's submitted questions with `pending`, `published`, or `rejected` status. The baseline returns up to 50 of their latest questions.

Private visibility hides bio/avatar from non-friends in the member directory; the owner and accepted friends may see them. Display name and approved public questions remain public. The current post/comment queries hide private avatars for every viewer, even friends; preserve this conservative public-discussion behavior unless deliberately changed. Private profiles are not anonymous accounts.

**Required:** share a privacy policy/serializer across all API views, including dashboard relationships. Do not return concealed fields and rely on the browser to ignore them. Private avatar files must require authorization at fetch time, including URLs saved before a privacy change. Public resource/hero media remain intentionally public.

### 6.3 Follows and mutual friendships

Following is one-way and independently toggled. It neither grants access to private profile details nor enables messages. Self-follow and nonexistent targets are invalid.

Friendship states presented to a viewer are none, outgoing pending, incoming pending, and friends. A member requests; the recipient accepts; the sender may cancel; either party may remove a relationship. The API supports removing a pending incoming request, though the current UI primarily presents Accept. Provide an accessible decline path when improving the interface.

**Required:** prevent simultaneous requests from creating duplicate inverse pairs; enforce one logical friendship per unordered pair with database constraints/transaction-safe handling. State changes must not implicitly create follows.

### 6.4 Discussions and replies

Guests and members browse/search published questions by title, body, or category. The search query is limited to 80 characters; current results are the latest 100 matches. Show informative empty states.

Signed-in users select **+ Ask a Question**, which opens a modal containing title, category, and problem description. Submission creates a pending question for every role. Explain that submission is not publication. Display the resulting state in My Dashboard.

Published cards show category, title, problem, author display name, and **View Replies**. Replies appear in chronological order. Member replies enter review; moderator/admin replies to published questions publish immediately. No member can reply to an unpublished/nonexistent question. No rich text or attachment support is implied by the baseline text fields.

**Required:** public reply reads must also verify parent publication status; return only published, authorized content. Preserve explicit reviewed-submission messages rather than replacing them with generic success notices. Add pagination when removing the current fixed caps; do not let older content silently become inaccessible at scale.

### 6.5 Moderation

Baseline **Review and Respond** shows oldest pending questions and replies, pending Lost & Found reports, private feedback, and resource publication. Approve changes `pending` to `published`; Reject changes it to `rejected`. Rejected records remain stored and are not public. Current APIs do not provide an edit/resubmit cycle or a rejection explanation.

Required question workflow:

1. Moderator opens a pending question with author, category, and full text.
2. Choose **Approve**, **Reject**, or **Approve & Answer**.
3. Approve & Answer opens a response field with reply validation.
4. Publish the question and moderator answer together in one database transaction.
5. If either write fails, neither becomes public. If another moderator already decided, report a conflict and refresh the queue; never create duplicate answers on retry.
6. The published thread identifies the responding staff member and their role.

Required moderation safeguards include authoritative state transitions, auditing actor/time/action/target, an optional internal decision reason with controlled visibility, and honest handling of missing/already-reviewed targets. The baseline update can report success after changing zero rows; fix that behavior. Rejection reasons shown to submitters, appeals, and resubmission remain Proposed policy/UI work.

Review content for relevance, respectful conduct, unsafe repair advice, sensitive identifiers, personal contact information, and inappropriate resources. Do not auto-publish member content to simplify implementation.

### 6.6 Direct messaging

The Members page offers Message only for accepted friends. The message dialog shows sent/received text and a composer. The baseline fetches the most recent 100 messages for the pair and presents them oldest to newest; it is request-driven, not a real-time service.

Both read and send endpoints must verify that the requester belongs to the pair and an accepted friendship currently exists. Removing friendship immediately blocks both reading and sending, including direct API requests and an already-open dialog. Removal does not currently delete stored messages. Re-friending can make retained history accessible again; retention and deletion policy must address this explicitly.

**Required before public release:** report/block workflows, submission throttling, a documented abuse-handling process, and narrowly scoped access to reported evidence. Blocking must revoke communication and associated access immediately. Do not create general moderator browsing of private conversations. End-to-end encryption, delivery/read receipts, attachments, and live presence are not baseline capabilities.

### 6.7 Lost & Found

Authenticated users submit `lost` or `found`, item name, public description, and location. Every report is pending until moderator approval. Published notices contain report number, kind, item, description, location, and creation time; omit reporter identity and account/contact details from the public API as well as the page.

Users must not post passwords, serial numbers, or private contact details. Moderators should reject unsafe descriptions and arrange correction through an approved process rather than publish them. Claimants quote the report number to the campus project team and establish ownership in person using identifying details not published online.

Required operational policy: accountable item custody, claim verification, and notice retirement. A digital `resolved/claimed/archived` lifecycle, expiry date, claim records, and submitter status view are Proposed additions; no such fields/workflows should be described as already implemented. Publication status and eventual item-resolution status should be separate concepts.

### 6.8 Feedback

Signed-in users submit a 1–5 rating and a private comment. Moderators and administrators view feedback with submitter identity for evaluation/follow-up. Guests and ordinary members cannot fetch other users' feedback. Feedback is private to staff, not anonymous. The current moderation queue includes the latest 100 records.

Preserve acknowledgement and a cleared form after successful submission. Public testimonials, average ratings, staff responses, exports, and analytics are not baseline features; require separate decisions and privacy review.

### 6.9 Media and resources

Moderators/admins publish a title, description, category, source/student credit, and one type: `external`, `image`, or `video`. External links must point to a specific HTTPS page/video and contain no embedded username/password. Uploaded images accept PNG/JPEG/WebP up to **3,000,000 bytes**; videos accept MP4/WebM up to **20,000,000 bytes**. These are decimal limits from the source, not MiB.

Cards display images inline, videos with controls and metadata preloading, and external links opening safely with `noopener noreferrer`. Preserve credit. The sample Wi-Fi tutorial is credited to Sertilink IT and the device-care flyer to Project TechCare template; do not relabel them as student-created. Content suitability and licensing must be reviewed before adoption.

Administrators may replace the homepage hero with an image under the same image constraints; retain a valid fallback.

**Required:** decode/validate the entire image, bound dimensions and resource use, and preferably re-encode/strip unnecessary metadata. Parse/inspect videos with maintained tooling and bounded processing; do not trust extensions, submitted MIME, or container signatures alone. Use generated storage names, quotas, safe response types, and controlled access. Add captions/transcripts for instructional video and useful alt text for images. Separate public learning media from private profile assets. Manage failed uploads/orphans and deliberate asset replacement without deleting still-referenced files.

## 7. Field validation contract

These are inspected baseline limits. The current `clean()` helper trims and silently truncates many values. Required behavior is consistent, explicit frontend/backend validation that rejects excessive input with actionable errors; do not silently lose user text.

| Field | Baseline constraint |
| --- | --- |
| Display name | 2–80 characters |
| Email | Trimmed/lowercase, simple format validation, maximum 160 |
| Password | Minimum 12; no explicit maximum in baseline |
| Verification code | Six digits; expiry/attempt/cooldown rules above |
| Bio | Maximum 400 |
| Profile visibility | `public` or `private` |
| Question title/body/category | 8–120 / 20–2000 / allowed category |
| Reply | 3–1000; published parent required |
| Message | 1–1000 after trimming |
| Feedback | Integer rating 1–5; message 10–1000 |
| Lost & Found | Item 3–100; location 3–100; details 10–500; kind enum |
| Resource | Title 4–120; description up to 500; credit 2–80; allowed category/type |
| External resource URL | HTTPS, valid host, no URL credentials, up to 1000 |
| Request body | Baseline maximum 28,000,000 bytes of JSON |

The frontend does not consistently express every server limit. Align them. Select a reasonable password maximum as an explicit implementation/security decision while preserving long passphrase support. Uploaded media is currently base64 in JSON, so proxy limits must account for encoding overhead in addition to decoded byte limits.

## 8. Frontend behavior and accessibility

Baseline architecture is a vanilla JavaScript rendered application with a shared page shell, desktop sidebar, responsive mobile menu, shared dialog, notifications/errors, and role-dependent navigation. There is no React application or Node application server in the package.

Preserve:

- Separate top-right **Sign In** and **Create Account** buttons when logged out; signed-in name and Sign out when authenticated.
- Separate dialogs for login, registration, verification, and asking a question. Do not restore the old permanently embedded question form.
- Role-appropriate Moderator/Admin navigation and My Dashboard for authenticated users.
- Mobile navigation closing after page selection, correct expanded state, and sensible page positioning.
- Escaping of user-generated text before HTML insertion; never remove `esc()` protections during refactoring.
- Focus visibility and reduced-motion support.

Required UX quality: named dialogs, keyboard navigation, focus containment/return, accessible close actions, associated labels, announced errors/status updates, readable contrast, reflow/zoom without clipped controls, touch-friendly targets, and no information conveyed by color alone. Do not claim formal accessibility conformance without testing.

Provide loading, empty, failure, success, and permission-denied states. Preserve entered content after recoverable errors; disable repeated submissions while pending. Refresh relevant data after moderation, friendship, and profile changes. Clear private state on logout/session expiry and avoid stale responses restoring it. Re-fetch after login as needed: current login sets the profile view without the dedicated dashboard fetch, so verify that followers/questions load immediately. A logged-in unauthorized user should see an access explanation, not a misleading sign-in prompt.

## 9. Architecture and API contract

### Current implementation

Browser HTML/CSS/JavaScript sends same-origin JSON requests to Python `ThreadingHTTPServer` in `server.py`. SQLite stores application records at `data/techcare.sqlite3`; uploads reside in `data/media/`. Static content is under `static/`. `TECHCARE_DATA_DIR` overrides the data directory; `PORT` defaults to 8000. The server binds to `0.0.0.0`, so a local demo requires appropriate network restriction.

The core runtime uses Python 3.10+ standard library only. Node is optional for syntax checking/preview conveniences. Pillow is a development dependency for the infographic utility, not currently required to run the application. FFmpeg/Pillow used in demo creation are not evidence of runtime dependencies.

### Existing endpoint inventory

| Method | Path | Purpose/access |
| --- | --- | --- |
| GET | `/api/me`, `/api/settings` | Current user or null; public hero setting |
| POST | `/api/register`, `/api/verify`, `/api/resend-verification` | Account challenge lifecycle |
| POST | `/api/login`, `/api/logout` | Establish/revoke session |
| GET / POST | `/api/dashboard` / `/api/profile` | Own dashboard / update own profile |
| GET | `/api/members` | Privacy-filtered directory and viewer relationship state |
| POST | `/api/follow`, `/api/friend` | Own follow/friendship actions |
| GET / POST | `/api/posts?q=...` / `/api/posts` | Published search / pending question |
| GET / POST | `/api/comments?post=...` / `/api/comments` | Published replies / submit reply |
| GET / POST | `/api/messages?user=...` / `/api/messages` | Accepted-friend conversation / message |
| GET / POST | `/api/lost-found` | Public notices / authenticated pending report |
| POST | `/api/feedback` | Authenticated private feedback |
| GET | `/api/queue` | Staff-only queues and feedback |
| POST | `/api/moderate` | Staff decision: kind, id, status |
| GET / POST | `/api/resources` / `/api/resource` | Public resources / staff publication |
| GET | `/api/admin/users` | Admin account listing |
| POST | `/api/admin/role`, `/api/admin/hero` | Admin role/hero changes |
| GET | `/`, `/static/<name>`, `/media/<name>` | Shell/assets/uploads; media authorization gap |

Retain working request fields and response contracts during refactoring, or migrate frontend/tests together with a documented compatibility plan. Current API failures generally use an `error` field. Introduce predictable validation, authentication, authorization, missing-record, conflict, throttling, and server-error responses without leaking internals.

### Production target

Build the target application with **Next.js**, as selected by the project owner. Preserve behavior through regression tests rather than rebuilding as a visual mockup. Document whether server-side functionality moves into the Next.js application or remains in a separate production backend. Flask/Django are not the selected application framework; references to them in older deployment documents describe earlier options. A reverse proxy alone does not make the bundled Python development server production-ready. Hosting and runtime details must fit the selected Next.js architecture and institutional deployment requirements.

Retain SQLite for a suitable single-node supervised pilot; the deployment plan targets IT-managed PostgreSQL with migrations before public multi-worker/horizontal scaling. Separate transport/routes, business rules, persistence, authentication/authorization, and media storage. This separation is a target, not the current layout.

## 10. Domain and database concepts

Baseline creation times/expirations are integer Unix timestamps. Keep stable identifiers and relationships during migration; define UTC storage and local display conventions explicitly.

| Entity/table | Core fields and relationships |
| --- | --- |
| `users` | id, name, unique email, password hash, role, bio, avatar path, created; migrated visibility and verified flags |
| `email_verifications` | One per user; code hash, expiry, attempts, last_sent; cascade on user deletion |
| `sessions` | Token hash primary key, user reference, expiry; cascade on user deletion |
| `follows` | Directed follower/followed composite key; no self-follow; user references |
| `posts` | User, title, body, category, publication status, created |
| `comments` | Post/user, body, publication status, created; post deletion cascades |
| `resources` | Title, description, category, type, URL/storage path, textual author credit, created |
| `feedback` | User, integer rating, message, created |
| `lost_found` | User, kind, item, details, location, publication status, created |
| `friendships` | Sender/receiver composite key, pending/accepted status, created; no self-pair |
| `messages` | Sender, receiver, body, created; conversation derived from pair |
| `settings` | Key/value; includes homepage hero |

Users have many posts, replies, feedback records, reports, sessions, and messages. Follows and friendships are distinct relationships. Resource author is a credit string, not currently an authenticated creator foreign key. There is no separate conversation table, notification table, media-ownership table, moderation-history table, or password-reset table in the inspected schema.

Required evolution should include appropriate persistent models for password resets, media ownership/access classification, audit events, and message reports/blocks. Notifications, item resolution, and expanded moderation reasons need models only when their scope is approved. Record migration versions, add validated enum/check constraints and indexes suited to queries, and enforce logical friendship uniqueness. Do not invent an exact production schema before selecting framework/migration tooling.

Account deletion is not a simple cascade: several content references lack cascade rules. Define retention, anonymization, referential integrity, and recovery requirements before implementing deletion. Never silently delete the user's database to make a migration pass.

## 11. Security and privacy requirements

These are project requirements derived from the reviewed gaps and deployment plan, not a certification of legal compliance or an exhaustive security audit.

1. **Authorization:** enforce role, ownership, friendship, and publication rules at every endpoint and media read. Test direct requests, guessed IDs, stale sessions, and privilege changes.
2. **Session/authentication:** retain strong salted password hashes, hashed session tokens, expiry/logout semantics, TLS, secure cookies, recovery, and rate limits. Assess hashing settings against the chosen framework before production; 310,000 iterations records the baseline, not a permanent recommendation.
3. **CSRF and origins:** add framework-supported CSRF controls for state-changing cookie-authenticated requests. The prototype's origin comparison accepts missing Origin and is not the complete production control. Configure trusted hosts/proxies explicitly.
4. **Browser headers:** apply appropriate CSP and anti-framing policy to the actual HTML document and relevant responses; consistently apply `nosniff`. Check the final policy against real UI assets and media. Apply HTTPS policies at the approved edge configuration.
5. **Content safety:** parameterized SQL, validated IDs/enums/lengths, escaped rendered text, safe links, and controlled file types/paths. Reject malformed JSON/base64 and excessive request/decoded sizes without revealing exceptions.
6. **Media privacy:** protect private assets through authorized delivery, remove unrestricted legacy paths, and prevent shared caches from leaking restricted responses. Random filenames are not access control. Privacy changes and friendship removal must affect subsequent access immediately.
7. **Abuse resistance:** cover login/register/verification/reset, question/reply/report/feedback submissions, friend requests, messaging, and uploads. Bounds must prevent CPU/storage exhaustion as well as excessive request counts.
8. **Data minimization:** public directories must not expose emails; public Lost & Found must not expose reporters; private feedback/messages must stay limited to intended audiences. Inform users that public posts/names remain visible even with a private profile.
9. **Secrets/logs:** keep credentials outside source/web roots, redact passwords/codes/tokens/message bodies, restrict operational logs, and audit privileged actions without duplicating unnecessary personal data.
10. **Governance:** approve a privacy notice, retention/deletion periods, staff access rules, abuse/report procedures, and incident response. Exact retention periods and responsible contacts remain Open.
11. **Repository hygiene:** exclude runtime `data/`, real uploads, environment secrets, caches, and temporary captures from Git/distributed ZIPs. Use synthetic fixtures for demos and tests.

## 12. Known issues and reconciliation register

| ID | Evidence/current issue | Required disposition |
| --- | --- | --- |
| K01 | Prior video review: about 15 seconds, VERIFY EMAIL caption shows Sign In | Re-record the actual six-digit verification screen |
| K02 | Video shows an embedded Ask a Question form; current source uses modal | Keep current modal; update recording |
| K03 | Video has older authentication links and a combined top-right control | Keep separate Sign In/Create Account dialogs/buttons; remove obsolete styling only after checking use |
| K04 | DOCX references nonexistent `PRODUCTION_DEPLOYMENT.docx` and section 0 | Point to real Markdown sections; regenerate DOCX from current Markdown |
| K05 | Upload validation checks only signatures/container markers; test accepts a fake PNG | Decode/inspect real media; replace fake positive fixture and add rejection tests |
| K06 | CSP/anti-framing headers appear on JSON, not main HTML | Centralize headers and validate actual document responses |
| K07 | Password reset absent | Implement before public registration |
| K08 | General request/abuse rate limits absent | Implement limits with meaningful retry/error behavior |
| K09 | Moderator queue only Approve/Reject despite Review and Respond title | Add atomic Approve & Answer |
| K10 | `/media/` publicly serves private-avatar URLs | Add authorized private storage/delivery and close old paths |
| K11 | Dashboard follower/following payload exposes private-avatar URLs | Apply privacy filtering even when frontend shows only names |
| K12 | No notifications | Decide scope; optional staged enhancement, not baseline |
| K13 | `package.json` uses Unix `PORT=4173 python3 server.py` syntax | Make convenience startup cross-platform or remove/document it |
| K14 | Infographic utility uses Linux font paths and requires Pillow | Use portable font discovery/configuration; document tools dependencies |
| K15 | No `.gitignore` in reviewed package | Exclude private data/secrets and development artifacts before Git use |
| K16 | No formal ERD/DFD/UML/database dictionary in reviewed package | Produce if academic deliverables require them; maintain against schema |
| K17 | Development HTTP server and incomplete public controls | Complete supported production migration and operational release gates |
| K18 | Raw SQLite integrity text can reach clients | Map conflicts to safe messages |
| K19 | Caption/subtitle and dialog labeling improvements needed | Add accessible media and verify dialog behavior |

Additional source-inspection risks to verify while implementing: silent input truncation, zero-row moderation success, reverse-pair friendship races, another-admin demotion, public reply queries not checking parent status, stale client state, initial dashboard data loading, unpaginated/capped lists, and orphaned upload cleanup. These are distinct from the prior review's executed test results; reproduce each before claiming a confirmed runtime failure.

The previously reviewed demo is approximately 70 seconds, 1280×720 H.264, with burned-in captions and no audio track. Its style can be retained. It must no longer be described as matching the final layout until a new recording is checked against the release build.

## 13. Deployment and operations

### Local and supervised pilot

- Run from the project root with Python 3.10+: `py server.py create-admin`, then `py server.py` on Windows; use the appropriate Python launcher on other systems.
- Configure SMTP for actual email verification. For a strictly localhost demonstration, PowerShell uses `$env:TECHCARE_DEV_VERIFY='1'`; Command Prompt uses `set TECHCARE_DEV_VERIFY=1`. Do not imply the syntax is interchangeable.
- Node/npm is not required to run the baseline. Document Pillow separately in `requirements-tools.txt` for infographic creation.
- Keep data outside source distribution and back it up. Use a distinct data directory for tests; never test against live accounts.

### Public/campus deployment target

Audience must be chosen: campus LAN/VPN-only, public community, or an approved separate domain. Names such as `techcare.uls.edu.ph` in the existing plan are illustrative; no domain, DNS delegation, server, or certificate is provisioned by this package.

Target request path: visitor → approved DNS/firewall → HTTPS edge reverse proxy → private production application → private database/protected media. Only approved edge ports are exposed. Restrict application access to the proxy, database access to the app, and administration to authorized operators.

University IT must approve hosting, DNS, branding, SMTP/SSO, firewall/NAT, certificates/renewal, patching, persistent storage, quotas, and service ownership. The existing plan's 2 vCPU/4 GB RAM/40 GB OS disk is an initial sizing estimate, not a capacity guarantee. Determine actual concurrency/media volume and load-test before selecting resources.

Required runbooks: deployment/migration, rollback, backup/restore, certificate renewal, failed mail delivery, storage exhaustion, moderation coverage, incident escalation, and account recovery. Use restricted staging with synthetic data. Keep secrets in managed configuration, production demo mode disabled, and health checks/logging free of sensitive data.

Back up database and media consistently, encrypt/restrict backups, keep a separate copy, and document a successful restore. For a live SQLite pilot use a supported database backup operation rather than blindly copying an active file. Establish retention, recovery-point and recovery-time targets with the service owner; no targets have yet been approved.

## 14. Testing and acceptance criteria

### Baseline evidence and preservation

The prior reviewer ran `python3 test_system.py` and `node --check static/app.js` and reported all 22 scenarios passing plus valid JavaScript syntax. Coverage described includes registration/verification, invalid codes, login/resend, follows, moderation, feedback permissions, Lost & Found, search, friendships/messages, privacy, role permissions, staff replies, HTTPS resource links, unfriending revocation, SMTP, duplicates, uploads, dashboard, and hero replacement.

Run the supplied suite in isolation before changes and after relevant changes. Passing the old suite alone is insufficient: its fake PNG success fixture must be corrected with the upload validator. Do not retain insecure behavior merely to keep existing tests green. Capture revision, environment, commands, actual results, and remaining issues. This specification supplies no new execution result.

### Required acceptance scenarios

| ID | Scenario and passing result |
| --- | --- |
| A01 | Valid registration sends SMTP code; unverified login is denied; correct code enables login |
| A02 | Invalid, expired, reused, malformed, and sixth-attempt codes fail; leading-zero codes work |
| A03 | Resend before cooldown does not issue a new code; after cooldown old code fails and new code works |
| A04 | Missing/failing SMTP rolls back registration; production cannot start with demo verification enabled |
| A05 | Login uses protected cookie; logout/expiry invalidate session; errors disclose no database internals |
| A06 | Password reset is expiring/single-use/throttled; completion revokes prior sessions; unknown-account response is safe |
| A07 | Member submits question through modal; public API cannot see it until approval; dashboard shows status |
| A08 | Member replies stay pending; staff replies publish immediately; replies require a published parent |
| A09 | Approve & Answer publishes both records atomically; retry/concurrent decision does not duplicate reply |
| A10 | Rejection hides content; stale/nonexistent moderation target gets accurate outcome and audit entry |
| A11 | Search matches published title/body/category and never includes pending/rejected content |
| A12 | Follow is independent of friendship; self-actions invalid; concurrent friend requests yield one logical pair |
| A13 | Only accepted friends can read/send their conversation; third party/staff without friendship denied |
| A14 | Unfriend/block revokes read/send immediately, including existing dialog and direct API calls |
| A15 | Private bio/avatar concealed in every relevant API and saved media URL; owner/friend access remains correct |
| A16 | Public Lost & Found contains only approved notices without reporter identity; invalid descriptions rejected |
| A17 | Feedback accepts valid rating/comment, is staff-only, and cannot be retrieved by unrelated members |
| A18 | Only staff publish resources; HTTPS links validated; valid real media accepted and malformed/oversized media rejected |
| A19 | Only admin manages roles/hero; self/last-admin protections and demotion take effect server-side |
| A20 | HTML receives effective security headers; CSRF, injection, ID tampering, path traversal, and spoofed proxy cases fail safely |
| A21 | Throttles work for auth, posting, messaging, and uploads without confusing normal recovery paths |
| A22 | Desktop/mobile full workflows work with keyboard, labeled dialogs, visible focus, reduced motion, and accessible media |
| A23 | Network/validation errors preserve entered content; duplicate submit is controlled; logout clears private UI state |
| A24 | Existing-data migration preserves records/relationships and documented verification decisions; restore/rollback demonstrated |
| A25 | Final documentation links resolve, screenshots/video match release revision, verification scene is accurate |

Test authorization with separate guest, unverified, member A/B/C, moderator, and administrator identities. Use direct API negative tests in addition to browser tests. Add boundary tests at/above field and media limits and use valid fixtures. Test pagination, concurrent moderation/friendship actions, and deployment resource limits when those changes land.

Release evidence must include desktop/mobile checks, privacy/security results, migration/restore evidence, operational ownership, and the final revision. The existing deployment plan asks for three pilot-suite runs before handoff; record these when conducting that handoff, not as a substitute for meaningful new acceptance coverage.

## 15. Suggested file structure

Preserve the current simple structure until a change justifies moving files. Do not rename everything merely to match this suggestion.

```text
Project_TechCare/
  README.md
  TECHCARE_CODEX_SPECIFICATION.md
  TECH_STACK_AND_CODE_MAP.md
  PRODUCTION_DEPLOYMENT.md
  server.py                       # current pilot entry point
  test_system.py                  # current isolated integration suite
  package.json                    # optional; make cross-platform
  make_infographic.py
  requirements-tools.txt          # proposed tool dependencies
  .gitignore                      # required addition
  .env.example                    # proposed names/placeholders only
  static/
    index.html
    app.js
    style.css
    techcare-hero.png
    device-care-guide.png
    connection-grid.svg
  docs/                           # proposed organized documentation
    decisions.md
    data-dictionary.md
    acceptance-report.md
    operations.md
    diagrams/
  tests/                          # proposed as suite grows
    fixtures/                     # synthetic data and valid media
    integration/
    security/
  data/                           # runtime only; ignored, never shipped
    techcare.sqlite3
    media/
  TechCare_System_Demo.mp4
```

For the Next.js implementation, organize pages/layouts under `app/` (or `src/app/`), reusable UI under `components/`, and shared server-side domain, authorization, persistence, and configuration code under clearly separated modules such as `lib/server/`. Use `public/` for intentionally public static assets only; never place private uploads there. Add migrations, tests, and deployment configuration as needed. If retaining a separate backend, document its location and API boundary. Choose framework conventions over an arbitrary bespoke layout. Update the code map and startup instructions after moves; the tree above describes the pilot, not the final Next.js layout.

## 16. Implementation priorities and release gates

### P0 — Establish trustworthy baseline and prevent exposure

Inventory the actual source/version; preserve data; add repository exclusions; record baseline tests. Fix private media/dashboard leakage, unsafe media validation, HTML security headers, and raw error exposure. Clarify audience and prohibit public exposure of the development server. Establish this document as the working specification.

### P1 — Complete core product experience

Implement Approve & Answer and reliable state transitions. Align frontend/backend validation, verification recovery, profile/dashboard refresh, and accessibility. Finalize intended UI, correct Markdown/DOCX, and produce a demo from the resulting build. Fix Windows utility compatibility. A polished submission/demo does not waive public-release controls.

### P2 — Public-release engineering and operations

Complete supported server/framework migration; password reset; CSRF/rate limits; message reporting/blocking; audit/retention tooling; authorized storage; migrations; staging; TLS/proxy hardening; restore/rollback/load tests; and approvals/operational ownership. These are prerequisites for public operation even if P1 presentation work is completed first.

### P3 — Approved enhancements

Notifications, improved history/search pagination UX, moderation explanations/resubmission, Lost & Found resolution UI, content administration, and academic diagrams as required. Do not expand into unrelated modules without a user decision.

Gate for classroom submission: coherent runnable build, meaningful passing tests, no real data/secrets, approved/accurately qualified content, synchronized documentation, and an accurate demo with remaining limitations disclosed.

Gate for public release: all applicable P0/P2 requirements and acceptance checks satisfied, named service/privacy/IT owners, approved audience/domain/branding, tested backups/restore/rollback, and explicit launch authorization.

## 17. Open decisions

Do useful implementation work without blocking on unrelated decisions. Ask only when the answer changes the work being performed.

- Confirm campus-only versus public audience and whether institutional affiliation is required.
- Confirm launch date, venue/hours, institutional wording/logo authorization, and service owner.
- Next.js is selected. Decide the backend boundary, database transition, hosting, DNS, SMTP provider/sender, and monitoring owner.
- Define load targets, storage quotas, retention periods, recovery targets, and incident contacts.
- Define account deletion/anonymization, private-message reporting access, blocking/history behavior, and old-account verification migration.
- Decide notifications: in-app/email, event types, consent/preferences, and privacy-safe message content.
- Decide appeals/resubmission, published-content edits, rejection reasons, and staff assignment expectations.
- Decide Lost & Found notice expiry/resolution and custody/claim record handling.
- Confirm required academic diagrams and submission formats.

## 18. Instructions to future Codex agents

1. Read this specification, repository instructions, the latest code map/deployment plan, and relevant source before changing anything. Never edit synced read-only `sources/` material; work in an authorized implementation directory.
2. Identify which requirements are Baseline, Required, Proposed, or Open. Do not claim proposed features exist or convert a prior reviewer statement into a new test result.
3. Preserve the core moderated-help journey, roles, separate auth dialogs, question modal, verification, profile privacy, independent follows/friends, friendship-gated messaging, private feedback, and anonymous public Lost & Found notices.
4. Use the latest source/spec to reconcile obsolete videos and DOCX. Do not downgrade current UI or protections to resemble older assets.
5. Preserve data and stable relationships. Use reversible, tested migrations; never erase live data or weaken permissions to pass tests. Keep secrets and personal data out of commits, demos, and logs.
6. Enforce permissions on the server and private media delivery. Do not implement privacy only by hiding controls or fields in the browser.
7. Complete each selected feature end to end: schema where needed, backend rules, frontend states, permission/error paths, regression tests, and documentation. Do not substitute mocked success for a functioning workflow.
8. Use Next.js as the selected application framework and keep architecture proportionate. React and the runtime/tooling needed for Next.js are within that choice. Do not add unrelated services, AI features, or cloud vendors without a relevant requirement. The migration must retain behavior, preserve data, and be tested.
9. Record important decisions and update this specification when behavior changes. Include requirement IDs, evidence, migration notes, and remaining limitations in handoff notes.
10. Use synthetic accounts/media for tests and recordings. The final walkthrough should show Home → Create Account → Verify Email → Sign In → Dashboard → Ask Question → Moderator Approval/Answer → Member Views Answer → Members/Friends → Messages → Lost & Found → Feedback → Moderator → Admin → Media.
11. Before reporting completion, run appropriate checks and clearly distinguish tested results from unverified assumptions. Report remaining release blockers honestly.
12. Treat publication, official institutional claims, domain purchases, and external deployment as separate actions requiring the relevant project authorization. This specification does not itself provision infrastructure or authorize a public launch.

## 19. Change log

| Version | Date | Change |
| --- | --- | --- |
| 1.1 | 2026-09-25 | Added the owner's instruction to perform available actions, app startup, and verification autonomously; selected Next.js and reconciled framework guidance. |
| 1.0 | 2026-09-25 | Consolidated full prior review and local source/document inspection into baseline behavior, intended improvements, release requirements, and Codex instructions. No application code changed. |

## 20. Next.js build addendum — 2026-09-25

This workspace contains a new Next.js implementation of the specification. The original specification and reference project at `C:\1 Sir mund\TechCare` were not modified. Sections 1–19 above remain the supplied baseline/requirements snapshot; do not interpret their historical implementation descriptions as the current code map.

Implemented in the local pilot: all primary pages; separate registration, verification, sign-in and recovery dialogs; profiles and dashboard; independent follows/friends; friendship-gated messaging with blocking/reporting; moderated questions, replies and Lost & Found; private feedback; staff resources; admin roles and hero replacement. Approve & Answer is transactional. Private media authorization, shared privacy filtering, strict validation, safe image decoding, role continuity, audit records, abuse controls, password reset, and HTML security headers are included.

Architecture decision: use Next.js for both UI and backend; retain SQLite through Node 24 for the single-node pilot. The original source/data is not automatically imported. An explicit copy migration helper requires a verification policy and is tested with synthetic legacy records. Public deployment still targets approved infrastructure and a suitable production persistence transition.

Current verification: 30 automated API/migration tests pass; 17 browser workflows pass; the 12 main screens have no violations under the executed axe rules; TypeScript and production compilation pass; the compiled app's nonce-based script policy and disabled classroom mode were checked on loopback. These are current execution results. The original Python assertions passed but its Windows cleanup failed, as recorded separately.

Real SMTP, configured video validation, institutional approvals, operational policies, scaled deployment, physical-device/assistive-technology testing, and actual restore/cutover drills remain release requirements. This build is not a public launch. No notifications, repair tickets, booking, payments, AI chat, or official institutional claims were added.

The maintained build records are `IMPLEMENTATION.md`, `ACCEPTANCE.md`, `MIGRATION.md`, and `OPERATIONS.md` alongside this file. Consult those files and the actual source before subsequent changes.
