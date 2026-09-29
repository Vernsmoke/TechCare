-- TechCare MySQL schema for a fresh installation.
-- Import with MySQL Workbench, then configure TECHCARE_DB_* in .env.local.
-- This creates a database named techcare; edit the CREATE DATABASE / USE names
-- here if you want a different database name.
CREATE DATABASE IF NOT EXISTS techcare
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
USE techcare;

CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(80) NOT NULL,
  email VARCHAR(160) NOT NULL,
  hash VARCHAR(255) NOT NULL,
  role ENUM('member','moderator','admin') NOT NULL DEFAULT 'member',
  bio VARCHAR(400) NOT NULL DEFAULT '',
  avatar VARCHAR(255) NOT NULL DEFAULT '',
  created BIGINT NOT NULL,
  visibility ENUM('public','private') NOT NULL DEFAULT 'public',
  verified TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY users_email (email)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS email_verifications (
  user_id INT UNSIGNED NOT NULL,
  code_hash VARCHAR(255) NOT NULL,
  expires BIGINT NOT NULL,
  attempts INT UNSIGNED NOT NULL DEFAULT 0,
  last_sent BIGINT NOT NULL,
  PRIMARY KEY (user_id),
  CONSTRAINT email_verifications_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS sessions (
  token_hash CHAR(64) NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  expires BIGINT NOT NULL,
  PRIMARY KEY (token_hash),
  KEY session_user (user_id),
  CONSTRAINT sessions_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS oauth_accounts (
  provider VARCHAR(32) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  created BIGINT NOT NULL,
  PRIMARY KEY (provider, subject),
  KEY oauth_accounts_user (user_id),
  CONSTRAINT oauth_accounts_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS follows (
  follower INT UNSIGNED NOT NULL,
  followed INT UNSIGNED NOT NULL,
  PRIMARY KEY (follower, followed),
  CONSTRAINT follows_follower_fk FOREIGN KEY (follower) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT follows_followed_fk FOREIGN KEY (followed) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT follows_not_self CHECK (follower <> followed)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS posts (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  title VARCHAR(120) NOT NULL,
  body VARCHAR(2000) NOT NULL,
  category VARCHAR(40) NOT NULL,
  status ENUM('pending','published','rejected') NOT NULL DEFAULT 'pending',
  created BIGINT NOT NULL,
  photo VARCHAR(255) NOT NULL DEFAULT '',
  PRIMARY KEY (id),
  KEY post_status_time (status, created DESC, id DESC),
  KEY post_photo (photo),
  CONSTRAINT posts_user_fk FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS comments (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  post_id INT UNSIGNED NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  body VARCHAR(1000) NOT NULL,
  status ENUM('pending','published','rejected') NOT NULL DEFAULT 'pending',
  created BIGINT NOT NULL,
  PRIMARY KEY (id),
  KEY comment_parent_status (post_id, status, created),
  CONSTRAINT comments_post_fk FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
  CONSTRAINT comments_user_fk FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS resources (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  title VARCHAR(120) NOT NULL,
  description VARCHAR(500) NOT NULL,
  category VARCHAR(40) NOT NULL,
  type ENUM('external','image','video') NOT NULL,
  url VARCHAR(1000) NOT NULL,
  author VARCHAR(80) NOT NULL,
  created BIGINT NOT NULL,
  status ENUM('draft','published') NOT NULL DEFAULT 'published',
  revision INT UNSIGNED NOT NULL DEFAULT 1,
  PRIMARY KEY (id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS feedback (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  rating TINYINT UNSIGNED NOT NULL,
  message VARCHAR(1000) NOT NULL,
  created BIGINT NOT NULL,
  PRIMARY KEY (id),
  CONSTRAINT feedback_user_fk FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT feedback_rating_check CHECK (rating BETWEEN 1 AND 5)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS lost_found (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  kind ENUM('lost','found') NOT NULL,
  item VARCHAR(100) NOT NULL,
  details VARCHAR(500) NOT NULL,
  location VARCHAR(100) NOT NULL,
  status ENUM('pending','published','rejected') NOT NULL DEFAULT 'pending',
  created BIGINT NOT NULL,
  PRIMARY KEY (id),
  CONSTRAINT lost_found_user_fk FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS friendships (
  sender INT UNSIGNED NOT NULL,
  receiver INT UNSIGNED NOT NULL,
  status ENUM('pending','accepted') NOT NULL DEFAULT 'pending',
  created BIGINT NOT NULL,
  pair_low INT UNSIGNED GENERATED ALWAYS AS (LEAST(sender, receiver)) STORED,
  pair_high INT UNSIGNED GENERATED ALWAYS AS (GREATEST(sender, receiver)) STORED,
  PRIMARY KEY (sender, receiver),
  UNIQUE KEY friendship_pair (pair_low, pair_high),
  CONSTRAINT friendships_sender_fk FOREIGN KEY (sender) REFERENCES users(id),
  CONSTRAINT friendships_receiver_fk FOREIGN KEY (receiver) REFERENCES users(id),
  CONSTRAINT friendships_not_self CHECK (sender <> receiver)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS messages (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  sender INT UNSIGNED NOT NULL,
  receiver INT UNSIGNED NOT NULL,
  body VARCHAR(1000) NOT NULL,
  created BIGINT NOT NULL,
  PRIMARY KEY (id),
  KEY message_pair (sender, receiver, id),
  CONSTRAINT messages_sender_fk FOREIGN KEY (sender) REFERENCES users(id),
  CONSTRAINT messages_receiver_fk FOREIGN KEY (receiver) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS settings (
  `key` VARCHAR(80) NOT NULL,
  `value` VARCHAR(1000) NOT NULL,
  PRIMARY KEY (`key`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS password_resets (
  token_hash CHAR(64) NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  expires BIGINT NOT NULL,
  PRIMARY KEY (token_hash),
  CONSTRAINT password_resets_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS media (
  name VARCHAR(64) NOT NULL,
  owner INT UNSIGNED NOT NULL,
  access ENUM('profile','public','question','announcement','managed') NOT NULL,
  mime VARCHAR(80) NOT NULL,
  bytes BIGINT UNSIGNED NOT NULL,
  created BIGINT NOT NULL,
  PRIMARY KEY (name),
  CONSTRAINT media_owner_fk FOREIGN KEY (owner) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS audit (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  actor INT UNSIGNED NOT NULL,
  action VARCHAR(80) NOT NULL,
  kind VARCHAR(40) NOT NULL,
  target INT UNSIGNED NOT NULL,
  reason VARCHAR(500) NOT NULL DEFAULT '',
  created BIGINT NOT NULL,
  PRIMARY KEY (id),
  CONSTRAINT audit_actor_fk FOREIGN KEY (actor) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS blocks (
  blocker INT UNSIGNED NOT NULL,
  blocked INT UNSIGNED NOT NULL,
  created BIGINT NOT NULL,
  PRIMARY KEY (blocker, blocked),
  CONSTRAINT blocks_blocker_fk FOREIGN KEY (blocker) REFERENCES users(id),
  CONSTRAINT blocks_blocked_fk FOREIGN KEY (blocked) REFERENCES users(id),
  CONSTRAINT blocks_not_self CHECK (blocker <> blocked)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS message_reports (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  reporter INT UNSIGNED NOT NULL,
  message_id INT UNSIGNED NOT NULL,
  reason VARCHAR(500) NOT NULL,
  created BIGINT NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY message_report_once (reporter, message_id),
  CONSTRAINT message_reports_reporter_fk FOREIGN KEY (reporter) REFERENCES users(id),
  CONSTRAINT message_reports_message_fk FOREIGN KEY (message_id) REFERENCES messages(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS rate_limits (
  `key` VARCHAR(255) NOT NULL,
  count INT UNSIGNED NOT NULL,
  expires BIGINT NOT NULL,
  PRIMARY KEY (`key`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS announcements (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  title VARCHAR(100) NOT NULL,
  description VARCHAR(280) NOT NULL DEFAULT '',
  image VARCHAR(255) NOT NULL,
  alt VARCHAR(160) NOT NULL,
  `date` CHAR(10) NOT NULL DEFAULT '',
  link VARCHAR(1000) NOT NULL DEFAULT '',
  status ENUM('draft','published') NOT NULL DEFAULT 'draft',
  `position` INT UNSIGNED NOT NULL,
  revision INT UNSIGNED NOT NULL DEFAULT 1,
  created BIGINT NOT NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS guides (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  title VARCHAR(120) NOT NULL,
  summary VARCHAR(500) NOT NULL,
  category VARCHAR(40) NOT NULL,
  `time` VARCHAR(40) NOT NULL,
  icon VARCHAR(20) NOT NULL,
  steps LONGTEXT NOT NULL,
  status ENUM('draft','published') NOT NULL DEFAULT 'draft',
  revision INT UNSIGNED NOT NULL DEFAULT 1,
  created BIGINT NOT NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS booths (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  title VARCHAR(120) NOT NULL,
  description VARCHAR(1000) NOT NULL,
  label VARCHAR(80) NOT NULL,
  `date` CHAR(10) NOT NULL DEFAULT '',
  dateNote VARCHAR(160) NOT NULL DEFAULT '',
  venue VARCHAR(160) NOT NULL,
  hours VARCHAR(160) NOT NULL,
  image VARCHAR(255) NOT NULL,
  alt VARCHAR(200) NOT NULL,
  steps LONGTEXT NOT NULL,
  preparation LONGTEXT NOT NULL,
  safety VARCHAR(2000) NOT NULL,
  note VARCHAR(1000) NOT NULL DEFAULT '',
  status ENUM('draft','published') NOT NULL DEFAULT 'draft',
  revision INT UNSIGNED NOT NULL DEFAULT 1,
  created BIGINT NOT NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS post_votes (
  post_id INT UNSIGNED NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  `value` TINYINT NOT NULL,
  PRIMARY KEY (post_id, user_id),
  CONSTRAINT post_votes_post_fk FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
  CONSTRAINT post_votes_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT post_votes_value_check CHECK (`value` IN (-1, 1))
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS comment_votes (
  comment_id INT UNSIGNED NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  `value` TINYINT NOT NULL,
  PRIMARY KEY (comment_id, user_id),
  CONSTRAINT comment_votes_comment_fk FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE,
  CONSTRAINT comment_votes_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT comment_votes_value_check CHECK (`value` IN (-1, 1))
) ENGINE=InnoDB;

-- Pilot seed content. The app can be used immediately after importing the schema.
INSERT IGNORE INTO resources
  (id,title,description,category,type,url,author,created,status,revision)
VALUES
  (1,'Fix Wi-Fi connection problems in Windows',
   'A specific video tutorial covering basic Wi-Fi troubleshooting. Review before following the steps.',
   'Connectivity','external','https://www.youtube.com/watch?v=xgVBNxeH-KU',
   'Sertilink IT',UNIX_TIMESTAMP(),'published',1),
  (2,'Five ways to care for your laptop',
   'A sample device-care flyer for student review before distribution.',
   'Hardware','image','/static/device-care-guide.png',
   'Project TechCare template',UNIX_TIMESTAMP(),'published',1);

INSERT IGNORE INTO guides
  (id,title,summary,category,`time`,icon,steps,status,revision,created)
VALUES
  (1,'Speed up a slow Windows PC','A smoother start, without changing your hardware.',
   'Operating system','4 min read','desktop',
   '["Restart your computer and note when it slows down.","Check free storage space in Settings. Move only files you recognize and have backed up.","Review startup apps in Task Manager. Disable only optional apps you recognize.","Apply official Windows updates, then test again. If the issue continues, describe what you observed in Discussion."]',
   'published',1,UNIX_TIMESTAMP()),
  (2,'Wi-Fi connected, no internet?','Find out where the connection is getting stuck.',
   'Connectivity','3 min read','wifi',
   '["Try another device on the same network to see whether the issue is shared.","Confirm the network name and Wi-Fi status. Avoid unfamiliar open networks.","Restart the router only if you own it or are authorized to do so.","Run the Windows network troubleshooter. For a campus network, contact the authorized IT team."]',
   'published',1,UNIX_TIMESTAMP()),
  (3,'Laptop won’t turn on?','Start with a few safe, simple external checks.',
   'Hardware','3 min read','laptop',
   '["Inspect the outlet and charger for visible damage. Do not use damaged equipment.","Disconnect external devices and try turning the laptop on once.","Record any lights, sounds, and screen response.","Stop if the battery is swollen, the device is unusually hot, or you notice a burning smell. Seek qualified support."]',
   'published',1,UNIX_TIMESTAMP()),
  (4,'Spot a suspicious message','Pause, check, and keep your information safe.',
   'Online safety','4 min read','shield',
   '["Do not open unexpected attachments or follow links asking for passwords or payment.","Check the sender’s full address, not just the display name.","Contact the organization using an independently verified channel.","Report the message through your email provider or campus IT. Do not publish private identifiers in a discussion."]',
   'published',1,UNIX_TIMESTAMP());

INSERT IGNORE INTO booths
  (id,title,description,label,date,dateNote,venue,hours,image,alt,steps,preparation,safety,note,status,revision,created)
VALUES
  (1,'Your campus Tech Support Booth',
   'Safe, supervised support for laptops and desktop computers, with a focus on learning together.',
   'Planned campus activity','2026-10-16','Planned date, pending College approval',
   'On campus','Venue and hours to be confirmed','/static/techcare-hero.webp',
   'Illustrated student volunteers helping a visitor at a technology support booth',
   '["Intake & consent: Tell us your concern. The team records the device condition and asks for your permission before starting.","Guided diagnosis: Students perform safe checks under faculty and guest technician supervision.","Test & release: Review the result together, receive recommendations, and acknowledge device release."]',
   '["Back up important files if possible.","Bring your charger and relevant accessories.","Unlock your device yourself. Never disclose your password.","Note when the problem started and what you have tried."]',
   'We do not perform board-level or battery-cell repairs, bypass accounts, or install pirated software. Unsafe or complex cases are referred to qualified support. Stop using a device with a swollen battery or unusual heat.',
   'This student project is not an official University website. Schedule, venue, scope, and visual identity require College approval.',
   'published',1,UNIX_TIMESTAMP());
