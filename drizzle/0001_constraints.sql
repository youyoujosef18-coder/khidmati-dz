-- Hand-written integrity rules that Drizzle's schema DSL cannot express.
CREATE EXTENSION IF NOT EXISTS btree_gist;
--> statement-breakpoint
-- Appointment overlap prevention: a technician can never hold two active
-- appointments whose time ranges overlap. Cancelled/expired/completed bookings
-- are excluded so their slot is released.
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_no_overlap" EXCLUDE USING gist (
  "technician_id" WITH =,
  tstzrange("scheduled_start_at", "scheduled_end_at", '[)') WITH &&
) WHERE ("status" IN ('requested', 'confirmed', 'technician_en_route', 'in_progress'));
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_time_order" CHECK ("scheduled_end_at" > "scheduled_start_at");
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_amount_nonneg" CHECK ("agreed_total_minor" >= 0);
--> statement-breakpoint
ALTER TABLE "booking_change_requests" ADD CONSTRAINT "bcr_time_order" CHECK ("proposed_end_at" > "proposed_start_at");
--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_rating_range" CHECK ("rating" BETWEEN 1 AND 5);
--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_amounts_nonneg" CHECK (
  "labor_minor" >= 0 AND "materials_minor" >= 0 AND "travel_minor" >= 0 AND
  "other_charges_minor" >= 0 AND "tax_minor" >= 0 AND "discount_minor" >= 0 AND "total_minor" >= 0
);
--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_total_consistent" CHECK (
  "total_minor" = "labor_minor" + "materials_minor" + "travel_minor" + "other_charges_minor" + "tax_minor" - "discount_minor"
);
--> statement-breakpoint
-- Only one accepted quote per request.
CREATE UNIQUE INDEX "quotes_one_accepted_per_request" ON "quotes" ("request_id") WHERE "status" = 'accepted';
--> statement-breakpoint
-- A request produces at most one live booking.
CREATE UNIQUE INDEX "bookings_one_per_request" ON "bookings" ("request_id")
  WHERE "request_id" IS NOT NULL AND "status" NOT IN ('cancelled', 'expired');
--> statement-breakpoint
ALTER TABLE "technician_services" ADD CONSTRAINT "tech_services_price_nonneg" CHECK ("starting_price_minor" IS NULL OR "starting_price_minor" >= 0);
--> statement-breakpoint
ALTER TABLE "technician_availability" ADD CONSTRAINT "tech_avail_weekday" CHECK ("weekday" BETWEEN 0 AND 6 AND "end_time" > "start_time");
--> statement-breakpoint
ALTER TABLE "availability_exceptions" ADD CONSTRAINT "avail_exc_order" CHECK ("ends_at" > "starts_at");
--> statement-breakpoint
ALTER TABLE "technician_profiles" ADD CONSTRAINT "tech_profiles_ranges" CHECK (
  "experience_years" BETWEEN 0 AND 70 AND "travel_radius_km" BETWEEN 0 AND 500 AND "max_daily_jobs" BETWEEN 1 AND 20
);
--> statement-breakpoint
-- One open dispute per booking.
CREATE UNIQUE INDEX "disputes_one_open_per_booking" ON "disputes" ("booking_id")
  WHERE "status" IN ('open', 'under_review', 'awaiting_information');
--> statement-breakpoint
-- Append-only tables: audit logs, ledger, booking history, verification reviews.
CREATE OR REPLACE FUNCTION khidmati_forbid_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Table % is append-only', TG_TABLE_NAME USING ERRCODE = '42501';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER audit_logs_append_only BEFORE UPDATE OR DELETE ON "audit_logs"
  FOR EACH ROW EXECUTE FUNCTION khidmati_forbid_mutation();
--> statement-breakpoint
CREATE TRIGGER ledger_entries_append_only BEFORE UPDATE OR DELETE ON "ledger_entries"
  FOR EACH ROW EXECUTE FUNCTION khidmati_forbid_mutation();
--> statement-breakpoint
CREATE TRIGGER booking_history_append_only BEFORE UPDATE OR DELETE ON "booking_status_history"
  FOR EACH ROW EXECUTE FUNCTION khidmati_forbid_mutation();
--> statement-breakpoint
CREATE TRIGGER verification_reviews_append_only BEFORE UPDATE OR DELETE ON "verification_reviews"
  FOR EACH ROW EXECUTE FUNCTION khidmati_forbid_mutation();
--> statement-breakpoint
-- Keep updated_at authoritative on the server.
CREATE OR REPLACE FUNCTION khidmati_touch_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['users','profiles','service_categories','technician_profiles','technician_services',
    'service_requests','quotes','bookings','reviews','payments','disputes','support_tickets','user_reports']
  LOOP
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION khidmati_touch_updated_at()', t || '_touch_updated_at', t);
  END LOOP;
END $$;
