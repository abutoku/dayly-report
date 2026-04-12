import { z } from "zod";

import { PaginationQuerySchema } from "./common";

/**
 * 訪問記録（リクエスト用）
 */
export const VisitRequestSchema = z
  .object({
    customer_id: z.number().int().openapi({ example: 1 }),
    visit_time: z
      .string()
      .regex(
        /^([01]\d|2[0-3]):[0-5]\d$/,
        "訪問時刻はHH:mm形式で入力してください",
      )
      .openapi({ example: "09:00" }),
    content: z
      .string()
      .min(1, "訪問内容は必須です")
      .openapi({ example: "新規提案の打合せ。見積依頼あり。" }),
  })
  .openapi("VisitRequest");

/**
 * 訪問記録の顧客情報（レスポンス用）
 */
const VisitCustomerSchema = z.object({
  id: z.number().int().openapi({ example: 1 }),
  name: z.string().openapi({ example: "A商事" }),
});

/**
 * 訪問記録（レスポンス用）
 */
export const VisitResponseSchema = z
  .object({
    id: z.number().int().openapi({ example: 1 }),
    customer: VisitCustomerSchema,
    visit_time: z.string().openapi({ example: "09:00" }),
    content: z
      .string()
      .openapi({ example: "新規提案の打合せ。見積依頼あり。" }),
  })
  .openapi("VisitResponse");

/**
 * 日報ステータス
 */
export const ReportStatusSchema = z
  .enum(["draft", "submitted"])
  .openapi("ReportStatus");

/**
 * POST /reports リクエスト
 */
export const CreateReportRequestSchema = z
  .object({
    report_date: z
      .string()
      .date("報告日はYYYY-MM-DD形式で入力してください")
      .openapi({ example: "2026-04-04" }),
    problem: z
      .string()
      .nullable()
      .optional()
      .openapi({ example: "A商事の見積について、特別値引きの承認が必要。" }),
    plan: z
      .string()
      .nullable()
      .optional()
      .openapi({ example: "A商事への見積作成、B工業への議事録送付" }),
    status: ReportStatusSchema,
    visits: z.array(VisitRequestSchema).optional().openapi({
      description: "訪問記録の配列（提出時は1件以上必須）",
    }),
  })
  .openapi("CreateReportRequest");

/**
 * PUT /reports/:id リクエスト
 */
export const UpdateReportRequestSchema = CreateReportRequestSchema.openapi(
  "UpdateReportRequest",
);

/**
 * 日報一覧の担当者情報
 */
const ReportSalespersonSchema = z.object({
  id: z.number().int().openapi({ example: 1 }),
  name: z.string().openapi({ example: "田中太郎" }),
});

/**
 * GET /reports レスポンスの1件分
 */
export const ReportListItemSchema = z
  .object({
    id: z.number().int().openapi({ example: 1 }),
    report_date: z.string().openapi({ example: "2026-04-04" }),
    salesperson: ReportSalespersonSchema,
    visit_count: z.number().int().openapi({ example: 3 }),
    status: ReportStatusSchema,
    created_at: z.string().datetime().openapi({
      example: "2026-04-04T17:00:00Z",
    }),
  })
  .openapi("ReportListItem");

/**
 * GET /reports クエリパラメータ
 */
export const ReportListQuerySchema = PaginationQuerySchema.extend({
  date_from: z.string().date().optional().openapi({ example: "2026-04-01" }),
  date_to: z.string().date().optional().openapi({ example: "2026-04-30" }),
  salesperson_id: z.coerce.number().int().optional().openapi({ example: 1 }),
  status: ReportStatusSchema.optional(),
});

/**
 * コメント（日報詳細レスポンス内）
 */
const ReportCommentSchema = z.object({
  id: z.number().int().openapi({ example: 1 }),
  commenter: z.object({
    id: z.number().int().openapi({ example: 10 }),
    name: z.string().openapi({ example: "鈴木部長" }),
  }),
  content: z.string().openapi({
    example: "A商事の値引きは10%まで承認します。見積を確認させてください。",
  }),
  created_at: z
    .string()
    .datetime()
    .openapi({ example: "2026-04-04T18:30:00Z" }),
});

/**
 * GET /reports/:id レスポンス data
 */
export const ReportDetailSchema = z
  .object({
    id: z.number().int().openapi({ example: 1 }),
    report_date: z.string().openapi({ example: "2026-04-04" }),
    salesperson: ReportSalespersonSchema,
    problem: z
      .string()
      .nullable()
      .openapi({ example: "A商事の見積について、特別値引きの承認が必要。" }),
    plan: z
      .string()
      .nullable()
      .openapi({ example: "A商事への見積作成、B工業への議事録送付" }),
    status: ReportStatusSchema,
    visits: z.array(VisitResponseSchema),
    comments: z.array(ReportCommentSchema),
    created_at: z.string().datetime().openapi({
      example: "2026-04-04T17:00:00Z",
    }),
    updated_at: z.string().datetime().openapi({
      example: "2026-04-04T17:00:00Z",
    }),
  })
  .openapi("ReportDetail");

/**
 * POST /reports, PUT /reports/:id レスポンス data
 */
export const ReportMutationResponseSchema = z
  .object({
    id: z.number().int().openapi({ example: 1 }),
    report_date: z.string().openapi({ example: "2026-04-04" }),
    problem: z
      .string()
      .nullable()
      .openapi({ example: "A商事の見積について、特別値引きの承認が必要。" }),
    plan: z
      .string()
      .nullable()
      .openapi({ example: "A商事への見積作成、B工業への議事録送付" }),
    status: ReportStatusSchema,
    visits: z.array(VisitResponseSchema),
    created_at: z.string().datetime().openapi({
      example: "2026-04-04T17:00:00Z",
    }),
  })
  .openapi("ReportMutationResponse");
