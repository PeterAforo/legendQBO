import { NextResponse } from "next/server";
import { getOAuthClient } from "@/lib/qbo";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

export async function POST() {
  try {
    const connection = await prisma.qboConnection.findFirst();
    if (!connection) {
      return NextResponse.json({ error: "No QBO connection found" }, { status: 404 });
    }

    // Attempt to revoke token with Intuit
    try {
      const oauthClient = getOAuthClient();
      oauthClient.setToken({
        access_token: connection.accessToken,
        refresh_token: connection.refreshToken,
      });
      await oauthClient.revoke({ access_token: connection.accessToken });
    } catch {
      // Token may already be invalid, continue with local cleanup
    }

    // Remove from database
    await prisma.qboConnection.delete({ where: { id: connection.id } });

    await logAudit({
      action: "settings_updated",
      entityType: "qbo_connection",
      entityId: connection.realmId,
      details: "Disconnected from QuickBooks Online",
    });

    return NextResponse.json({ message: "Disconnected from QuickBooks" });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Disconnect failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
