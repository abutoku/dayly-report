import { z } from "zod";

/**
 * POST /auth/login リクエスト
 */
export const LoginRequestSchema = z
  .object({
    email: z
      .string()
      .email("メールアドレスの形式が不正です")
      .openapi({ example: "tanaka@example.com" }),
    password: z.string().min(1, "パスワードは必須です").openapi({
      example: "password123",
    }),
  })
  .openapi("LoginRequest");

/**
 * ログインレスポンスのユーザー情報
 */
export const LoginSalespersonSchema = z
  .object({
    id: z.number().int().openapi({ example: 1 }),
    name: z.string().openapi({ example: "田中太郎" }),
    email: z.string().email().openapi({ example: "tanaka@example.com" }),
    is_manager: z.boolean().openapi({ example: true }),
  })
  .openapi("LoginSalesperson");

/**
 * POST /auth/login レスポンス data
 */
export const LoginResponseDataSchema = z
  .object({
    token: z.string().openapi({ example: "eyJhbGciOiJIUzI1NiIs..." }),
    salesperson: LoginSalespersonSchema,
  })
  .openapi("LoginResponseData");
