# Implementation decisions

Date: 2026-09-25. Status: local pilot implementation.

## Architecture

Next.js owns the interface and backend. There is no Python server dependency in the new app. App Router pages use a shared persistent client shell, with server-rendered HTML and isolated interactive screens. The frontend lives in `frontend/src/`; reusable API calls, hooks, and context live in `services/`, `hooks/`, and `context/`. The backend is split into transport (`frontend/src/app/api`), request orchestration (`backend/src/controllers/api.mjs`), validation, authentication/privacy, persistence, mail, and media. Browser-safe shared contracts live in `shared/src/`.

SQLite is retained for the single-node pilot through Node 24's built-in SQLite API. A migration to IT-managed PostgreSQL is still required before the specified public multi-worker/scaled deployment. IDs, timestamps, the original password-hash format, and core relationships remain compatible. New passwords use PBKDF2-SHA256 with 600,000 iterations; the verifier accepts the original 310,000 iteration format. Passwords allow 12 to 128 characters without trimming.

JSON endpoint names and principal fields are retained. API responses still use `error` for errors. Status codes now distinguish authentication (401), authorization (403), missing content (404), stale decisions/conflicts (409), oversize requests (413), throttling (429), and unavailable mail/video processing (503). Updated UI and tests use these distinctions together.

Normal JSON requests are capped at 32,768 bytes; upload-bearing routes retain the 28,000,000 byte envelope. Images are capped at 3,000,000 decoded bytes and 16 megapixels, fully decoded and re-encoded as WebP without unnecessary metadata. Videos are capped at 20,000,000 bytes and inspected by configured FFprobe with a timeout, output bound, resolution bound, and duration bound. Video validation is **not** malware scanning or full frame-by-frame decoding. Per-account storage is capped at 100 MB and instance-managed media at 1 GB, checked again transactionally before insertion. Replaced media is retained until reviewed cleanup so referenced assets are not deleted accidentally; abandoned/replaced media still counts against quota.

The pilot deliberately uses a global source rate ceiling because no trusted reverse-proxy source identity is configured. Untrusted forwarded headers do not determine rate-limit identities. Persistent account/action limits complement that ceiling. This should be replaced by an approved trusted-edge source policy for multi-user public service; current values are pilot implementation choices, not load targets.

## Privacy and security changes

- Question photos are stored as protected `question` media. Every image read checks its associated post: only the author and staff can view unpublished/rejected photos, and approved photos are public. Orphaned uploads are not readable. Failed post inserts clean up their upload. Media responses remain `no-store`. The client offers a local camera preview (video only, no microphone), captures to JPEG, resizes to a maximum 1920-pixel edge, and sends it only with the submitted question. Camera tracks stop on capture, cancel, errors, and component unmount, including late permission responses. Server validation still independently decodes and re-encodes every image, stripping metadata. The same-origin camera permission policy allows browser prompting; user consent is required. Device file capture is the fallback. Real hardware/browser-specific camera behavior still needs device testing; browser automation uses a simulated camera.

- One privacy serializer filters directory and dashboard relationship payloads. Private discussion avatars remain hidden even from friends.
- Profile media lives outside `public/` and is served from `/api/media/<generated-name>` with authorization on every fetch and `private, no-store`. The old `/media/` path is absent. A privacy change, unfriend, or block affects the next server read immediately.
- Friendship uniqueness uses an index on the unordered pair. Transactional state changes prevent inverse requests.
- Every message read/send requires a current accepted friendship. The open conversation rechecks on focus and every 15 seconds; already displayed text cannot be retroactively unseen. Server access revocation is immediate. History remains stored and can return after re-friending.
- Reporting stores a reference to the specific message and a reason. The queue exposes only reported evidence; staff have no general conversation endpoint.
- Approve & Answer publishes the question, answer, and audit event in one transaction. Already-reviewed/missing targets return a conflict and cannot duplicate an answer.
- All administrator accounts are protected from web demotion. Admin creation is an operator CLI, never public registration.
- Mutations require exact configured Origin, JSON, a custom request header, and no cross-site Fetch Metadata. There are no permissive CORS responses. Production secure cookies are configured explicitly, never inferred from client-forwarded protocol headers.
- HTML gets a fresh nonce-based script CSP through `frontend/src/proxy.ts`. Styles allow inline style attributes for React/Radix behavior; development alone allows script eval. HTML rendering is dynamic for nonce correctness. JSON/media responses get security headers through Next configuration.
- Recovery tokens are single-use, hashed, and expire after 15 minutes. Reset revokes all prior sessions. Unknown and known account requests have the same normal recovery response, including mail failures. Local demonstration mode intentionally exposes challenge material only to the local workflow.

