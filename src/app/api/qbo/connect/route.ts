import { NextResponse } from "next/server";
import { getOAuthClient } from "@/lib/qbo";
import OAuthClient from "intuit-oauth";

export async function GET() {
  try {
    const oauthClient = getOAuthClient();

    const authUri = oauthClient.authorizeUri({
      scope: [OAuthClient.scopes.Accounting],
      state: "qbo-connect",
    });

    return NextResponse.redirect(authUri);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to initiate QBO connection";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
