import { Prisma, type User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ForbiddenError } from "@/lib/errors";

export interface CommunicationAnalyticsFilters {
  fromDate?: string | null;
  toDate?: string | null;
}

const parseDate = (value: string | null | undefined): Date | undefined => {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

export const getChurchCommunicationAnalytics = async (
  user: User,
  filters: CommunicationAnalyticsFilters = {}
) => {
  if (user.role !== "CHURCH_ADMIN" || !user.churchId) {
    throw new ForbiddenError("Only church admins can view communication analytics");
  }

  const from = parseDate(filters.fromDate);
  const to = parseDate(filters.toDate);

  // Define type for SMS stats aggregation result
  type SmsStatsResult = {
    _count: {
      _all: number;
    };
  };

  // Get SMS statistics
  const smsStats = await prisma.memberPass.aggregate({
    where: {
      member: {
        churchId: user.churchId,
      },
      ...(from || to
        ? {
            createdAt: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            },
          }
        : {}),
      smsSentAt: { not: null },
    },
    _count: {
      _all: true
    }
  }) as unknown as SmsStatsResult;

  // Get password reset stats
  const resetStats = await prisma.passwordResetToken.aggregate({
    where: {
      user: {
        churchId: user.churchId,
      },
      ...(from || to
        ? {
            createdAt: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            },
          }
        : {}),
    },
    _count: { _all: true },
  });

  // Get timeline data (last 14 days)
  const endDate = to ? new Date(to) : new Date();
  const startDate = from ? new Date(from) : new Date();
  startDate.setDate(endDate.getDate() - 13); // 14 days total including today

  const timelineData = await prisma.$queryRaw<Array<{ date: string; smsCount: bigint; resetCount: bigint }>>`
    SELECT 
      DATE_TRUNC('day', date_series)::date as date,
      COALESCE(sms.count, 0) as "smsCount",
      COALESCE(reset.count, 0) as "resetCount"
    FROM 
      generate_series(${startDate}::timestamp, ${endDate}::timestamp, '1 day'::interval) as date_series
    LEFT JOIN (
      SELECT 
        DATE_TRUNC('day', "createdAt") as day,
        COUNT(*) as count
      FROM "MemberPass"
      WHERE "memberId" IN (
        SELECT id FROM "User" WHERE "churchId" = ${user.churchId}
      )
      ${from || to ? Prisma.sql`AND "createdAt" BETWEEN ${from || new Date(0)} AND ${to || new Date()}` : Prisma.empty}
      GROUP BY day
    ) sms ON DATE_TRUNC('day', date_series) = sms.day
    LEFT JOIN (
      SELECT 
        DATE_TRUNC('day', "createdAt") as day,
        COUNT(*) as count
      FROM "PasswordResetToken"
      WHERE "userId" IN (
        SELECT id FROM "User" WHERE "churchId" = ${user.churchId}
      )
      ${from || to ? Prisma.sql`AND "createdAt" BETWEEN ${from || new Date(0)} AND ${to || new Date()}` : Prisma.empty}
      GROUP BY day
    ) reset ON DATE_TRUNC('day', date_series) = reset.day
    ORDER BY date
  `;

  // Format the timeline data
  const timeline = timelineData.map((item) => ({
    date: item.date,
    smsSent: Number(item.smsCount),
    emailSent: Number(item.resetCount), // Using reset tokens as a proxy for emails
  }));

  return {
    sms: {
      totalSent: smsStats._count._all,
      delivered: smsStats._count._all, // Using _count._all since we're already filtering for smsSentAt not null
      failed: 0, // We don't track SMS failures currently
      queued: 0, // We don't track queued messages currently
      lastSentAt: await prisma.memberPass.findFirst({
        where: {
          member: {
            churchId: user.churchId,
          },
          smsSentAt: { not: null },
        },
        orderBy: { smsSentAt: 'desc' },
        select: { smsSentAt: true },
      }).then((result) => result?.smsSentAt?.toISOString() || null),
    },
    email: {
      totalSent: resetStats._count._all,
      delivered: resetStats._count._all, // Assuming all reset tokens are delivered
      failed: 0, // We don't track email failures currently
      queued: 0, // We don't track queued emails currently
      lastSentAt: await prisma.passwordResetToken.findFirst({
        where: {
          user: {
            churchId: user.churchId,
          },
        },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }).then((result) => result?.createdAt.toISOString() || null),
    },
    timeline,
    recent: await getRecentCommunications(user.churchId, 5),
  };
};

async function getRecentCommunications(churchId: string, limit: number) {
  // Get recent SMS communications
  const recentSMS = await prisma.memberPass.findMany({
    where: {
      member: {
        churchId,
      },
      smsSentAt: { not: null },
    },
    orderBy: { smsSentAt: 'desc' },
    take: limit,
    select: {
      id: true,
      smsSentAt: true,
      member: {
        select: {
          firstName: true,
          lastName: true,
          phoneNumber: true,
        },
      },
    },
  });

  // Get recent password reset tokens (as a proxy for emails)
  const recentResets = await prisma.passwordResetToken.findMany({
    where: {
      user: {
        churchId,
      },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      createdAt: true,
      user: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
  });

  // Combine and sort all communications
  const allCommunications = [
    ...recentSMS.map((sms) => ({
      id: `sms-${sms.id}`,
      channel: 'SMS' as const,
      recipient: sms.member.phoneNumber,
      status: 'DELIVERED' as const,
      sentAt: sms.smsSentAt?.toISOString() || new Date().toISOString(),
      snippet: `Welcome ${sms.member.firstName}, your Umuganda pass is ready.`,
    })),
    ...recentResets.map((reset) => ({
      id: `email-${reset.id}`,
      channel: 'Email' as const,
      recipient: reset.user.email || 'No email',
      status: 'DELIVERED' as const,
      sentAt: reset.createdAt.toISOString(),
      snippet: 'Password reset instructions',
    })),
  ].sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime())
   .slice(0, limit);

  return allCommunications;
}
