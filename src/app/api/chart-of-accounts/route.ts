import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const accounts = await prisma.chartOfAccount.findMany({
    orderBy: { accountName: "asc" },
  });
  return NextResponse.json(accounts);
}
