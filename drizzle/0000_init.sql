CREATE TYPE "public"."account_status" AS ENUM('active', 'suspended', 'deletion_requested', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."approval_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."availability_status" AS ENUM('available', 'unavailable', 'vacation');--> statement-breakpoint
CREATE TYPE "public"."booking_status" AS ENUM('requested', 'confirmed', 'technician_en_route', 'in_progress', 'awaiting_completion_confirmation', 'completed', 'cancelled', 'disputed', 'expired');--> statement-breakpoint
CREATE TYPE "public"."change_request_status" AS ENUM('pending', 'accepted', 'rejected', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."delivery_channel" AS ENUM('in_app', 'email', 'sms', 'push');--> statement-breakpoint
CREATE TYPE "public"."delivery_status" AS ENUM('delivered', 'sent', 'queued', 'failed', 'skipped_not_configured', 'skipped_preference');--> statement-breakpoint
CREATE TYPE "public"."dispute_status" AS ENUM('open', 'under_review', 'awaiting_information', 'resolved', 'closed');--> statement-breakpoint
CREATE TYPE "public"."document_type" AS ENUM('identity_card', 'passport', 'driving_license', 'business_registration', 'artisan_card', 'qualification', 'insurance', 'other');--> statement-breakpoint
CREATE TYPE "public"."file_bucket" AS ENUM('public-avatars', 'portfolio', 'technician-verification', 'service-request-media', 'conversation-attachments', 'dispute-evidence');--> statement-breakpoint
CREATE TYPE "public"."ledger_entry_type" AS ENUM('cash_collected', 'refund', 'platform_fee', 'adjustment');--> statement-breakpoint
CREATE TYPE "public"."app_locale" AS ENUM('fr-DZ', 'ar-DZ');--> statement-breakpoint
CREATE TYPE "public"."moderation_status" AS ENUM('published', 'hidden', 'pending');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('cash', 'online');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('unpaid', 'cash_recorded', 'pending', 'succeeded', 'failed', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."pricing_model" AS ENUM('fixed', 'starting_at', 'hourly', 'estimate', 'quote_only');--> statement-breakpoint
CREATE TYPE "public"."priority" AS ENUM('low', 'normal', 'high', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."quote_status" AS ENUM('sent', 'accepted', 'rejected', 'superseded', 'withdrawn', 'expired');--> statement-breakpoint
CREATE TYPE "public"."report_status" AS ENUM('open', 'reviewing', 'actioned', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."request_status" AS ENUM('awaiting_quote', 'quote_received', 'booked', 'cancelled', 'expired');--> statement-breakpoint
CREATE TYPE "public"."app_role" AS ENUM('client', 'technician', 'support_agent', 'administrator', 'super_administrator');--> statement-breakpoint
CREATE TYPE "public"."ticket_status" AS ENUM('open', 'pending', 'resolved', 'closed');--> statement-breakpoint
CREATE TYPE "public"."time_window" AS ENUM('morning', 'afternoon', 'evening', 'flexible');--> statement-breakpoint
CREATE TYPE "public"."auth_token_type" AS ENUM('email_verify', 'password_reset', 'phone_otp');--> statement-breakpoint
CREATE TYPE "public"."urgency" AS ENUM('normal', 'urgent', 'emergency');--> statement-breakpoint
CREATE TYPE "public"."verification_status" AS ENUM('draft', 'submitted', 'under_review', 'additional_information_required', 'approved', 'rejected', 'suspended', 'expired');--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text,
	"reason" text,
	"safe_metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "auth_token_type" NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "availability_exceptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"technician_id" uuid NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"exception_type" text DEFAULT 'blocked' NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booking_change_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"requested_by" uuid NOT NULL,
	"proposed_start_at" timestamp with time zone NOT NULL,
	"proposed_end_at" timestamp with time zone NOT NULL,
	"reason" text,
	"status" "change_request_status" DEFAULT 'pending' NOT NULL,
	"responded_by" uuid,
	"responded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booking_status_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"previous_status" "booking_status",
	"new_status" "booking_status" NOT NULL,
	"actor_id" uuid,
	"reason" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" text NOT NULL,
	"request_id" uuid,
	"client_id" uuid NOT NULL,
	"technician_id" uuid NOT NULL,
	"service_id" uuid,
	"category_id" uuid NOT NULL,
	"accepted_quote_id" uuid,
	"address_id" uuid NOT NULL,
	"wilaya_code" text NOT NULL,
	"commune_id" integer NOT NULL,
	"title" text NOT NULL,
	"scheduled_start_at" timestamp with time zone NOT NULL,
	"scheduled_end_at" timestamp with time zone NOT NULL,
	"status" "booking_status" NOT NULL,
	"pricing_model" "pricing_model" NOT NULL,
	"currency" text DEFAULT 'DZD' NOT NULL,
	"agreed_total_minor" integer NOT NULL,
	"payment_method" "payment_method" DEFAULT 'cash' NOT NULL,
	"payment_status" "payment_status" DEFAULT 'unpaid' NOT NULL,
	"hold_expires_at" timestamp with time zone,
	"completion_requested_at" timestamp with time zone,
	"auto_complete_at" timestamp with time zone,
	"cancellation_reason" text,
	"cancelled_by" uuid,
	"completed_at" timestamp with time zone,
	"idempotency_key" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client_addresses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"label" text NOT NULL,
	"wilaya_code" text NOT NULL,
	"commune_id" integer NOT NULL,
	"neighborhood" text,
	"address_line" text NOT NULL,
	"latitude" numeric(9, 6),
	"longitude" numeric(9, 6),
	"access_notes" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "communes" (
	"id" integer PRIMARY KEY NOT NULL,
	"wilaya_code" text NOT NULL,
	"name_fr" text NOT NULL,
	"name_ar" text NOT NULL,
	"daira_fr" text,
	"daira_ar" text
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid,
	"request_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"technician_id" uuid NOT NULL,
	"technician_user_id" uuid NOT NULL,
	"last_message_at" timestamp with time zone,
	"blocked_at" timestamp with time zone,
	"blocked_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dispute_evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dispute_id" uuid NOT NULL,
	"uploaded_by" uuid NOT NULL,
	"file_id" uuid NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dispute_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dispute_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"body" text NOT NULL,
	"is_internal" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "disputes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" text NOT NULL,
	"booking_id" uuid NOT NULL,
	"opened_by" uuid NOT NULL,
	"previous_booking_status" "booking_status" NOT NULL,
	"category" text NOT NULL,
	"description" text NOT NULL,
	"status" "dispute_status" DEFAULT 'open' NOT NULL,
	"priority" "priority" DEFAULT 'normal' NOT NULL,
	"assigned_to" uuid,
	"outcome" text,
	"resolution" text,
	"resolved_by" uuid,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid,
	"bucket" "file_bucket" NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"width" integer,
	"height" integer,
	"original_name" text,
	"data" "bytea" NOT NULL,
	"entity_type" text,
	"entity_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ledger_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid,
	"technician_id" uuid NOT NULL,
	"entry_type" "ledger_entry_type" NOT NULL,
	"amount_minor" integer NOT NULL,
	"currency" text DEFAULT 'DZD' NOT NULL,
	"actor_id" uuid,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"sender_id" uuid NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"attachment_file_id" uuid,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"notification_id" uuid NOT NULL,
	"channel" "delivery_channel" NOT NULL,
	"provider" text NOT NULL,
	"delivery_status" "delivery_status" NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"provider_reference" text,
	"last_error" text,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"link" text,
	"payload" jsonb,
	"dedupe_key" text,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"provider_reference" text NOT NULL,
	"amount_minor" integer NOT NULL,
	"currency" text DEFAULT 'DZD' NOT NULL,
	"payment_status" "payment_status" NOT NULL,
	"recorded_by" uuid,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portfolio_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"technician_id" uuid NOT NULL,
	"file_id" uuid NOT NULL,
	"caption" text,
	"moderation_status" "moderation_status" DEFAULT 'published' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"full_name" text NOT NULL,
	"display_name" text NOT NULL,
	"phone" text,
	"email" text,
	"preferred_locale" "app_locale" DEFAULT 'fr-DZ' NOT NULL,
	"avatar_file_id" uuid,
	"account_status" "account_status" DEFAULT 'active' NOT NULL,
	"status_reason" text,
	"terms_accepted_at" timestamp with time zone NOT NULL,
	"privacy_accepted_at" timestamp with time zone NOT NULL,
	"notification_prefs" jsonb DEFAULT '{"email":true,"sms":true,"push":true}'::jsonb NOT NULL,
	"deletion_requested_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quote_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quote_id" uuid NOT NULL,
	"description" text NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_price_minor" integer NOT NULL,
	"line_total_minor" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"technician_id" uuid NOT NULL,
	"revision_number" integer DEFAULT 1 NOT NULL,
	"pricing_model" "pricing_model" DEFAULT 'fixed' NOT NULL,
	"labor_minor" integer DEFAULT 0 NOT NULL,
	"materials_minor" integer DEFAULT 0 NOT NULL,
	"travel_minor" integer DEFAULT 0 NOT NULL,
	"other_charges_minor" integer DEFAULT 0 NOT NULL,
	"other_charges_note" text,
	"tax_minor" integer DEFAULT 0 NOT NULL,
	"discount_minor" integer DEFAULT 0 NOT NULL,
	"total_minor" integer NOT NULL,
	"currency" text DEFAULT 'DZD' NOT NULL,
	"duration_minutes" integer NOT NULL,
	"proposed_start_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"status" "quote_status" DEFAULT 'sent' NOT NULL,
	"terms" text,
	"message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer NOT NULL,
	"window_start" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "request_matches" (
	"request_id" uuid NOT NULL,
	"technician_id" uuid NOT NULL,
	"match_reason" jsonb,
	"declined_at" timestamp with time zone,
	"decline_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "request_matches_request_id_technician_id_pk" PRIMARY KEY("request_id","technician_id")
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"technician_id" uuid NOT NULL,
	"rating" smallint NOT NULL,
	"comment" text,
	"moderation_status" "moderation_status" DEFAULT 'published' NOT NULL,
	"moderation_reason" text,
	"moderated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_technicians" (
	"client_id" uuid NOT NULL,
	"technician_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "saved_technicians_client_id_technician_id_pk" PRIMARY KEY("client_id","technician_id")
);
--> statement-breakpoint
CREATE TABLE "service_areas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"technician_id" uuid NOT NULL,
	"wilaya_code" text NOT NULL,
	"commune_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"parent_id" uuid,
	"name_fr" text NOT NULL,
	"name_ar" text NOT NULL,
	"description_fr" text,
	"description_ar" text,
	"examples_fr" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"examples_ar" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"icon_key" text DEFAULT 'wrench' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_request_media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"file_id" uuid NOT NULL,
	"uploaded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" text NOT NULL,
	"client_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"service_id" uuid,
	"target_technician_id" uuid,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"urgency" "urgency" DEFAULT 'normal' NOT NULL,
	"address_id" uuid NOT NULL,
	"wilaya_code" text NOT NULL,
	"commune_id" integer NOT NULL,
	"preferred_date" date,
	"time_window" time_window DEFAULT 'flexible' NOT NULL,
	"preferred_start_at" timestamp with time zone,
	"preferred_end_at" timestamp with time zone,
	"budget_max_minor" integer,
	"currency" text DEFAULT 'DZD' NOT NULL,
	"customer_notes" text,
	"payment_method" "payment_method" DEFAULT 'cash' NOT NULL,
	"status" "request_status" DEFAULT 'awaiting_quote' NOT NULL,
	"idempotency_key" text NOT NULL,
	"cancellation_reason" text,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_agent" text,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "support_ticket_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"body" text NOT NULL,
	"is_internal" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "support_tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" text NOT NULL,
	"user_id" uuid NOT NULL,
	"booking_id" uuid,
	"subject" text NOT NULL,
	"description" text NOT NULL,
	"priority" "priority" DEFAULT 'normal' NOT NULL,
	"status" "ticket_status" DEFAULT 'open' NOT NULL,
	"assigned_to" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "technician_availability" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"technician_id" uuid NOT NULL,
	"weekday" smallint NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "technician_categories" (
	"technician_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"approval_status" "approval_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "technician_categories_technician_id_category_id_pk" PRIMARY KEY("technician_id","category_id")
);
--> statement-breakpoint
CREATE TABLE "technician_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"technician_id" uuid NOT NULL,
	"document_type" "document_type" NOT NULL,
	"file_id" uuid NOT NULL,
	"review_status" "approval_status" DEFAULT 'pending' NOT NULL,
	"review_reason" text,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "technician_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"public_name" text NOT NULL,
	"legal_name" text NOT NULL,
	"bio" text DEFAULT '' NOT NULL,
	"experience_years" smallint DEFAULT 0 NOT NULL,
	"primary_category_id" uuid,
	"working_languages" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"base_wilaya_code" text,
	"base_commune_id" integer,
	"verification_status" "verification_status" DEFAULT 'draft' NOT NULL,
	"availability_status" "availability_status" DEFAULT 'available' NOT NULL,
	"travel_radius_km" smallint DEFAULT 10 NOT NULL,
	"avatar_file_id" uuid,
	"emergency_available" boolean DEFAULT false NOT NULL,
	"default_duration_minutes" smallint DEFAULT 90 NOT NULL,
	"travel_buffer_minutes" smallint DEFAULT 30 NOT NULL,
	"max_daily_jobs" smallint DEFAULT 4 NOT NULL,
	"service_terms" text DEFAULT '' NOT NULL,
	"average_rating_derived" numeric(3, 2),
	"review_count_derived" integer DEFAULT 0 NOT NULL,
	"submitted_at" timestamp with time zone,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "technician_services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"technician_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"pricing_model" "pricing_model" NOT NULL,
	"starting_price_minor" integer,
	"currency" text DEFAULT 'DZD' NOT NULL,
	"estimated_duration_minutes" smallint DEFAULT 60 NOT NULL,
	"approval_status" "approval_status" DEFAULT 'pending' NOT NULL,
	"moderation_reason" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reporter_id" uuid NOT NULL,
	"target_type" text NOT NULL,
	"target_id" uuid NOT NULL,
	"reported_user_id" uuid,
	"booking_id" uuid,
	"reason" text NOT NULL,
	"description" text,
	"status" "report_status" DEFAULT 'open' NOT NULL,
	"resolution_note" text,
	"reviewed_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "app_role" NOT NULL,
	"granted_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text,
	"phone" text,
	"password_hash" text NOT NULL,
	"email_verified_at" timestamp with time zone,
	"phone_verified_at" timestamp with time zone,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"technician_id" uuid NOT NULL,
	"previous_status" "verification_status" NOT NULL,
	"new_status" "verification_status" NOT NULL,
	"actor_id" uuid,
	"reason" text,
	"checklist" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wilayas" (
	"code" text PRIMARY KEY NOT NULL,
	"name_fr" text NOT NULL,
	"name_ar" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_tokens" ADD CONSTRAINT "auth_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "availability_exceptions" ADD CONSTRAINT "availability_exceptions_technician_id_technician_profiles_id_fk" FOREIGN KEY ("technician_id") REFERENCES "public"."technician_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_change_requests" ADD CONSTRAINT "booking_change_requests_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_change_requests" ADD CONSTRAINT "booking_change_requests_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_change_requests" ADD CONSTRAINT "booking_change_requests_responded_by_users_id_fk" FOREIGN KEY ("responded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_status_history" ADD CONSTRAINT "booking_status_history_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_status_history" ADD CONSTRAINT "booking_status_history_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_request_id_service_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."service_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_technician_id_technician_profiles_id_fk" FOREIGN KEY ("technician_id") REFERENCES "public"."technician_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_service_id_technician_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."technician_services"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_category_id_service_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."service_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_accepted_quote_id_quotes_id_fk" FOREIGN KEY ("accepted_quote_id") REFERENCES "public"."quotes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_address_id_client_addresses_id_fk" FOREIGN KEY ("address_id") REFERENCES "public"."client_addresses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_cancelled_by_users_id_fk" FOREIGN KEY ("cancelled_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_addresses" ADD CONSTRAINT "client_addresses_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_addresses" ADD CONSTRAINT "client_addresses_wilaya_code_wilayas_code_fk" FOREIGN KEY ("wilaya_code") REFERENCES "public"."wilayas"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_addresses" ADD CONSTRAINT "client_addresses_commune_id_communes_id_fk" FOREIGN KEY ("commune_id") REFERENCES "public"."communes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communes" ADD CONSTRAINT "communes_wilaya_code_wilayas_code_fk" FOREIGN KEY ("wilaya_code") REFERENCES "public"."wilayas"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_request_id_service_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."service_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_technician_id_technician_profiles_id_fk" FOREIGN KEY ("technician_id") REFERENCES "public"."technician_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_technician_user_id_users_id_fk" FOREIGN KEY ("technician_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_blocked_by_users_id_fk" FOREIGN KEY ("blocked_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispute_evidence" ADD CONSTRAINT "dispute_evidence_dispute_id_disputes_id_fk" FOREIGN KEY ("dispute_id") REFERENCES "public"."disputes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispute_evidence" ADD CONSTRAINT "dispute_evidence_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispute_evidence" ADD CONSTRAINT "dispute_evidence_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispute_messages" ADD CONSTRAINT "dispute_messages_dispute_id_disputes_id_fk" FOREIGN KEY ("dispute_id") REFERENCES "public"."disputes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispute_messages" ADD CONSTRAINT "dispute_messages_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_opened_by_users_id_fk" FOREIGN KEY ("opened_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_technician_id_technician_profiles_id_fk" FOREIGN KEY ("technician_id") REFERENCES "public"."technician_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_attachment_file_id_files_id_fk" FOREIGN KEY ("attachment_file_id") REFERENCES "public"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_notification_id_notifications_id_fk" FOREIGN KEY ("notification_id") REFERENCES "public"."notifications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_recorded_by_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_settings" ADD CONSTRAINT "platform_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_items" ADD CONSTRAINT "portfolio_items_technician_id_technician_profiles_id_fk" FOREIGN KEY ("technician_id") REFERENCES "public"."technician_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_items" ADD CONSTRAINT "portfolio_items_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_id_users_id_fk" FOREIGN KEY ("id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_request_id_service_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."service_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_technician_id_technician_profiles_id_fk" FOREIGN KEY ("technician_id") REFERENCES "public"."technician_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_matches" ADD CONSTRAINT "request_matches_request_id_service_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."service_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_matches" ADD CONSTRAINT "request_matches_technician_id_technician_profiles_id_fk" FOREIGN KEY ("technician_id") REFERENCES "public"."technician_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_technician_id_technician_profiles_id_fk" FOREIGN KEY ("technician_id") REFERENCES "public"."technician_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_moderated_by_users_id_fk" FOREIGN KEY ("moderated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_technicians" ADD CONSTRAINT "saved_technicians_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_technicians" ADD CONSTRAINT "saved_technicians_technician_id_technician_profiles_id_fk" FOREIGN KEY ("technician_id") REFERENCES "public"."technician_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_areas" ADD CONSTRAINT "service_areas_technician_id_technician_profiles_id_fk" FOREIGN KEY ("technician_id") REFERENCES "public"."technician_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_areas" ADD CONSTRAINT "service_areas_wilaya_code_wilayas_code_fk" FOREIGN KEY ("wilaya_code") REFERENCES "public"."wilayas"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_areas" ADD CONSTRAINT "service_areas_commune_id_communes_id_fk" FOREIGN KEY ("commune_id") REFERENCES "public"."communes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_request_media" ADD CONSTRAINT "service_request_media_request_id_service_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."service_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_request_media" ADD CONSTRAINT "service_request_media_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_request_media" ADD CONSTRAINT "service_request_media_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_category_id_service_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."service_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_service_id_technician_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."technician_services"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_target_technician_id_technician_profiles_id_fk" FOREIGN KEY ("target_technician_id") REFERENCES "public"."technician_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_address_id_client_addresses_id_fk" FOREIGN KEY ("address_id") REFERENCES "public"."client_addresses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_wilaya_code_wilayas_code_fk" FOREIGN KEY ("wilaya_code") REFERENCES "public"."wilayas"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_commune_id_communes_id_fk" FOREIGN KEY ("commune_id") REFERENCES "public"."communes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_ticket_messages" ADD CONSTRAINT "support_ticket_messages_ticket_id_support_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."support_tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_ticket_messages" ADD CONSTRAINT "support_ticket_messages_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "technician_availability" ADD CONSTRAINT "technician_availability_technician_id_technician_profiles_id_fk" FOREIGN KEY ("technician_id") REFERENCES "public"."technician_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "technician_categories" ADD CONSTRAINT "technician_categories_technician_id_technician_profiles_id_fk" FOREIGN KEY ("technician_id") REFERENCES "public"."technician_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "technician_categories" ADD CONSTRAINT "technician_categories_category_id_service_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."service_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "technician_documents" ADD CONSTRAINT "technician_documents_technician_id_technician_profiles_id_fk" FOREIGN KEY ("technician_id") REFERENCES "public"."technician_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "technician_documents" ADD CONSTRAINT "technician_documents_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "technician_documents" ADD CONSTRAINT "technician_documents_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "technician_profiles" ADD CONSTRAINT "technician_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "technician_profiles" ADD CONSTRAINT "technician_profiles_primary_category_id_service_categories_id_fk" FOREIGN KEY ("primary_category_id") REFERENCES "public"."service_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "technician_profiles" ADD CONSTRAINT "technician_profiles_base_wilaya_code_wilayas_code_fk" FOREIGN KEY ("base_wilaya_code") REFERENCES "public"."wilayas"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "technician_profiles" ADD CONSTRAINT "technician_profiles_base_commune_id_communes_id_fk" FOREIGN KEY ("base_commune_id") REFERENCES "public"."communes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "technician_services" ADD CONSTRAINT "technician_services_technician_id_technician_profiles_id_fk" FOREIGN KEY ("technician_id") REFERENCES "public"."technician_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "technician_services" ADD CONSTRAINT "technician_services_category_id_service_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."service_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_reports" ADD CONSTRAINT "user_reports_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_reports" ADD CONSTRAINT "user_reports_reported_user_id_users_id_fk" FOREIGN KEY ("reported_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_reports" ADD CONSTRAINT "user_reports_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_reports" ADD CONSTRAINT "user_reports_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_granted_by_users_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_reviews" ADD CONSTRAINT "verification_reviews_technician_id_technician_profiles_id_fk" FOREIGN KEY ("technician_id") REFERENCES "public"."technician_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_reviews" ADD CONSTRAINT "verification_reviews_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_logs_created_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_entity_idx" ON "audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "auth_tokens_user_type_idx" ON "auth_tokens" USING btree ("user_id","type");--> statement-breakpoint
CREATE UNIQUE INDEX "auth_tokens_hash_uq" ON "auth_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "availability_exceptions_tech_idx" ON "availability_exceptions" USING btree ("technician_id");--> statement-breakpoint
CREATE INDEX "booking_change_requests_booking_idx" ON "booking_change_requests" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "booking_status_history_booking_idx" ON "booking_status_history" USING btree ("booking_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "bookings_reference_uq" ON "bookings" USING btree ("reference");--> statement-breakpoint
CREATE UNIQUE INDEX "bookings_idem_uq" ON "bookings" USING btree ("client_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "bookings_client_idx" ON "bookings" USING btree ("client_id","scheduled_start_at");--> statement-breakpoint
CREATE INDEX "bookings_tech_idx" ON "bookings" USING btree ("technician_id","scheduled_start_at");--> statement-breakpoint
CREATE INDEX "bookings_status_idx" ON "bookings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "client_addresses_client_idx" ON "client_addresses" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "communes_wilaya_idx" ON "communes" USING btree ("wilaya_code");--> statement-breakpoint
CREATE UNIQUE INDEX "conversations_req_tech_uq" ON "conversations" USING btree ("request_id","technician_id");--> statement-breakpoint
CREATE INDEX "conversations_client_idx" ON "conversations" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "conversations_tech_user_idx" ON "conversations" USING btree ("technician_user_id");--> statement-breakpoint
CREATE INDEX "dispute_messages_dispute_idx" ON "dispute_messages" USING btree ("dispute_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "disputes_reference_uq" ON "disputes" USING btree ("reference");--> statement-breakpoint
CREATE INDEX "disputes_booking_idx" ON "disputes" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "disputes_status_idx" ON "disputes" USING btree ("status");--> statement-breakpoint
CREATE INDEX "files_owner_idx" ON "files" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "files_entity_idx" ON "files" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "ledger_entries_tech_idx" ON "ledger_entries" USING btree ("technician_id","created_at");--> statement-breakpoint
CREATE INDEX "messages_conversation_idx" ON "messages" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX "notification_deliveries_notif_idx" ON "notification_deliveries" USING btree ("notification_id");--> statement-breakpoint
CREATE INDEX "notification_deliveries_status_idx" ON "notification_deliveries" USING btree ("delivery_status");--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_dedupe_uq" ON "notifications" USING btree ("user_id","dedupe_key");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_provider_ref_uq" ON "payments" USING btree ("provider","provider_reference");--> statement-breakpoint
CREATE INDEX "payments_booking_idx" ON "payments" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "portfolio_items_tech_idx" ON "portfolio_items" USING btree ("technician_id");--> statement-breakpoint
CREATE INDEX "quote_items_quote_idx" ON "quote_items" USING btree ("quote_id");--> statement-breakpoint
CREATE UNIQUE INDEX "quotes_revision_uq" ON "quotes" USING btree ("request_id","technician_id","revision_number");--> statement-breakpoint
CREATE INDEX "quotes_request_idx" ON "quotes" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "quotes_tech_idx" ON "quotes" USING btree ("technician_id");--> statement-breakpoint
CREATE INDEX "request_matches_tech_idx" ON "request_matches" USING btree ("technician_id");--> statement-breakpoint
CREATE UNIQUE INDEX "reviews_booking_client_uq" ON "reviews" USING btree ("booking_id","client_id");--> statement-breakpoint
CREATE INDEX "reviews_tech_idx" ON "reviews" USING btree ("technician_id","created_at");--> statement-breakpoint
CREATE INDEX "service_areas_tech_idx" ON "service_areas" USING btree ("technician_id");--> statement-breakpoint
CREATE INDEX "service_areas_geo_idx" ON "service_areas" USING btree ("wilaya_code","commune_id");--> statement-breakpoint
CREATE UNIQUE INDEX "service_categories_slug_uq" ON "service_categories" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "service_request_media_req_idx" ON "service_request_media" USING btree ("request_id");--> statement-breakpoint
CREATE UNIQUE INDEX "service_requests_reference_uq" ON "service_requests" USING btree ("reference");--> statement-breakpoint
CREATE UNIQUE INDEX "service_requests_idem_uq" ON "service_requests" USING btree ("client_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "service_requests_client_idx" ON "service_requests" USING btree ("client_id","created_at");--> statement-breakpoint
CREATE INDEX "service_requests_geo_idx" ON "service_requests" USING btree ("wilaya_code","commune_id","category_id");--> statement-breakpoint
CREATE INDEX "service_requests_status_idx" ON "service_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "support_ticket_messages_ticket_idx" ON "support_ticket_messages" USING btree ("ticket_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "support_tickets_reference_uq" ON "support_tickets" USING btree ("reference");--> statement-breakpoint
CREATE INDEX "support_tickets_user_idx" ON "support_tickets" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "technician_availability_tech_idx" ON "technician_availability" USING btree ("technician_id");--> statement-breakpoint
CREATE INDEX "technician_documents_tech_idx" ON "technician_documents" USING btree ("technician_id");--> statement-breakpoint
CREATE UNIQUE INDEX "technician_profiles_user_uq" ON "technician_profiles" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "technician_profiles_slug_uq" ON "technician_profiles" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "technician_profiles_status_idx" ON "technician_profiles" USING btree ("verification_status");--> statement-breakpoint
CREATE INDEX "technician_services_tech_idx" ON "technician_services" USING btree ("technician_id");--> statement-breakpoint
CREATE INDEX "technician_services_cat_idx" ON "technician_services" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "user_reports_status_idx" ON "user_reports" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "user_roles_user_role_uq" ON "user_roles" USING btree ("user_id","role");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_uq" ON "users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "users_phone_uq" ON "users" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "verification_reviews_tech_idx" ON "verification_reviews" USING btree ("technician_id");