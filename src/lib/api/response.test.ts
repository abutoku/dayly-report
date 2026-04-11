import { describe, expect, it, vi } from "vitest";
import { z, ZodError } from "zod";
import {
  ApiError,
  ERROR_STATUS,
  ErrorCode,
  created,
  errorResponse,
  formatZodError,
  noContent,
  ok,
  paginated,
  withErrorHandler,
  zodErrorResponse,
} from "./response";

async function readJson(res: Response): Promise<unknown> {
  return JSON.parse(await res.text());
}

describe("ok", () => {
  it("returns 200 with { data } envelope", async () => {
    const res = ok({ id: 1, name: "田中" });
    expect(res.status).toBe(200);
    expect(await readJson(res)).toEqual({ data: { id: 1, name: "田中" } });
  });
});

describe("created", () => {
  it("returns 201 with { data } envelope", async () => {
    const res = created({ id: 9 });
    expect(res.status).toBe(201);
    expect(await readJson(res)).toEqual({ data: { id: 9 } });
  });
});

describe("noContent", () => {
  it("returns 204 with empty body", async () => {
    const res = noContent();
    expect(res.status).toBe(204);
    expect(await res.text()).toBe("");
  });
});

describe("paginated", () => {
  it("returns 200 with data array and pagination", async () => {
    const res = paginated([{ id: 1 }, { id: 2 }], {
      page: 1,
      per_page: 20,
      total: 2,
      total_pages: 1,
    });
    expect(res.status).toBe(200);
    expect(await readJson(res)).toEqual({
      data: [{ id: 1 }, { id: 2 }],
      pagination: { page: 1, per_page: 20, total: 2, total_pages: 1 },
    });
  });
});

describe("errorResponse", () => {
  it("maps each ErrorCode to the documented HTTP status", async () => {
    for (const code of Object.values(ErrorCode)) {
      const res = errorResponse(code, "メッセージ");
      expect(res.status).toBe(ERROR_STATUS[code]);
      expect(await readJson(res)).toEqual({
        error: { code, message: "メッセージ" },
      });
    }
  });

  it("includes details when provided", async () => {
    const res = errorResponse("VALIDATION_ERROR", "ng", [{ path: "email" }]);
    expect(res.status).toBe(400);
    expect(await readJson(res)).toEqual({
      error: {
        code: "VALIDATION_ERROR",
        message: "ng",
        details: [{ path: "email" }],
      },
    });
  });
});

describe("formatZodError / zodErrorResponse", () => {
  const schema = z.object({
    email: z.string().email(),
    age: z.number().int(),
  });

  function makeZodError(): ZodError {
    const result = schema.safeParse({ email: "not-an-email", age: 1.5 });
    if (result.success) throw new Error("schema should have failed");
    return result.error;
  }

  it("formatZodError flattens issues into path/message/code", () => {
    const details = formatZodError(makeZodError());
    expect(details.length).toBeGreaterThan(0);
    for (const detail of details) {
      expect(detail).toHaveProperty("path");
      expect(detail).toHaveProperty("message");
      expect(detail).toHaveProperty("code");
    }
    expect(details.map((d) => d.path)).toEqual(
      expect.arrayContaining(["email", "age"]),
    );
  });

  it("zodErrorResponse returns 400 VALIDATION_ERROR with details", async () => {
    const res = zodErrorResponse(makeZodError());
    expect(res.status).toBe(400);
    const body = (await readJson(res)) as {
      error: { code: string; message: string; details: unknown[] };
    };
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.message).toBe("リクエストの検証に失敗しました");
    expect(Array.isArray(body.error.details)).toBe(true);
    expect(body.error.details.length).toBeGreaterThan(0);
  });
});

describe("ApiError", () => {
  it("derives status from the code", () => {
    const err = new ApiError("NOT_FOUND", "見つかりません");
    expect(err.status).toBe(404);
    expect(err.code).toBe("NOT_FOUND");
    expect(err.message).toBe("見つかりません");
  });
});

describe("withErrorHandler", () => {
  it("passes through successful responses", async () => {
    const handler = withErrorHandler(async () => ok({ hello: "world" }));
    const res = await handler();
    expect(res.status).toBe(200);
    expect(await readJson(res)).toEqual({ data: { hello: "world" } });
  });

  it("converts ZodError to 400 VALIDATION_ERROR", async () => {
    const schema = z.object({ name: z.string() });
    const handler = withErrorHandler(async () => {
      schema.parse({});
      return ok(null);
    });
    const res = await handler();
    expect(res.status).toBe(400);
    const body = (await readJson(res)) as { error: { code: string } };
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("converts ApiError to its declared status and code", async () => {
    const handler = withErrorHandler(async () => {
      throw new ApiError("FORBIDDEN", "権限がありません");
    });
    const res = await handler();
    expect(res.status).toBe(403);
    expect(await readJson(res)).toEqual({
      error: { code: "FORBIDDEN", message: "権限がありません" },
    });
  });

  it("converts unknown errors to 500 INTERNAL_ERROR and logs them", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const handler = withErrorHandler(async () => {
      throw new Error("boom");
    });
    const res = await handler();
    expect(res.status).toBe(500);
    expect(await readJson(res)).toEqual({
      error: {
        code: "INTERNAL_ERROR",
        message: "サーバーエラーが発生しました",
      },
    });
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("forwards arguments to the wrapped handler", async () => {
    const handler = withErrorHandler(async (a: number, b: number) =>
      ok({ sum: a + b }),
    );
    const res = await handler(2, 3);
    expect(await readJson(res)).toEqual({ data: { sum: 5 } });
  });
});
