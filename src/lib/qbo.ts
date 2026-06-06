import OAuthClient from "intuit-oauth";
import { prisma } from "@/lib/prisma";

const QBO_CLIENT_ID = process.env.QBO_CLIENT_ID || "";
const QBO_CLIENT_SECRET = process.env.QBO_CLIENT_SECRET || "";
const QBO_REDIRECT_URI = process.env.QBO_REDIRECT_URI || "http://localhost:3000/api/qbo/callback";
const QBO_ENVIRONMENT = (process.env.QBO_ENVIRONMENT || "sandbox") as "sandbox" | "production";

export function getOAuthClient() {
  return new OAuthClient({
    clientId: QBO_CLIENT_ID,
    clientSecret: QBO_CLIENT_SECRET,
    environment: QBO_ENVIRONMENT,
    redirectUri: QBO_REDIRECT_URI,
  });
}

export function getBaseUrl(): string {
  return QBO_ENVIRONMENT === "production"
    ? "https://quickbooks.api.intuit.com"
    : "https://sandbox-quickbooks.api.intuit.com";
}

/**
 * Get a valid access token, refreshing if needed
 */
export async function getValidToken(): Promise<{
  accessToken: string;
  realmId: string;
} | null> {
  const connection = await prisma.qboConnection.findFirst();
  if (!connection) return null;

  // Check if token is still valid (with 5-minute buffer)
  const isExpired = new Date() >= new Date(connection.expiresAt.getTime() - 5 * 60 * 1000);

  if (!isExpired) {
    return { accessToken: connection.accessToken, realmId: connection.realmId };
  }

  // Refresh the token
  try {
    const oauthClient = getOAuthClient();
    oauthClient.setToken({
      access_token: connection.accessToken,
      refresh_token: connection.refreshToken,
      token_type: connection.tokenType,
    });

    const response = await oauthClient.refreshUsingToken(connection.refreshToken);
    const tokenData = response.getToken();

    const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000);

    await prisma.qboConnection.update({
      where: { id: connection.id },
      data: {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresAt,
      },
    });

    return { accessToken: tokenData.access_token, realmId: connection.realmId };
  } catch (error) {
    console.error("Failed to refresh QBO token:", error);
    return null;
  }
}

/**
 * Make an authenticated API call to QBO
 */
export async function qboApiCall(
  endpoint: string,
  options: { method?: string; body?: Record<string, unknown> } = {}
): Promise<{ ok: boolean; data?: Record<string, unknown>; error?: string }> {
  const token = await getValidToken();
  if (!token) {
    return { ok: false, error: "Not connected to QuickBooks" };
  }

  const { accessToken, realmId } = token;
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}/v3/company/${realmId}${endpoint}`;

  try {
    const res = await fetch(url, {
      method: options.method || "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error("QBO API Error:", res.status, errorText);
      return { ok: false, error: `QBO API Error: ${res.status} - ${errorText}` };
    }

    const data = await res.json();
    return { ok: true, data };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown QBO API error";
    return { ok: false, error: message };
  }
}
