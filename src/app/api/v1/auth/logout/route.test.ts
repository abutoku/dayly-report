import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    salesperson: {
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

const mockFindUnique = prisma.salesperson.findUnique as ReturnType<
  typeof vi.fn
>;
const mockVerifyToken = verifyToken as ReturnType<typeof vi.fn>;

const activeSalesperson = {
  id: 1,
  name: "田中太郎",
  email: "tanaka@example.com",
  managerId: null,
  isActive: true,
};

function createRequest(token?: string): NextRequest {
  const headers: Record<string, string> = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return new NextRequest("http://localhost/api/v1/auth/logout", {
    method: "POST",
    headers,
  });
}

describe("POST /api/v1/auth/logout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // AUTH-010: Authenticated user logs out → 204
  it("AUTH-010: returns 204 No Content on successful logout", async () => {
    mockVerifyToken.mockResolvedValue({
      sub: 1,
      email: "tanaka@example.com",
      name: "田中太郎",
      isManager: false,
    });
    mockFindUnique.mockResolvedValue(activeSalesperson);

    const request = createRequest("valid-token");
    const response = await POST(request);

    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
  });

  // AUTH-011: Unauthenticated request → 401
  it("AUTH-011: returns 401 when no token is provided", async () => {
    const request = createRequest();
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error.code).toBe("UNAUTHORIZED");
  });

  // AUTH-011 supplement: invalid token → 401
  it("AUTH-011: returns 401 when token is invalid", async () => {
    mockVerifyToken.mockRejectedValue(new Error("invalid token"));

    const request = createRequest("invalid-token");
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error.code).toBe("UNAUTHORIZED");
  });

  // AUTH-011 supplement: inactive user → 401
  it("AUTH-011: returns 401 when user is inactive", async () => {
    mockVerifyToken.mockResolvedValue({
      sub: 1,
      email: "tanaka@example.com",
      name: "田中太郎",
      isManager: false,
    });
    mockFindUnique.mockResolvedValue({ ...activeSalesperson, isActive: false });

    const request = createRequest("valid-token");
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error.code).toBe("UNAUTHORIZED");
  });
});
