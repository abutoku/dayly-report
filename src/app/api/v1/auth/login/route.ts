import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { comparePassword, signToken, unauthorizedResponse } from "@/lib/auth";

const loginSchema = z.object({
  email: z
    .string({ required_error: "メールアドレスは必須です" })
    .min(1, "メールアドレスは必須です")
    .email("メールアドレスの形式が不正です"),
  password: z
    .string({ required_error: "パスワードは必須です" })
    .min(1, "パスワードは必須です"),
});

const INVALID_CREDENTIALS_MESSAGE =
  "メールアドレスまたはパスワードが正しくありません";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "リクエストボディが不正です",
          details: [],
        },
      },
      { status: 400 },
    );
  }

  const result = loginSchema.safeParse(body);
  if (!result.success) {
    const details = result.error.issues.map((issue) => ({
      field: issue.path.join("."),
      message: issue.message,
    }));
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "バリデーションエラー",
          details,
        },
      },
      { status: 400 },
    );
  }

  const { email, password } = result.data;

  const salesperson = await prisma.salesperson.findUnique({
    where: { email },
    include: { subordinates: { select: { id: true } } },
  });

  if (!salesperson) {
    return unauthorizedResponse(INVALID_CREDENTIALS_MESSAGE);
  }

  if (!salesperson.isActive) {
    return unauthorizedResponse(INVALID_CREDENTIALS_MESSAGE);
  }

  const passwordMatch = await comparePassword(password, salesperson.password);
  if (!passwordMatch) {
    return unauthorizedResponse(INVALID_CREDENTIALS_MESSAGE);
  }

  const isManager = salesperson.subordinates.length > 0;

  const token = await signToken({
    sub: salesperson.id,
    email: salesperson.email,
    name: salesperson.name,
    isManager,
  });

  return NextResponse.json(
    {
      data: {
        token,
        salesperson: {
          id: salesperson.id,
          name: salesperson.name,
          email: salesperson.email,
          is_manager: isManager,
        },
      },
    },
    { status: 200 },
  );
}
