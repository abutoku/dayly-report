import "@/schemas/setup";
import { prisma } from "@/lib/prisma";
import {
  type AuthenticatedRequest,
  isManager,
  withAuth,
} from "@/lib/auth/middleware";
import { forbiddenResponse } from "@/lib/auth/errors";
import { errorResponse, ok, withErrorHandler } from "@/lib/api/response";

/**
 * GET /api/v1/reports/:id
 *
 * 日報詳細を取得する。訪問記録・コメントを含む。
 *
 * 権限:
 *   - 本人の日報 → OK
 *   - 上長が部下（managerId === currentUser.id）の日報 → OK
 *   - 上記以外 → 403 FORBIDDEN
 */
export const GET = withAuth(
  withErrorHandler(async (request: AuthenticatedRequest, context: unknown) => {
    const { params } = context as { params: Promise<{ id: string }> };
    const { id: rawId } = await params;

    // パスパラメータ id のバリデーション: 数値でなければ 400
    const id = Number(rawId);
    if (!Number.isInteger(id) || id <= 0) {
      return errorResponse(
        "VALIDATION_ERROR",
        "日報IDは正の整数で指定してください",
      );
    }

    const report = await prisma.dailyReport.findUnique({
      where: { id },
      select: {
        id: true,
        reportDate: true,
        problem: true,
        plan: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        salespersonId: true,
        salesperson: {
          select: {
            id: true,
            name: true,
            managerId: true,
          },
        },
        visitRecords: {
          select: {
            id: true,
            visitTime: true,
            content: true,
            customer: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: { visitTime: "asc" },
        },
        comments: {
          select: {
            id: true,
            content: true,
            createdAt: true,
            commenter: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!report) {
      return errorResponse("NOT_FOUND", "指定された日報が見つかりません");
    }

    const currentUser = request.salesperson;
    const userIsManager = isManager(request);

    // 権限チェック
    const isOwn = report.salespersonId === currentUser.id;
    const isSubordinateReport =
      userIsManager && report.salesperson.managerId === currentUser.id;

    if (!isOwn && !isSubordinateReport) {
      return forbiddenResponse("この日報を閲覧する権限がありません");
    }

    // レスポンス整形
    const data = {
      id: report.id,
      report_date: report.reportDate.toISOString().split("T")[0],
      salesperson: {
        id: report.salesperson.id,
        name: report.salesperson.name,
      },
      problem: report.problem,
      plan: report.plan,
      status: report.status,
      visits: report.visitRecords.map((vr) => ({
        id: vr.id,
        customer: vr.customer,
        visit_time: vr.visitTime.toISOString().slice(11, 16),
        content: vr.content,
      })),
      comments: report.comments.map((c) => ({
        id: c.id,
        commenter: c.commenter,
        content: c.content,
        created_at: c.createdAt.toISOString(),
      })),
      created_at: report.createdAt.toISOString(),
      updated_at: report.updatedAt.toISOString(),
    };

    return ok(data);
  }) as Parameters<typeof withAuth>[0],
);
