CREATE TABLE `users` (
  `user_key` TEXT PRIMARY KEY NOT NULL,
  `skin_type` TEXT NOT NULL,
  `environment` TEXT NOT NULL,
  `start_minute` INTEGER NOT NULL,
  `end_minute` INTEGER NOT NULL,
  `timezone` TEXT NOT NULL DEFAULT 'Asia/Seoul',
  `created_at` INTEGER NOT NULL,
  `updated_at` INTEGER NOT NULL
);

CREATE TABLE `user_slots` (
  `user_key` TEXT NOT NULL,
  `slot_minute` INTEGER NOT NULL,
  PRIMARY KEY (`user_key`, `slot_minute`)
);

CREATE INDEX `user_slots_minute_idx` ON `user_slots` (`slot_minute`);

CREATE TABLE `notifications` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  `user_key` TEXT NOT NULL,
  `date` TEXT NOT NULL,
  `slot_minute` INTEGER NOT NULL,
  `status` TEXT NOT NULL,
  `sent_at` INTEGER NOT NULL,
  `error` TEXT
);

CREATE UNIQUE INDEX `notifications_user_date_slot` ON `notifications` (
  `user_key`,
  `date`,
  `slot_minute`
);
