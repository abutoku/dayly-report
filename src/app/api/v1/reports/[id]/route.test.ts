import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { PUT } from "./route";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    salesperson: {
      findUnique: vi.fn(),
    },
    dailyReport: {
      findUnique: vi.fn(),
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
const mockDailyReportFindUnique = prisma.dailyReport.findUnique as ReturnType<
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

const salesUser = {
  id: 1,
  name: "田中太郎",
  email: "tanaka@example.com",
  managerId: 10,
  isActive: true,
};

function createPutRequest(token?: string, body?: unknown): NextRequest {
  const url = "http://localhost/api/v1/reports/1";
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return new NextRequest(url, {
    method: "PUT",
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

function setupAuth(jwt: typeof salesJwt, user: typeof salesUser) {
  mockVerifyToken.mockResolvedValue(jwt);
  mockFindUniqueSalesperson.mockResolvedValue(user);
}

const validUpdateBody = {
  report_date: "2026-04-04",
  problem: "更新後の課題",
  plan: "更新後の予定",
  status: "draft",
  visits: [
    {
      customer_id: 1,
      visit_time: "09:00",
      content: "更新後の訪問内容 1",
    },
    {
      customer_id: 2,
      visit_time: "11:00",
      content: "更新後の訪問内容 2",
    },
  ],
};

type UpdateOverrides = {
  id?: number;
  reportDate?: string;
  problem?: string | null;
  plan?: string | null;
  status?: string;
  visitRecords?: unknown[];
};

function setupUpdateTransaction(
  overrides?: UpdateOverrides,
  captors?: {
    onDeleteMany?: ReturnType<typeof vi.fn>;
    onUpdate?: ReturnType<typeof vi.fn>;
  },
) {
  const defaults = {
    id: 1,
    reportDate: new Date("2026-04-04"),
    problem: "更新後の課題",
    plan: "更新後の予定",
    status: "draft",
    createdAt: new Date("2026-04-04T17:00:00Z"),
    visitRecords: [
      {
        id: 10,
        customer: { id: 1, name: "A商事" },
        visitTime: new Date("1970-01-01T09:00:00Z"),
        content: "更新後の訪問内容 1",
      },
      {
        id: 11,
        customer: { id: 2, name: "B工業" },
        visitTime: new Date("1970-01-01T11:00:00Z"),
        content: "更新後の訪問内容 2",
      },
    ],
  };

  const reportData = { ...defaults, ...overrides };
  if (overrides?.reportDate) {
    reportData.reportDate = new Date(overrides.reportDate);
  }

  const deleteManyMock = captors?.onDeleteMany ?? vi.fn();
  const updateMock = captors?.onUpdate ?? vi.fn().mockResolvedValue(reportData);
  if (!captors?.onUpdate) {
    updateMock.mockResolvedValue(reportData);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockTransaction.mockImplementation(async (fn: (tx: any) => any) => {
    const mockTx = {
      visitRecord: {
        deleteMany: deleteManyMock,
      },
      dailyReport: {
        update: updateMock,
      },
    };
    return fn(mockTx);
  });

  return { deleteManyMock, updateMock };
}

describe("PUT /api/v1/reports/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("正常系", () => {
    // RPT-050: 下書きの日報を編集して再保存
    it("RPT-050: 下書きの日報を編集して再保存", async () => {
      setupAuth(salesJwt, salesUser);
      mockDailyReportFindUnique.mockResolvedValue({
        id: 1,
        salespersonId: 1,
        status: "draft",
      });
      mockCustomerFindMany.mockResolvedValue([{ id: 1 }, { id: 2 }]);
      setupUpdateTransaction();

      const response = await PUT(
        createPutRequest("valid-token", validUpdateBody),
        {
          params: Promise.resolve({ id: "1" }),
        },
      );
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.data.id).toBe(1);
      expect(json.data.report_date).toBe("2026-04-04");
      expect(json.data.problem).toBe("更新後の課題");
      expect(json.data.plan).toBe("更新後の予定");
      expect(json.data.status).toBe("draft");
      expect(json.data.visits).toHaveLength(2);
      expect(json.data.visits[0].customer).toEqual({ id: 1, name: "A商事" });
      expect(json.data.visits[0].visit_time).toBe("09:00");
      expect(json.data.visits[1].customer).toEqual({ id: 2, name: "B工業" });
      expect(json.data.visits[1].visit_time).toBe("11:00");
      expect(json.data.created_at).toBeDefined();
    });

    // RPT-051: 下書きの日報を提出（status: draft→submitted）
    it("RPT-051: 下書きの日報を提出（status: draft→submitted）", async () => {
      setupAuth(salesJwt, salesUser);
      mockDailyReportFindUnique.mockResolvedValue({
        id: 1,
        salespersonId: 1,
        status: "draft",
      });
      mockCustomerFindMany.mockResolvedValue([{ id: 1 }, { id: 2 }]);
      const { updateMock } = setupUpdateTransaction({
        status: "submitted",
      });

      const body = { ...validUpdateBody, status: "submitted" };
      const response = await PUT(createPutRequest("valid-token", body), {
        params: Promise.resolve({ id: "1" }),
      });
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.data.status).toBe("submitted");
      // update呼び出しで status: submitted が渡っていること
      expect(updateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 1 },
          data: expect.objectContaining({ status: "submitted" }),
        }),
      );
    });

    // RPT-052: 訪問記録を追加・変更して更新（全件洗い替え）
    it("RPT-052: 訪問記録を追加・変更して更新（全件洗い替え）", async () => {
      setupAuth(salesJwt, salesUser);
      mockDailyReportFindUnique.mockResolvedValue({
        id: 1,
        salespersonId: 1,
        status: "draft",
      });
      mockCustomerFindMany.mockResolvedValue([{ id: 1 }, { id: 2 }, { id: 3 }]);

      const { deleteManyMock, updateMock } = setupUpdateTransaction({
        visitRecords: [
          {
            id: 20,
            customer: { id: 1, name: "A商事" },
            visitTime: new Date("1970-01-01T09:00:00Z"),
            content: "打合せ1",
          },
          {
            id: 21,
            customer: { id: 2, name: "B工業" },
            visitTime: new Date("1970-01-01T11:00:00Z"),
            content: "打合せ2",
          },
          {
            id: 22,
            customer: { id: 3, name: "C物産" },
            visitTime: new Date("1970-01-01T14:00:00Z"),
            content: "打合せ3",
          },
        ],
      });

      const body = {
        report_date: "2026-04-04",
        problem: null,
        plan: null,
        status: "draft",
        visits: [
          { customer_id: 1, visit_time: "09:00", content: "打合せ1" },
          { customer_id: 2, visit_time: "11:00", content: "打合せ2" },
          { customer_id: 3, visit_time: "14:00", content: "打合せ3" },
        ],
      };

      const response = await PUT(createPutRequest("valid-token", body), {
        params: Promise.resolve({ id: "1" }),
      });
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.data.visits).toHaveLength(3);

      // 全件洗い替え: visitRecord.deleteMany が dailyReportId:1 で呼ばれていること
      expect(deleteManyMock).toHaveBeenCalledWith({
        where: { dailyReportId: 1 },
      });

      // update の data.visitRecords.create に新しい訪問記録が配列で渡されている
      expect(updateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 1 },
          data: expect.objectContaining({
            visitRecords: {
              create: [
                expect.objectContaining({
                  customerId: 1,
                  content: "打合せ1",
                }),
                expect.objectContaining({
                  customerId: 2,
                  content: "打合せ2",
                }),
                expect.objectContaining({
                  customerId: 3,
                  content: "打合せ3",
                }),
              ],
            },
          }),
        }),
      );
    });
  });

  describe("異常系", () => {
    // RPT-053: 提出済みの日報を編集 → 403
    it("RPT-053: 提出済みの日報を編集", async () => {
      setupAuth(salesJwt, salesUser);
      mockDailyReportFindUnique.mockResolvedValue({
        id: 1,
        salespersonId: 1,
        status: "submitted",
      });

      const response = await PUT(
        createPutRequest("valid-token", validUpdateBody),
        {
          params: Promise.resolve({ id: "1" }),
        },
      );
      const json = await response.json();

      expect(response.status).toBe(403);
      expect(json.error.code).toBe("FORBIDDEN");
      expect(json.error.message).toContain("提出済み");

      // 提出済みの場合 transaction は呼ばれないこと
      expect(mockTransaction).not.toHaveBeenCalled();
    });

    // RPT-054: 他人の日報を編集 → 403
    it("RPT-054: 他人の日報を編集", async () => {
      setupAuth(salesJwt, salesUser);
      // 日報の作成者が自分(id=1)ではない (salespersonId=2)
      mockDailyReportFindUnique.mockResolvedValue({
        id: 1,
        salespersonId: 2,
        status: "draft",
      });

      const response = await PUT(
        createPutRequest("valid-token", validUpdateBody),
        {
          params: Promise.resolve({ id: "1" }),
        },
      );
      const json = await response.json();

      expect(response.status).toBe(403);
      expect(json.error.code).toBe("FORBIDDEN");
      expect(mockTransaction).not.toHaveBeenCalled();
    });

    // RPT-055: 存在しないIDを指定 → 404
    it("RPT-055: 存在しないIDを指定", async () => {
      setupAuth(salesJwt, salesUser);
      mockDailyReportFindUnique.mockResolvedValue(null);

      const response = await PUT(
        createPutRequest("valid-token", validUpdateBody),
        { params: Promise.resolve({ id: "9999" }) },
      );
      const json = await response.json();

      expect(response.status).toBe(404);
      expect(json.error.code).toBe("NOT_FOUND");
      expect(mockTransaction).not.toHaveBeenCalled();
    });

    // 未認証でアクセス → 401
    it("returns 401 when no token is provided", async () => {
      const response = await PUT(createPutRequest(undefined, validUpdateBody), {
        params: Promise.resolve({ id: "1" }),
      });
      const json = await response.json();

      expect(response.status).toBe(401);
      expect(json.error.code).toBe("UNAUTHORIZED");
    });

    // 不正なJSONボディ → 400
    it("returns 400 when request body is invalid JSON", async () => {
      setupAuth(salesJwt, salesUser);

      const req = new NextRequest("http://localhost/api/v1/reports/1", {
        method: "PUT",
        headers: {
          Authorization: "Bearer valid-token",
          "Content-Type": "application/json",
        },
        body: "not-valid-json{{{",
      });

      const response = await PUT(req, {
        params: Promise.resolve({ id: "1" }),
      });
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.error.code).toBe("VALIDATION_ERROR");
      expect(json.error.message).toContain("JSON");
    });

    // 提出時に visits 0件 → 400
    it("returns 400 when submitting with zero visits", async () => {
      setupAuth(salesJwt, salesUser);
      mockDailyReportFindUnique.mockResolvedValue({
        id: 1,
        salespersonId: 1,
        status: "draft",
      });

      const body = {
        report_date: "2026-04-04",
        status: "submitted",
        visits: [],
      };

      const response = await PUT(createPutRequest("valid-token", body), {
        params: Promise.resolve({ id: "1" }),
      });
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.error.code).toBe("VALIDATION_ERROR");
    });

    // 存在しない customer_id を指定 → 400
    it("returns 400 when customer_id does not exist", async () => {
      setupAuth(salesJwt, salesUser);
      mockDailyReportFindUnique.mockResolvedValue({
        id: 1,
        salespersonId: 1,
        status: "draft",
      });
      // customer_id 999 は存在しない
      mockCustomerFindMany.mockResolvedValue([{ id: 1 }]);

      const body = {
        report_date: "2026-04-04",
        status: "submitted",
        visits: [
          { customer_id: 1, visit_time: "09:00", content: "打合せ1" },
          { customer_id: 999, visit_time: "11:00", content: "打合せ2" },
        ],
      };

      const response = await PUT(createPutRequest("valid-token", body), {
        params: Promise.resolve({ id: "1" }),
      });
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.error.code).toBe("VALIDATION_ERROR");
      expect(json.error.message).toContain("999");
    });

    // 不正なID形式 (0, 負数, 非整数) → 404
    it("returns 404 when id is not a valid positive integer", async () => {
      setupAuth(salesJwt, salesUser);

      const response = await PUT(
        createPutRequest("valid-token", validUpdateBody),
        { params: Promise.resolve({ id: "abc" }) },
      );
      const json = await response.json();

      expect(response.status).toBe(404);
      expect(json.error.code).toBe("NOT_FOUND");
      // findUnique は呼ばれないこと
      expect(mockDailyReportFindUnique).not.toHaveBeenCalled();
    });
  });
});
