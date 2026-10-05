import { authorizeAdmin, adminDenied } from "@/lib/adminAuthorization";
import { prisma } from "@/lib/prisma";


export async function GET(request: Request) {
  const auth = await authorizeAdmin(request, "personal:read");
  if (!auth.ok) return adminDenied(auth);
  const orders = await prisma.order.findMany({
    include: { user: { select: { email: true, name: true } }, items: { include: { product: true } } },
    orderBy: { createdAt: "desc" },
  });
  return Response.json(orders);
}

export async function PUT(request: Request) {
  const auth = await authorizeAdmin(request, "personal:write");
  if (!auth.ok) return adminDenied(auth);
  const { id, status, adminNote } = await request.json();
  if (!id) return Response.json({ error: "Укажите id" }, { status: 400 });
  if (status === undefined && adminNote === undefined) {
    return Response.json({ error: "Нет данных для обновления" }, { status: 400 });
  }
  if (status !== undefined && (typeof status !== "string" || !status.trim())) {
    return Response.json({ error: "Некорректный статус" }, { status: 400 });
  }
  if (adminNote !== undefined && typeof adminNote !== "string") {
    return Response.json({ error: "Некорректная заметка" }, { status: 400 });
  }
  if (typeof adminNote === "string" && adminNote.length > 5000) {
    return Response.json({ error: "Заметка не должна превышать 5000 символов" }, { status: 400 });
  }
  const order = await prisma.order.update({
    where: { id },
    data: {
      ...(status !== undefined ? { status: status.trim() } : {}),
      ...(adminNote !== undefined ? { adminNote: adminNote.trim() } : {}),
    },
  });
  return Response.json(order);
}

export async function DELETE(request: Request) {
  const auth = await authorizeAdmin(request, "personal:delete");
  if (!auth.ok) return adminDenied(auth);
  const { id } = await request.json();
  if (!id) return Response.json({ error: "Укажите id" }, { status: 400 });
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) return Response.json({ error: "Заказ не найден" }, { status: 404 });
  if (order.status !== "cancelled" && order.status !== "delivered") {
    return Response.json({ error: "Удалять можно только отменённые или завершённые заказы" }, { status: 400 });
  }
  await prisma.order.delete({ where: { id } });
  return Response.json({ success: true });
}
