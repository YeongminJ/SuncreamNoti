-- Add notification_agreed_at (ms epoch) for storing the moment the user
-- accepted the Toss notification agreement (Notification.requestAgreement).
-- NULL = not agreed yet; cron filters on this column instead of toss_user_key.
ALTER TABLE `users` ADD COLUMN `notification_agreed_at` INTEGER;
