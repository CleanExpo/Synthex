-- SYN-802: phone_pool table
-- Stores Twilio phone numbers assigned to organisations for inbound-call attribution.

CREATE TABLE "phone_pool" (
  "id"                TEXT        NOT NULL,
  "organization_id"   TEXT        NOT NULL,
  "twilio_phone_e164" TEXT        NOT NULL,
  "active"            BOOLEAN     NOT NULL DEFAULT true,
  "assigned_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"        TIMESTAMP(3) NOT NULL,

  CONSTRAINT "phone_pool_pkey" PRIMARY KEY ("id")
);

-- Unique: one org per phone number
CREATE UNIQUE INDEX "phone_pool_twilio_phone_e164_key" ON "phone_pool"("twilio_phone_e164");

-- Lookup by org
CREATE INDEX "phone_pool_organization_id_idx" ON "phone_pool"("organization_id");

-- Fast webhook lookup (active numbers only)
CREATE INDEX "phone_pool_twilio_phone_e164_active_idx" ON "phone_pool"("twilio_phone_e164", "active");

-- FK → organizations
ALTER TABLE "phone_pool" ADD CONSTRAINT "phone_pool_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
