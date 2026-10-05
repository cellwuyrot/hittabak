import { prisma } from "@/lib/prisma";
import { authorizeAdmin, adminDenied } from "@/lib/adminAuthorization";
import bcrypt from "bcryptjs";

export async function GET(request: Request) {
  const auth = await authorizeAdmin(request, "admins:manage");
  if (!auth.ok) return adminDenied(auth);

  const admins = await prisma.admin.findMany({
    select: { id: true, username: true, role: true },
    orderBy: { username: "asc" },
  });
  return Response.json(admins);
}

export async function POST(request: Request) {
  const auth = await authorizeAdmin(request, "admins:manage");
  if (!auth.ok) return adminDenied(auth);

  const { username, password, role } = await request.json();
  if (!username || !password) {
    return Response.json({ error: "Логин и пароль обязательны" }, { status: 400 });
  }
  if (password.length < 6) {
    return Response.json({ error: "Пароль должен быть минимум 6 символов" }, { status: 400 });
  }

  const existing = await prisma.admin.findUnique({ where: { username } });
  if (existing) {
    return Response.json({ error: "Этот логин уже занят" }, { status: 400 });
  }

  const validRoles = ["admin", "editor"];
  const adminRole = validRoles.includes(role) ? role : "editor";
  const hashed = await bcrypt.hash(password, 10);

  const admin = await prisma.admin.create({
    data: { username, password: hashed, role: adminRole },
    select: { id: true, username: true, role: true },
  });

  return Response.json(admin);
}

export async function PUT(request: Request) {
  const auth = await authorizeAdmin(request, "admins:manage");
  if (!auth.ok) return adminDenied(auth);

  const { id, role, password } = await request.json();
  if (!id) return Response.json({ error: "ID обязателен" }, { status: 400 });

  const data: Record<string, string> = {};
  if (role && ["admin", "editor"].includes(role)) data.role = role;
  if (password && password.length >= 6) data.password = await bcrypt.hash(password, 10);

  if (Object.keys(data).length === 0) {
    return Response.json({ error: "Нечего обновлять" }, { status: 400 });
  }

  const admin = await prisma.admin.update({
    where: { id },
    data,
    select: { id: true, username: true, role: true },
  });
  return Response.json(admin);
}

export async function DELETE(request: Request) {
  const auth = await authorizeAdmin(request, "admins:manage");
  if (!auth.ok) return adminDenied(auth);

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return Response.json({ error: "ID обязателен" }, { status: 400 });

  if (id === auth.admin.id) {
    return Response.json({ error: "Нельзя удалить себя" }, { status: 400 });
  }

  await prisma.admin.delete({ where: { id } });
  return Response.json({ success: true });
}
