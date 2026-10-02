import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";
import jwt from "jsonwebtoken";
import { sendStatusUpdateNotification } from "@/lib/mail";
import { getSiteSettings } from "@/lib/siteSettings";

const SECRET = process.env.JWT_SECRET || "hittabak-secret-key-2025";

function checkAdmin(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!auth) return false;
  try {
    const payload = jwt.verify(auth.replace("Bearer ", ""), SECRET) as { role?: string };
    return payload.role === "admin";
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  if (!checkAdmin(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const inquiries = await prisma.inquiry.findMany({
    orderBy: { createdAt: "desc" },
  });
  return Response.json(inquiries);
}

export async function PATCH(req: NextRequest) {
  if (!checkAdmin(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id, status, adminNote } = await req.json();
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
  const settings = await getSiteSettings();

  const existing = await prisma.inquiry.findUnique({ where: { id } });
  if (!existing) return Response.json({ error: "Not found" }, { status: 404 });

  const updated = await prisma.inquiry.update({
    where: { id },
    data: {
      ...(status !== undefined ? { status: status.trim() } : {}),
      ...(adminNote !== undefined ? { adminNote: adminNote.trim() } : {}),
    },
  });

  const nextStatus = status === undefined ? existing.status : status.trim();
  const canSendStatusEmail = existing.email && (existing.emailVerified || settings.disableCheckoutEmailVerification);
  if (status !== undefined && existing.status !== nextStatus && canSendStatusEmail) {
    sendStatusUpdateNotification(existing.email, existing.name, nextStatus, id)
      .catch((err) => console.error("Failed to send status notification:", err));
  }

  return Response.json(updated);
}

export async function DELETE(req: NextRequest) {
  if (!checkAdmin(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json();
  await prisma.inquiry.delete({ where: { id } });
  return Response.json({ success: true });
}
