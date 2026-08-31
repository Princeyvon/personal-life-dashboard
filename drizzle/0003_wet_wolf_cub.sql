CREATE TABLE `calendar_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`googleEventId` varchar(255),
	`calendarId` varchar(255) NOT NULL DEFAULT 'primary',
	`title` varchar(255) NOT NULL,
	`description` text,
	`location` varchar(512),
	`startAt` timestamp NOT NULL,
	`endAt` timestamp NOT NULL,
	`allDay` int NOT NULL DEFAULT 0,
	`source` enum('dashboard','google') NOT NULL DEFAULT 'dashboard',
	`etag` varchar(255),
	`lastSyncedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `calendar_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `google_calendar_connections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`calendarId` varchar(255) NOT NULL DEFAULT 'primary',
	`encryptedCredentials` text NOT NULL,
	`expiresAt` timestamp,
	`lastSyncedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `google_calendar_connections_id` PRIMARY KEY(`id`),
	CONSTRAINT `google_calendar_connections_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE INDEX `calendar_events_user_id_idx` ON `calendar_events` (`userId`);--> statement-breakpoint
CREATE INDEX `calendar_events_google_event_idx` ON `calendar_events` (`userId`,`googleEventId`);--> statement-breakpoint
CREATE INDEX `google_calendar_connections_user_id_idx` ON `google_calendar_connections` (`userId`);