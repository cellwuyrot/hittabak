import { authorizeAdmin, adminDenied } from "@/lib/adminAuthorization";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";



export async function GET(req: NextRequest) {
  const auth = await authorizeAdmin(req, "personal:read");
  if (!auth.ok) return adminDenied(auth);

  const clients = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      lastName: true,
      phone: true,
      city: true,
      createdAt: true,
      _count: { select: { orders: true, reviews: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const result = clients.map((c) => ({
    id: c.id,
    email: c.email,
    name: c.name,
    lastName: c.lastName,
    phone: c.phone,
    city: c.city,
    createdAt: c.createdAt,
    ordersCount: c._count.orders,
    reviewsCount: c._count.reviews,
  }));

  return Response.json(result);
}

export async function DELETE(req: NextRequest) {
  const auth = await authorizeAdmin(req, "personal:delete");
  if (!auth.ok) return adminDenied(auth);

  const { id } = await req.json();
  if (!id) return Response.json({ error: "ID обязателен" }, { status: 400 });

  await prisma.user.delete({ where: { id } });
  return Response.json({ success: true });
}

export async function PATCH(req: NextRequest) {
  const auth = await authorizeAdmin(req, "personal:write");
  if (!auth.ok) return adminDenied(auth);

  const { id, action } = await req.json();
  if (!id) return Response.json({ error: "ID обязателен" }, { status: 400 });

  if (action === "get-details") {
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true, email: true, name: true, lastName: true, phone: true,
        zipCode: true, region: true, city: true, street: true, building: true, apartment: true,
        createdAt: true,
        orders: {
          select: { id: true, status: true, total: true, createdAt: true },
          orderBy: { createdAt: "desc" },
          take: 10,
        },
        reviews: {
          select: { id: true, rating: true, text: true, createdAt: true, product: { select: { name: true } } },
          orderBy: { createdAt: "desc" },
          take: 10,
        },
      },
    });
    return Response.json(user);
  }

  return Response.json({ error: "Неизвестное действие" }, { status: 400 });
}
