import { NextResponse } from "next/server";
import { z } from "zod";
import { createHandler } from "@/lib/route";
import { requireAuthMiddleware } from "@/middlewares/auth.middleware";
import { jsonBodyMiddleware } from "@/middlewares/body.middleware";
import { querySchemaMiddleware } from "@/middlewares/query.middleware";
import { churchAccessMiddleware } from "@/middlewares/access.middleware";
import {
  createAttendanceController,
  listAttendanceController,
} from "@/controllers/attendance.controller";

const attendanceQuerySchema = z.object({
  districtId: z.string().optional(),
  churchId: z.string().optional(),
  sessionId: z.string().optional(),
  status: z.enum(["PENDING", "APPROVED"]).optional(),
});

const createAttendanceSchema = z.object({
  sessionId: z.string().min(1, "Session is required"),
  memberId: z.string().min(1, "Member is required"),
});

export const GET = createHandler({
  middlewares: [
    requireAuthMiddleware(["UNION_ADMIN", "DISTRICT_ADMIN", "CHURCH_ADMIN"]),
    querySchemaMiddleware(attendanceQuerySchema),
  ],
  controller: listAttendanceController,
});

export const POST = createHandler({
  middlewares: [
    requireAuthMiddleware(["CHURCH_ADMIN"]),
    jsonBodyMiddleware(createAttendanceSchema),
    churchAccessMiddleware({ key: "sessionId", optional: true }),
  ],
  controller: createAttendanceController,
});

export const OPTIONS = createHandler({
  controller: async () => new NextResponse(null, { status: 204 }),
});
