-- TechCare MySQL 8.0.16+ schema (latest application schema, migration version 7).
-- Select the application database before applying this file.
SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(80) NOT NULL,
  email VARCHAR(254) NOT NULL,
  hash VARCHAR(160) NOT NULL,
  role VARCHAR(16) NOT NULL DEFAULT 'member',
  bio VARCHAR(1000) NOT NULL DEFAULT '',
  avatar VARCHAR(512) NOT NULL DEFAULT '',
  created BIGINT NOT NULL,
  visibility VARCHAR(16) NOT NULL DEFAULT 'public',
  verified TINYINT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY users_email (email),
  CONSTRAINT users_role_check CHECK (role IN ('member','moderator','admin')),
  CONSTRAINT users_visibility_check CHECK (visibility IN ('public','private'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS email_verifications (
  user_id INT UNSIGNED NOT NULL,
  code_hash VARCHAR(160) NOT NULL,
  expires BIGINT NOT NULL,
  attempts INT UNSIGNED NOT NULL DEFAULT 0,
  last_sent BIGINT NOT NULL,
  PRIMARY KEY (user_id),
  CONSTRAINT email_verifications_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sessions (
  token_hash CHAR(64) NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  expires BIGINT NOT NULL,
  PRIMARY KEY (token_hash),
  KEY session_user (user_id),
  CONSTRAINT sessions_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS follows (
  follower INT UNSIGNED NOT NULL,
  followed INT UNSIGNED NOT NULL,
  PRIMARY KEY (follower,followed),
  CONSTRAINT follows_follower_fk FOREIGN KEY (follower) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT follows_followed_fk FOREIGN KEY (followed) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT follows_not_self CHECK (follower <> followed)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS posts (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  title VARCHAR(160) NOT NULL,
  body TEXT NOT NULL,
  category VARCHAR(80) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'pending',
  created BIGINT NOT NULL,
  photo VARCHAR(512) NOT NULL DEFAULT '',
  PRIMARY KEY (id),
  KEY post_status_time (status,created DESC,id DESC),
  KEY posts_user_created (user_id,created DESC,id DESC),
  KEY post_photo (photo),
  CONSTRAINT posts_user_fk FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT posts_status_check CHECK (status IN ('pending','published','rejected'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS comments (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  post_id INT UNSIGNED NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  body TEXT NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'pending',
  created BIGINT NOT NULL,
  photo VARCHAR(512) NOT NULL DEFAULT '',
  parent_id INT UNSIGNED NULL,
  root_id INT UNSIGNED NULL,
  deleted TINYINT UNSIGNED NOT NULL DEFAULT 0,
  revision INT UNSIGNED NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  KEY comment_parent_status (post_id,status,created),
  KEY comment_thread (root_id,status,created,id),
  KEY comment_photo (photo),
  CONSTRAINT comments_post_fk FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
  CONSTRAINT comments_user_fk FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT comments_parent_fk FOREIGN KEY (parent_id) REFERENCES comments(id) ON DELETE SET NULL,
  CONSTRAINT comments_root_fk FOREIGN KEY (root_id) REFERENCES comments(id) ON DELETE CASCADE,
  CONSTRAINT comments_status_check CHECK (status IN ('pending','published','rejected'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS resources (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  title VARCHAR(160) NOT NULL,
  description TEXT NOT NULL,
  category VARCHAR(80) NOT NULL,
  type VARCHAR(24) NOT NULL,
  url VARCHAR(2048) NOT NULL,
  author VARCHAR(120) NOT NULL,
  created BIGINT NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'published',
  revision INT UNSIGNED NOT NULL DEFAULT 1,
  cover VARCHAR(512) NOT NULL DEFAULT '',
  PRIMARY KEY (id),
  CONSTRAINT resources_status_check CHECK (status IN ('draft','published'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS feedback (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  rating TINYINT UNSIGNED NOT NULL,
  message TEXT NOT NULL,
  created BIGINT NOT NULL,
  PRIMARY KEY (id),
  CONSTRAINT feedback_user_fk FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT feedback_rating_check CHECK (rating BETWEEN 1 AND 5)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS lost_found (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  kind VARCHAR(16) NOT NULL,
  item VARCHAR(160) NOT NULL,
  details TEXT NOT NULL,
  location VARCHAR(160) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'pending',
  created BIGINT NOT NULL,
  photos LONGTEXT NOT NULL,
  event_date CHAR(10) NOT NULL DEFAULT '',
  returned TINYINT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  CONSTRAINT lost_found_user_fk FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT lost_found_kind_check CHECK (kind IN ('lost','found')),
  CONSTRAINT lost_found_status_check CHECK (status IN ('pending','published','rejected'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS friendships (
  sender INT UNSIGNED NOT NULL,
  receiver INT UNSIGNED NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'pending',
  created BIGINT NOT NULL,
  pair_low INT UNSIGNED GENERATED ALWAYS AS (LEAST(sender,receiver)) STORED,
  pair_high INT UNSIGNED GENERATED ALWAYS AS (GREATEST(sender,receiver)) STORED,
  PRIMARY KEY (sender,receiver),
  UNIQUE KEY friendship_pair (pair_low,pair_high),
  CONSTRAINT friendships_sender_fk FOREIGN KEY (sender) REFERENCES users(id),
  CONSTRAINT friendships_receiver_fk FOREIGN KEY (receiver) REFERENCES users(id),
  CONSTRAINT friendships_not_self CHECK (sender <> receiver),
  CONSTRAINT friendships_status_check CHECK (status IN ('pending','accepted'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS messages (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  sender INT UNSIGNED NOT NULL,
  receiver INT UNSIGNED NOT NULL,
  body TEXT NOT NULL,
  created BIGINT NOT NULL,
  PRIMARY KEY (id),
  KEY message_pair (sender,receiver,id),
  CONSTRAINT messages_sender_fk FOREIGN KEY (sender) REFERENCES users(id),
  CONSTRAINT messages_receiver_fk FOREIGN KEY (receiver) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS settings (
  `key` VARCHAR(120) NOT NULL,
  value TEXT NOT NULL,
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS password_resets (
  token_hash CHAR(64) NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  expires BIGINT NOT NULL,
  PRIMARY KEY (token_hash),
  CONSTRAINT password_resets_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS media (
  name VARCHAR(64) NOT NULL,
  owner INT UNSIGNED NOT NULL,
  access VARCHAR(24) NOT NULL,
  mime VARCHAR(100) NOT NULL,
  bytes INT UNSIGNED NOT NULL,
  created BIGINT NOT NULL,
  PRIMARY KEY (name),
  KEY media_owner (owner),
  CONSTRAINT media_owner_fk FOREIGN KEY (owner) REFERENCES users(id),
  CONSTRAINT media_access_check CHECK (access IN ('profile','public','question','announcement','managed','comment','lost'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS audit (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  actor INT UNSIGNED NOT NULL,
  action VARCHAR(80) NOT NULL,
  kind VARCHAR(40) NOT NULL,
  target INT UNSIGNED NOT NULL,
  reason VARCHAR(1000) NOT NULL DEFAULT '',
  created BIGINT NOT NULL,
  PRIMARY KEY (id),
  KEY audit_kind_target (kind,target),
  CONSTRAINT audit_actor_fk FOREIGN KEY (actor) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS blocks (
  blocker INT UNSIGNED NOT NULL,
  blocked INT UNSIGNED NOT NULL,
  created BIGINT NOT NULL,
  PRIMARY KEY (blocker,blocked),
  CONSTRAINT blocks_blocker_fk FOREIGN KEY (blocker) REFERENCES users(id),
  CONSTRAINT blocks_blocked_fk FOREIGN KEY (blocked) REFERENCES users(id),
  CONSTRAINT blocks_not_self CHECK (blocker <> blocked)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS message_reports (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  reporter INT UNSIGNED NOT NULL,
  message_id INT UNSIGNED NOT NULL,
  reason TEXT NOT NULL,
  created BIGINT NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY message_reports_reporter_message (reporter,message_id),
  CONSTRAINT message_reports_reporter_fk FOREIGN KEY (reporter) REFERENCES users(id),
  CONSTRAINT message_reports_message_fk FOREIGN KEY (message_id) REFERENCES messages(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS rate_limits (
  `key` VARCHAR(191) NOT NULL,
  count INT UNSIGNED NOT NULL,
  expires BIGINT NOT NULL,
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS migrations (
  version INT UNSIGNED NOT NULL,
  applied BIGINT NOT NULL,
  PRIMARY KEY (version)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS announcements (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  title VARCHAR(160) NOT NULL,
  description VARCHAR(1000) NOT NULL DEFAULT '',
  image VARCHAR(512) NOT NULL,
  alt VARCHAR(240) NOT NULL,
  date CHAR(10) NOT NULL DEFAULT '',
  link VARCHAR(2048) NOT NULL DEFAULT '',
  status VARCHAR(16) NOT NULL DEFAULT 'draft',
  position INT UNSIGNED NOT NULL,
  revision INT UNSIGNED NOT NULL DEFAULT 1,
  created BIGINT NOT NULL,
  PRIMARY KEY (id),
  KEY announcements_order (position,id),
  KEY announcements_image (image),
  CONSTRAINT announcements_status_check CHECK (status IN ('draft','published'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS guides (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  title VARCHAR(160) NOT NULL,
  summary VARCHAR(500) NOT NULL,
  category VARCHAR(80) NOT NULL,
  time VARCHAR(40) NOT NULL,
  icon VARCHAR(24) NOT NULL,
  steps LONGTEXT NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'draft',
  revision INT UNSIGNED NOT NULL DEFAULT 1,
  created BIGINT NOT NULL,
  images LONGTEXT NOT NULL,
  PRIMARY KEY (id),
  CONSTRAINT guides_status_check CHECK (status IN ('draft','published'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS booths (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  title VARCHAR(160) NOT NULL,
  description TEXT NOT NULL,
  label VARCHAR(100) NOT NULL,
  date CHAR(10) NOT NULL DEFAULT '',
  dateNote VARCHAR(240) NOT NULL DEFAULT '',
  venue VARCHAR(200) NOT NULL,
  hours VARCHAR(200) NOT NULL,
  image VARCHAR(512) NOT NULL,
  alt VARCHAR(240) NOT NULL,
  steps LONGTEXT NOT NULL,
  preparation LONGTEXT NOT NULL,
  safety TEXT NOT NULL,
  note TEXT NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'draft',
  revision INT UNSIGNED NOT NULL DEFAULT 1,
  created BIGINT NOT NULL,
  PRIMARY KEY (id),
  CONSTRAINT booths_status_check CHECK (status IN ('draft','published'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS post_votes (
  post_id INT UNSIGNED NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  value TINYINT NOT NULL,
  PRIMARY KEY (post_id,user_id),
  CONSTRAINT post_votes_post_fk FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
  CONSTRAINT post_votes_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT post_votes_value_check CHECK (value IN (-1,1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS comment_votes (
  comment_id INT UNSIGNED NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  value TINYINT NOT NULL,
  PRIMARY KEY (comment_id,user_id),
  CONSTRAINT comment_votes_comment_fk FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE,
  CONSTRAINT comment_votes_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT comment_votes_value_check CHECK (value IN (-1,1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS notifications (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  comment_id INT UNSIGNED NOT NULL,
  seen TINYINT UNSIGNED NOT NULL DEFAULT 0,
  created BIGINT NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY notifications_comment (comment_id),
  KEY notifications_user (user_id,id),
  CONSTRAINT notifications_user_fk FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT notifications_comment_fk FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS content_reports (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  reporter INT UNSIGNED NOT NULL,
  kind VARCHAR(16) NOT NULL,
  target INT UNSIGNED NOT NULL,
  reason TEXT NOT NULL,
  resolved TINYINT UNSIGNED NOT NULL DEFAULT 0,
  created BIGINT NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY content_reports_unique (reporter,kind,target),
  CONSTRAINT content_reports_reporter_fk FOREIGN KEY (reporter) REFERENCES users(id),
  CONSTRAINT content_reports_kind_check CHECK (kind IN ('post','comment'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS item_inquiries (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  report_id INT UNSIGNED NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  body TEXT NOT NULL,
  created BIGINT NOT NULL,
  response VARCHAR(1000) NOT NULL DEFAULT '',
  PRIMARY KEY (id),
  KEY item_inquiries_report (report_id,id),
  CONSTRAINT item_inquiries_report_fk FOREIGN KEY (report_id) REFERENCES lost_found(id),
  CONSTRAINT item_inquiries_user_fk FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO migrations (version,applied)
VALUES (1,UNIX_TIMESTAMP()),(2,UNIX_TIMESTAMP()),(3,UNIX_TIMESTAMP()),
       (4,UNIX_TIMESTAMP()),(5,UNIX_TIMESTAMP()),(6,UNIX_TIMESTAMP()),(7,UNIX_TIMESTAMP());
