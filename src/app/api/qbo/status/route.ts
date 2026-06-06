import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const connection = await prisma.qboConnection.findFirst();

    if (!connection) {
      return NextResponse.json({ connected: false });
    }

    const isTokenValid = new Date() < connection.expiresAt;

    return NextResponse.json({
      connected: true,
      realmId: connection.realmId,
      companyName: connection.companyName,
      tokenValid: isTokenValid,
      expiresAt: connection.expiresAt,
      connectedAt: connection.createdAt,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to check QBO status";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
