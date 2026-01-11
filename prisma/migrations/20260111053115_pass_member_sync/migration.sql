/*
  Warnings:

  - A unique constraint covering the columns `[memberId]` on the table `Pass` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "AuditLog_unionId_createdAt_idx";

-- DropIndex
DROP INDEX "AuditLog_userRole_createdAt_idx";

-- AlterTable
ALTER TABLE "Pass" ADD COLUMN     "churchId" TEXT,
ADD COLUMN     "memberId" TEXT,
ADD COLUMN     "sessionDate" TIMESTAMP(3),
ALTER COLUMN "attendanceId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "AuditLog_unionId_createdAt_idx" ON "AuditLog"("unionId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_userRole_createdAt_idx" ON "AuditLog"("userRole", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Pass_memberId_key" ON "Pass"("memberId");

-- AddForeignKey
ALTER TABLE "Pass" ADD CONSTRAINT "Pass_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pass" ADD CONSTRAINT "Pass_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE SET NULL ON UPDATE CASCADE;
