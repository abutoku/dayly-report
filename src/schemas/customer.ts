import { z } from "zod";

import { PaginationQuerySchema } from "./common";

/**
 * POST /customers リクエスト
 */
export const CreateCustomerRequestSchema = z
  .object({
    name: z.string().min(1, "顧客名は必須です").openapi({ example: "D電機" }),
    address: z
      .string()
      .nullable()
      .optional()
      .openapi({ example: "名古屋市中区栄1-1-1" }),
    phone: z
      .string()
      .regex(/^[\d-]+$/, "電話番号の形式が不正です")
      .nullable()
      .optional()
      .openapi({ example: "052-123-4567" }),
  })
  .openapi("CreateCustomerRequest");

/**
 * PUT /customers/:id リクエスト
 */
export const UpdateCustomerRequestSchema = z
  .object({
    name: z
      .string()
      .min(1, "顧客名は必須です")
      .openapi({ example: "A商事株式会社" }),
    address: z
      .string()
      .nullable()
      .optional()
      .openapi({ example: "東京都千代田区丸の内1-1-1" }),
    phone: z
      .string()
      .regex(/^[\d-]+$/, "電話番号の形式が不正です")
      .nullable()
      .optional()
      .openapi({ example: "03-1234-5678" }),
    is_active: z.boolean().optional().openapi({ example: true }),
  })
  .openapi("UpdateCustomerRequest");

/**
 * GET /customers クエリパラメータ
 */
export const CustomerListQuerySchema = PaginationQuerySchema.extend({
  name: z.string().optional().openapi({ example: "商事" }),
  is_active: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
});

/**
 * 顧客一覧の1件分
 */
export const CustomerListItemSchema = z
  .object({
    id: z.number().int().openapi({ example: 1 }),
    name: z.string().openapi({ example: "A商事" }),
    address: z
      .string()
      .nullable()
      .openapi({ example: "東京都千代田区丸の内1-1-1" }),
    phone: z.string().nullable().openapi({ example: "03-1234-5678" }),
    is_active: z.boolean().openapi({ example: true }),
  })
  .openapi("CustomerListItem");

/**
 * GET /customers/:id レスポンス data
 */
export const CustomerDetailSchema = z
  .object({
    id: z.number().int().openapi({ example: 1 }),
    name: z.string().openapi({ example: "A商事" }),
    address: z
      .string()
      .nullable()
      .openapi({ example: "東京都千代田区丸の内1-1-1" }),
    phone: z.string().nullable().openapi({ example: "03-1234-5678" }),
    is_active: z.boolean().openapi({ example: true }),
    created_at: z.string().datetime().openapi({
      example: "2026-01-15T09:00:00Z",
    }),
    updated_at: z.string().datetime().openapi({
      example: "2026-03-20T14:00:00Z",
    }),
  })
  .openapi("CustomerDetail");
