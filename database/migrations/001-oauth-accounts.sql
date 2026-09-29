CREATE TABLE IF NOT EXISTS oauth_accounts (
  provider VARCHAR(32) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  created BIGINT NOT NULL,
  PRIMARY KEY (provider, subject),
  KEY oauth_accounts_user (user_id),
  CONSTRAINT oauth_accounts_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;
