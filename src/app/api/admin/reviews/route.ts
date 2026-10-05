import { authorizeAdmin, adminDenied } from "@/lib/adminAuthorization";
import { prisma } from "@/lib/prisma";


function displayName(r: {
  authorName: string;
  user: { name: string; email: string } | null;
}): string {
  if (r.authorName) return r.authorName;
  if (r.user) return r.user.name || r.user.email.split("@")[0];
  return "Аноним";
}

// GET — список всех товаров с их отзывами (для раздела «Отзывы» в админке)
export async function GET(request: Request) {
  const auth = await authorizeAdmin(request, "reviews:read");
  if (!auth.ok) return adminDenied(auth);

  const products = await prisma.product.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      category: { select: { name: true } },
      reviews: {
        orderBy: { createdAt: "desc" },
        include: { user: { select: { name: true, email: true } } },
      },
    },
  });

  const result = products.map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    image: p.image,
    brand: p.brand,
    productType: p.productType,
    price: p.price,
    categoryName: p.category?.name || "",
    reviews: p.reviews.map((r) => ({
      id: r.id,
      authorName: r.authorName,
      userName: displayName(r),
      rating: r.rating,
      text: r.text,
      published: r.published,
      source: r.source,
      isUser: !!r.userId,
      createdAt: r.createdAt.toISOString(),
    })),
  }));

  return Response.json(result);
}

// POST — создать (применить) отзыв вручную/из сгенерированного черновика
export async function POST(request: Request) {
  const auth = await authorizeAdmin(request, "reviews:moderate");
  if (!auth.ok) return adminDenied(auth);

  const body = await request.json();
  const { productId, authorName, rating, text, published, createdAt } = body;

  if (!productId) return Response.json({ error: "Не указан товар" }, { status: 400 });
  const numRating = Number(rating) || 5;
  if (numRating < 1 || numRating > 5) return Response.json({ error: "Оценка от 1 до 5" }, { status: 400 });

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) return Response.json({ error: "Товар не найден" }, { status: 404 });

  const review = await prisma.review.create({
    data: {
      productId,
      authorName: (authorName || "").toString().trim(),
      rating: numRating,
      text: (text || "").toString().trim(),
      published: published === undefined ? false : Boolean(published),
      source: "manual",
      ...(createdAt ? { createdAt: new Date(createdAt) } : {}),
    },
  });

  return Response.json({ id: review.id }, { status: 201 });
}

// PATCH — обновить существующий отзыв
export async function PATCH(request: Request) {
  const auth = await authorizeAdmin(request, "reviews:moderate");
  if (!auth.ok) return adminDenied(auth);

  const body = await request.json();
  const { id, authorName, rating, text, published } = body;
  if (!id) return Response.json({ error: "Не указан отзыв" }, { status: 400 });

  const existing = await prisma.review.findUnique({ where: { id }, select: { source: true } });
  if (!existing) return Response.json({ error: "Отзыв не найден" }, { status: 404 });
  if (published === true && ["ai", "import-unverified"].includes(existing.source)) return Response.json({ error: "Нельзя публиковать отзыв без подтверждённого происхождения" }, { status: 400 });

  const data: Record<string, unknown> = {};
  if (authorName !== undefined) data.authorName = String(authorName).trim();
  if (rating !== undefined) {
    const numRating = Number(rating);
    if (numRating < 1 || numRating > 5) return Response.json({ error: "Оценка от 1 до 5" }, { status: 400 });
    data.rating = numRating;
  }
  if (text !== undefined) data.text = String(text).trim();
  if (published !== undefined) data.published = Boolean(published);

  await prisma.review.update({ where: { id }, data });
  return Response.json({ ok: true });
}

// DELETE — удалить один отзыв { id } или несколько { ids: [] }
export async function DELETE(request: Request) {
  const auth = await authorizeAdmin(request, "reviews:moderate");
  if (!auth.ok) return adminDenied(auth);

  const body = await request.json().catch(() => ({}));
  const { id, ids } = body as { id?: string; ids?: string[] };

  if (Array.isArray(ids) && ids.length > 0) {
    const res = await prisma.review.deleteMany({ where: { id: { in: ids } } });
    return Response.json({ deleted: res.count });
  }
  if (id) {
    await prisma.review.delete({ where: { id } });
    return Response.json({ deleted: 1 });
  }
  return Response.json({ error: "Не указан отзыв" }, { status: 400 });
}
