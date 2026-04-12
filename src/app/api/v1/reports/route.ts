import "@/schemas/setup";
import { prisma } from "@/lib/prisma";
import {
  type AuthenticatedRequest,
  isManager,
  withAuth,
} from "@/lib/auth/middleware";
import { forbiddenResponse } from "@/lib/auth/errors";
import { paginated, zodErrorResponse } from "@/lib/api/response";
import { ReportListQuerySchema } from "@/schemas/report";

export const GET = withAuth(async (request: AuthenticatedRequest) => {
  const url = new URL(request.url);
  const rawQuery: Record<string, string> = {};
  for (const [key, value] of url.searchParams.entries()) {
    rawQuery[key] = value;
  }

  const parsed = ReportListQuerySchema.safeParse(rawQuery);
  if (!parsed.success) {
    return zodErrorResponse(parsed.error);
  }

  const {
    date_from,
    date_to,
    salesperson_id,
    status,
    page = 1,
    per_page = 20,
  } = parsed.data;

  const currentUser = request.salesperson;
  const userIsManager = isManager(request);

  // 権限チェック: 営業が他人のsalesperson_idを指定した場合は403
  if (!userIsManager) {
    if (salesperson_id !== undefined && salesperson_id !== currentUser.id) {
      return forbiddenResponse("他の担当者の日報は閲覧できません");
    }
  }

  // WHERE条件の構築
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};

  // salesperson_id フィルタ
  if (userIsManager) {
    if (salesperson_id !== undefined) {
      // 上長が特定の部下を指定
      where.salespersonId = salesperson_id;
    } else {
      // 上長が未指定: 自分＋部下全員
      const subordinates = await prisma.salesperson.findMany({
        where: { managerId: currentUser.id },
        select: { id: true },
      });
      const ids = [currentUser.id, ...subordinates.map((s) => s.id)];
      where.salespersonId = { in: ids };
    }
  } else {
    // 営業: 自分の日報のみ
    where.salespersonId = currentUser.id;
  }

  // 日付フィルタ
  if (date_from || date_to) {
    where.reportDate = {};
    if (date_from) {
      where.reportDate.gte = new Date(date_from);
    }
    if (date_to) {
      where.reportDate.lte = new Date(date_to);
    }
  }

  // ステータスフィルタ
  if (status) {
    where.status = status;
  }

  // 総件数取得
  const total = await prisma.dailyReport.count({ where });
  const total_pages = Math.ceil(total / per_page) || 0;

  // データ取得
  const reports = await prisma.dailyReport.findMany({
    where,
    select: {
      id: true,
      reportDate: true,
      status: true,
      createdAt: true,
      salesperson: {
        select: {
          id: true,
          name: true,
        },
      },
      _count: {
        select: {
          visitRecords: true,
        },
      },
    },
    orderBy: { reportDate: "desc" },
    skip: (page - 1) * per_page,
    take: per_page,
  });

  const data = reports.map((r) => ({
    id: r.id,
    report_date: r.reportDate.toISOString().split("T")[0],
    salesperson: r.salesperson,
    visit_count: r._count.visitRecords,
    status: r.status,
    created_at: r.createdAt.toISOString(),
  }));

  return paginated(data, { page, per_page, total, total_pages });
});
