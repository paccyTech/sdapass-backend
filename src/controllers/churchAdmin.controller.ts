import type {
  AuthenticatedBodyContext,
  AuthenticatedBodyParamsContext,
  AuthenticatedParamsContext,
  AuthenticatedQueryContext,
} from "@/middlewares/types";
import {
  createChurchAdmin,
  deleteChurchAdmin,
  listChurchAdmins,
  updateChurchAdmin,
  type ChurchAdminFilters,
  type CreateChurchAdminInput,
  type UpdateChurchAdminInput,
} from "@/services/churchAdmin.service";
import { recordAuditLog } from "@/services/audit-log.service";

export const listChurchAdminsController = async (
  context: AuthenticatedQueryContext<Partial<ChurchAdminFilters>>,
) => {
  const admins = await listChurchAdmins(context.user, context.queryData ?? {});
  return { admins };
};

export const createChurchAdminController = async (
  context: AuthenticatedBodyContext<CreateChurchAdminInput>,
) => {
  if (!context.body) {
    throw new Error("Missing request body");
  }

  const result = await createChurchAdmin(context.user, context.body);

  await recordAuditLog({
    req: context.req,
    user: context.user,
    action: "churchAdmin.create",
    details: {
      adminId: result.admin.id,
      churchId: result.admin.churchId,
      email: result.admin.email,
      phoneNumber: result.admin.phoneNumber,
    },
  });
  return result;
};

export const updateChurchAdminController = async (
  context: AuthenticatedBodyParamsContext<UpdateChurchAdminInput, { adminId: string }>,
) => {
  if (!context.paramsData?.adminId) {
    throw new Error("Administrator id is required");
  }

  const changes = context.body ?? {};
  const result = await updateChurchAdmin(context.user, context.paramsData.adminId, changes);

  await recordAuditLog({
    req: context.req,
    user: context.user,
    action: "churchAdmin.update",
    details: {
      adminId: result.admin.id,
      churchId: result.admin.churchId,
      changes,
    },
  });
  return result;
};

export const deleteChurchAdminController = async (
  context: AuthenticatedParamsContext<{ adminId: string }>,
) => {
  if (!context.paramsData?.adminId) {
    throw new Error("Administrator id is required");
  }

  const result = await deleteChurchAdmin(context.user, context.paramsData.adminId);

  await recordAuditLog({
    req: context.req,
    user: context.user,
    action: "churchAdmin.delete",
    details: {
      adminId: context.paramsData.adminId,
    },
  });
  return result;
};
