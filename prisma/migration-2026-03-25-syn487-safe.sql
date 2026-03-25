-- AlterTable
ALTER TABLE "keyword_targets" ADD COLUMN "auto_seeded" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "testimonial_requests" ALTER COLUMN "token" SET DEFAULT gen_random_uuid()::text;
