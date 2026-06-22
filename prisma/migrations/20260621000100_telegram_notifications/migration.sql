ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "notifyTelegram" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "telegramChatId" TEXT,
ADD COLUMN IF NOT EXISTS "telegramUsername" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'User_telegramChatId_key'
  ) THEN
    CREATE UNIQUE INDEX "User_telegramChatId_key" ON "User"("telegramChatId");
  END IF;
END $$;
