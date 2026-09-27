# Discussion feed and question pages

Discussion now uses a feed of questions with author details, category, a text excerpt, attached photo, vote score, and comment count. **Newest** orders by publication record creation time; **Top** orders by total vote score, with newer questions first for ties. Search and category filters apply before pagination and remain in the URL.

Each published question has its own `/discussion/<id>` page, with its complete text, photo, comments, and comment form. **Copy link** shares the question address. The comment count links directly to the comments section. Old `/discussion?thread=<id>` links redirect to the question page, including questions outside the first feed page.

Signed-in members, moderators, and admins can upvote or downvote questions and published comments. Each account has one vote per item. Choosing the other direction replaces the previous vote; choosing the selected direction removes it. The displayed score is upvotes minus downvotes. Guests can read content; voting and commenting prompt sign-in. Voter identities are not returned publicly.

Existing moderation behavior is retained: questions and member comments need approval; moderator/admin comments publish immediately. Pending or rejected questions cannot be read through direct links or voted on. Comments under an unavailable parent question are unavailable as well. Comments remain a flat chronological list with pagination.

Migration 5 adds `post_votes` and `comment_votes` without changing existing questions or comments. Votes have database-enforced unique account/target pairs, constrained values, and foreign keys. Vote writes are transactional and idempotent, with existing same-origin checks and per-account rate limits.

Run `npm test` for API and migration checks. `npm run test:discussion` builds the app, then runs the real member/admin/guest flows in Edge on port 3018 with synthetic data in a temporary database. It verifies voting, persistence, moderation, direct links, sorting, filtering, accessibility, and mobile layout. It does not change real preview content. Screenshots and a report are saved in ignored `artifacts/`.
