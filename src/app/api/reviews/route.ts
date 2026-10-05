import { prisma } from "@/lib/prisma";
import { authenticateUser } from "@/lib/userAuthorization";

export async function POST(request: Request) {
  const authentication = await authenticateUser(request);
  if (!authentication) return Response.json({ error: "Не авторизован" }, { status: 401 });
  const payload = authentication.claims;

  const { productId, rating, text } = await request.json();
  if (!productId || !rating) return Response.json({ error: "Укажите товар и оценку" }, { status: 400 });
  if (rating < 1 || rating > 5) return Response.json({ error: "Оценка от 1 до 5" }, { status: 400 });

  const hasPurchase = await prisma.orderItem.findFirst({
    where: {
      productId,
      order: { userId: payload.id, status: "delivered" },
    },
  });
  if (!hasPurchase) return Response.json({ error: "Оставить отзыв можно только после получения товара" }, { status: 403 });

  const existing = await prisma.review.findFirst({
    where: { productId, userId: payload.id },
  });
  if (existing) return Response.json({ error: "Вы уже оставили отзыв на этот товар" }, { status: 400 });

  const review = await prisma.review.create({
    data: { productId, userId: payload.id, rating, text: text || "", source: "user" },
    include: { user: { select: { name: true, email: true } } },
  });

  return Response.json({
    id: review.id,
    rating: review.rating,
    text: review.text,
    createdAt: review.createdAt.toISOString(),
    userName: review.authorName || (review.user ? (review.user.name || review.user.email.split("@")[0]) : "Аноним"),
  }, { status: 201 });
}
