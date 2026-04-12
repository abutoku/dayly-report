import "./setup";

import { z } from "zod";

/**
 * ページネーション（レスポンス）
 */
export const PaginationSchema = z
  .object({
    page: z.number().int().openapi({ example: 1 }),
    per_page: z.number().int().openapi({ example: 20 }),
    total: z.number().int().openapi({ example: 100 }),
    total_pages: z.number().int().openapi({ example: 5 }),
  })
  .openapi("Pagination");

/**
 * ページネーション（クエリパラメータ）
 */
export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().openapi({ example: 1 }),
  per_page: z.coerce.number().int().min(1).max(100).optional().openapi({
    example: 20,
  }),
});

/**
 * エラー詳細（Zod バリデーションエラー用）
 */
export const ErrorDetailSchema = z
  .object({
    path: z.string().openapi({ example: "email" }),
    message: z.string().openapi({ example: "メールアドレスは必須です" }),
    code: z.string().openapi({ example: "invalid_type" }),
  })
  .openapi("ErrorDetail");

/**
 * エラーボディ
 */
export const ErrorBodySchema = z
  .object({
    code: z
      .enum([
        "VALIDATION_ERROR",
        "UNAUTHORIZED",
        "FORBIDDEN",
        "NOT_FOUND",
        "CONFLICT",
        "INTERNAL_ERROR",
      ])
      .openapi({ example: "VALIDATION_ERROR" }),
    message: z.string().openapi({ example: "リクエストの検証に失敗しました" }),
    details: z.array(ErrorDetailSchema).optional(),
  })
  .openapi("ErrorBody");

/**
 * エラーレスポンス
 */
export const ErrorResponseSchema = z
  .object({
    error: ErrorBodySchema,
  })
  .openapi("ErrorResponse");

/**
 * 成功レスポンスのファクトリ
 */
export function successSchema<T extends z.ZodType>(dataSchema: T) {
  return z.object({ data: dataSchema });
}

/**
 * 一覧レスポンスのファクトリ
 */
export function paginatedSchema<T extends z.ZodType>(itemSchema: T) {
  return z.object({
    data: z.array(itemSchema),
    pagination: PaginationSchema,
  });
}
