import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    salesperson: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    dailyReport: {
      count: vi.fn(),
      findMany: vi.fn(),
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
const mockFindManySalesperson = prisma.salesperson.findMany as ReturnType<
  typeof vi.fn
>;
const mockFindFirstSalesperson = (
  prisma.salesperson as unknown as { findFirst: ReturnType<typeof vi.fn> }
).findFirst;
const mockDailyReportCount = prisma.dailyReport.count as ReturnType<
  typeof vi.fn
>;
const mockDailyReportFindMany = prisma.dailyReport.findMany as ReturnType<
  typeof vi.fn
>;

// テストデータ
const salesJwt = {
  sub: 1,
  email: "tanaka@example.com",
  name: "田中太郎",
  isManager: false,
};

const managerJwt = {
  sub: 10,
  email: "suzuki@example.com",
  name: "鈴木部長",
  isManager: true,
};

const salesUser = {
  id: 1,
  name: "田中太郎",
  email: "tanaka@example.com",
  managerId: 10,
  isActive: true,
};

const managerUser = {
  id: 10,
  name: "鈴木部長",
  email: "suzuki@example.com",
  managerId: null,
  isActive: true,
};

function createRequest(
  token?: string,
  params?: Record<string, string>,
): NextRequest {
  const url = new URL("http://localhost/api/v1/reports");
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }
  const headers: Record<string, string> = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return new NextRequest(url.toString(), { method: "GET", headers });
}

function setupAuth(jwt: typeof salesJwt, user: typeof salesUser) {
  mockVerifyToken.mockResolvedValue(jwt);
  mockFindUniqueSalesperson.mockResolvedValue(user);
}

const sampleReport = {
  id: 1,
  reportDate: new Date("2026-04-04"),
  status: "submitted",
  createdAt: new Date("2026-04-04T17:00:00Z"),
  salesperson: { id: 1, name: "田中太郎" },
  _count: { visitRecords: 3 },
};

