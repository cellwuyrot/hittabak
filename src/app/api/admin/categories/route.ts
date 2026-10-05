import { authorizeAdmin, adminDenied } from "@/lib/adminAuthorization";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slugify";


async function uniqueSlug(name: string) {
  const base = slugify(name) || "category";
  let slug = base;
  let counter = 2;
  while (await prisma.category.findUnique({ where: { slug } })) slug = `${base}-${counter++}`;
  return slug;
}

async function validateParent(parentId: string | null, editingId?: string) {
  if (!parentId) return null;
  if (parentId === editingId) throw new Error("Категория не может быть родителем самой себе");
  const categories = await prisma.category.findMany({ select: { id: true, parentId: true } });
  const byId = new Map(categories.map((item) => [item.id, item]));
  if (!byId.has(parentId)) throw new Error("Родительская категория не найдена");
  let depth = 1;
  let current: string | null = parentId;
  const seen = new Set<string>();
  while (current) {
    if (current === editingId) throw new Error("Нельзя переместить категорию внутрь её дочерней категории");
    if (seen.has(current)) throw new Error("Обнаружен цикл категорий");
    seen.add(current);
    current = byId.get(current)?.parentId || null;
    depth++;
  }
  if (depth > 4) throw new Error("Максимальная структура: тип → бренд → модель → цвет");
  return parentId;
}

export async function GET(request: Request) {
  const auth = await authorizeAdmin(request, "content:read");
  if (!auth.ok) return adminDenied(auth);
  const categories = await prisma.category.findMany({
    orderBy: [{ order: "asc" }, { name: "asc" }],
    include: { _count: { select: { products: true, children: true } } },
  });
  return Response.json(categories);
}

export async function POST(request: Request) {
  const auth = await authorizeAdmin(request, "content:write");
  if (!auth.ok) return adminDenied(auth);
  try {
    const { name, icon, order, parentId, metaTitle, metaDescription, seoText } = await request.json();
    if (!name?.trim()) return Response.json({ error: "Название обязательно" }, { status: 400 });
    const validParentId = await validateParent(parentId || null);
    const category = await prisma.category.create({
      data: {
        name: name.trim(), slug: await uniqueSlug(name), icon: icon || "", order: Number(order) || 0,
        parentId: validParentId, metaTitle: metaTitle || "", metaDescription: metaDescription || "", seoText: seoText || "",
      },
    });
    return Response.json(category, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Не удалось создать категорию" }, { status: 400 });
  }
}

export async function PUT(request: Request) {
  const auth = await authorizeAdmin(request, "content:write");
  if (!auth.ok) return adminDenied(auth);
  try {
    const { id, name, icon, order, parentId, metaTitle, metaDescription, seoText } = await request.json();
    if (!id || !name?.trim()) return Response.json({ error: "ID и название обязательны" }, { status: 400 });
    const validParentId = await validateParent(parentId || null, id);
    const category = await prisma.category.update({
      where: { id },
      data: {
        name: name.trim(), icon: icon || "", order: Number(order) || 0, parentId: validParentId,
        metaTitle: metaTitle || "", metaDescription: metaDescription || "", seoText: seoText || "",
      },
    });
    return Response.json(category);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Не удалось обновить категорию" }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const auth = await authorizeAdmin(request, "content:delete");
  if (!auth.ok) return adminDenied(auth);
  const { id } = await request.json();
  if (!id) return Response.json({ error: "ID обязателен" }, { status: 400 });
  const category = await prisma.category.findUnique({
    where: { id },
    include: { _count: { select: { products: true, children: true } } },
  });
  if (!category) return Response.json({ error: "Категория не найдена" }, { status: 404 });
  if (category._count.products || category._count.children) {
    return Response.json({ error: "Сначала перенесите товары и дочерние категории. Данные не удалены." }, { status: 409 });
  }
  await prisma.category.delete({ where: { id } });
  return Response.json({ success: true });
}
