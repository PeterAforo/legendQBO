import { NextRequest, NextResponse } from "next/server";
import { getOAuthClient, qboApiCall } from "@/lib/qbo";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

export async function GET(request: NextRequest) {
  try {
    const url = request.url;
    const oauthClient = getOAuthClient();

    const authResponse = await oauthClient.createToken(url);
    const tokenData = authResponse.getToken();

    const realmId = request.nextUrl.searchParams.get("realmId");
    if (!realmId) {
      return NextResponse.redirect(new URL("/settings?qbo=error&msg=no_realm", request.url));
    }

    const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000);

    // Upsert the connection (only one QBO connection at a time)
    await prisma.qboConnection.upsert({
      where: { realmId },
      create: {
        realmId,
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        tokenType: tokenData.token_type,
        expiresAt,
      },
      update: {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        tokenType: tokenData.token_type,
        expiresAt,
      },
    });

    // Try to fetch company name
    try {
      const companyInfo = await qboApiCall("/companyinfo/" + realmId);
      if (companyInfo.ok && companyInfo.data) {
        const info = companyInfo.data as { CompanyInfo?: { CompanyName?: string } };
        if (info.CompanyInfo?.CompanyName) {
          await prisma.qboConnection.update({
            where: { realmId },
            data: { companyName: info.CompanyInfo.CompanyName },
          });
        }
      }
    } catch {
      // Non-critical, continue
    }

    await logAudit({
      action: "settings_updated",
      entityType: "qbo_connection",
      entityId: realmId,
      details: "Connected to QuickBooks Online",
    });

    return NextResponse.redirect(new URL("/settings?qbo=connected", request.url));
  } catch (error: unknown) {
    console.error("QBO callback error:", error);
    const message = error instanceof Error ? error.message : "unknown";
    return NextResponse.redirect(
      new URL(`/settings?qbo=error&msg=${encodeURIComponent(message)}`, request.url)
    );
  }
}