## Visual direction

`design-taste-frontend` was applied to public/community-facing surfaces. Its own scope excludes dense admin and multi-step product UI, so those surfaces use straightforward accessible forms and Radix Dialog rather than marketing interactions. No Sites skill was used.

Design read: a trustworthy, welcoming campus support portal. Variance 4, motion 2, density 4. The established blue/gold identity, illustration, primary navigation labels, separate auth dialogs, and question modal are preserved. Gold and muted category colors are brand/context exceptions to the skill's default single-accent guidance. This is a light-only theme; no unrequested dark-mode switch is claimed. Surface radius 12–20 px, controls 8 px, avatar circles. Motion is limited to interaction feedback and brief dialog transitions, with reduced-motion support.

The shell replaces the reference single-document page switching with bookmarkable Next routes (`/guides`, `/resources`, `/discussion`, `/members`, `/booth`, `/lostfound`, `/feedback`, `/profile`, `/moderate`, `/admin`). The reference had no separate server page slugs or established SEO URLs. Guest discovery remains public. No invented users, statistics, testimonials, or university endorsement is shown. Original sample media credits are preserved.

## File map

| Location                                         | Responsibility                                                                  |
| ------------------------------------------------ | ------------------------------------------------------------------------------- |
| `frontend/src/app/layout.tsx`, `frontend/src/components/layout/shell.tsx` | Document, shell, navigation, authentication, session clearing, question modal   |
| `frontend/src/components/features/home.tsx`                              | Home and guide detail dialog                                                    |
| `frontend/src/components/features/community.tsx`                          | Discussion, replies, directory, friendships, messaging/reporting                |
| `frontend/src/components/features/views.tsx`                              | Guides, media, booth, Lost & Found, feedback, profile, moderator/admin, privacy |
| `frontend/src/components/ui/ui.tsx`                                       | Accessible dialogs, bounded forms, loading/error/empty states                  |
| `frontend/src/services/api.ts`, `frontend/src/hooks/use-data.ts`           | API requests, upload progress, data fetching, and polling                      |
| `frontend/src/context/techcare-context.ts`                                | Shared application state contract and context consumer hook                   |
| `frontend/src/assets/styles/globals.css`                                  | Design tokens, components, responsive layout, reduced motion                    |
| `frontend/src/utils/content.ts`, `shared/src/types.ts`                    | Safe guide content, sample credits, shared types                                |
| `backend/src/`                                                             | Database, permissions, validators, mail, media, domain API                      |
| `frontend/src/app/api/[...path]/route.ts`                                 | Next Node-runtime API transport                                                 |
| `frontend/src/proxy.ts`, `frontend/next.config.mjs`                       | HTML nonce and response security headers                                        |
| `scripts/create-admin.mjs`, `scripts/start.mjs`  | Operator bootstrap and guarded production startup                               |
| `scripts/migrate-legacy.mjs`                     | Explicit copy-based legacy migration                                            |
| `tests/`                                         | Isolated API and migration acceptance tests                                     |
| `scripts/workflow-check.mjs`                     | Full browser workflows in isolated temporary data                               |

No external analytics, AI services, cloud accounts, notifications, bookings, repair tickets, payments, or real-time chat infrastructure was added.
