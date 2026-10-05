import { authorizeAdmin, adminDenied } from "@/lib/adminAuthorization";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";



export async function GET(req: NextRequest) {
  const auth = await authorizeAdmin(req, "personal:read");
  if (!auth.ok) return adminDenied(auth);

  const callbacks = await prisma.callbackRequest.findMany({
    orderBy: { createdAt: "desc" },
  });
  return Response.json(callbacks);
}

export async function PATCH(req: NextRequest) {
  const auth = await authorizeAdmin(req, "personal:write");
  if (!auth.ok) return adminDenied(auth);

  const { id, status } = await req.json();
  const updated = await prisma.callbackRequest.update({
    where: { id },
    data: { status },
  });
  return Response.json(updated);
}

export async function DELETE(req: NextRequest) {
  const auth = await authorizeAdmin(req, "personal:delete");
  if (!auth.ok) return adminDenied(auth);

  const { id } = await req.json();
  await prisma.callbackRequest.delete({ where: { id } });
  return Response.json({ success: true });
}
