import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";

export const POST = withAuth(async () => {
  return new NextResponse(null, { status: 204 });
});
