import { z } from "zod";

/**
 * POST /reports/:id/comments リクエスト
 */
export const CreateCommentRequestSchema = z
  .object({
    content: z.string().min(1, "コメント内容は必須です").openapi({
      example: "A商事の値引きは10%まで承認します。見積を確認させてください。",
    }),
  })
  .openapi("CreateCommentRequest");

/**
 * POST /reports/:id/comments レスポンス data
 */
export const CommentResponseSchema = z
  .object({
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
  })
  .openapi("CommentResponse");
