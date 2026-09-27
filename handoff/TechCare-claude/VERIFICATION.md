# Verification: Claude-inspired copy

Verified on 2026-09-27 with Node 24 and local Microsoft Edge.

- Production build and TypeScript check: passed.
- API/domain/migration suite: 32 tests passed.
- Account/community browser workflows: 22 checks passed, no browser errors or accessibility violations.
- Help assistant: 11 checks passed, no browser errors or accessibility violations.
- Design checks: 16 page/state/viewport scans passed. Includes public pages, guide selection, registration, light/dark appearance, and 768/390/320px viewports. No broken images, horizontal overflow, or WCAG A/AA violations detected by axe.
- Production smoke check: passed, including runtime headers and disabled classroom verification.
- Screenshots were visually inspected for desktop, phone, and dark appearance.
- Lighthouse was unavailable in the local offline package cache; no Lighthouse performance score is claimed.

Preview port: 3002. Isolated browser workflow test port: 3012. Isolated production smoke test port: 3013.

The downloadable archive contains source, public assets, example environment configuration, tests, and documentation. Dependencies, build output, local environment settings, accounts, uploads, and databases are excluded. Use `npm ci`, copy `.env.example` to `.env.local`, then `npm run dev`.

After the blue/readability update: production build, all 16 design scans, and all 11 assistant checks passed again. Desktop and mobile screenshots were inspected; no overflow or accessibility violations were detected.

After announcement implementation: 37 server/domain/migration tests pass. Production build passes. The 16 existing page/state design scans pass. The isolated production announcement browser test passes creation, draft persistence, publish/hide, reorder, image replacement, deletion confirmation, image enlargement and focus restoration, dates/links, and empty fallback. All eight announcement accessibility scans pass across desktop, dark mode, 390/320px public views, and admin/editor mobile views. Test announcements and test accounts were confined to a temporary database, not the live preview.

After campus image integration: production build and 38 server/domain/migration tests pass. All three day/night pairs load and switch with the app theme, including enlarged images; the selected theme persists after reload. The admin picker publishes paired photos with an editable image description; thumbnails and editor previews match the theme. Uploaded image replacement and campus preset reuse pass. All 13 announcement/gallery accessibility scans pass, with no browser errors or horizontal overflow. Desktop light/dark and mobile dark screenshots were visually inspected. All six supplied PNGs are encoded as WebP at their original 1672 × 941 dimensions; source files remain untouched.

Campus background correction: moved the three campus pairs behind homepage content and restored the announcement illustration fallback. Manual background selectors retain the current view across theme changes. Production build, 13 announcement/background accessibility scans, and 16 design scans pass. Screenshot review confirmed the background stays behind navigation and content in desktop and mobile layouts. No automatic background rotation was added.

Background visibility adjustment: reduced the full-photo overlay from 84% to 30% in light mode and from 72% to 12% in dark mode. Text and controls use local surfaces for contrast. All 16 design scans passed with no browser errors, broken images, overflow, or detected accessibility violations; desktop light/dark screenshots were inspected.

Port 3000 reference match: replaced the separate text panels and background selectors with the reference's full-color fixed backdrop and single 96% content surface. Home uses dormitory courtyard, Booth uses covered walkway, and other routes use campus building. Paired image layers crossfade on theme changes and respect reduced motion. Production build, all 16 design scans, and all 13 announcement/background scans pass. Desktop light/dark and mobile screenshots inspected; no browser errors, broken images, or detected accessibility violations.
