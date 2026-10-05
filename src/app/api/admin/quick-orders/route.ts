import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authorizeAdmin, adminDenied } from "@/lib/adminAuthorization";

export async function GET(request: Request) {
  const auth = await authorizeAdmin(request, "personal:read"); if (!auth.ok) return adminDenied(auth);
  const orders = await prisma.quickOrder.findMany({
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(orders);
}
