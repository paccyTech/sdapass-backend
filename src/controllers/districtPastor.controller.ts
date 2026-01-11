import type { AuthenticatedBodyContext, AuthenticatedQueryContext } from "@/middlewares/types";
import {
  assignChurchesToPastor,
  createDistrictPastor,
  deleteDistrictPastor,
  listDistrictPastors,
  updateDistrictPastor,
  type CreateDistrictPastorInput,
  type DistrictPastorFilters,
  type UpdateDistrictPastorInput,
} from "@/services/districtPastor.service";
import { recordAuditLog } from "@/services/audit-log.service";

export const listDistrictPastorsController = async (
  context: AuthenticatedQueryContext<DistrictPastorFilters>,
) => {
  const actorsPastors = await listDistrictPastors(context.user, context.queryData ?? {});
  return { pastors: actorsPastors };
};

export const createDistrictPastorController = async (
  context: AuthenticatedBodyContext<CreateDistrictPastorInput>,
) => {
  if (!context.body) {
    throw new Error("Missing request body");
  }

  const result = await createDistrictPastor(context.user, context.body);

  await recordAuditLog({
    req: context.req,
    user: context.user,
    action: "districtPastor.create",
    details: {
      pastorId: result.pastor.id,
      districtId: result.pastor.districtId,
      email: result.pastor.email,
      phoneNumber: result.pastor.phoneNumber,
    },
  });
  return result;
};

export const updateDistrictPastorController = async (
  context: AuthenticatedBodyContext<UpdateDistrictPastorInput> & { params: { pastorId: string } },
) => {
  if (!context.params.pastorId) {
    throw new Error("Pastor id is required");
  }

  const changes = context.body ?? {};
  const pastor = await updateDistrictPastor(context.user, context.params.pastorId, changes);

  await recordAuditLog({
    req: context.req,
    user: context.user,
    action: "districtPastor.update",
    details: {
      pastorId: pastor.id,
      districtId: pastor.districtId,
      changes,
    },
  });
  return { pastor };
};

export const assignChurchesToPastorController = async (
  context: AuthenticatedBodyContext<{ churchIds: string[] }> & { params: { pastorId: string } },
) => {
  if (!context.body) {
    throw new Error("Missing request body");
  }

  const { churchIds } = context.body;
  if (!Array.isArray(churchIds)) {
    throw new Error("churchIds must be provided");
  }

  const pastor = await assignChurchesToPastor(context.user, context.params.pastorId, churchIds);

  await recordAuditLog({
    req: context.req,
    user: context.user,
    action: "districtPastor.assignChurches",
    details: {
      pastorId: pastor.id,
      churchIds,
    },
  });
  return { pastor };
};

export const deleteDistrictPastorController = async (
  context: AuthenticatedBodyContext<undefined> & { params: { pastorId: string } },
) => {
  if (!context.params.pastorId) {
    throw new Error("Pastor id is required");
  }

  await deleteDistrictPastor(context.user, context.params.pastorId);

  await recordAuditLog({
    req: context.req,
    user: context.user,
    action: "districtPastor.delete",
    details: {
      pastorId: context.params.pastorId,
    },
  });
  return { success: true };
};
