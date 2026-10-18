import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  customType,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
});

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });
const createdAt = () => ts("created_at").notNull().defaultNow();
const updatedAt = () => ts("updated_at").notNull().defaultNow();

/* ------------------------------------------------------------------ */
/* Enums                                                              */
/* ------------------------------------------------------------------ */

export const roleEnum = pgEnum("app_role", [
  "client",
  "technician",
  "support_agent",
  "administrator",
  "super_administrator",
]);

export const accountStatusEnum = pgEnum("account_status", [
  "active",
  "suspended",
  "deletion_requested",
  "deleted",
]);

export const localeEnum = pgEnum("app_locale", ["fr-DZ", "ar-DZ"]);

export const verificationStatusEnum = pgEnum("verification_status", [
  "draft",
  "submitted",
  "under_review",
  "additional_information_required",
  "approved",
  "rejected",
  "suspended",
  "expired",
]);

export const availabilityStatusEnum = pgEnum("availability_status", [
  "available",
  "unavailable",
  "vacation",
]);

export const approvalStatusEnum = pgEnum("approval_status", ["pending", "approved", "rejected"]);

export const pricingModelEnum = pgEnum("pricing_model", [
  "fixed",
  "starting_at",
  "hourly",
  "estimate",
  "quote_only",
]);

export const documentTypeEnum = pgEnum("document_type", [
  "identity_card",
  "passport",
  "driving_license",
  "business_registration",
  "artisan_card",
  "qualification",
  "insurance",
  "other",
]);

export const fileBucketEnum = pgEnum("file_bucket", [
  "public-avatars",
  "portfolio",
  "technician-verification",
  "service-request-media",
  "conversation-attachments",
  "dispute-evidence",
]);

export const urgencyEnum = pgEnum("urgency", ["normal", "urgent", "emergency"]);
export const timeWindowEnum = pgEnum("time_window", ["morning", "afternoon", "evening", "flexible"]);

export const requestStatusEnum = pgEnum("request_status", [
  "awaiting_quote",
  "quote_received",
  "booked",
  "cancelled",
  "expired",
]);

export const quoteStatusEnum = pgEnum("quote_status", [
  "sent",
  "accepted",
  "rejected",
  "superseded",
  "withdrawn",
  "expired",
]);

export const bookingStatusEnum = pgEnum("booking_status", [
  "requested",
  "confirmed",
  "technician_en_route",
  "in_progress",
  "awaiting_completion_confirmation",
  "completed",
  "cancelled",
  "disputed",
  "expired",
]);

export const paymentMethodEnum = pgEnum("payment_method", ["cash", "online"]);
export const paymentStatusEnum = pgEnum("payment_status", [
  "unpaid",
  "cash_recorded",
  "pending",
  "succeeded",
  "failed",
  "refunded",
]);

export const changeRequestStatusEnum = pgEnum("change_request_status", [
  "pending",
  "accepted",
  "rejected",
  "cancelled",
]);

export const moderationStatusEnum = pgEnum("moderation_status", ["published", "hidden", "pending"]);

export const disputeStatusEnum = pgEnum("dispute_status", [
  "open",
  "under_review",
  "awaiting_information",
  "resolved",
  "closed",
]);

export const ticketStatusEnum = pgEnum("ticket_status", ["open", "pending", "resolved", "closed"]);
export const priorityEnum = pgEnum("priority", ["low", "normal", "high", "urgent"]);
export const reportStatusEnum = pgEnum("report_status", ["open", "reviewing", "actioned", "dismissed"]);

export const deliveryChannelEnum = pgEnum("delivery_channel", ["in_app", "email", "sms", "push"]);
export const deliveryStatusEnum = pgEnum("delivery_status", [
  "delivered",
  "sent",
  "queued",
  "failed",
  "skipped_not_configured",
  "skipped_preference",
]);

export const ledgerEntryTypeEnum = pgEnum("ledger_entry_type", [
  "cash_collected",
  "refund",
  "platform_fee",
  "adjustment",
]);

export const tokenTypeEnum = pgEnum("auth_token_type", ["email_verify", "password_reset", "phone_otp"]);

