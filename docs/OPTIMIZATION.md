# Optimization verification — October 6, 2026

This pass applies targeted performance and reliability improvements to the existing app. The advanced optimization playbook supplied with the request was used as a reference; this is not a claim that every audit in that document has been completed.

## Changes

- The guide assistant requests its library on first opening. Closing and reopening it reuses the data; the existing version signal still refreshes changed content.
- Admin content, logo, and announcement settings load through separate dynamic imports, reducing JavaScript needed by public routes.
- Optional data hooks accept a disabled path and ignore results from aborted initial requests.
- Progress uploads now honor cancellation, settle on abort/network failures, and time out after 120 seconds. Timeout feedback asks users to check whether the server saved the change before retrying. Mutations are never retried automatically; aborting a browser request does not roll back server work.

No schema, dependency, environment, or consent-flow changes are required.

## Measured results

Measured locally in headless Microsoft Edge against production builds, with fresh browser contexts, synthetic data, and the consent flow completed. Baseline source: commit `0056e32`. Values are decoded JavaScript resource bytes observed after network idle, including resources requested by Next.js. They are not compressed network transfer sizes or user-perceived timing measurements.

| Measurement | Before | After |
| --- | ---: | ---: |
| Home initial guide API requests, assistant closed | 2 | 1 |
| Guides initial guide API requests, assistant closed | 2 | 1 |
| Home decoded JavaScript bytes | 698,807 | 699,583 |
| Guides decoded JavaScript bytes | 870,093 | 827,742 |
| Guides JavaScript requests | 19 | 18 |

Guides loads 42,351 fewer decoded bytes (4.9%). Home grows by 776 bytes (0.1%); the improvement there is avoiding the unused API request. Opening the assistant brings total guide requests to two, and reopening adds none. Both pages have zero horizontal overflow at 390 × 844 after the existing navigation transition completes.

## Verification and reproduction

```powershell
npm test
npm run build
npm run typecheck
npm run test:production
npm run test:optimization
```

All 70 tests pass, including eight browser API helper regression tests. Build and typecheck pass. Production checks cover consent on load/reload, navigation, assets, and security headers. Optimization checks cover request counts, assistant reopening, mobile overflow, and loading the admin content/logo/announcement settings. Both browser runs report zero uncaught browser errors.

The optimization script requires Microsoft Edge and port 3024 free. It creates and cleans up a temporary database containing a synthetic administrator; it does not use application records. Measurements are saved to ignored `artifacts/optimization-optimized.json`. To measure older source without enforcing optimization expectations, build it and run `node scripts/optimization-check.mjs --baseline` with this script available.

The client API tests use Node 24's experimental `stripTypeScriptTypes` API to execute the real helper without an additional test runner. Node prints an expected experimental warning.

This pass does not establish Core Web Vitals, real-network speed, concurrent-user capacity, or coverage in browsers other than Edge. Deployment-level profiling and a full accessibility/security audit remain separate work.
