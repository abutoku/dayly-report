import "@/schemas/setup";
import { prisma } from "@/lib/prisma";
import { type AuthenticatedRequest, withAuth } from "@/lib/auth/middleware";
import { forbiddenResponse } from "@/lib/auth/errors";
import { errorResponse, noContent, withErrorHandler } from "@/lib/api/response";

/**
 * DELETE /api/v1/reports/:id
 *
 * 日報を削除する。本人かつ下書きステータスの場合のみ可能。
 * visit_records は Prisma スキーマの onDelete: Cascade により自動削除される。
 *
 * 権限チェック順序:
 *   1. id のパース (数値以外 → 404)
 *   2. 日報の存在チェック (存在しない → 404)
 *   3. 本人チェック (他人 → 403)
 *   4. ステータスチェック (submitted → 403)
 */
export const DELETE = withAuth(
  withErrorHandler(async (request: AuthenticatedRequest, context?: unknown) => {
    const { id: rawId } = await (context as { params: Promise<{ id: string }> })
      .params;

    // id のバリデーション (数値以外は 404)
    const id = Number(rawId);
    if (!Number.isInteger(id) || id <= 0) {
      return errorResponse("NOT_FOUND", "指定された日報は存在しません");
    }

    // 日報の存在確認
    const report = await prisma.dailyReport.findUnique({
      where: { id },
      select: {
        id: true,
        salespersonId: true,
        status: true,
      },
    });

    if (!report) {
      return errorResponse("NOT_FOUND", "指定された日報は存在しません");
    }

    const currentUser = request.salesperson;

    // 本人チェック
    if (report.salespersonId !== currentUser.id) {
      return forbiddenResponse("他の担当者の日報は削除できません");
    }

    // ステータスチェック (下書きのみ削除可)
    if (report.status !== "draft") {
      return forbiddenResponse("提出済みの日報は削除できません");
    }

    // 削除実行 (visit_records は cascade で自動削除)
    await prisma.dailyReport.delete({ where: { id } });

    return noContent();
  }) as Parameters<typeof withAuth>[0],
);
