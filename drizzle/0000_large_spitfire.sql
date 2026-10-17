CREATE TABLE `entries` (
	`owner` text NOT NULL,
	`date` text NOT NULL,
	`workout` text,
	`bedtime` text,
	`bedtime_day` text DEFAULT 'previous' NOT NULL,
	`wake_time` text,
	`alcohol` text,
	`alcohol_quantity` text,
	`junk_food` text,
	`notes` text DEFAULT '' NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`owner`, `date`)
);
--> statement-breakpoint
CREATE TABLE `phases` (
	`owner` text PRIMARY KEY NOT NULL,
	`start_date` text NOT NULL,
	`weeks` integer NOT NULL,
	`title` text NOT NULL
);
