# Homepage announcements

Sign in as an administrator and open **Admin → Announcements → Add announcement**.

1. Choose a campus photo under **Image source**, or upload a PNG, JPEG, or WebP image (up to 3 MB). The preview shows the complete image. The three campus photos have matching day/night versions that automatically follow the app's light/dark setting, including enlarged views and admin previews. Custom uploads use the same image in both modes.
2. Enter a title and image description. Add a short description, event date, and HTTPS details link if needed.
3. Choose **Draft (hidden)** to prepare privately, or **Published** to show it on the homepage. Select **Save announcement**.

Use **Edit** to change the details or replace the image. Leaving the replacement field empty retains the current image. **Publish / Hide** controls visibility. The arrow buttons change order; **Delete** asks for confirmation. Up to 12 announcements can be stored.

Dates are event labels, not publication schedules or automatic expiry dates. Hide outdated announcements when appropriate. Details links open a new tab.

Visitors see one complete image with readable text underneath. When multiple announcements are published, they rotate every seven seconds with a gentle fade and slide. Previous/next and pause/play controls remain available. Rotation pauses while the pointer or keyboard focus is inside the carousel, while an image is enlarged, when the carousel is offscreen, and when the browser tab is hidden. Returning to the carousel starts a fresh seven-second interval. Reduced-motion preferences disable autoplay by default and remove the transition; visitors can still navigate manually or explicitly start rotation. A single announcement stays still. Slides share a stable height so the content below does not jump as they change.

The campus photos fill the background around one nearly opaque content panel, matching the reference on port 3000. The homepage uses the dormitory courtyard, the booth page uses the covered walkway, and other pages use the campus building. Light/dark mode crossfades matching day/night images; reduced-motion preferences disable the fade. Announcement content is independent of the background. If no announcement is published, the homepage illustration appears with a brief empty message. Admins can change that illustration under **Homepage illustration**. No sample announcements or accounts are inserted into the live database.

Draft announcement details and uploaded draft images are readable only by admins. Hiding an announcement also restricts its uploaded image URL. Campus photos are shared public assets and remain available independently of announcements. Uploaded images are validated and re-encoded; replaced/deleted announcement uploads are removed when no announcement references them. Saves reject stale revisions to prevent another admin's edit being silently overwritten.

Database migration 3 creates the announcements table and adds the announcement media category while retaining existing accounts, posts, and uploads. It runs automatically when the app opens its database.

Verification: `npm test` includes permission, image privacy, validation, ordering, replacement, rollback, and deletion checks. `node scripts/announcements-check.mjs` uses an isolated database and production server on port 3014 to test the admin and public browser flows. Run `npm run build` first. Screenshots and results are saved under ignored `artifacts/`.

With the preview running on port 3000, `node scripts/announcement-carousel-check.mjs` verifies rotation, wrapping, manual navigation, pause conditions, reduced motion, layout stability, accessibility, and single/empty states. It intercepts announcement requests with browser-only fixtures and does not modify saved announcements.
