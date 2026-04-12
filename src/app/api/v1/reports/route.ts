import "@/schemas/setup";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  type AuthenticatedRequest,
  isManager,
  withAuth,
} from "@/lib/auth/middleware";
import { forbiddenResponse } from "@/lib/auth/errors";
import {
  created,
  errorResponse,
  paginated,
  withErrorHandler,
  zodErrorResponse,
} from "@/lib/api/response";
import {
  CreateReportRequestSchema,
  ReportListQuerySchema,
} from "@/schemas/report";

export const GET = withAuth(
  withErrorHandler(async (request: AuthenticatedRequest) => {
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

    // 上長が特定のsalesperson_idを指定した場合、自分または部下であることを検証
    if (userIsManager && salesperson_id !== undefined) {
      if (salesperson_id !== currentUser.id) {
        const isSubord = await prisma.salesperson.findFirst({
          where: { id: salesperson_id, managerId: currentUser.id },
          select: { id: true },
        });
        if (!isSubord) {
          return forbiddenResponse("指定した担当者の日報は閲覧できません");
        }
      }
    }

    // WHERE条件の構築
    const where: Prisma.DailyReportWhereInput = {};

    // salesperson_id フィルタ
    if (userIsManager) {
      if (salesperson_id !== undefined) {
        // 上長が特定の担当者（自分または部下）を指定
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
    const total_pages = Math.ceil(total / per_page);

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
  }) as Parameters<typeof withAuth>[0],
);

export const POST = withAuth(
  withErrorHandler(async (request: AuthenticatedRequest) => {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return errorResponse(
        "VALIDATION_ERROR",
        "リクエストボディのJSON解析に失敗しました",
      );
    }
    const parsed = CreateReportRequestSchema.safeParse(body);
    if (!parsed.success) {
      return zodErrorResponse(parsed.error);
    }

    const { report_date, problem, plan, status, visits } = parsed.data;
    const currentUser = request.salesperson;

    // Business rule: submitted requires at least 1 visit
    if (status === "submitted" && (!visits || visits.length === 0)) {
      return errorResponse(
        "VALIDATION_ERROR",
        "提出時は訪問記録が1件以上必要です",
      );
    }

    // Validate customer_ids exist
    if (visits && visits.length > 0) {
      const customerIds = [...new Set(visits.map((v) => v.customer_id))];
      const existingCustomers = await prisma.customer.findMany({
        where: { id: { in: customerIds }, isActive: true },
        select: { id: true },
      });
      const existingIds = new Set(existingCustomers.map((c) => c.id));
      const invalidIds = customerIds.filter((id) => !existingIds.has(id));
      if (invalidIds.length > 0) {
        return errorResponse(
          "VALIDATION_ERROR",
          `存在しない顧客IDが指定されています: ${invalidIds.join(", ")}`,
        );
      }
    }

    // Create report + visit records in transaction
    try {
      const report = await prisma.$transaction(async (tx) => {
        const dailyReport = await tx.dailyReport.create({
          data: {
            salespersonId: currentUser.id,
            reportDate: new Date(report_date),
            problem: problem ?? null,
            plan: plan ?? null,
            status,
            visitRecords:
              visits && visits.length > 0
                ? {
                    create: visits.map((v) => ({
                      customerId: v.customer_id,
                      visitTime: new Date(`1970-01-01T${v.visit_time}:00Z`),
                      content: v.content,
                    })),
                  }
                : undefined,
          },
          include: {
            visitRecords: {
              include: { customer: { select: { id: true, name: true } } },
              orderBy: { visitTime: "asc" },
            },
          },
        });
        return dailyReport;
      });

      // Format response
      const data = {
        id: report.id,
        report_date: report.reportDate.toISOString().split("T")[0],
        problem: report.problem,
        plan: report.plan,
        status: report.status,
        visits: report.visitRecords.map((vr) => ({
          id: vr.id,
          customer: vr.customer,
          visit_time: vr.visitTime.toISOString().slice(11, 16),
          content: vr.content,
        })),
        created_at: report.createdAt.toISOString(),
      };

      return created(data);
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        return errorResponse(
          "CONFLICT",
          `${report_date} の日報は既に存在します`,
        );
      }
      throw err;
    }
  }) as Parameters<typeof withAuth>[0],
);
