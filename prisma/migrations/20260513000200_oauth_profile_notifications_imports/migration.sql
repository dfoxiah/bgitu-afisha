ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'MODERATOR';

ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'ACTIVE_PARTICIPANT';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'LEADER_ASSIGNED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'ROLE_ASSIGNED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'PARTICIPANT_ADDED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'PARTICIPATION_STATUS_CHANGED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'EVENT_COMPLETED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'REPORT_DRAFT_CREATED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'IMPORT_COMPLETED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'IMPORT_COMPLETED_WITH_ERRORS';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'ACCESS_CHANGED';

DO $$ BEGIN
  CREATE TYPE "ConsentType" AS ENUM ('PRIVACY', 'TERMS');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "ImportType" AS ENUM ('USERS', 'EVENTS', 'NEWS');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "ImportStatus" AS ENUM ('COMPLETED', 'COMPLETED_WITH_ERRORS', 'FAILED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "ReportStatus" AS ENUM ('DRAFT', 'PUBLISHED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "profileCompletedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "notifyInApp" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS "notifyEmail" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "notifyVk" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "vkUserId" TEXT,
ADD COLUMN IF NOT EXISTS "yandexEmail" TEXT,
ADD COLUMN IF NOT EXISTS "privacyConsentVersion" TEXT,
ADD COLUMN IF NOT EXISTS "termsConsentVersion" TEXT,
ADD COLUMN IF NOT EXISTS "consentSource" TEXT;

ALTER TABLE "Event"
ADD COLUMN IF NOT EXISTS "isPublic" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP(3);

ALTER TABLE "EventReport"
ADD COLUMN IF NOT EXISTS "status" "ReportStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN IF NOT EXISTS "publishedAt" TIMESTAMP(3);

ALTER TABLE "Notification"
ADD COLUMN IF NOT EXISTS "link" TEXT;

CREATE TABLE IF NOT EXISTS "UserConsent" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" "ConsentType" NOT NULL,
  "version" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "provider" TEXT,
  "ip" TEXT,
  "userAgent" TEXT,
  "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "UserConsent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ImportJob" (
  "id" TEXT NOT NULL,
  "actorId" TEXT,
  "type" "ImportType" NOT NULL,
  "mode" TEXT NOT NULL,
  "status" "ImportStatus" NOT NULL,
  "inputRows" INTEGER NOT NULL DEFAULT 0,
  "created" INTEGER NOT NULL DEFAULT 0,
  "updated" INTEGER NOT NULL DEFAULT 0,
  "skipped" INTEGER NOT NULL DEFAULT 0,
  "errors" JSONB,
  "warnings" JSONB,
  "fileName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ImportJob_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "NewsTemplate" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "body" TEXT NOT NULL,
  "variables" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "NewsTemplate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Event_isPublic_idx" ON "Event"("isPublic");
CREATE INDEX IF NOT EXISTS "EventReport_status_idx" ON "EventReport"("status");
CREATE INDEX IF NOT EXISTS "UserConsent_userId_type_idx" ON "UserConsent"("userId", "type");
CREATE INDEX IF NOT EXISTS "UserConsent_acceptedAt_idx" ON "UserConsent"("acceptedAt");
CREATE INDEX IF NOT EXISTS "ImportJob_actorId_createdAt_idx" ON "ImportJob"("actorId", "createdAt");
CREATE INDEX IF NOT EXISTS "ImportJob_type_createdAt_idx" ON "ImportJob"("type", "createdAt");
CREATE INDEX IF NOT EXISTS "NewsTemplate_createdById_idx" ON "NewsTemplate"("createdById");

ALTER TABLE "UserConsent" ADD CONSTRAINT "UserConsent_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ImportJob" ADD CONSTRAINT "ImportJob_actorId_fkey"
FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "NewsTemplate" ADD CONSTRAINT "NewsTemplate_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
