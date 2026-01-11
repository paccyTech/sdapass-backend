import crypto from "crypto";

import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { sendSms } from "@/lib/sms";
import { sendPasswordResetEmail } from "@/lib/email";
import { AppError, NotFoundError } from "@/lib/errors";
import { UserModel } from "@/models/user.model";
import { hashPassword } from "@/services/auth.service";
import { Role } from "@prisma/client";

const RESET_TOKEN_TTL_MINUTES = 60;

// Roles that should receive password reset via email
const EMAIL_BASED_ROLES: Role[] = [
  'UNION_ADMIN',
  'DISTRICT_ADMIN', 
  'CHURCH_ADMIN'
];

// Roles that should receive password reset via SMS
const SMS_BASED_ROLES: Role[] = [
  'MEMBER',
  'POLICE_VERIFIER'
];

export interface PasswordResetRequestInput {
  nationalId?: string;
  email?: string;
}

export interface PasswordResetConfirmInput {
  token: string;
  newPassword: string;
}

const buildResetLink = (token: string) => {
  const baseUrl = env.PRIMARY_ORIGIN || "http://localhost:3000";
  return `${baseUrl}/reset-password/confirm?token=${encodeURIComponent(token)}`;
};

const generateResetToken = () => crypto.randomBytes(24).toString("base64url");

const sendResetViaSms = async (phoneNumber: string, token: string, expiresInMinutes: number) => {
  if (!env.SMS_API_KEY) {
    throw new AppError("SMS service is not configured", 500);
  }

  const link = buildResetLink(token);
  const message = [
    "Umuganda SDA password reset request.",
    `Follow this link within ${expiresInMinutes} minutes: ${link}`,
  ].join(" ");

  try {
    await sendSms({
      to: phoneNumber,
      message,
    });
    return true;
  } catch (smsError) {
    console.error("Failed to send password reset SMS", smsError);
    throw new AppError("Unable to send password reset SMS", 500);
  }
};

const sendResetViaEmail = async (email: string, token: string, expiresInMinutes: number) => {
  if (!env.GMAIL_USER || !env.GMAIL_APP_PASSWORD) {
    throw new AppError("Email service is not properly configured", 500);
  }

  try {
    await sendPasswordResetEmail(email, token, expiresInMinutes);
    return true;
  } catch (error) {
    console.error("Failed to send password reset email", error);
    throw new AppError("Unable to send password reset email", 500);
  }
};

export const requestPasswordReset = async ({ nationalId, email }: PasswordResetRequestInput) => {
  if (!nationalId && !email) {
    throw new AppError("Provide either national ID or email", 400);
  }

  const user = nationalId
    ? await UserModel.findByNationalId(nationalId)
    : await UserModel.findByEmail(email as string);

  if (!user) {
    // Avoid leaking account existence – respond with success
    return { success: true } as const;
  }

  const token = generateResetToken();
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000);

  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      token,
      expiresAt,
    },
  });

  // Determine the appropriate reset method based on user role
  const isAdmin = EMAIL_BASED_ROLES.includes(user.role as Role);
  const isMember = SMS_BASED_ROLES.includes(user.role as Role);

  try {
    if (isAdmin && user.email) {
      // Send reset link via email for admins
      await sendResetViaEmail(user.email, token, RESET_TOKEN_TTL_MINUTES);
    } else if (isMember && user.phoneNumber) {
      // Send reset link via SMS for members
      await sendResetViaSms(user.phoneNumber, token, RESET_TOKEN_TTL_MINUTES);
    } else if (isAdmin && !user.email) {
      throw new AppError("No email address on record for this admin account", 400);
    } else if (isMember && !user.phoneNumber) {
      throw new AppError("No phone number on record for this member account", 400);
    } else {
      throw new AppError("Unable to determine reset method for this user", 400);
    }
  } catch (error) {
    // Clean up the token if sending fails
    await prisma.passwordResetToken.deleteMany({
      where: { token }
    });
    throw error; // Re-throw the error to be handled by the controller
  }

  return { success: true } as const;
};

export const confirmPasswordReset = async ({ token, newPassword }: PasswordResetConfirmInput) => {
  if (!token || !newPassword) {
    throw new AppError("Token and new password are required", 400);
  }

  if (newPassword.length < 8) {
    throw new AppError("Password must be at least 8 characters", 400);
  }

  const record = await prisma.passwordResetToken.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!record) {
    throw new NotFoundError("Reset token not found");
  }

  if (record.usedAt) {
    throw new AppError("Reset token already used", 400);
  }

  if (record.expiresAt.getTime() < Date.now()) {
    throw new AppError("Reset token expired", 400);
  }

  // Check if the user still exists and is active
  const user = await prisma.user.findUnique({
    where: { id: record.userId },
  });

  if (!user) {
    throw new NotFoundError("User account not found");
  }

  if (!user.isActive) {
    throw new AppError("This account has been deactivated", 403);
  }

  const passwordHash = await hashPassword(newPassword);

  // Update the user's password and mark the token as used in a transaction
  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash },
    }),
    prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
  ]);

  return { success: true } as const;
};
