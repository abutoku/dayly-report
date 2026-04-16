import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { DELETE } from "./route";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    salesperson: {
      findUnique: vi.fn(),
    },
    dailyReport: {
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock("@/lib/auth/jwt", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth/jwt")>();
  return {
    ...actual,
    verifyToken: vi.fn(),
  };
});

import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth/jwt";

const mockVerifyToken = verifyToken as ReturnType<typeof vi.fn>;
const mockFindUniqueSalesperson = prisma.salesperson.findUnique as ReturnType<
  typeof vi.fn
>;
const mockDailyReportFindUnique = prisma.dailyReport.findUnique as ReturnType<
  typeof vi.fn
>;
const mockDailyReportDelete = prisma.dailyReport.delete as ReturnType<
  typeof vi.fn
>;

// テストデータ
const salesJwt = {
  sub: 1,
  email: "tanaka@example.com",
  name: "田中太郎",
  isManager: false,
};

const salesUser = {
  id: 1,
  name: "田中太郎",
  email: "tanaka@example.com",
  managerId: 10,
  isActive: true,
};

function setupAuth(jwt: typeof salesJwt, user: typeof salesUser) {
  mockVerifyToken.mockResolvedValue(jwt);
  mockFindUniqueSalesperson.mockResolvedValue(user);
}

function createDeleteRequest(id: string, token?: string): NextRequest {
  const url = `http://localhost/api/v1/reports/${id}`;
  const headers: Record<string, string> = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return new NextRequest(url, { method: "DELETE", headers });
}

function createContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("DELETE /api/v1/reports/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // RPT-060: 下書きの日報を削除 → 204、prisma.dailyReport.delete が呼ばれる
  it("RPT-060: 下書きの日報を削除", async () => {
    setupAuth(salesJwt, salesUser);
    mockDailyReportFindUnique.mockResolvedValue({
      id: 1,
      salespersonId: 1,
      status: "draft",
    });
    mockDailyReportDelete.mockResolvedValue({
      id: 1,
      salespersonId: 1,
      status: "draft",
    });

    const response = await DELETE(
      createDeleteRequest("1", "valid-token"),
      createContext("1"),
    );

    expect(response.status).toBe(204);
    expect(mockDailyReportDelete).toHaveBeenCalledWith({
      where: { id: 1 },
    });
  });

  // RPT-061: 提出済み(submitted)の日報を削除 → 403 FORBIDDEN
  it("RPT-061: 提出済みの日報を削除", async () => {
    setupAuth(salesJwt, salesUser);
    mockDailyReportFindUnique.mockResolvedValue({
      id: 1,
      salespersonId: 1,
      status: "submitted",
    });

    const response = await DELETE(
      createDeleteRequest("1", "valid-token"),
      createContext("1"),
    );
    const json = await response.json();

    expect(response.status).toBe(403);
    expect(json.error.code).toBe("FORBIDDEN");
    expect(mockDailyReportDelete).not.toHaveBeenCalled();
  });

  // RPT-062: 他人の日報を削除 → 403 FORBIDDEN
  it("RPT-062: 他人の日報を削除", async () => {
    setupAuth(salesJwt, salesUser);
    mockDailyReportFindUnique.mockResolvedValue({
      id: 1,
      salespersonId: 999, // 別の営業担当者
      status: "draft",
    });

    const response = await DELETE(
      createDeleteRequest("1", "valid-token"),
      createContext("1"),
    );
    const json = await response.json();

    expect(response.status).toBe(403);
    expect(json.error.code).toBe("FORBIDDEN");
    expect(mockDailyReportDelete).not.toHaveBeenCalled();
  });

  // RPT-063: 存在しないIDを指定 → 404 NOT_FOUND
  it("RPT-063: 存在しないIDを指定", async () => {
    setupAuth(salesJwt, salesUser);
    mockDailyReportFindUnique.mockResolvedValue(null);

    const response = await DELETE(
      createDeleteRequest("999", "valid-token"),
      createContext("999"),
    );
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.error.code).toBe("NOT_FOUND");
    expect(mockDailyReportDelete).not.toHaveBeenCalled();
  });

  // 追加: 数値以外のIDを指定 → 404
  it("returns 404 when id is not a valid number", async () => {
    setupAuth(salesJwt, salesUser);

    const response = await DELETE(
      createDeleteRequest("abc", "valid-token"),
      createContext("abc"),
    );
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.error.code).toBe("NOT_FOUND");
    expect(mockDailyReportFindUnique).not.toHaveBeenCalled();
    expect(mockDailyReportDelete).not.toHaveBeenCalled();
  });

  // 追加: 未認証でアクセス → 401
  it("returns 401 when no token is provided", async () => {
    const response = await DELETE(createDeleteRequest("1"), createContext("1"));
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error.code).toBe("UNAUTHORIZED");
  });
});
