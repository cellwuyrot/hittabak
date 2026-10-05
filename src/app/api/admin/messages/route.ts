import { authorizeAdmin, adminDenied } from "@/lib/adminAuthorization";
import { prisma } from "@/lib/prisma";


export async function GET(request: Request) {
  const auth = await authorizeAdmin(request, "personal:read");
  if (!auth.ok) return adminDenied(auth);

  const url = new URL(request.url);
  const orderId = url.searchParams.get("orderId");
  if (!orderId) return Response.json({ error: "orderId обязателен" }, { status: 400 });

  const messages = await prisma.message.findMany({
    where: { orderId },
    orderBy: { createdAt: "asc" },
  });
  return Response.json(messages);
}

export async function POST(request: Request) {
  const auth = await authorizeAdmin(request, "personal:write");
  if (!auth.ok) return adminDenied(auth);

  const { orderId, text } = await request.json();
  if (!orderId || !text) return Response.json({ error: "orderId и text обязательны" }, { status: 400 });

  const message = await prisma.message.create({
    data: { orderId, senderId: auth.admin.id, senderRole: "admin", text },
  });
  return Response.json(message);
}
