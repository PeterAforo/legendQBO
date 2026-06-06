import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  let settings = await prisma.companySettings.findFirst();
  if (!settings) {
    settings = await prisma.companySettings.create({
      data: {
        companyName: "Legends Homecare LLC",
        qboCompanyName: "Legends Homecare LLC",
        bankName: "Bank of America",
        currency: "USD",
      },
    });
  }
  return NextResponse.json(settings);
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    let settings = await prisma.companySettings.findFirst();

    if (settings) {
      settings = await prisma.companySettings.update({
        where: { id: settings.id },
        data: {
          companyName: body.companyName,
          qboCompanyName: body.qboCompanyName,
          bankName: body.bankName,
          currency: body.currency,
          notes: body.notes || null,
        },
      });
    } else {
      settings = await prisma.companySettings.create({
        data: {
          companyName: body.companyName || "Legends Homecare LLC",
          qboCompanyName: body.qboCompanyName || "Legends Homecare LLC",
          bankName: body.bankName || "Bank of America",
          currency: body.currency || "USD",
          notes: body.notes || null,
        },
      });
    }

    return NextResponse.json(settings);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Save failed";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
