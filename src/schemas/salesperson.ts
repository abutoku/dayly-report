import { z } from "zod";

import { PaginationQuerySchema } from "./common";

/**
 * 営業一覧の上長情報
 */
const ManagerSchema = z
  .object({
    id: z.number().int().openapi({ example: 10 }),
    name: z.string().openapi({ example: "鈴木部長" }),
  })
  .nullable();

/**
 * POST /salespersons リクエスト
 */
export const CreateSalespersonRequestSchema = z
  .object({
    name: z.string().min(1, "氏名は必須です").openapi({ example: "山田花子" }),
    email: z
      .string()
      .email("メールアドレスの形式が不正です")
      .openapi({ example: "yamada@example.com" }),
    password: z
      .string()
      .min(1, "パスワードは必須です")
      .openapi({ example: "initial_password" }),
    manager_id: z.number().int().nullable().optional().openapi({ example: 10 }),
  })
  .openapi("CreateSalespersonRequest");

/**
 * PUT /salespersons/:id リクエスト
 */
export const UpdateSalespersonRequestSchema = z
  .object({
    name: z.string().min(1, "氏名は必須です").openapi({ example: "田中太郎" }),
    email: z
      .string()
      .email("メールアドレスの形式が不正です")
      .openapi({ example: "tanaka@example.com" }),
    password: z.string().min(1).optional().openapi({
      description: "変更する場合のみ指定",
    }),
    manager_id: z.number().int().nullable().optional().openapi({ example: 10 }),
    is_active: z.boolean().optional().openapi({ example: true }),
  })
  .openapi("UpdateSalespersonRequest");

/**
 * GET /salespersons クエリパラメータ
 */
export const SalespersonListQuerySchema = PaginationQuerySchema.extend({
  is_active: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
});

/**
 * 営業一覧の1件分
 */
export const SalespersonListItemSchema = z
  .object({
    id: z.number().int().openapi({ example: 1 }),
    name: z.string().openapi({ example: "田中太郎" }),
    email: z.string().email().openapi({ example: "tanaka@example.com" }),
    manager: ManagerSchema,
    is_active: z.boolean().openapi({ example: true }),
  })
  .openapi("SalespersonListItem");

/**
 * GET /salespersons/:id レスポンス data
 */
export const SalespersonDetailSchema = z
  .object({
    id: z.number().int().openapi({ example: 1 }),
    name: z.string().openapi({ example: "田中太郎" }),
    email: z.string().email().openapi({ example: "tanaka@example.com" }),
    manager: ManagerSchema,
    is_active: z.boolean().openapi({ example: true }),
    created_at: z.string().datetime().openapi({
      example: "2026-01-10T09:00:00Z",
    }),
    updated_at: z.string().datetime().openapi({
      example: "2026-03-01T11:00:00Z",
    }),
  })
  .openapi("SalespersonDetail");