/* ------------------------------------------------------------------ */
/* Identity & access                                                  */
/* ------------------------------------------------------------------ */

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email"),
    phone: text("phone"),
    passwordHash: text("password_hash").notNull(),
    emailVerifiedAt: ts("email_verified_at"),
    phoneVerifiedAt: ts("phone_verified_at"),
    lastLoginAt: ts("last_login_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("users_email_uq").on(t.email),
    uniqueIndex("users_phone_uq").on(t.phone),
  ],
);

export const profiles = pgTable("profiles", {
  id: uuid("id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  fullName: text("full_name").notNull(),
  displayName: text("display_name").notNull(),
  phone: text("phone"),
  email: text("email"),
  preferredLocale: localeEnum("preferred_locale").notNull().default("fr-DZ"),
  avatarFileId: uuid("avatar_file_id"),
  accountStatus: accountStatusEnum("account_status").notNull().default("active"),
  statusReason: text("status_reason"),
  termsAcceptedAt: ts("terms_accepted_at").notNull(),
  privacyAcceptedAt: ts("privacy_accepted_at").notNull(),
  notificationPrefs: jsonb("notification_prefs")
    .$type<{ email: boolean; sms: boolean; push: boolean }>()
    .notNull()
    .default({ email: true, sms: true, push: true }),
  deletionRequestedAt: ts("deletion_requested_at"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const userRoles = pgTable(
  "user_roles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: roleEnum("role").notNull(),
    grantedBy: uuid("granted_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("user_roles_user_role_uq").on(t.userId, t.role)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(), // SHA-256 of the cookie token
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
    expiresAt: ts("expires_at").notNull(),
    lastSeenAt: ts("last_seen_at").notNull().defaultNow(),
    userAgent: text("user_agent"),
    revokedAt: ts("revoked_at"),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

/** Pending e-mail code (sign-up or sign-in on a new device), bound to the browser by a cookie. */
export const loginChallenges = pgTable(
  "login_challenges",
  {
    id: text("id").primaryKey(), // SHA-256 of the challenge cookie token
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    purpose: text("purpose").notNull(), // 'signup' | 'login'
    codeHash: text("code_hash").notNull(),
    nextUrl: text("next_url"),
    attempts: integer("attempts").notNull().default(0),
    sendCount: integer("send_count").notNull().default(1),
    lastSentAt: ts("last_sent_at").notNull().defaultNow(),
    expiresAt: ts("expires_at").notNull(),
    consumedAt: ts("consumed_at"),
    createdAt: createdAt(),
  },
  (t) => [index("login_challenges_user_idx").on(t.userId), check("login_challenges_purpose_chk", sql`${t.purpose} in ('signup','login')`)],
);

/** Browsers that completed an e-mail code: no code is asked there again until expiry. */
export const trustedDevices = pgTable(
  "trusted_devices",
  {
    id: text("id").primaryKey(), // SHA-256 of the device cookie token
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    userAgent: text("user_agent"),
    expiresAt: ts("expires_at").notNull(),
    lastUsedAt: ts("last_used_at").notNull().defaultNow(),
    createdAt: createdAt(),
  },
  (t) => [index("trusted_devices_user_idx").on(t.userId)],
);

export const authTokens = pgTable(
  "auth_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: tokenTypeEnum("type").notNull(),
    tokenHash: text("token_hash").notNull(),
    expiresAt: ts("expires_at").notNull(),
    usedAt: ts("used_at"),
    attempts: integer("attempts").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index("auth_tokens_user_type_idx").on(t.userId, t.type), uniqueIndex("auth_tokens_hash_uq").on(t.tokenHash)],
);

export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  windowStart: ts("window_start").notNull(),
});

/* ------------------------------------------------------------------ */
/* Files (private by default, served through authorized routes)      */
/* ------------------------------------------------------------------ */

export const files = pgTable(
  "files",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id").references(() => users.id, { onDelete: "set null" }),
    bucket: fileBucketEnum("bucket").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    width: integer("width"),
    height: integer("height"),
    originalName: text("original_name"),
    data: bytea("data").notNull(),
    // Entity the file is attached to once used (request, message, dispute, document...)
    entityType: text("entity_type"),
    entityId: uuid("entity_id"),
    createdAt: createdAt(),
  },
  (t) => [index("files_owner_idx").on(t.ownerId), index("files_entity_idx").on(t.entityType, t.entityId)],
);

/* ------------------------------------------------------------------ */
/* Geography                                                          */
/* ------------------------------------------------------------------ */

export const wilayas = pgTable("wilayas", {
  code: text("code").primaryKey(),
  nameFr: text("name_fr").notNull(),
  nameAr: text("name_ar").notNull(),
  isActive: boolean("is_active").notNull().default(true),
});

export const communes = pgTable(
  "communes",
  {
    id: integer("id").primaryKey(),
    wilayaCode: text("wilaya_code")
      .notNull()
      .references(() => wilayas.code),
    nameFr: text("name_fr").notNull(),
    nameAr: text("name_ar").notNull(),
    dairaFr: text("daira_fr"),
    dairaAr: text("daira_ar"),
  },
  (t) => [index("communes_wilaya_idx").on(t.wilayaCode)],
);

/* ------------------------------------------------------------------ */
/* Catalogue                                                          */
/* ------------------------------------------------------------------ */

export const serviceCategories = pgTable(
  "service_categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    parentId: uuid("parent_id"),
    nameFr: text("name_fr").notNull(),
    nameAr: text("name_ar").notNull(),
    descriptionFr: text("description_fr"),
    descriptionAr: text("description_ar"),
    examplesFr: jsonb("examples_fr").$type<string[]>().notNull().default([]),
    examplesAr: jsonb("examples_ar").$type<string[]>().notNull().default([]),
    iconKey: text("icon_key").notNull().default("wrench"),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("service_categories_slug_uq").on(t.slug)],
);

/* ------------------------------------------------------------------ */
/* Technicians                                                        */
/* ------------------------------------------------------------------ */

export const technicianProfiles = pgTable(
  "technician_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    publicName: text("public_name").notNull(),
    legalName: text("legal_name").notNull(),
    bio: text("bio").notNull().default(""),
    experienceYears: smallint("experience_years").notNull().default(0),
    primaryCategoryId: uuid("primary_category_id").references(() => serviceCategories.id),
    workingLanguages: jsonb("working_languages").$type<string[]>().notNull().default([]),
    baseWilayaCode: text("base_wilaya_code").references(() => wilayas.code),
    baseCommuneId: integer("base_commune_id").references(() => communes.id),
    verificationStatus: verificationStatusEnum("verification_status").notNull().default("draft"),
    availabilityStatus: availabilityStatusEnum("availability_status").notNull().default("available"),
    travelRadiusKm: smallint("travel_radius_km").notNull().default(10),
    avatarFileId: uuid("avatar_file_id"),
    emergencyAvailable: boolean("emergency_available").notNull().default(false),
    defaultDurationMinutes: smallint("default_duration_minutes").notNull().default(90),
    travelBufferMinutes: smallint("travel_buffer_minutes").notNull().default(30),
    maxDailyJobs: smallint("max_daily_jobs").notNull().default(4),
    serviceTerms: text("service_terms").notNull().default(""),
    averageRatingDerived: numeric("average_rating_derived", { precision: 3, scale: 2 }),
    reviewCountDerived: integer("review_count_derived").notNull().default(0),
    submittedAt: ts("submitted_at"),
    approvedAt: ts("approved_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("technician_profiles_user_uq").on(t.userId),
    uniqueIndex("technician_profiles_slug_uq").on(t.slug),
    index("technician_profiles_status_idx").on(t.verificationStatus),
  ],
);

export const technicianCategories = pgTable(
  "technician_categories",
  {
    technicianId: uuid("technician_id")
      .notNull()
      .references(() => technicianProfiles.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => serviceCategories.id),
    isPrimary: boolean("is_primary").notNull().default(false),
    approvalStatus: approvalStatusEnum("approval_status").notNull().default("pending"),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.technicianId, t.categoryId] })],
);

