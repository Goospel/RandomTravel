CREATE TABLE "travel_event" (
	"id" text PRIMARY KEY NOT NULL,
	"event" text NOT NULL,
	"mode" text,
	"area_code" integer,
	"content_type_id" integer,
	"content_id" text,
	"session_id" text NOT NULL,
	"ts" bigint NOT NULL
);
--> statement-breakpoint
CREATE INDEX "travel_event_event_ts_idx" ON "travel_event" USING btree ("event","ts");