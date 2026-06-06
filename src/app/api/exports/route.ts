import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const exports = await prisma.exportFile.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return NextResponse.json(exports);
}