export const technicianDocuments = pgTable(
  "technician_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    technicianId: uuid("technician_id")
      .notNull()
      .references(() => technicianProfiles.id, { onDelete: "cascade" }),
    documentType: documentTypeEnum("document_type").notNull(),
    fileId: uuid("file_id")
      .notNull()
      .references(() => files.id),
    reviewStatus: approvalStatusEnum("review_status").notNull().default("pending"),
    reviewReason: text("review_reason"),
    reviewedBy: uuid("reviewed_by").references(() => users.id, { onDelete: "set null" }),
    reviewedAt: ts("reviewed_at"),
    expiresAt: ts("expires_at"),
    createdAt: createdAt(),
  },
  (t) => [index("technician_documents_tech_idx").on(t.technicianId)],
);

export const verificationReviews = pgTable(
  "verification_reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    technicianId: uuid("technician_id")
      .notNull()
      .references(() => technicianProfiles.id, { onDelete: "cascade" }),
    previousStatus: verificationStatusEnum("previous_status").notNull(),
    newStatus: verificationStatusEnum("new_status").notNull(),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    reason: text("reason"),
    checklist: jsonb("checklist").$type<Record<string, boolean>>(),
    createdAt: createdAt(),
  },
  (t) => [index("verification_reviews_tech_idx").on(t.technicianId)],
);

