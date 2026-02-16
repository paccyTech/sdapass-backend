import { createHandler } from "@/lib/route";
import { requireAuthMiddleware } from "@/middlewares/auth.middleware";
import { paramsSchemaMiddleware } from "@/middlewares/params.middleware";
import { listMemberAttendanceController } from "@/controllers/attendance.controller";
import { z } from "zod";
import { NextResponse } from "next/server";

const memberAttendanceParamsSchema = z.object({
  memberId: z.string(),
});

export const GET = createHandler({
  middlewares: [
    requireAuthMiddleware(), // Allow members to view their own attendance
    paramsSchemaMiddleware(memberAttendanceParamsSchema),
  ],
  controller: listMemberAttendanceController,
});

export const OPTIONS = async () => {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': 'http://localhost:3000',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Credentials': 'true',
    },
  });
};
