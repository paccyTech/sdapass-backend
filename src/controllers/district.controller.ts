import type {
  AuthenticatedBodyContext,
  AuthenticatedContext,
  AuthenticatedQueryContext,
} from "@/middlewares/types";
import {
  createDistrict,
  deleteDistrict,
  getDistrictForUser,
  listDistrictsForUser,
  updateDistrict,
  type CreateDistrictInput,
  type DistrictFilters,
  type UpdateDistrictInput,
} from "@/services/district.service";
import { recordAuditLog } from "@/services/audit-log.service";

export const listDistrictsController = async (
  context: AuthenticatedQueryContext<Partial<DistrictFilters>>,
) => {
  const districts = await listDistrictsForUser(context.user, context.queryData ?? {});
  return { districts };
};

export const createDistrictController = async (
  context: AuthenticatedBodyContext<CreateDistrictInput>,
) => {
  if (!context.body) {
    throw new Error("Missing request body");
  }

  const district = await createDistrict(context.user, context.body);

  await recordAuditLog({
    req: context.req,
    user: context.user,
    action: "district.create",
    details: {
      districtId: district.id,
      name: district.name,
      unionId: district.unionId,
      location: district.location,
    },
  });
  return { district };
};

export const updateDistrictController = async (
  context: AuthenticatedBodyContext<UpdateDistrictInput> & { params: { districtId: string } },
) => {
  if (!context.params.districtId) {
    throw new Error("District id is required");
  }

  const changes = context.body ?? {};
  const district = await updateDistrict(context.user, context.params.districtId, changes);

  await recordAuditLog({
    req: context.req,
    user: context.user,
    action: "district.update",
    details: {
      districtId: district.id,
      name: district.name,
      unionId: district.unionId,
      changes,
    },
  });
  return { district };
};

export const deleteDistrictController = async (
  context: AuthenticatedBodyContext<undefined> & { params: { districtId: string } },
) => {
  if (!context.params.districtId) {
    throw new Error("District id is required");
  }

  await deleteDistrict(context.user, context.params.districtId);

  await recordAuditLog({
    req: context.req,
    user: context.user,
    action: "district.delete",
    details: {
      districtId: context.params.districtId,
    },
  });
  return { success: true };
};

export const getDistrictController = async (
  context: AuthenticatedContext & { params: { districtId: string } },
) => {
  if (!context.params.districtId) {
    throw new Error("District id is required");
  }

  const district = await getDistrictForUser(context.user, context.params.districtId);
  return { district };
};
