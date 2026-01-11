import type {
  AuthenticatedBodyContext,
  AuthenticatedQueryContext,
} from "@/middlewares/types";
import {
  createChurch,
  deleteChurch,
  getChurchForUser,
  listChurchesForUser,
  updateChurch,
  type ChurchFilters,
  type CreateChurchInput,
  type UpdateChurchInput,
} from "@/services/church.service";
import { recordAuditLog } from "@/services/audit-log.service";

export const listChurchesController = async (
  context: AuthenticatedQueryContext<Partial<ChurchFilters>>,
) => {
  const churches = await listChurchesForUser(context.user, context.queryData ?? {});
  return { churches };
};

export const createChurchController = async (
  context: AuthenticatedBodyContext<CreateChurchInput>,
) => {
  if (!context.body) {
    throw new Error("Missing request body");
  }

  const church = await createChurch(context.user, context.body);

  await recordAuditLog({
    req: context.req,
    user: context.user,
    action: "church.create",
    details: {
      churchId: church.id,
      name: church.name,
      districtId: church.districtId,
      location: church.location,
    },
  });
  return { church };
};

export const updateChurchController = async (
  context: AuthenticatedBodyContext<UpdateChurchInput> & { params: { churchId: string } },
) => {
  if (!context.params.churchId) {
    throw new Error("Church id is required");
  }

  const changes = context.body ?? {};
  const church = await updateChurch(context.user, context.params.churchId, changes);

  await recordAuditLog({
    req: context.req,
    user: context.user,
    action: "church.update",
    details: {
      churchId: church.id,
      name: church.name,
      districtId: church.districtId,
      changes,
    },
  });
  return { church };
};

export const deleteChurchController = async (
  context: AuthenticatedBodyContext<undefined> & { params: { churchId: string } },
) => {
  if (!context.params.churchId) {
    throw new Error("Church id is required");
  }

  const result = await deleteChurch(context.user, context.params.churchId);

  await recordAuditLog({
    req: context.req,
    user: context.user,
    action: "church.delete",
    details: {
      churchId: context.params.churchId,
    },
  });
  return result;
};

export const getChurchController = async (
  context: AuthenticatedQueryContext<undefined> & { params: { churchId: string } },
) => {
  if (!context.params.churchId) {
    throw new Error("Church id is required");
  }

  const church = await getChurchForUser(context.user, context.params.churchId);
  return { church };
};
