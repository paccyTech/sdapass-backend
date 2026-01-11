-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "userName" TEXT NOT NULL,
    "userRole" "Role",
    "action" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "unionId" TEXT,
    "districtId" TEXT,
    "churchId" TEXT,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Indexes
CREATE INDEX "AuditLog_unionId_createdAt_idx" ON "AuditLog"("unionId", "createdAt" DESC);
CREATE INDEX "AuditLog_userRole_createdAt_idx" ON "AuditLog"("userRole", "createdAt" DESC);
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");
