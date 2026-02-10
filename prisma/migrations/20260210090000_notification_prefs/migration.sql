ALTER TABLE "User"
ADD COLUMN "notifyNewEvents" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "notifyChanges" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "notifyNews" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "notificationCategories" "EventCategory"[] NOT NULL DEFAULT ARRAY[]::"EventCategory"[];