export const technicianServices = pgTable(
  "technician_services",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    technicianId: uuid("technician_id")
      .notNull()
      .references(() => technicianProfiles.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => serviceCategories.id),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    pricingModel: pricingModelEnum("pricing_model").notNull(),
    startingPriceMinor: integer("starting_price_minor"),
    currency: text("currency").notNull().default("DZD"),
    estimatedDurationMinutes: smallint("estimated_duration_minutes").notNull().default(60),
    approvalStatus: approvalStatusEnum("approval_status").notNull().default("pending"),
    moderationReason: text("moderation_reason"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("technician_services_tech_idx").on(t.technicianId), index("technician_services_cat_idx").on(t.categoryId)],
);

export const serviceAreas = pgTable(
  "service_areas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    technicianId: uuid("technician_id")
      .notNull()
      .references(() => technicianProfiles.id, { onDelete: "cascade" }),
    wilayaCode: text("wilaya_code")
      .notNull()
      .references(() => wilayas.code),
    // null commune = the whole wilaya
    communeId: integer("commune_id").references(() => communes.id),
    createdAt: createdAt(),
  },
  (t) => [
    index("service_areas_tech_idx").on(t.technicianId),
    index("service_areas_geo_idx").on(t.wilayaCode, t.communeId),
  ],
);

export const technicianAvailability = pgTable(
  "technician_availability",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    technicianId: uuid("technician_id")
      .notNull()
      .references(() => technicianProfiles.id, { onDelete: "cascade" }),
    weekday: smallint("weekday").notNull(), // 0 = Sunday … 6 = Saturday
    startTime: time("start_time").notNull(),
    endTime: time("end_time").notNull(),
    isActive: boolean("is_active").notNull().default(true),
  },
  (t) => [index("technician_availability_tech_idx").on(t.technicianId)],
);

export const availabilityExceptions = pgTable(
  "availability_exceptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    technicianId: uuid("technician_id")
      .notNull()
      .references(() => technicianProfiles.id, { onDelete: "cascade" }),
    startsAt: ts("starts_at").notNull(),
    endsAt: ts("ends_at").notNull(),
    exceptionType: text("exception_type").notNull().default("blocked"),
    reason: text("reason"),
    createdAt: createdAt(),
  },
  (t) => [index("availability_exceptions_tech_idx").on(t.technicianId)],
);

export const portfolioItems = pgTable(
  "portfolio_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    technicianId: uuid("technician_id")
      .notNull()
      .references(() => technicianProfiles.id, { onDelete: "cascade" }),
    fileId: uuid("file_id")
      .notNull()
      .references(() => files.id),
    caption: text("caption"),
    moderationStatus: moderationStatusEnum("moderation_status").notNull().default("published"),
    createdAt: createdAt(),
  },
  (t) => [index("portfolio_items_tech_idx").on(t.technicianId)],
);

/* ------------------------------------------------------------------ */
/* Clients                                                            */
/* ------------------------------------------------------------------ */

export const clientAddresses = pgTable(
  "client_addresses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    wilayaCode: text("wilaya_code")
      .notNull()
      .references(() => wilayas.code),
    communeId: integer("commune_id")
      .notNull()
      .references(() => communes.id),
    neighborhood: text("neighborhood"),
    addressLine: text("address_line").notNull(),
    latitude: numeric("latitude", { precision: 9, scale: 6 }),
    longitude: numeric("longitude", { precision: 9, scale: 6 }),
    accessNotes: text("access_notes"),
    isDefault: boolean("is_default").notNull().default(false),
    archivedAt: ts("archived_at"),
    createdAt: createdAt(),
  },
  (t) => [index("client_addresses_client_idx").on(t.clientId)],
);

