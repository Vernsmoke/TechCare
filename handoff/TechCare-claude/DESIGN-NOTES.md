# TechCare: Claude-inspired edition

This is an independent copy of the existing TechCare app, using `DESIGN.md` as visual reference material. It retains TechCare's identity, routes, content, moderation, accounts, help assistant, and admin controls.

## Design decisions

The original used blue accents, Manrope headings, white/gray surfaces, compact navigation, and rounded cards. This edition uses a warm editorial aesthetic: cream canvas (#faf9f5), TechCare blue (#0066cc), warm black (#181715), regular serif display headings, and 8/12/16px radii. Design variance 5, motion intensity 2, visual density 4: a calm, readable community portal with familiar controls.

The supplied reference's licensed Copernicus and Styrene fonts are not included. Georgia supplies local serif display headings, with the existing self-hosted Manrope for body and controls. Blue buttons use white text. Body text, navigation, actions, guide cards, and assistant messages use larger readable sizes. Decorative labels and repeated taglines are removed; instructions, form labels, safety guidance, and event qualifiers remain.

The homepage uses an admin-managed announcement carousel with a subtle layered-card appearance, complete images, readable text, and manual arrows. Guides stay below the hero. The user's campus day/night photos fill the app background around a single nearly opaque content panel, matching the background implementation on port 3000. Scenes follow the route: courtyard on Home, walkway on Booth, building elsewhere. Theme changes crossfade paired images, with reduced-motion support. They are not inserted into the announcement carousel automatically. The homepage illustration remains the fallback when no announcement is published. Admins can choose a paired photo explicitly for an announcement or upload their own image. The original support-booth illustration and device-care flyer were recovered from the existing TechCare student package to fix missing assets in this copy. The favicon uses the same monitor/heart identity as the navigation, rendered from Phosphor icons.

The reference's visual guidance does not replace the app with Claude branding or copy. The application's existing sidebar and navigation labels are retained for its many community and account functions. Both light and dark appearances remain available.

## Isolation and implementation

- New copy: `handoff/TechCare-claude`.
- Preview: `http://127.0.0.1:3002`.
- Database and uploads: this copy's `data/`, initialized fresh.
- Session and appearance cookies have a `techcare-claude` prefix so the original can run alongside it.
- No existing credentials, accounts, database, or private uploads were copied.
- Theme implementation: `src/app/claude-theme.css`; announcement UI: `src/components/announcements.tsx` and `src/components/announcement-settings.tsx`.
- `npm run dev` starts this edition on port 3002.
- `node scripts/design-check.mjs` checks public pages, guide selection, dialogs, dark mode, narrow screens, image loading, and accessibility against the running preview.

The source `DESIGN.md` is retained verbatim as the supplied reference, including descriptions of Claude branding. Those descriptions are reference content rather than operational instructions for this app.
