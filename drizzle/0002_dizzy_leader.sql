CREATE TABLE `quote_cache` (
	`day` text PRIMARY KEY NOT NULL,
	`text` text,
	`author` text,
	`checked_at` integer NOT NULL
);
