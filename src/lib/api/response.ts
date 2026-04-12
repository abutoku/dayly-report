import { NextResponse } from "next/server";
import { ZodError } from "zod";

/**
 * 共通エラーコード（docs/API仕様書.md 共通仕様を参照）
 */
export const ErrorCode = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

/**
 * 各エラーコードに対応する HTTP ステータスコード
 */
export const ERROR_STATUS: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_ERROR: 500,
};

export interface Pagination {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
}

export interface SuccessBody<T> {
  data: T;
}

export interface PaginatedBody<T> {
  data: T[];
  pagination: Pagination;
}

export interface ErrorBody {
  code: ErrorCode;
  message: string;
  details?: unknown;
}

export interface ErrorResponseBody {
  error: ErrorBody;
}

/**
 * API ハンドラ内で投げると `withErrorHandler` が共通フォーマットに整形する例外
 */
export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = ERROR_STATUS[code];
    this.details = details;
  }
}

/**
 * 200 OK レスポンス
 */
export function ok<T>(
  data: T,
  init?: ResponseInit,
): NextResponse<SuccessBody<T>> {
  return NextResponse.json<SuccessBody<T>>({ data }, { status: 200, ...init });
}

/**
 * 201 Created レスポンス
 */
export function created<T>(
  data: T,
  init?: ResponseInit,
): NextResponse<SuccessBody<T>> {
  return NextResponse.json<SuccessBody<T>>({ data }, { status: 201, ...init });
}

/**
 * 204 No Content レスポンス
 */
export function noContent(init?: ResponseInit): NextResponse<null> {
  return new NextResponse(null, { status: 204, ...init }) as NextResponse<null>;
}

/**
 * 一覧取得用のページネーション付きレスポンス
 */
export function paginated<T>(
  data: T[],
  pagination: Pagination,
  init?: ResponseInit,
): NextResponse<PaginatedBody<T>> {
  return NextResponse.json<PaginatedBody<T>>(
    { data, pagination },
    { status: 200, ...init },
  );
}

/**
 * 共通フォーマットのエラーレスポンスを生成する
 */
export function errorResponse(
  code: ErrorCode,
  message: string,
  details?: unknown,
  init?: ResponseInit,
): NextResponse<ErrorResponseBody> {
  const error: ErrorBody =
    details === undefined ? { code, message } : { code, message, details };
  // status は ErrorCode から決まる invariant のため、init.status による
  // 上書きを許さないよう必ず後勝ちで status を確定させる。
  return NextResponse.json<ErrorResponseBody>(
    { error },
    { ...init, status: ERROR_STATUS[code] },
  );
}

export interface ZodIssueDetail {
  path: string;
  message: string;
  code: string;
}

/**
 * ZodError を API 仕様書の `details` 形式に整形する
 */
export function formatZodError(error: ZodError): ZodIssueDetail[] {
  return error.issues.map((issue) => ({
    path: issue.path.map((segment) => String(segment)).join("."),
    message: issue.message,
    code: issue.code,
  }));
}

/**
 * ZodError を 400 VALIDATION_ERROR レスポンスに変換する
 */
export function zodErrorResponse(
  error: ZodError,
  message = "リクエストの検証に失敗しました",
): NextResponse<ErrorResponseBody> {
  return errorResponse("VALIDATION_ERROR", message, formatZodError(error));
}

/**
 * Route Handler を try/catch でラップし、既知エラーを共通フォーマットに変換する。
 *
 * - ZodError → 400 VALIDATION_ERROR + details
 * - ApiError → 対応するステータス・コード
 * - その他   → 500 INTERNAL_ERROR
 */
export function withErrorHandler<TArgs extends unknown[]>(
  handler: (...args: TArgs) => Promise<Response> | Response,
): (...args: TArgs) => Promise<Response> {
  return async (...args: TArgs) => {
    try {
      return await handler(...args);
    } catch (err) {
      if (err instanceof ZodError) {
        return zodErrorResponse(err);
      }
      if (err instanceof ApiError) {
        return errorResponse(err.code, err.message, err.details);
      }
      console.error("[withErrorHandler] Unhandled error:", err);
      return errorResponse("INTERNAL_ERROR", "サーバーエラーが発生しました");
    }
  };
}
