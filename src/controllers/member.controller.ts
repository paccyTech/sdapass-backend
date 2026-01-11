import type {
  AuthenticatedBodyContext,
  AuthenticatedBodyParamsContext,
  AuthenticatedParamsContext,
  AuthenticatedQueryContext,
} from "@/middlewares/types";
import {
  createMember,
  deleteMember,
  getMemberPassForUser,
  listMembersForUser,
  updateMember,
  type CreateMemberInput,
  type MemberFilters,
  type UpdateMemberInput,
} from "@/services/member.service";
import { recordAuditLog } from "@/services/audit-log.service";

export const listMembersController = async (
  context: AuthenticatedQueryContext<Partial<MemberFilters>>,
) => {
  const members = await listMembersForUser(context.user, context.queryData ?? {});
  return { members };
};

export const createMemberController = async (
  context: AuthenticatedBodyContext<CreateMemberInput>,
) => {
  if (!context.body) {
    throw new Error("Missing request body");
  }

  const result = await createMember(context.user, context.body);

  await recordAuditLog({
    req: context.req,
    user: context.user,
    action: "member.create",
    details: {
      memberId: result.member.id,
      churchId: result.member.church?.id ?? null,
      firstName: result.member.firstName,
      lastName: result.member.lastName,
    },
  });
  return result;
};

export const updateMemberController = async (
  context: AuthenticatedBodyParamsContext<UpdateMemberInput, { memberId: string }>,
) => {
  const memberId = context.paramsData?.memberId;
  if (!memberId) {
    throw new Error("Member id is required");
  }

  const changes = context.body ?? {};
  const result = await updateMember(context.user, memberId, changes);

  await recordAuditLog({
    req: context.req,
    user: context.user,
    action: "member.update",
    details: {
      memberId,
      churchId: result.member.church?.id ?? null,
      changes,
    },
  });
  return result;
};

export const deleteMemberController = async (
  context: AuthenticatedParamsContext<{ memberId: string }>,
) => {
  const memberId = context.paramsData?.memberId;
  if (!memberId) {
    throw new Error("Member id is required");
  }

  const result = await deleteMember(context.user, memberId);

  await recordAuditLog({
    req: context.req,
    user: context.user,
    action: "member.delete",
    details: {
      memberId,
    },
  });
  return result;
};

export const getMemberPassController = async (
  context: AuthenticatedParamsContext<{ memberId: string }>,
) => {
  const memberId = context.paramsData?.memberId;
  if (!memberId) {
    throw new Error("Member id is required");
  }

  const result = await getMemberPassForUser(context.user, memberId);
  return result;
};
