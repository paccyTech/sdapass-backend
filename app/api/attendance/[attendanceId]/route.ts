import { z } from "zod";

import { createHandler } from "@/lib/route";
import { requireAuthMiddleware } from "@/middlewares/auth.middleware";
import { paramsSchemaMiddleware } from "@/middlewares/params.middleware";
import { jsonBodyMiddleware } from "@/middlewares/body.middleware";
import { updateAttendanceController } from "@/controllers/attendance.controller";

const updateAttendanceSchema = z.object({
  status: z.enum(["PENDING", "APPROVED"]),
  issuePass: z.boolean().optional(),
});

const attendanceParamsSchema = z.object({
  attendanceId: z.string().min(1, "Attendance ID is required"),
});

export const PATCH = createHandler({
  middlewares: [
    requireAuthMiddleware(["CHURCH_ADMIN"]),
    paramsSchemaMiddleware(attendanceParamsSchema),
    jsonBodyMiddleware(updateAttendanceSchema),
  ],
  controller: updateAttendanceController,
});
