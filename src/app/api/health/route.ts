import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const checks: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    env: {
      DATABASE_URL: process.env.DATABASE_URL ? "SET (" + process.env.DATABASE_URL.replace(/\/\/.*@/, "//***@") + ")" : "NOT SET",
      NODE_ENV: process.env.NODE_ENV,
    },
  };

  try {
    const result = await prisma.$queryRawUnsafe<{ now: Date }[]>("SELECT NOW() as now");
    checks.database = { status: "connected", serverTime: result[0]?.now };
  } catch (error: unknown) {
    checks.database = {
      status: "error",
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack?.split("\n").slice(0, 5) : undefined,
    };
  }

  const isHealthy = (checks.database as Record<string, unknown>)?.status === "connected";
  return NextResponse.json(checks, { status: isHealthy ? 200 : 500 });
}