export const savedTechnicians = pgTable(
  "saved_technicians",
  {
    clientId: uuid("client_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    technicianId: uuid("technician_id")
      .notNull()
      .references(() => technicianProfiles.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.clientId, t.technicianId] })],
);

/* ------------------------------------------------------------------ */
/* Requests, quotes, bookings                                         */
/* ------------------------------------------------------------------ */

export const serviceRequests = pgTable(
  "service_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reference: text("reference").notNull(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => serviceCategories.id),
    serviceId: uuid("service_id").references(() => technicianServices.id),
    // When the client asked a specific professional directly
    targetTechnicianId: uuid("target_technician_id").references(() => technicianProfiles.id),
    title: text("title").notNull(),
    description: text("description").notNull(),
    urgency: urgencyEnum("urgency").notNull().default("normal"),
    addressId: uuid("address_id")
      .notNull()
      .references(() => clientAddresses.id),
    wilayaCode: text("wilaya_code")
      .notNull()
      .references(() => wilayas.code),
    communeId: integer("commune_id")
      .notNull()
      .references(() => communes.id),
    preferredDate: date("preferred_date", { mode: "string" }),
    timeWindow: timeWindowEnum("time_window").notNull().default("flexible"),
    preferredStartAt: ts("preferred_start_at"),
    preferredEndAt: ts("preferred_end_at"),
    budgetMaxMinor: integer("budget_max_minor"),
    currency: text("currency").notNull().default("DZD"),
    customerNotes: text("customer_notes"),
    paymentMethod: paymentMethodEnum("payment_method").notNull().default("cash"),
    status: requestStatusEnum("status").notNull().default("awaiting_quote"),
    idempotencyKey: text("idempotency_key").notNull(),
    cancellationReason: text("cancellation_reason"),
    expiresAt: ts("expires_at").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("service_requests_reference_uq").on(t.reference),
    uniqueIndex("service_requests_idem_uq").on(t.clientId, t.idempotencyKey),
    index("service_requests_client_idx").on(t.clientId, t.createdAt),
    index("service_requests_geo_idx").on(t.wilayaCode, t.communeId, t.categoryId),
    index("service_requests_status_idx").on(t.status),
  ],
);

export const requestMatches = pgTable(
  "request_matches",
  {
    requestId: uuid("request_id")
      .notNull()
      .references(() => serviceRequests.id, { onDelete: "cascade" }),
    technicianId: uuid("technician_id")
      .notNull()
      .references(() => technicianProfiles.id, { onDelete: "cascade" }),
    matchReason: jsonb("match_reason").$type<Record<string, unknown>>(),
    declinedAt: ts("declined_at"),
    declineReason: text("decline_reason"),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.requestId, t.technicianId] }), index("request_matches_tech_idx").on(t.technicianId)],
);

export const serviceRequestMedia = pgTable(
  "service_request_media",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requestId: uuid("request_id")
      .notNull()
      .references(() => serviceRequests.id, { onDelete: "cascade" }),
    fileId: uuid("file_id")
      .notNull()
      .references(() => files.id),
    uploadedBy: uuid("uploaded_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [index("service_request_media_req_idx").on(t.requestId)],
);

export const quotes = pgTable(
  "quotes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requestId: uuid("request_id")
      .notNull()
      .references(() => serviceRequests.id, { onDelete: "cascade" }),
    technicianId: uuid("technician_id")
      .notNull()
      .references(() => technicianProfiles.id),
    revisionNumber: integer("revision_number").notNull().default(1),
    pricingModel: pricingModelEnum("pricing_model").notNull().default("fixed"),
    laborMinor: integer("labor_minor").notNull().default(0),
    materialsMinor: integer("materials_minor").notNull().default(0),
    travelMinor: integer("travel_minor").notNull().default(0),
    otherChargesMinor: integer("other_charges_minor").notNull().default(0),
    otherChargesNote: text("other_charges_note"),
    taxMinor: integer("tax_minor").notNull().default(0),
    discountMinor: integer("discount_minor").notNull().default(0),
    totalMinor: integer("total_minor").notNull(),
    currency: text("currency").notNull().default("DZD"),
    durationMinutes: integer("duration_minutes").notNull(),
    proposedStartAt: ts("proposed_start_at").notNull(),
    expiresAt: ts("expires_at").notNull(),
    status: quoteStatusEnum("status").notNull().default("sent"),
    terms: text("terms"),
    message: text("message"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("quotes_revision_uq").on(t.requestId, t.technicianId, t.revisionNumber),
    index("quotes_request_idx").on(t.requestId),
    index("quotes_tech_idx").on(t.technicianId),
  ],
);

export const quoteItems = pgTable(
  "quote_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    quoteId: uuid("quote_id")
      .notNull()
      .references(() => quotes.id, { onDelete: "cascade" }),
    description: text("description").notNull(),
    quantity: integer("quantity").notNull().default(1),
    unitPriceMinor: integer("unit_price_minor").notNull(),
    lineTotalMinor: integer("line_total_minor").notNull(),
  },
  (t) => [index("quote_items_quote_idx").on(t.quoteId)],
);

