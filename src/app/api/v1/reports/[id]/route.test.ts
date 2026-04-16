import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    salesperson: {
      findUnique: vi.fn(),
    },
    dailyReport: {
      findUnique: vi.fn(),
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

// JWT ペイロード
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

const otherSalesJwt = {
  sub: 2,
  email: "yamada@example.com",
  name: "山田花子",
  isManager: false,
};

const otherManagerJwt = {
  sub: 20,
  email: "sato@example.com",
  name: "佐藤部長",
  isManager: true,
};

// ユーザー
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

const otherSalesUser = {
  id: 2,
  name: "山田花子",
  email: "yamada@example.com",
  managerId: 10,
  isActive: true,
};

const otherManagerUser = {
  id: 20,
  name: "佐藤部長",
  email: "sato@example.com",
  managerId: null,
  isActive: true,
};

function createRequest(token?: string, url?: string): NextRequest {
  const headers: Record<string, string> = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return new NextRequest(url ?? "http://localhost/api/v1/reports/1", {
    method: "GET",
    headers,
  });
}

function setupAuth(jwt: typeof salesJwt, user: typeof salesUser) {
  mockVerifyToken.mockResolvedValue(jwt);
  mockFindUniqueSalesperson.mockResolvedValue(user);
}

// 日報詳細のサンプル（Prismaの select 結果形式）
const sampleReport = {
  id: 1,
  reportDate: new Date("2026-04-04"),
  problem: "A商事の見積について、特別値引きの承認が必要。",
  plan: "A商事への見積作成、B工業への議事録送付",
  status: "submitted",
  createdAt: new Date("2026-04-04T17:00:00Z"),
  updatedAt: new Date("2026-04-04T17:00:00Z"),
  salespersonId: 1,
  salesperson: {
    id: 1,
    name: "田中太郎",
    managerId: 10,
  },
  visitRecords: [
    {
      id: 1,
      visitTime: new Date("1970-01-01T09:00:00Z"),
      content: "新規提案の打合せ。見積依頼あり。",
      customer: { id: 1, name: "A商事" },
    },
    {
      id: 2,
      visitTime: new Date("1970-01-01T11:00:00Z"),
      content: "定期フォロー。次回は来月予定。",
      customer: { id: 2, name: "B工業" },
    },
  ],
  comments: [
    {
      id: 1,
      content: "A商事の値引きは10%まで承認します。",
      createdAt: new Date("2026-04-04T18:30:00Z"),
      commenter: { id: 10, name: "鈴木部長" },
    },
  ],
};

function makeContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("GET /api/v1/reports/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // RPT-040: 自分の日報を取得 → 200、訪問記録・コメントを含む詳細
  it("RPT-040: returns own report with visits and comments", async () => {
    setupAuth(salesJwt, salesUser);
    mockDailyReportFindUnique.mockResolvedValue(sampleReport);

    const response = await GET(createRequest("valid-token"), makeContext("1"));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data.id).toBe(1);
    expect(json.data.report_date).toBe("2026-04-04");
    expect(json.data.salesperson).toEqual({ id: 1, name: "田中太郎" });
    expect(json.data.problem).toBe(
      "A商事の見積について、特別値引きの承認が必要。",
    );
    expect(json.data.plan).toBe("A商事への見積作成、B工業への議事録送付");
    expect(json.data.status).toBe("submitted");
    expect(json.data.visits).toHaveLength(2);
    expect(json.data.visits[0]).toEqual({
      id: 1,
      customer: { id: 1, name: "A商事" },
      visit_time: "09:00",
      content: "新規提案の打合せ。見積依頼あり。",
    });
    expect(json.data.comments).toHaveLength(1);
    expect(json.data.comments[0]).toEqual({
      id: 1,
      commenter: { id: 10, name: "鈴木部長" },
      content: "A商事の値引きは10%まで承認します。",
      created_at: "2026-04-04T18:30:00.000Z",
    });
    expect(json.data.created_at).toBe("2026-04-04T17:00:00.000Z");
    expect(json.data.updated_at).toBe("2026-04-04T17:00:00.000Z");
  });

  // RPT-041: 上長が部下の日報を取得 → 200
  it("RPT-041: manager can fetch subordinate's report", async () => {
    setupAuth(managerJwt, managerUser);
    // salespersonId=1, salesperson.managerId=10（上長=10）なので部下
    mockDailyReportFindUnique.mockResolvedValue(sampleReport);

    const response = await GET(createRequest("valid-token"), makeContext("1"));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data.id).toBe(1);
    expect(json.data.salesperson).toEqual({ id: 1, name: "田中太郎" });
  });

  // RPT-042: コメントが created_at 昇順でクエリされる
  it("RPT-042: fetches comments ordered by created_at ASC", async () => {
    setupAuth(salesJwt, salesUser);
    mockDailyReportFindUnique.mockResolvedValue(sampleReport);

    await GET(createRequest("valid-token"), makeContext("1"));

    expect(mockDailyReportFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1 },
        select: expect.objectContaining({
          comments: expect.objectContaining({
            orderBy: { createdAt: "asc" },
          }),
        }),
      }),
    );
  });

  // RPT-043: 訪問記録が visit_time 昇順でクエリされる
  it("RPT-043: fetches visits ordered by visit_time ASC", async () => {
    setupAuth(salesJwt, salesUser);
    mockDailyReportFindUnique.mockResolvedValue(sampleReport);

    await GET(createRequest("valid-token"), makeContext("1"));

    expect(mockDailyReportFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1 },
        select: expect.objectContaining({
          visitRecords: expect.objectContaining({
            orderBy: { visitTime: "asc" },
          }),
        }),
      }),
    );
  });

  // RPT-044: 存在しないIDを指定 → 404
  it("RPT-044: returns 404 when report does not exist", async () => {
    setupAuth(salesJwt, salesUser);
    mockDailyReportFindUnique.mockResolvedValue(null);

    const response = await GET(
      createRequest("valid-token"),
      makeContext("999"),
    );
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.error.code).toBe("NOT_FOUND");
  });

  // RPT-045: 他人（部下でもない）の日報を取得 → 403
  it("RPT-045: returns 403 when fetching another salesperson's report", async () => {
    setupAuth(otherSalesJwt, otherSalesUser);
    // 取得したreportは salespersonId=1（他人）かつ閲覧者は営業(id=2)
    mockDailyReportFindUnique.mockResolvedValue(sampleReport);

    const response = await GET(createRequest("valid-token"), makeContext("1"));
    const json = await response.json();

    expect(response.status).toBe(403);
    expect(json.error.code).toBe("FORBIDDEN");
  });

  // PERM-004相当: 上長が部下でない営業の日報を取得 → 403
  it("returns 403 when manager fetches a non-subordinate's report", async () => {
    setupAuth(otherManagerJwt, otherManagerUser);
    // salesperson.managerId=10 だが、アクセスしているのは別上長(id=20)
    mockDailyReportFindUnique.mockResolvedValue(sampleReport);

    const response = await GET(createRequest("valid-token"), makeContext("1"));
    const json = await response.json();

    expect(response.status).toBe(403);
    expect(json.error.code).toBe("FORBIDDEN");
  });

  // ID が数値でない場合 → 400 VALIDATION_ERROR
  it("returns 400 when id is not a number", async () => {
    setupAuth(salesJwt, salesUser);

    const response = await GET(
      createRequest("valid-token"),
      makeContext("abc"),
    );
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error.code).toBe("VALIDATION_ERROR");
    // DBにアクセスしないこと
    expect(mockDailyReportFindUnique).not.toHaveBeenCalled();
  });

  // ID が 0 以下の場合 → 400 VALIDATION_ERROR
  it("returns 400 when id is zero or negative", async () => {
    setupAuth(salesJwt, salesUser);

    const response = await GET(createRequest("valid-token"), makeContext("0"));
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error.code).toBe("VALIDATION_ERROR");
    expect(mockDailyReportFindUnique).not.toHaveBeenCalled();
  });

  // 未認証でアクセス → 401
  it("returns 401 when no token is provided", async () => {
    const response = await GET(createRequest(), makeContext("1"));
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error.code).toBe("UNAUTHORIZED");
  });

  // 上長が自分自身の日報を取得 → 200
  it("manager can fetch their own report", async () => {
    setupAuth(managerJwt, managerUser);
    const ownReport = {
      ...sampleReport,
      salespersonId: 10,
      salesperson: { id: 10, name: "鈴木部長", managerId: null },
    };
    mockDailyReportFindUnique.mockResolvedValue(ownReport);

    const response = await GET(createRequest("valid-token"), makeContext("1"));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data.salesperson).toEqual({ id: 10, name: "鈴木部長" });
  });
});
