CREATE TABLE `__new_quote_cache` (
	`owner` text DEFAULT '' NOT NULL,
	`day` text NOT NULL,
	`text` text,
	`author` text,
	`checked_at` integer NOT NULL,
	PRIMARY KEY(`owner`, `day`)
);
--> statement-breakpoint
INSERT INTO `__new_quote_cache`("owner", "day", "text", "author", "checked_at") SELECT '', "day", "text", "author", "checked_at" FROM `quote_cache`;--> statement-breakpoint
DROP TABLE `quote_cache`;--> statement-breakpoint
ALTER TABLE `__new_quote_cache` RENAME TO `quote_cache`;--> statement-breakpoint