-- CreateTable
CREATE TABLE "UmugandaEvent" (
    "id" TEXT NOT NULL,
    "unionId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "theme" TEXT,
    "location" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UmugandaEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UmugandaEventAttendance" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "checkedInAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UmugandaEventAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UmugandaEvent_unionId_date_idx" ON "UmugandaEvent"("unionId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "UmugandaEventAttendance_eventId_memberId_key" ON "UmugandaEventAttendance"("eventId", "memberId");

-- CreateIndex
CREATE INDEX "UmugandaEventAttendance_churchId_checkedInAt_idx" ON "UmugandaEventAttendance"("churchId", "checkedInAt");

-- AddForeignKey
ALTER TABLE "UmugandaEvent" ADD CONSTRAINT "UmugandaEvent_unionId_fkey" FOREIGN KEY ("unionId") REFERENCES "Union"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UmugandaEvent" ADD CONSTRAINT "UmugandaEvent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UmugandaEventAttendance" ADD CONSTRAINT "UmugandaEventAttendance_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "UmugandaEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UmugandaEventAttendance" ADD CONSTRAINT "UmugandaEventAttendance_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UmugandaEventAttendance" ADD CONSTRAINT "UmugandaEventAttendance_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;
