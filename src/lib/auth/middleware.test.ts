// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { signToken, type JwtPayload } from "./jwt";

const mockFindUnique = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    salesperson: {
      findUnique: mockFindUnique,
    },
  },
}));

const { withAuth } = await import("./middleware");
const { isManager } = await import("./middleware");
type AuthenticatedSalesperson = import("./middleware").AuthenticatedSalesperson;

const activeSalesperson = {
  id: 1,
  name: "田中太郎",
  email: "tanaka@example.com",
  managerId: 10,
  isActive: true,
};

function createRequest(token?: string): NextRequest {
  const headers: Record<string, string> = {};
  if (token) {
    headers["authorization"] = `Bearer ${token}`;
  }
  return new NextRequest("http://localhost:3000/api/v1/reports", { headers });
}

describe("withAuth middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 401 when no Authorization header", async () => {
    const handler = vi.fn();
    const wrappedHandler = withAuth(handler);
    const response = await wrappedHandler(createRequest());

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error.code).toBe("UNAUTHORIZED");
    expect(handler).not.toHaveBeenCalled();
  });

  it("should return 401 when token is invalid", async () => {
    const handler = vi.fn();
    const wrappedHandler = withAuth(handler);
    const response = await wrappedHandler(createRequest("invalid-token"));

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("should return 401 when user is inactive", async () => {
    mockFindUnique.mockResolvedValue({
      ...activeSalesperson,
      isActive: false,
    });

    const payload: JwtPayload = {
      sub: 1,
      email: "tanaka@example.com",
      name: "田中太郎",
      isManager: false,
    };
    const token = await signToken(payload);
    const handler = vi.fn();
    const wrappedHandler = withAuth(handler);
    const response = await wrappedHandler(createRequest(token));

    expect(response.status).toBe(401);
  });

  it("should return 401 when user not found", async () => {
    mockFindUnique.mockResolvedValue(null);

    const payload: JwtPayload = {
      sub: 999,
      email: "ghost@example.com",
      name: "Ghost",
      isManager: false,
    };
    const token = await signToken(payload);
    const handler = vi.fn();
    const wrappedHandler = withAuth(handler);
    const response = await wrappedHandler(createRequest(token));

    expect(response.status).toBe(401);
  });

  it("should call handler with authenticated request on success", async () => {
    mockFindUnique.mockResolvedValue(activeSalesperson);

    const payload: JwtPayload = {
      sub: 1,
      email: "tanaka@example.com",
      name: "田中太郎",
      isManager: false,
    };
    const token = await signToken(payload);
    const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));
    const wrappedHandler = withAuth(handler);
    await wrappedHandler(createRequest(token));

    expect(handler).toHaveBeenCalledOnce();
    const req = handler.mock.calls[0][0];
    expect(req.salesperson.id).toBe(1);
    expect(req.salesperson.email).toBe("tanaka@example.com");
  });
});

describe("isManager", () => {
  it("should return true when managerId is null (top-level manager)", () => {
    const manager: AuthenticatedSalesperson = {
      id: 10,
      name: "鈴木部長",
      email: "suzuki@example.com",
      managerId: null,
      isActive: true,
    };
    expect(isManager(manager)).toBe(true);
  });

  it("should return false when managerId is set (subordinate)", () => {
    const subordinate: AuthenticatedSalesperson = {
      id: 1,
      name: "田中太郎",
      email: "tanaka@example.com",
      managerId: 10,
      isActive: true,
    };
    expect(isManager(subordinate)).toBe(false);
  });
});
