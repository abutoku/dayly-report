import "@/schemas/setup";
import { prisma } from "@/lib/prisma";
import { type AuthenticatedRequest, withAuth } from "@/lib/auth/middleware";
import { forbiddenResponse } from "@/lib/auth/errors";
import {
  errorResponse,
  ok,
  withErrorHandler,
  zodErrorResponse,
} from "@/lib/api/response";
import { UpdateReportRequestSchema } from "@/schemas/report";

type RouteContext = { params: Promise<{ id: string }> };

export const PUT = withAuth(
  withErrorHandler(async (request: AuthenticatedRequest, context: unknown) => {
    const { params } = context as RouteContext;
    const { id: rawId } = await params;
    const id = Number(rawId);
    if (!Number.isInteger(id) || id <= 0) {
      return errorResponse("NOT_FOUND", "指定された日報は存在しません");
    }

    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return errorResponse(
        "VALIDATION_ERROR",
        "リクエストボディのJSON解析に失敗しました",
      );
    }

    const parsed = UpdateReportRequestSchema.safeParse(body);
    if (!parsed.success) {
      return zodErrorResponse(parsed.error);
    }

    const { report_date, problem, plan, status, visits } = parsed.data;
    const currentUser = request.salesperson;

    // Fetch target report
    const existing = await prisma.dailyReport.findUnique({
      where: { id },
      select: { id: true, salespersonId: true, status: true },
    });

    if (!existing) {
      return errorResponse("NOT_FOUND", "指定された日報は存在しません");
    }

    // Ownership check
    if (existing.salespersonId !== currentUser.id) {
      return forbiddenResponse("他の担当者の日報は編集できません");
    }

    // Status check: submitted cannot be edited
    if (existing.status === "submitted") {
      return forbiddenResponse("提出済みの日報は編集できません");
    }

    // Business rule: submitted requires at least 1 visit
    if (status === "submitted" && (!visits || visits.length === 0)) {
      return errorResponse(
        "VALIDATION_ERROR",
        "提出時は訪問記録が1件以上必要です",
      );
    }

    // Validate customer_ids exist and are active
    if (visits && visits.length > 0) {
      const customerIds = [...new Set(visits.map((v) => v.customer_id))];
      const existingCustomers = await prisma.customer.findMany({
        where: { id: { in: customerIds }, isActive: true },
        select: { id: true },
      });
      const existingIds = new Set(existingCustomers.map((c) => c.id));
      const invalidIds = customerIds.filter((cid) => !existingIds.has(cid));
      if (invalidIds.length > 0) {
        return errorResponse(
          "VALIDATION_ERROR",
          `存在しない顧客IDが指定されています: ${invalidIds.join(", ")}`,
        );
      }
    }

    // Update report + replace visit records in transaction
    const report = await prisma.$transaction(async (tx) => {
      // 全件洗い替え: 既存の訪問記録を削除
      await tx.visitRecord.deleteMany({
        where: { dailyReportId: id },
      });

      const dailyReport = await tx.dailyReport.update({
        where: { id },
        data: {
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

    return ok(data);
  }) as Parameters<typeof withAuth>[0],
);
