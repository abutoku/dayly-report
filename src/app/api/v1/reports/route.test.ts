import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { GET, POST } from "./route";

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
    customer: {
      findMany: vi.fn(),
    },
    $transaction: vi.fn(),
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
const mockCustomerFindMany = prisma.customer.findMany as ReturnType<
  typeof vi.fn
>;
const mockTransaction = (
  prisma as unknown as { $transaction: ReturnType<typeof vi.fn> }
).$transaction;

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

// --- POST /api/v1/reports ---

function createPostRequest(token?: string, body?: unknown): NextRequest {
  const url = "http://localhost/api/v1/reports";
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return new NextRequest(url, {
    method: "POST",
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

const validSubmitBody = {
  report_date: "2026-04-04",
  problem: "A商事の見積について、特別値引きの承認が必要。",
  plan: "A商事への見積作成、B工業への議事録送付",
  status: "submitted",
  visits: [
    {
      customer_id: 1,
      visit_time: "09:00",
      content: "新規提案の打合せ。見積依頼あり。",
    },
    {
      customer_id: 2,
      visit_time: "11:00",
      content: "定期フォロー。次回は来月予定。",
    },
  ],
};

function setupPostTransactionSuccess(overrides?: {
  id?: number;
  reportDate?: string;
  problem?: string | null;
  plan?: string | null;
  status?: string;
  visitRecords?: unknown[];
}) {
  const defaults = {
    id: 1,
    reportDate: new Date("2026-04-04"),
    problem: "A商事の見積について、特別値引きの承認が必要。",
    plan: "A商事への見積作成、B工業への議事録送付",
    status: "submitted",
    createdAt: new Date("2026-04-04T17:00:00Z"),
    visitRecords: [
      {
        id: 1,
        customer: { id: 1, name: "A商事" },
        visitTime: new Date("1970-01-01T09:00:00Z"),
        content: "新規提案の打合せ。見積依頼あり。",
      },
      {
        id: 2,
        customer: { id: 2, name: "B工業" },
        visitTime: new Date("1970-01-01T11:00:00Z"),
        content: "定期フォロー。次回は来月予定。",
      },
    ],
  };

  const reportData = { ...defaults, ...overrides };
  if (overrides?.reportDate) {
    reportData.reportDate = new Date(overrides.reportDate);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockTransaction.mockImplementation(async (fn: (tx: any) => any) => {
    const mockTx = {
      dailyReport: {
        create: vi.fn().mockResolvedValue(reportData),
      },
    };
    return fn(mockTx);
  });
}

describe("POST /api/v1/reports", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("正常系", () => {
    // RPT-020: 訪問記録2件＋Problem＋Planを入力して提出
    it("RPT-020: 訪問記録2件＋Problem＋Planを入力して提出", async () => {
      setupAuth(salesJwt, salesUser);
      mockCustomerFindMany.mockResolvedValue([{ id: 1 }, { id: 2 }]);
      setupPostTransactionSuccess();

      const response = await POST(
        createPostRequest("valid-token", validSubmitBody),
      );
      const json = await response.json();

      expect(response.status).toBe(201);
      expect(json.data.id).toBe(1);
      expect(json.data.report_date).toBe("2026-04-04");
      expect(json.data.problem).toBe(
        "A商事の見積について、特別値引きの承認が必要。",
      );
      expect(json.data.plan).toBe("A商事への見積作成、B工業への議事録送付");
      expect(json.data.status).toBe("submitted");
      expect(json.data.visits).toHaveLength(2);
      expect(json.data.visits[0].customer).toEqual({ id: 1, name: "A商事" });
      expect(json.data.visits[0].visit_time).toBe("09:00");
      expect(json.data.visits[1].customer).toEqual({ id: 2, name: "B工業" });
      expect(json.data.created_at).toBeDefined();
    });

    // RPT-021: 下書きとして保存（status=draft）
    it("RPT-021: 下書きとして保存（status=draft）", async () => {
      setupAuth(salesJwt, salesUser);
      mockCustomerFindMany.mockResolvedValue([{ id: 1 }]);
      setupPostTransactionSuccess({
        status: "draft",
        visitRecords: [
          {
            id: 1,
            customer: { id: 1, name: "A商事" },
            visitTime: new Date("1970-01-01T09:00:00Z"),
            content: "打合せ",
          },
        ],
      });

      const body = {
        report_date: "2026-04-04",
        problem: "課題あり",
        plan: "予定あり",
        status: "draft",
        visits: [{ customer_id: 1, visit_time: "09:00", content: "打合せ" }],
      };

      const response = await POST(createPostRequest("valid-token", body));
      const json = await response.json();

      expect(response.status).toBe(201);
      expect(json.data.status).toBe("draft");
    });

    // RPT-022: Problem・Plan未入力で下書き保存
    it("RPT-022: Problem・Plan未入力で下書き保存", async () => {
      setupAuth(salesJwt, salesUser);
      setupPostTransactionSuccess({
        problem: null,
        plan: null,
        status: "draft",
        visitRecords: [],
      });

      const body = {
        report_date: "2026-04-04",
        status: "draft",
      };

      const response = await POST(createPostRequest("valid-token", body));
      const json = await response.json();

      expect(response.status).toBe(201);
      expect(json.data.problem).toBeNull();
      expect(json.data.plan).toBeNull();
    });

    // RPT-023: 同一顧客への複数訪問記録を登録
    it("RPT-023: 同一顧客への複数訪問記録を登録", async () => {
      setupAuth(salesJwt, salesUser);
      mockCustomerFindMany.mockResolvedValue([{ id: 1 }]);
      setupPostTransactionSuccess({
        visitRecords: [
          {
            id: 1,
            customer: { id: 1, name: "A商事" },
            visitTime: new Date("1970-01-01T09:00:00Z"),
            content: "午前の打合せ",
          },
          {
            id: 2,
            customer: { id: 1, name: "A商事" },
            visitTime: new Date("1970-01-01T14:00:00Z"),
            content: "午後の打合せ",
          },
        ],
      });

      const body = {
        report_date: "2026-04-04",
        status: "submitted",
        visits: [
          { customer_id: 1, visit_time: "09:00", content: "午前の打合せ" },
          { customer_id: 1, visit_time: "14:00", content: "午後の打合せ" },
        ],
      };

      const response = await POST(createPostRequest("valid-token", body));
      const json = await response.json();

      expect(response.status).toBe(201);
      expect(json.data.visits).toHaveLength(2);
      expect(json.data.visits[0].customer.id).toBe(1);
      expect(json.data.visits[1].customer.id).toBe(1);
    });

    // RPT-026: 訪問記録0件で下書き保存は許可される
    it("RPT-026: 訪問記録0件で下書き保存は許可される", async () => {
      setupAuth(salesJwt, salesUser);
      setupPostTransactionSuccess({
        status: "draft",
        visitRecords: [],
      });

      const body = {
        report_date: "2026-04-04",
        status: "draft",
      };

      const response = await POST(createPostRequest("valid-token", body));
      const json = await response.json();

      expect(response.status).toBe(201);
      expect(json.data.status).toBe("draft");
      expect(json.data.visits).toHaveLength(0);
    });
  });

  describe("異常系", () => {
    // RPT-024: 報告日が未入力
    it("RPT-024: 報告日が未入力", async () => {
      setupAuth(salesJwt, salesUser);

      const body = {
        status: "draft",
      };

      const response = await POST(createPostRequest("valid-token", body));
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.error.code).toBe("VALIDATION_ERROR");
    });

    // RPT-025: 訪問記録0件で提出（status=submitted）
    it("RPT-025: 訪問記録0件で提出（status=submitted）", async () => {
      setupAuth(salesJwt, salesUser);

      const body = {
        report_date: "2026-04-04",
        status: "submitted",
      };

      const response = await POST(createPostRequest("valid-token", body));
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.error.code).toBe("VALIDATION_ERROR");
    });

    // RPT-027: 同一日付の日報が既に存在する場合
    it("RPT-027: 同一日付の日報が既に存在する場合", async () => {
      setupAuth(salesJwt, salesUser);
      mockCustomerFindMany.mockResolvedValue([{ id: 1 }, { id: 2 }]);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockTransaction.mockImplementation(async (fn: (tx: any) => any) => {
        const mockTx = {
          dailyReport: {
            create: vi
              .fn()
              .mockRejectedValue(
                new Prisma.PrismaClientKnownRequestError(
                  "Unique constraint failed on the fields: (`salesperson_id`,`report_date`)",
                  { code: "P2002", clientVersion: "6.x" },
                ),
              ),
          },
        };
        return fn(mockTx);
      });

      const response = await POST(
        createPostRequest("valid-token", validSubmitBody),
      );
      const json = await response.json();

      expect(response.status).toBe(409);
      expect(json.error.code).toBe("CONFLICT");
      expect(json.error.message).toContain("2026-04-04");
    });

    // RPT-028: 存在しないcustomer_idを指定
    it("RPT-028: 存在しないcustomer_idを指定", async () => {
      setupAuth(salesJwt, salesUser);
      // customer_id 999 does not exist — return only id 1
      mockCustomerFindMany.mockResolvedValue([{ id: 1 }]);

      const body = {
        report_date: "2026-04-04",
        status: "submitted",
        visits: [
          { customer_id: 1, visit_time: "09:00", content: "打合せ" },
          { customer_id: 999, visit_time: "11:00", content: "訪問" },
        ],
      };

      const response = await POST(createPostRequest("valid-token", body));
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.error.code).toBe("VALIDATION_ERROR");
      expect(json.error.message).toContain("999");
    });

    // RPT-029: 訪問時刻の形式が不正（例: "25:00"）
    it('RPT-029: 訪問時刻の形式が不正（例: "25:00"）', async () => {
      setupAuth(salesJwt, salesUser);

      const body = {
        report_date: "2026-04-04",
        status: "submitted",
        visits: [{ customer_id: 1, visit_time: "25:00", content: "打合せ" }],
      };

      const response = await POST(createPostRequest("valid-token", body));
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.error.code).toBe("VALIDATION_ERROR");
    });

    // RPT-030: 訪問内容が未入力
    it("RPT-030: 訪問内容が未入力", async () => {
      setupAuth(salesJwt, salesUser);

      const body = {
        report_date: "2026-04-04",
        status: "submitted",
        visits: [{ customer_id: 1, visit_time: "09:00", content: "" }],
      };

      const response = await POST(createPostRequest("valid-token", body));
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.error.code).toBe("VALIDATION_ERROR");
    });

    // RPT-031: 未認証でアクセス
    it("RPT-031: 未認証でアクセス", async () => {
      const response = await POST(
        createPostRequest(undefined, validSubmitBody),
      );
      const json = await response.json();

      expect(response.status).toBe(401);
      expect(json.error.code).toBe("UNAUTHORIZED");
    });

    // 無効化された顧客（is_active=false）のcustomer_idを指定 → 400
    it("returns 400 when customer_id refers to inactive customer", async () => {
      setupAuth(salesJwt, salesUser);
      // customer_id 1 exists but is inactive — findMany with isActive:true returns empty
      mockCustomerFindMany.mockResolvedValue([]);

      const body = {
        report_date: "2026-04-04",
        status: "submitted",
        visits: [{ customer_id: 1, visit_time: "09:00", content: "打合せ" }],
      };

      const response = await POST(createPostRequest("valid-token", body));
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.error.code).toBe("VALIDATION_ERROR");
      expect(json.error.message).toContain("1");
    });

    // 不正なJSONボディ → 400
    it("returns 400 when request body is invalid JSON", async () => {
      setupAuth(salesJwt, salesUser);

      const req = new NextRequest("http://localhost/api/v1/reports", {
        method: "POST",
        headers: {
          Authorization: "Bearer valid-token",
          "Content-Type": "application/json",
        },
        body: "not-valid-json{{{",
      });

      const response = await POST(req);
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.error.code).toBe("VALIDATION_ERROR");
      expect(json.error.message).toContain("JSON");
    });
  });
});
