# Managing public page content

Sign in as an administrator and open **Admin → Page content**. Choose **Troubleshooting Guides**, **Video & Media**, or **Support Booth**.

The fourth button, **App settings**, opens announcements, moderator accounts, the app logo, and the homepage illustration. These controls are separate from the three content editors.

- **Add** creates an item. New items default to **Draft**.
- **Edit** changes an existing item. Saving a published item updates its public content.
- **Publish** makes a draft visible to users. **Hide** returns an item to Draft without deleting it.
- **Delete** permanently removes an item after confirmation.
- **View page** opens the corresponding public page.

Guides support a title, summary, category, reading time, icon, and up to 20 steps (one per line). The guide library, homepage preview, and assistant use published guides. There is no hardcoded public fallback after an item is hidden or deleted.

Media supports credited external links (including YouTube), image uploads, direct HTTPS video-file links, and validated MP4/WebM uploads. Leave the replacement upload empty to retain an existing file. PNG/JPEG/WebP images have a 3 MB limit; videos have a 20 MB limit and require `TECHCARE_FFPROBE` on the server. A direct video-file link is available when that validator is not configured. Media filters apply before pagination.

Booths support a title, description, activity label, date and date note, venue, hours, campus image or upload, image description, visit steps, preparation list, safety guidance, and additional note. The public page lists all published booths, newest first; the homepage previews the newest published booth. Use Hide when an old event should no longer appear.

Admin saves refresh content in that browser session. Other visitors see updated content when they reload or revisit the page; there is no live cross-browser push. Draft uploads are only accessible to administrators, and hiding an uploaded item revokes new public media requests. Shared static illustrations and external URLs remain public independently of an item's visibility.

## Permissions and persistence

All management endpoints require the admin role on the server. Moderators retain their existing ability to publish a new media resource through Moderation, but cannot edit, hide, or delete existing page content. Members and guests can only read published content.

Migration 4 preserves existing resources, copies the four original guides and existing booth details into editable records once, and adds draft visibility and edit revisions. Data is stored in the existing SQLite database. Deleted defaults do not return on restart. Revision checks reject stale edits rather than overwriting a newer save. Mutations are audited. Replaced or deleted managed uploads are removed when no remaining content references them.

## Verification

`npm test` includes API permissions, CRUD, visibility, media access and cleanup, validation, conflict handling, rollback, and migration preservation checks.

`npm run test:content` builds the app and runs the real admin/public browser flow with Microsoft Edge against an isolated temporary database on port 3016. It checks guide creation/editing/hiding/deletion, assistant content, media publication, booth/homepage synchronization, accessibility, and mobile overflow. It does not change the preview's accounts or content. Reports and screenshots are saved under ignored `artifacts/`.
