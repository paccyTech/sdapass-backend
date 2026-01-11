import { Role } from "@prisma/client";

export const canCreateRole = (actorRole: Role, targetRole: Role): boolean => {
  switch (actorRole) {
    case "UNION_ADMIN":
      return targetRole === "DISTRICT_ADMIN";
    case "DISTRICT_ADMIN":
      return targetRole === "CHURCH_ADMIN";
    case "CHURCH_ADMIN":
      return targetRole === "MEMBER";
    default:
      return false;
  }
};

export const canViewDistrict = (actorRole: Role, districtId?: string | null): boolean => {
  if (actorRole === "UNION_ADMIN") {
    return true;
  }
  return actorRole === "DISTRICT_ADMIN" && !!districtId;
};

export const canViewChurch = (actorRole: Role, churchId?: string | null): boolean => {
  if (actorRole === "UNION_ADMIN" || actorRole === "DISTRICT_ADMIN") {
    return true;
  }
  return actorRole === "CHURCH_ADMIN" && !!churchId;
};

export const canManageAttendance = (role: Role): boolean => role === "CHURCH_ADMIN";

export const canViewReports = (role: Role): boolean => {
  return role === "UNION_ADMIN" || role === "DISTRICT_ADMIN" || role === "CHURCH_ADMIN";
};