export const bookings = pgTable(
  "bookings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reference: text("reference").notNull(),
    requestId: uuid("request_id").references(() => serviceRequests.id),
    clientId: uuid("client_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    technicianId: uuid("technician_id")
      .notNull()
      .references(() => technicianProfiles.id, { onDelete: "restrict" }),
    serviceId: uuid("service_id").references(() => technicianServices.id),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => serviceCategories.id),
    acceptedQuoteId: uuid("accepted_quote_id").references(() => quotes.id),
    addressId: uuid("address_id")
      .notNull()
      .references(() => clientAddresses.id),
    wilayaCode: text("wilaya_code").notNull(),
    communeId: integer("commune_id").notNull(),
    title: text("title").notNull(),
    scheduledStartAt: ts("scheduled_start_at").notNull(),
    scheduledEndAt: ts("scheduled_end_at").notNull(),
    status: bookingStatusEnum("status").notNull(),
    pricingModel: pricingModelEnum("pricing_model").notNull(),
    currency: text("currency").notNull().default("DZD"),
    agreedTotalMinor: integer("agreed_total_minor").notNull(),
    paymentMethod: paymentMethodEnum("payment_method").notNull().default("cash"),
    paymentStatus: paymentStatusEnum("payment_status").notNull().default("unpaid"),
    holdExpiresAt: ts("hold_expires_at"),
    completionRequestedAt: ts("completion_requested_at"),
    autoCompleteAt: ts("auto_complete_at"),
    cancellationReason: text("cancellation_reason"),
    cancelledBy: uuid("cancelled_by").references(() => users.id, { onDelete: "set null" }),
    completedAt: ts("completed_at"),
    idempotencyKey: text("idempotency_key"),
    version: integer("version").notNull().default(1),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("bookings_reference_uq").on(t.reference),
    uniqueIndex("bookings_idem_uq").on(t.clientId, t.idempotencyKey),
    index("bookings_client_idx").on(t.clientId, t.scheduledStartAt),
    index("bookings_tech_idx").on(t.technicianId, t.scheduledStartAt),
    index("bookings_status_idx").on(t.status),
    // Overlap prevention lives in a hand-written migration (EXCLUDE USING gist).
  ],
);

export const bookingStatusHistory = pgTable(
  "booking_status_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    previousStatus: bookingStatusEnum("previous_status"),
    newStatus: bookingStatusEnum("new_status").notNull(),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    reason: text("reason"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: createdAt(),
  },
  (t) => [index("booking_status_history_booking_idx").on(t.bookingId, t.createdAt)],
);

export const bookingChangeRequests = pgTable(
  "booking_change_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    requestedBy: uuid("requested_by")
      .notNull()
      .references(() => users.id),
    proposedStartAt: ts("proposed_start_at").notNull(),
    proposedEndAt: ts("proposed_end_at").notNull(),
    reason: text("reason"),
    status: changeRequestStatusEnum("status").notNull().default("pending"),
    respondedBy: uuid("responded_by").references(() => users.id),
    respondedAt: ts("responded_at"),
    createdAt: createdAt(),
  },
  (t) => [index("booking_change_requests_booking_idx").on(t.bookingId)],
);

/* ------------------------------------------------------------------ */
/* Messaging                                                          */
/* ------------------------------------------------------------------ */

