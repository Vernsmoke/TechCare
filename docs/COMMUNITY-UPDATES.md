# Discussion and agreement updates

- Home shows the three newest published discussions above Helpful guides, with author, topic, reply count and latest published-comment activity.
- Discussion search and sorting share a toolbar. Topic filters use the existing Phosphor icons and retain their URL filters.
- Comment and reply attachments use an Add image button with validation, preview, replacement and removal. Existing question-photo and camera controls remain available.
- Moderator accounts default to administrators and moderators. Name/email searches run on the server; both views return 20 accounts per page. Existing role and verification restrictions apply.

## Agreement flow

The lower-left panel requires two initially unchecked agreements whenever the app is opened or reloaded. `/terms` and `/privacy` remain readable without acceptance. App components are not mounted until acceptance, and API requests require the current agreement cookie except for agreement status/acceptance, public settings, branding and logout.

`POST /api/consent` requires both boolean approvals, the current version and the existing same-origin mutation checks. An HttpOnly, SameSite=Lax cookie records acceptance for API access for one year and uses Secure on HTTPS or when configured. The interface still asks again on each full page load. This is a browser-level acknowledgment, not an account-level consent audit record. Clearing it does not remove prior contributions or account data.

When either agreement changes, update `CONSENT_VERSION` in `shared/src/consent.mjs`. Older acceptance then fails at the API boundary and the UI asks again. The existing local-pilot limitations remain in the notice, including the need to approve privacy contacts and retention/deletion procedures before public operation.

## Verification

- `npm test` includes acceptance/CSRF/version checks, staff-only defaults, bounded member search, role changes and published-only activity.
- `npm run build` checks the production bundle and TypeScript.
- Existing browser suites use `scripts/consent-fixture.mjs` to begin after acceptance while exercising their respective features.
