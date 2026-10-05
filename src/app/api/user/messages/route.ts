import { prisma } from "@/lib/prisma";
import { authenticateUser } from "@/lib/userAuthorization";

export async function GET(request: Request) {
  const authentication = await authenticateUser(request);
  if (!authentication) return Response.json({ error: "Не авторизован" }, { status: 401 });
  const payload = authentication.claims;

  const url = new URL(request.url);
  const orderId = url.searchParams.get("orderId");
  if (!orderId) return Response.json({ error: "orderId обязателен" }, { status: 400 });

  const order = await prisma.order.findFirst({ where: { id: orderId, userId: payload.id } });
  if (!order) return Response.json({ error: "Заказ не найден" }, { status: 404 });

  const messages = await prisma.message.findMany({
    where: { orderId },
    orderBy: { createdAt: "asc" },
  });
  return Response.json(messages);
}

export async function POST(request: Request) {
  const authentication = await authenticateUser(request);
  if (!authentication) return Response.json({ error: "Не авторизован" }, { status: 401 });
  const payload = authentication.claims;

  const { orderId, text } = await request.json();
  if (!orderId || !text) return Response.json({ error: "orderId и text обязательны" }, { status: 400 });

  const order = await prisma.order.findFirst({ where: { id: orderId, userId: payload.id } });
  if (!order) return Response.json({ error: "Заказ не найден" }, { status: 404 });

  const message = await prisma.message.create({
    data: { orderId, senderId: payload.id, senderRole: "user", text },
  });
  return Response.json(message);
}