export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id").references(() => bookings.id),
    requestId: uuid("request_id")
      .notNull()
      .references(() => serviceRequests.id, { onDelete: "cascade" }),
    clientId: uuid("client_id")
      .notNull()
      .references(() => users.id),
    technicianId: uuid("technician_id")
      .notNull()
      .references(() => technicianProfiles.id),
    technicianUserId: uuid("technician_user_id")
      .notNull()
      .references(() => users.id),
    lastMessageAt: ts("last_message_at"),
    blockedAt: ts("blocked_at"),
    blockedBy: uuid("blocked_by").references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("conversations_req_tech_uq").on(t.requestId, t.technicianId),
    index("conversations_client_idx").on(t.clientId),
    index("conversations_tech_user_idx").on(t.technicianUserId),
  ],
);

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    senderId: uuid("sender_id")
      .notNull()
      .references(() => users.id),
    body: text("body").notNull().default(""),
    attachmentFileId: uuid("attachment_file_id").references(() => files.id),
    readAt: ts("read_at"),
    createdAt: createdAt(),
  },
  (t) => [index("messages_conversation_idx").on(t.conversationId, t.createdAt)],
);

/* ------------------------------------------------------------------ */
/* Reviews                                                            */
/* ------------------------------------------------------------------ */

export const reviews = pgTable(
  "reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id),
    clientId: uuid("client_id")
      .notNull()
      .references(() => users.id),
    technicianId: uuid("technician_id")
      .notNull()
      .references(() => technicianProfiles.id),
    rating: smallint("rating").notNull(),
    comment: text("comment"),
    moderationStatus: moderationStatusEnum("moderation_status").notNull().default("published"),
    moderationReason: text("moderation_reason"),
    moderatedBy: uuid("moderated_by").references(() => users.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("reviews_booking_client_uq").on(t.bookingId, t.clientId),
    index("reviews_tech_idx").on(t.technicianId, t.createdAt),
  ],
);

/* ------------------------------------------------------------------ */
/* Notifications                                                      */
/* ------------------------------------------------------------------ */

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    link: text("link"),
    payload: jsonb("payload").$type<Record<string, unknown>>(),
    dedupeKey: text("dedupe_key"),
    readAt: ts("read_at"),
    createdAt: createdAt(),
  },
  (t) => [
    index("notifications_user_idx").on(t.userId, t.createdAt),
    uniqueIndex("notifications_dedupe_uq").on(t.userId, t.dedupeKey),
  ],
);

export const notificationDeliveries = pgTable(
  "notification_deliveries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    notificationId: uuid("notification_id")
      .notNull()
      .references(() => notifications.id, { onDelete: "cascade" }),
    channel: deliveryChannelEnum("channel").notNull(),
    provider: text("provider").notNull(),
    deliveryStatus: deliveryStatusEnum("delivery_status").notNull(),
    attemptCount: integer("attempt_count").notNull().default(0),
    providerReference: text("provider_reference"),
    lastError: text("last_error"),
    sentAt: ts("sent_at"),
    createdAt: createdAt(),
  },
  (t) => [index("notification_deliveries_notif_idx").on(t.notificationId), index("notification_deliveries_status_idx").on(t.deliveryStatus)],
);

/* ------------------------------------------------------------------ */
/* Money                                                              */
/* ------------------------------------------------------------------ */

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id),
    provider: text("provider").notNull(), // 'cash' until an online provider is integrated
    providerReference: text("provider_reference").notNull(),
    amountMinor: integer("amount_minor").notNull(),
    currency: text("currency").notNull().default("DZD"),
    paymentStatus: paymentStatusEnum("payment_status").notNull(),
    recordedBy: uuid("recorded_by").references(() => users.id),
    note: text("note"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("payments_provider_ref_uq").on(t.provider, t.providerReference),
    index("payments_booking_idx").on(t.bookingId),
  ],
);

export const ledgerEntries = pgTable(
  "ledger_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id").references(() => bookings.id),
    technicianId: uuid("technician_id")
      .notNull()
      .references(() => technicianProfiles.id),
    entryType: ledgerEntryTypeEnum("entry_type").notNull(),
    amountMinor: integer("amount_minor").notNull(),
    currency: text("currency").notNull().default("DZD"),
    actorId: uuid("actor_id").references(() => users.id),
    reason: text("reason"),
    createdAt: createdAt(),
  },
  (t) => [index("ledger_entries_tech_idx").on(t.technicianId, t.createdAt)],
);

/* ------------------------------------------------------------------ */
/* Disputes, support, reports                                         */
/* ------------------------------------------------------------------ */

