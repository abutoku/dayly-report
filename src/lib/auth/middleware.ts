import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken, type JwtPayload } from "./jwt";
import { unauthorizedResponse } from "./errors";

export interface AuthenticatedSalesperson {
  id: number;
  name: string;
  email: string;
  managerId: number | null;
  isActive: boolean;
}

export type AuthenticatedRequest = NextRequest & {
  salesperson: AuthenticatedSalesperson;
  jwtPayload: JwtPayload;
};

type RouteHandler = (
  request: AuthenticatedRequest,
  context?: unknown,
) => Promise<NextResponse>;

export function withAuth(handler: RouteHandler) {
  return async (
    request: NextRequest,
    context?: unknown,
  ): Promise<NextResponse> => {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return unauthorizedResponse();
    }

    const token = authHeader.slice(7);

    let payload: JwtPayload;
    try {
      payload = await verifyToken(token);
    } catch {
      return unauthorizedResponse("トークンが無効または期限切れです");
    }

    const salesperson = await prisma.salesperson.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        name: true,
        email: true,
        managerId: true,
        isActive: true,
      },
    });

    if (!salesperson || !salesperson.isActive) {
      return unauthorizedResponse("ユーザーが無効です");
    }

    const authenticatedRequest = request as AuthenticatedRequest;
    authenticatedRequest.salesperson = salesperson;
    authenticatedRequest.jwtPayload = payload;

    return handler(authenticatedRequest, context);
  };
}

export function isManager(salesperson: AuthenticatedSalesperson): boolean {
  return salesperson.managerId === null;
}

export async function isSubordinate(
  managerId: number,
  targetSalespersonId: number,
): Promise<boolean> {
  const target = await prisma.salesperson.findUnique({
    where: { id: targetSalespersonId },
    select: { managerId: true },
  });
  return target?.managerId === managerId;
}
