process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgres://postgres@localhost:5432/khidmati_test";
process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
delete process.env.EMAIL_PROVIDER_API_KEY;
delete process.env.SMS_PROVIDER;