export const disputes = pgTable(
  "disputes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reference: text("reference").notNull(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id),
    openedBy: uuid("opened_by")
      .notNull()
      .references(() => users.id),
    previousBookingStatus: bookingStatusEnum("previous_booking_status").notNull(),
    category: text("category").notNull(),
    description: text("description").notNull(),
    status: disputeStatusEnum("status").notNull().default("open"),
    priority: priorityEnum("priority").notNull().default("normal"),
    assignedTo: uuid("assigned_to").references(() => users.id),
    outcome: text("outcome"), // 'completed' | 'cancelled'
    resolution: text("resolution"),
    resolvedBy: uuid("resolved_by").references(() => users.id),
    resolvedAt: ts("resolved_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("disputes_reference_uq").on(t.reference),
    index("disputes_booking_idx").on(t.bookingId),
    index("disputes_status_idx").on(t.status),
  ],
);

export const disputeEvidence = pgTable("dispute_evidence", {
  id: uuid("id").primaryKey().defaultRandom(),
  disputeId: uuid("dispute_id")
    .notNull()
    .references(() => disputes.id, { onDelete: "cascade" }),
  uploadedBy: uuid("uploaded_by")
    .notNull()
    .references(() => users.id),
  fileId: uuid("file_id")
    .notNull()
    .references(() => files.id),
  description: text("description"),
  createdAt: createdAt(),
});

export const disputeMessages = pgTable(
  "dispute_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    disputeId: uuid("dispute_id")
      .notNull()
      .references(() => disputes.id, { onDelete: "cascade" }),
    authorId: uuid("author_id")
      .notNull()
      .references(() => users.id),
    body: text("body").notNull(),
    isInternal: boolean("is_internal").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index("dispute_messages_dispute_idx").on(t.disputeId, t.createdAt)],
);

export const supportTickets = pgTable(
  "support_tickets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reference: text("reference").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    bookingId: uuid("booking_id").references(() => bookings.id),
    subject: text("subject").notNull(),
    description: text("description").notNull(),
    priority: priorityEnum("priority").notNull().default("normal"),
    status: ticketStatusEnum("status").notNull().default("open"),
    assignedTo: uuid("assigned_to").references(() => users.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("support_tickets_reference_uq").on(t.reference), index("support_tickets_user_idx").on(t.userId)],
);

export const supportTicketMessages = pgTable(
  "support_ticket_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ticketId: uuid("ticket_id")
      .notNull()
      .references(() => supportTickets.id, { onDelete: "cascade" }),
    authorId: uuid("author_id")
      .notNull()
      .references(() => users.id),
    body: text("body").notNull(),
    isInternal: boolean("is_internal").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index("support_ticket_messages_ticket_idx").on(t.ticketId, t.createdAt)],
);

export const userReports = pgTable(
  "user_reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reporterId: uuid("reporter_id")
      .notNull()
      .references(() => users.id),
    targetType: text("target_type").notNull(), // technician_profile | user | conversation | review
    targetId: uuid("target_id").notNull(),
    reportedUserId: uuid("reported_user_id").references(() => users.id),
    bookingId: uuid("booking_id").references(() => bookings.id),
    reason: text("reason").notNull(),
    description: text("description"),
    status: reportStatusEnum("status").notNull().default("open"),
    resolutionNote: text("resolution_note"),
    reviewedBy: uuid("reviewed_by").references(() => users.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("user_reports_status_idx").on(t.status, t.createdAt)],
);

/* ------------------------------------------------------------------ */
/* Audit & settings                                                   */
/* ------------------------------------------------------------------ */

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    reason: text("reason"),
    safeMetadata: jsonb("safe_metadata").$type<Record<string, unknown>>(),
    createdAt: createdAt(),
  },
  (t) => [index("audit_logs_created_idx").on(t.createdAt), index("audit_logs_entity_idx").on(t.entityType, t.entityId)],
);

export const platformSettings = pgTable("platform_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").$type<unknown>().notNull(),
  updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
  updatedAt: updatedAt(),
});

export const contactMessages = pgTable(
  "contact_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    email: text("email"),
    phone: text("phone"),
    subject: text("subject").notNull(),
    message: text("message").notNull(),
    status: ticketStatusEnum("status").notNull().default("open"),
    handledBy: uuid("handled_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [index("contact_messages_status_idx").on(t.status, t.createdAt)],
);
