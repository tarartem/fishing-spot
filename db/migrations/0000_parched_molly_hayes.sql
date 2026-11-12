CREATE TABLE "catch_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"review_id" uuid NOT NULL,
	"storage_path" text NOT NULL,
	"public_url" text NOT NULL,
	"photo_type" text DEFAULT 'catch' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cell_micro_analyses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"grid_analysis_id" uuid NOT NULL,
	"cell_id" text NOT NULL,
	"ai_micro_response" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fishing_spots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"water_body_id" uuid NOT NULL,
	"grid_analysis_id" uuid,
	"cell_id" text NOT NULL,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"tactical_advice" jsonb NOT NULL,
	"target_species_fit" jsonb NOT NULL,
	"fishing_type" text NOT NULL,
	"access_mode" text NOT NULL,
	"restriction_status" text DEFAULT 'allowed' NOT NULL,
	"avg_rating" double precision DEFAULT 0 NOT NULL,
	"review_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "grid_analyses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"water_body_id" uuid NOT NULL,
	"query_hash" text NOT NULL,
	"sector_bbox" jsonb NOT NULL,
	"water_type" text NOT NULL,
	"fishing_type" text NOT NULL,
	"target_species" jsonb NOT NULL,
	"access_mode" text NOT NULL,
	"season" text NOT NULL,
	"grid_definition" jsonb NOT NULL,
	"ai_response" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "grid_analyses_query_hash_unique" UNIQUE("query_hash")
);
--> statement-breakpoint
CREATE TABLE "restriction_zones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"water_body_id" uuid NOT NULL,
	"reported_by_user_id" uuid,
	"cell_id" text,
	"status" text NOT NULL,
	"reason" text NOT NULL,
	"source" text DEFAULT 'osm' NOT NULL,
	"bounds" jsonb,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "spot_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"water_body_id" uuid NOT NULL,
	"spot_id" uuid,
	"user_id" uuid NOT NULL,
	"rating" integer NOT NULL,
	"comment" text NOT NULL,
	"fishing_type_used" text NOT NULL,
	"species_caught" jsonb NOT NULL,
	"fished_on" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"display_name" text NOT NULL,
	"preferred_locale" text DEFAULT 'en' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "water_bodies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"osm_id" text NOT NULL,
	"name" text NOT NULL,
	"water_type" text NOT NULL,
	"country_code" text NOT NULL,
	"center_lat" double precision NOT NULL,
	"center_lng" double precision NOT NULL,
	"description" text NOT NULL,
	"common_species" jsonb NOT NULL,
	"bbox" jsonb NOT NULL,
	"polygon_geojson" jsonb NOT NULL,
	"avg_rating" double precision DEFAULT 0 NOT NULL,
	"review_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "water_bodies_osm_id_unique" UNIQUE("osm_id")
);
--> statement-breakpoint
ALTER TABLE "catch_photos" ADD CONSTRAINT "catch_photos_review_id_spot_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."spot_reviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cell_micro_analyses" ADD CONSTRAINT "cell_micro_analyses_grid_analysis_id_grid_analyses_id_fk" FOREIGN KEY ("grid_analysis_id") REFERENCES "public"."grid_analyses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fishing_spots" ADD CONSTRAINT "fishing_spots_water_body_id_water_bodies_id_fk" FOREIGN KEY ("water_body_id") REFERENCES "public"."water_bodies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fishing_spots" ADD CONSTRAINT "fishing_spots_grid_analysis_id_grid_analyses_id_fk" FOREIGN KEY ("grid_analysis_id") REFERENCES "public"."grid_analyses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grid_analyses" ADD CONSTRAINT "grid_analyses_water_body_id_water_bodies_id_fk" FOREIGN KEY ("water_body_id") REFERENCES "public"."water_bodies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restriction_zones" ADD CONSTRAINT "restriction_zones_water_body_id_water_bodies_id_fk" FOREIGN KEY ("water_body_id") REFERENCES "public"."water_bodies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restriction_zones" ADD CONSTRAINT "restriction_zones_reported_by_user_id_users_id_fk" FOREIGN KEY ("reported_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spot_reviews" ADD CONSTRAINT "spot_reviews_water_body_id_water_bodies_id_fk" FOREIGN KEY ("water_body_id") REFERENCES "public"."water_bodies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spot_reviews" ADD CONSTRAINT "spot_reviews_spot_id_fishing_spots_id_fk" FOREIGN KEY ("spot_id") REFERENCES "public"."fishing_spots"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spot_reviews" ADD CONSTRAINT "spot_reviews_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_cell_micro_analyses_unique" ON "cell_micro_analyses" USING btree ("grid_analysis_id","cell_id");--> statement-breakpoint
CREATE INDEX "idx_fishing_spots_water_body" ON "fishing_spots" USING btree ("water_body_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_grid_analyses_query_hash" ON "grid_analyses" USING btree ("query_hash");--> statement-breakpoint
CREATE INDEX "idx_restriction_zones_water_body" ON "restriction_zones" USING btree ("water_body_id");--> statement-breakpoint
CREATE INDEX "idx_spot_reviews_water_body" ON "spot_reviews" USING btree ("water_body_id");--> statement-breakpoint
CREATE INDEX "idx_water_bodies_center" ON "water_bodies" USING btree ("center_lat","center_lng");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_water_bodies_osm_id" ON "water_bodies" USING btree ("osm_id");