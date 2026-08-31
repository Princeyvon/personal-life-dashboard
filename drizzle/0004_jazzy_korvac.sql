CREATE TABLE `daily_rewind_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`enabled` int NOT NULL DEFAULT 0,
	`scheduleCronTaskUid` varchar(65),
	`pending` int NOT NULL DEFAULT 0,
	`pendingAt` timestamp,
	`lastCapturedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `daily_rewind_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `daily_rewind_settings_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE INDEX `daily_rewind_settings_user_id_idx` ON `daily_rewind_settings` (`userId`);--> statement-breakpoint
CREATE INDEX `daily_rewind_settings_schedule_uid_idx` ON `daily_rewind_settings` (`scheduleCronTaskUid`);