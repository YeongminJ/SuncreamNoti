ALTER TABLE `users` ADD COLUMN `toss_user_key` INTEGER;

CREATE INDEX `users_toss_user_key_idx` ON `users` (`toss_user_key`);
