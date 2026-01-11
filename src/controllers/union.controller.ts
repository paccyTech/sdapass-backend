import type { AuthenticatedBodyContext, AuthenticatedContext } from "@/middlewares/types";
import {
  createUnion,
  getUnionStats,
  listUnionsForUser,
  type CreateUnionInput,
} from "@/services/union.service";
import { recordAuditLog } from "@/services/audit-log.service";

export const listUnionsController = async (context: AuthenticatedContext) => {
  const unions = await listUnionsForUser(context.user);
  return { unions };
};

export const createUnionController = async (
  context: AuthenticatedBodyContext<CreateUnionInput>,
) => {
  if (!context.body) {
    throw new Error("Missing request body");
  }

  const union = await createUnion(context.user, context.body);

  await recordAuditLog({
    req: context.req,
    user: context.user,
    action: "union.create",
    details: {
      unionId: union.id,
      name: union.name,
    },
  });
  return { union };
};

export const getUnionStatsController = async (context: AuthenticatedContext) => {
  const stats = await getUnionStats(context.user);
  return { stats };
};
