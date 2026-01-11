-- AlterTable
ALTER TABLE "Church" ADD COLUMN     "districtPastorId" TEXT;

-- AddForeignKey
ALTER TABLE "Church" ADD CONSTRAINT "Church_districtPastorId_fkey" FOREIGN KEY ("districtPastorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
