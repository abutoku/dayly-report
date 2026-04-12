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

vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>();
  return {
    ...actual,
    comparePassword: vi.fn(),
    signToken: vi.fn(),
  };
});

import { prisma } from "@/lib/prisma";
import { comparePassword, signToken } from "@/lib/auth";

const mockFindUnique = prisma.salesperson.findUnique as ReturnType<
  typeof vi.fn
>;
const mockComparePassword = comparePassword as ReturnType<typeof vi.fn>;
const mockSignToken = signToken as ReturnType<typeof vi.fn>;

function createRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const activeSalesperson = {
  id: 1,
  name: "田中太郎",
  email: "tanaka@example.com",
  password: "$2a$10$hashedpassword",
  managerId: null,
  isActive: true,
  subordinates: [{ id: 2 }],
  createdAt: new Date(),
  updatedAt: new Date(),
};

const inactiveSalesperson = {
  ...activeSalesperson,
  id: 3,
  email: "inactive@example.com",
  isActive: false,
};

describe("POST /api/v1/auth/login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // AUTH-001: Correct credentials → 200
  it("AUTH-001: returns 200 with token and salesperson info on valid login", async () => {
    mockFindUnique.mockResolvedValue(activeSalesperson);
    mockComparePassword.mockResolvedValue(true);
    mockSignToken.mockResolvedValue("mock-jwt-token");

    const request = createRequest({
      email: "tanaka@example.com",
      password: "password123",
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data.token).toBe("mock-jwt-token");
    expect(json.data.salesperson).toEqual({
      id: 1,
      name: "田中太郎",
      email: "tanaka@example.com",
      is_manager: true,
    });

    expect(mockSignToken).toHaveBeenCalledWith({
      sub: 1,
      email: "tanaka@example.com",
      name: "田中太郎",
      isManager: true,
    });
  });

  // AUTH-001 supplement: salesperson with no subordinates → is_manager = false
  it("AUTH-001: returns is_manager=false when salesperson has no subordinates", async () => {
    mockFindUnique.mockResolvedValue({
      ...activeSalesperson,
      subordinates: [],
    });
    mockComparePassword.mockResolvedValue(true);
    mockSignToken.mockResolvedValue("mock-jwt-token");

    const request = createRequest({
      email: "tanaka@example.com",
      password: "password123",
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data.salesperson.is_manager).toBe(false);
  });

  // AUTH-002: Non-existent email → 401
  it("AUTH-002: returns 401 when email does not exist", async () => {
    mockFindUnique.mockResolvedValue(null);

    const request = createRequest({
      email: "unknown@example.com",
      password: "password123",
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error.code).toBe("UNAUTHORIZED");
    expect(json.error.message).toBe(
      "メールアドレスまたはパスワードが正しくありません",
    );
    expect(mockComparePassword).not.toHaveBeenCalled();
  });

  // AUTH-003: Wrong password → 401
  it("AUTH-003: returns 401 when password is incorrect", async () => {
    mockFindUnique.mockResolvedValue(activeSalesperson);
    mockComparePassword.mockResolvedValue(false);

    const request = createRequest({
      email: "tanaka@example.com",
      password: "wrongpassword",
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error.code).toBe("UNAUTHORIZED");
    expect(json.error.message).toBe(
      "メールアドレスまたはパスワードが正しくありません",
    );
    expect(mockSignToken).not.toHaveBeenCalled();
  });

  // AUTH-004: Empty email → 400
  it("AUTH-004: returns 400 when email is empty", async () => {
    const request = createRequest({
      email: "",
      password: "password123",
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error.code).toBe("VALIDATION_ERROR");
    expect(json.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "email" })]),
    );
  });

  // AUTH-005: Empty password → 400
  it("AUTH-005: returns 400 when password is empty", async () => {
    const request = createRequest({
      email: "tanaka@example.com",
      password: "",
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error.code).toBe("VALIDATION_ERROR");
    expect(json.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "password" })]),
    );
  });

  // AUTH-006: Invalid email format → 400
  it("AUTH-006: returns 400 when email format is invalid", async () => {
    const request = createRequest({
      email: "not-an-email",
      password: "password123",
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error.code).toBe("VALIDATION_ERROR");
    expect(json.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "email" })]),
    );
  });

  // AUTH-007: Inactive salesperson → 401
  it("AUTH-007: returns 401 when salesperson is inactive", async () => {
    mockFindUnique.mockResolvedValue(inactiveSalesperson);

    const request = createRequest({
      email: "inactive@example.com",
      password: "password123",
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error.code).toBe("UNAUTHORIZED");
    expect(json.error.message).toBe(
      "メールアドレスまたはパスワードが正しくありません",
    );
    // Should not attempt password comparison for inactive users
    expect(mockComparePassword).not.toHaveBeenCalled();
  });

  // Edge: missing email field entirely
  it("returns 400 when email field is missing", async () => {
    const request = createRequest({
      password: "password123",
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error.code).toBe("VALIDATION_ERROR");
  });

  // Edge: missing password field entirely
  it("returns 400 when password field is missing", async () => {
    const request = createRequest({
      email: "tanaka@example.com",
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error.code).toBe("VALIDATION_ERROR");
  });

  // Edge: invalid JSON body
  it("returns 400 when request body is not valid JSON", async () => {
    const request = new NextRequest("http://localhost/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error.code).toBe("VALIDATION_ERROR");
  });
});
