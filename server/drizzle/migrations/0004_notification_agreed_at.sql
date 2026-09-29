-- Add notification_agreed_at (ms epoch) for storing the moment the user
-- accepted the Toss notification agreement (Notification.requestAgreement).
-- NULL = not agreed yet; cron filters on this column instead of toss_user_key.
ALTER TABLE `users` ADD COLUMN `notification_agreed_at` INTEGER;

-- Backfill: users who already had `toss_user_key` populated were being
-- notified under the old policy — treat them as agreed at their last-updated
-- moment so they don't drop off the cron the instant the new filter kicks in.
-- New/unregistered users stay NULL and will populate when their client sends
-- the agreement outcome (or the delayed-sync path in notificationAgreement.ts).
UPDATE `users`
SET `notification_agreed_at` = `updated_at`
WHERE `toss_user_key` IS NOT NULL AND `notification_agreed_at` IS NULL;
