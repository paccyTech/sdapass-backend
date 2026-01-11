ALTER TABLE "User" ADD COLUMN "username" TEXT;
UPDATE "User" SET "username" = "nationalId" WHERE "username" IS NULL;  -- tweak if you prefer different usernames
ALTER TABLE "User" ALTER COLUMN "username" SET NOT NULL;
CREATE UNIQUE INDEX "User_username_key" ON "User" ("username");