import { prisma } from "@/lib/prisma";
import { authenticateUser } from "@/lib/userAuthorization";

async function getUserId(request: Request): Promise<string | null> { const auth = await authenticateUser(request); return auth?.user.id ?? null; }

export async function GET(request: Request) {
  const userId = await getUserId(request);
  if (!userId) return Response.json({ error: "Не авторизован" }, { status: 401 });

  const orders = await prisma.order.findMany({
    where: { userId },
    select: {
      id: true, status: true, total: true, name: true, phone: true, address: true,
      comment: true, trackNumber: true, trackUrl: true, promoCode: true, discount: true,
      createdAt: true, updatedAt: true,
      items: { include: { product: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return Response.json(orders);
}

export async function POST(request: Request) {
  const userId = await getUserId(request);
  if (!userId) return Response.json({ error: "Не авторизован" }, { status: 401 });

  const { name, phone, address, comment } = await request.json();
  if (!name || !phone || !address) {
    return Response.json({ error: "Заполните имя, телефон и адрес" }, { status: 400 });
  }

  const cartItems = await prisma.cartItem.findMany({
    where: { userId },
    include: { product: true },
  });

  if (cartItems.length === 0) {
    return Response.json({ error: "Корзина пуста" }, { status: 400 });
  }

  const total = cartItems.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

  const order = await prisma.order.create({
    data: {
      userId,
      total,
      name,
      phone,
      address,
      comment: comment || "",
      items: {
        create: cartItems.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          price: item.product.price,
        })),
      },
    },
    select: {
      id: true, status: true, total: true, name: true, phone: true, address: true,
      comment: true, trackNumber: true, trackUrl: true, promoCode: true, discount: true,
      createdAt: true, updatedAt: true,
      items: { include: { product: true } },
    },
  });

  await prisma.cartItem.deleteMany({ where: { userId } });

  return Response.json(order);
}
