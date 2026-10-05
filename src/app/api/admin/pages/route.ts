import { authorizeAdmin, adminDenied } from "@/lib/adminAuthorization";
import { prisma } from "@/lib/prisma";


export async function GET(request: Request) {
  const auth = await authorizeAdmin(request, "content:read");
  if (!auth.ok) return adminDenied(auth);

  const pages = await prisma.sitePage.findMany({ orderBy: { slug: "asc" } });
  return Response.json(pages);
}

export async function PUT(request: Request) {
  const auth = await authorizeAdmin(request, "content:write");
  if (!auth.ok) return adminDenied(auth);

  const { slug, title, content } = await request.json();
  if (!slug) return Response.json({ error: "Slug обязателен" }, { status: 400 });

  const page = await prisma.sitePage.upsert({
    where: { slug },
    create: { slug, title: title || "", content: content || "" },
    update: { title: title || "", content: content || "" },
  });
  return Response.json(page);
}