describe("GET /api/v1/reports", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // RPT-001: 営業が自分の日報一覧を取得
  it("RPT-001: returns only own reports for salesperson", async () => {
    setupAuth(salesJwt, salesUser);
    mockDailyReportCount.mockResolvedValue(1);
    mockDailyReportFindMany.mockResolvedValue([sampleReport]);

    const response = await GET(createRequest("valid-token"));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data).toHaveLength(1);
    expect(json.data[0].id).toBe(1);
    expect(json.data[0].salesperson.id).toBe(1);
    expect(json.pagination).toBeDefined();

    // WHERE条件で自分のIDのみフィルタされていること
    expect(mockDailyReportFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ salespersonId: 1 }),
      }),
    );
  });

  // RPT-002: 上長がsalesperson_id指定で部下の日報を取得
  it("RPT-002: manager can filter by salesperson_id", async () => {
    setupAuth(managerJwt, managerUser);
    mockFindFirstSalesperson.mockResolvedValue({ id: 1 });
    mockDailyReportCount.mockResolvedValue(1);
    mockDailyReportFindMany.mockResolvedValue([sampleReport]);

    const response = await GET(
      createRequest("valid-token", { salesperson_id: "1" }),
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data).toHaveLength(1);
    expect(mockDailyReportFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ salespersonId: 1 }),
      }),
    );
  });

  // RPT-003: 上長がsalesperson_id未指定で自分＋部下全員の日報を取得
  it("RPT-003: manager gets own + subordinates reports when no salesperson_id", async () => {
    setupAuth(managerJwt, managerUser);
    mockFindManySalesperson.mockResolvedValue([{ id: 1 }, { id: 2 }]);
    mockDailyReportCount.mockResolvedValue(2);
    mockDailyReportFindMany.mockResolvedValue([
      sampleReport,
      {
        ...sampleReport,
        id: 2,
        salesperson: { id: 2, name: "山田花子" },
      },
    ]);

    const response = await GET(createRequest("valid-token"));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data).toHaveLength(2);

    // 自分(10) + 部下(1, 2) のIDでフィルタされていること
    expect(mockDailyReportFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          salespersonId: { in: [10, 1, 2] },
        }),
      }),
    );
  });

  // RPT-004: 期間絞り込み
  it("RPT-004: filters by date_from and date_to", async () => {
    setupAuth(salesJwt, salesUser);
    mockDailyReportCount.mockResolvedValue(1);
    mockDailyReportFindMany.mockResolvedValue([sampleReport]);

    const response = await GET(
      createRequest("valid-token", {
        date_from: "2026-04-01",
        date_to: "2026-04-30",
      }),
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(mockDailyReportFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          reportDate: {
            gte: new Date("2026-04-01"),
            lte: new Date("2026-04-30"),
          },
        }),
      }),
    );
    expect(json.data).toHaveLength(1);
  });

  // RPT-005: status=draft で絞り込み
  it("RPT-005: filters by status=draft", async () => {
    setupAuth(salesJwt, salesUser);
    const draftReport = { ...sampleReport, status: "draft" };
    mockDailyReportCount.mockResolvedValue(1);
    mockDailyReportFindMany.mockResolvedValue([draftReport]);

    const response = await GET(
      createRequest("valid-token", { status: "draft" }),
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data[0].status).toBe("draft");
    expect(mockDailyReportFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "draft" }),
      }),
    );
  });

  // RPT-006: ページネーション
  it("RPT-006: supports pagination (page=2, per_page=10)", async () => {
    setupAuth(salesJwt, salesUser);
    mockDailyReportCount.mockResolvedValue(25);
    mockDailyReportFindMany.mockResolvedValue([sampleReport]);

    const response = await GET(
      createRequest("valid-token", { page: "2", per_page: "10" }),
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.pagination).toEqual({
      page: 2,
      per_page: 10,
      total: 25,
      total_pages: 3,
    });
    expect(mockDailyReportFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 10,
        take: 10,
      }),
    );
  });

  // RPT-007: 0件の場合は空配列
  it("RPT-007: returns empty array and total=0 when no reports", async () => {
    setupAuth(salesJwt, salesUser);
    mockDailyReportCount.mockResolvedValue(0);
    mockDailyReportFindMany.mockResolvedValue([]);

    const response = await GET(createRequest("valid-token"));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data).toEqual([]);
    expect(json.pagination.total).toBe(0);
    expect(json.pagination.total_pages).toBe(0);
  });

  // RPT-008: visit_count が正しく集計されている
  it("RPT-008: visit_count matches visitRecords count", async () => {
    setupAuth(salesJwt, salesUser);
    mockDailyReportCount.mockResolvedValue(1);
    mockDailyReportFindMany.mockResolvedValue([
      { ...sampleReport, _count: { visitRecords: 5 } },
    ]);

    const response = await GET(createRequest("valid-token"));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data[0].visit_count).toBe(5);
  });

  // RPT-009: 営業が他人のsalesperson_idを指定 → 403
  it("RPT-009: returns 403 when salesperson specifies another person's id", async () => {
    setupAuth(salesJwt, salesUser);

    const response = await GET(
      createRequest("valid-token", { salesperson_id: "999" }),
    );
    const json = await response.json();

    expect(response.status).toBe(403);
    expect(json.error.code).toBe("FORBIDDEN");
  });

  // RPT-010: 未認証でアクセス → 401
  it("RPT-010: returns 401 when no token is provided", async () => {
    const response = await GET(createRequest());
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error.code).toBe("UNAUTHORIZED");
  });

  // PERM-004: 上長が部下でない営業のsalesperson_idを指定 → 403
  it("PERM-004: returns 403 when manager specifies non-subordinate salesperson_id", async () => {
    setupAuth(managerJwt, managerUser);
    mockFindFirstSalesperson.mockResolvedValue(null);

    const response = await GET(
      createRequest("valid-token", { salesperson_id: "999" }),
    );
    const json = await response.json();

    expect(response.status).toBe(403);
    expect(json.error.code).toBe("FORBIDDEN");
  });

  // 上長が自分のsalesperson_idを指定した場合は正常に取得できる
  it("manager can specify own salesperson_id", async () => {
    setupAuth(managerJwt, managerUser);
    mockDailyReportCount.mockResolvedValue(1);
    mockDailyReportFindMany.mockResolvedValue([
      {
        ...sampleReport,
        salesperson: { id: 10, name: "鈴木部長" },
      },
    ]);

    const response = await GET(
      createRequest("valid-token", { salesperson_id: "10" }),
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data).toHaveLength(1);
    // findFirstは呼ばれない（自分のIDなのでスキップ）
    expect(mockFindFirstSalesperson).not.toHaveBeenCalled();
  });

  // レスポンス形式の確認
  it("returns correct response format with report_date and created_at", async () => {
    setupAuth(salesJwt, salesUser);
    mockDailyReportCount.mockResolvedValue(1);
    mockDailyReportFindMany.mockResolvedValue([sampleReport]);

    const response = await GET(createRequest("valid-token"));
    const json = await response.json();

    expect(response.status).toBe(200);
    const report = json.data[0];
    expect(report.report_date).toBe("2026-04-04");
    expect(report.created_at).toBe("2026-04-04T17:00:00.000Z");
    expect(report.salesperson).toEqual({ id: 1, name: "田中太郎" });
    expect(report.visit_count).toBe(3);
    expect(report.status).toBe("submitted");
  });
});
