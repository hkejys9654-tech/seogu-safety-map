CREATE TABLE `chore_cards` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`notice` text DEFAULT '' NOT NULL,
	`prepare` text DEFAULT '' NOT NULL,
	`action` text DEFAULT '' NOT NULL,
	`kid` integer DEFAULT false NOT NULL,
	`invisible` integer DEFAULT false NOT NULL,
	`position` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `family_records` (
	`no` text PRIMARY KEY NOT NULL,
	`payload` text NOT NULL,
	`updated_at` text NOT NULL
);
