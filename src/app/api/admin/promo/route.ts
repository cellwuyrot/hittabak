import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authorizeAdmin, adminDenied } from "@/lib/adminAuthorization";

export async function GET(request: Request) {
  const auth = await authorizeAdmin(request, "settings:manage"); if (!auth.ok) return adminDenied(auth);
  const promos = await prisma.promoCode.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json(promos);
}

export async function POST(req: NextRequest) {
  const auth = await authorizeAdmin(req, "settings:manage"); if (!auth.ok) return adminDenied(auth);
  const data = await req.json();
  
  if (data.id) {
    const updated = await prisma.promoCode.update({
      where: { id: data.id },
      data: {
        code: data.code?.toUpperCase().trim(),
        discountType: data.discountType,
        discountValue: data.discountValue,
        minOrder: data.minOrder || 0,
        maxUses: data.maxUses || 0,
        active: data.active ?? true,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
      },
    });
    return NextResponse.json(updated);
  }

  const promo = await prisma.promoCode.create({
    data: {
      code: data.code?.toUpperCase().trim(),
      discountType: data.discountType || "percent",
      discountValue: data.discountValue || 0,
      minOrder: data.minOrder || 0,
      maxUses: data.maxUses || 0,
      active: true,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
    },
  });

  return NextResponse.json(promo);
}

export async function DELETE(req: NextRequest) {
  const auth = await authorizeAdmin(req, "settings:manage"); if (!auth.ok) return adminDenied(auth);
  const { id } = await req.json();
  await prisma.promoCode.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
