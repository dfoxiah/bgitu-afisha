-- Add explicit admin-owned scenario accounts for role testing flows.
ALTER TABLE "User"
ADD COLUMN "isScenarioPersona" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "scenarioOwnerId" TEXT;

ALTER TABLE "User"
ADD CONSTRAINT "User_scenarioOwnerId_fkey"
FOREIGN KEY ("scenarioOwnerId") REFERENCES "User"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

CREATE INDEX "User_scenarioOwnerId_isScenarioPersona_idx"
ON "User"("scenarioOwnerId", "isScenarioPersona");
