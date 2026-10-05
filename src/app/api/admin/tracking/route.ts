import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authorizeAdmin, adminDenied } from "@/lib/adminAuthorization";

export async function POST(req: NextRequest) {
  const auth = await authorizeAdmin(req, "personal:write"); if (!auth.ok) return adminDenied(auth);
  const { orderId, trackNumber, trackUrl } = await req.json();

  if (!orderId) return NextResponse.json({ error: "orderId required" }, { status: 400 });

  const updated = await prisma.order.update({
    where: { id: orderId },
    data: {
      trackNumber: trackNumber || "",
      trackUrl: trackUrl || "",
    },
  });

  return NextResponse.json(updated);
}
