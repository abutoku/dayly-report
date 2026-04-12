import { NextResponse } from "next/server";

interface ErrorBody {
  error: {
    code: string;
    message: string;
  };
}

export function unauthorizedResponse(
  message = "認証が必要です",
): NextResponse<ErrorBody> {
  return NextResponse.json(
    { error: { code: "UNAUTHORIZED", message } },
    { status: 401 },
  );
}

export function forbiddenResponse(
  message = "権限が不足しています",
): NextResponse<ErrorBody> {
  return NextResponse.json(
    { error: { code: "FORBIDDEN", message } },
    { status: 403 },
  );
}
