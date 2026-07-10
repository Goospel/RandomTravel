CREATE TABLE "congestion_daily" (
	"sigungu_cd" text NOT NULL,
	"base_ymd" text NOT NULL,
	"spot_count" integer NOT NULL,
	"median_rate" double precision NOT NULL,
	"crowded_share" double precision NOT NULL,
	"fetched_at" bigint NOT NULL,
	CONSTRAINT "congestion_daily_sigungu_cd_base_ymd_pk" PRIMARY KEY("sigungu_cd","base_ymd")
);
--> statement-breakpoint
CREATE TABLE "visitor_daily" (
	"sigungu_cd" text NOT NULL,
	"base_ymd" text NOT NULL,
	"tou_div_cd" text NOT NULL,
	"tou_num" double precision NOT NULL,
	CONSTRAINT "visitor_daily_sigungu_cd_base_ymd_tou_div_cd_pk" PRIMARY KEY("sigungu_cd","base_ymd","tou_div_cd")
);
