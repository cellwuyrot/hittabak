import { prisma } from "@/lib/prisma";
import { authenticateUser } from "@/lib/userAuthorization";

async function getUserId(request: Request): Promise<string | null> { const auth = await authenticateUser(request); return auth?.user.id ?? null; }

export async function GET(request: Request) {
  const userId = await getUserId(request);
  if (!userId) return Response.json({ error: "Не авторизован" }, { status: 401 });

  const items = await prisma.cartItem.findMany({
    where: { userId },
    include: { product: { include: { category: true } } },
    orderBy: { product: { name: "asc" } },
  });
  return Response.json(items);
}

export async function POST(request: Request) {
  const userId = await getUserId(request);
  if (!userId) return Response.json({ error: "Не авторизован" }, { status: 401 });

  const { productId, quantity, isPack } = await request.json();
  if (!productId) return Response.json({ error: "Не указан товар" }, { status: 400 });

  const pack = !!isPack;
  const item = await prisma.cartItem.upsert({
    where: { userId_productId_isPack: { userId, productId, isPack: pack } },
    update: { quantity: { increment: quantity || 1 } },
    create: { userId, productId, quantity: quantity || 1, isPack: pack },
    include: { product: true },
  });
  return Response.json(item);
}

export async function PUT(request: Request) {
  const userId = await getUserId(request);
  if (!userId) return Response.json({ error: "Не авторизован" }, { status: 401 });

  const { productId, quantity, isPack } = await request.json();
  if (!productId || quantity < 1) return Response.json({ error: "Неверные данные" }, { status: 400 });

  const pack = !!isPack;
  const item = await prisma.cartItem.update({
    where: { userId_productId_isPack: { userId, productId, isPack: pack } },
    data: { quantity },
    include: { product: true },
  });
  return Response.json(item);
}

export async function DELETE(request: Request) {
  const userId = await getUserId(request);
  if (!userId) return Response.json({ error: "Не авторизован" }, { status: 401 });

  const { productId, isPack } = await request.json();
  if (productId) {
    const pack = isPack !== undefined ? !!isPack : false;
    await prisma.cartItem.delete({ where: { userId_productId_isPack: { userId, productId, isPack: pack } } });
  } else {
    await prisma.cartItem.deleteMany({ where: { userId } });
  }
  return Response.json({ ok: true });
}
