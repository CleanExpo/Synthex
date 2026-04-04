-- OAuth Account Model Migration
-- Adds multi-provider authentication support via Account model

-- Add password column if it doesn't exist (nullable for OAuth-only users)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'password'
    ) THEN
        ALTER TABLE "users" ADD COLUMN "password" TEXT;
    ELSE
        -- Make password nullable if it exists and is NOT NULL
        ALTER TABLE "users" ALTER COLUMN "password" DROP NOT NULL;
    END IF;
END $$;

-- CreateTable: accounts
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "expiresAt" INTEGER,
    "tokenType" TEXT,
    "scope" TEXT,
    "idToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: unique constraint on provider + providerAccountId
CREATE UNIQUE INDEX "accounts_provider_providerAccountId_key" ON "accounts"("provider", "providerAccountId");

-- CreateIndex: index on userId for faster lookups
CREATE INDEX "accounts_userId_idx" ON "accounts"("userId");

-- AddForeignKey: link accounts to users with cascade delete
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
