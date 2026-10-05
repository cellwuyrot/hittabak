import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendPasswordResetEmail } from "@/lib/mail";
import { clientIp, takeRateLimit } from "@/lib/rateLimit";
import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "crypto";

const GENERIC = "Если адрес зарегистрирован и отправка доступна, инструкции будут отправлены.";
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const normalizeEmail = (value: string) => value.trim().toLowerCase();

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>; try { body = await req.json(); } catch { return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 }); }
  const ip = clientIp(req);
  if (body.action === "request") {
    if (typeof body.email !== "string" || !emailPattern.test(normalizeEmail(body.email))) return NextResponse.json({ error: "Некорректный email" }, { status: 400 });
    const email = normalizeEmail(body.email);
    if (!takeRateLimit(`reset-request-ip:${ip}`, 10, 15*60_000) || !takeRateLimit(`reset-request-pair:${ip}:${hash(email)}`, 3, 15*60_000)) return NextResponse.json({ error: "Слишком много запросов" }, { status: 429 });
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      const raw = randomBytes(32).toString("base64url");
      await prisma.passwordResetToken.create({ data: { userId: user.id, tokenHash: hash(raw), expiresAt: new Date(Date.now()+60*60_000) } });
      const origin = process.env.APP_ORIGIN;
      if (origin) { const url = new URL("/reset-password", origin); url.searchParams.set("token", raw); await sendPasswordResetEmail(user.email, url.toString()); }
    }
    return NextResponse.json({ success: true, message: GENERIC });
  }
  if (body.action === "reset") {
    if (!takeRateLimit(`reset-apply-ip:${ip}`, 10, 15*60_000)) return NextResponse.json({ error: "Слишком много попыток" }, { status: 429 });
    if (typeof body.token !== "string" || body.token.length < 32 || typeof body.newPassword !== "string") return NextResponse.json({ error: "Неверный или просроченный код восстановления" }, { status: 400 });
    if (body.newPassword.length < 8) return NextResponse.json({ error: "Пароль должен быть минимум 8 символов" }, { status: 400 });
    const tokenHash = hash(body.token); const password = await bcrypt.hash(body.newPassword, 12); const now = new Date();
    const applied = await prisma.$transaction(async tx => {
      const record = await tx.passwordResetToken.findUnique({ where: { tokenHash } });
      if (!record || record.purpose !== "password-reset" || record.consumedAt || record.expiresAt <= now || record.attempts >= 5) return false;
      const claim = await tx.passwordResetToken.updateMany({ where: { id: record.id, consumedAt: null, expiresAt: { gt: now }, attempts: { lt: 5 } }, data: { consumedAt: now, attempts: { increment: 1 } } });
      if (claim.count !== 1) return false;
      await tx.user.update({ where: { id: record.userId }, data: { password, sessionVersion: { increment: 1 } } });
      await tx.passwordResetToken.updateMany({ where: { userId: record.userId, consumedAt: null }, data: { consumedAt: now } });
      return true;
    });
    return applied ? NextResponse.json({ success: true, message: "Пароль успешно изменён" }) : NextResponse.json({ error: "Неверный или просроченный код восстановления" }, { status: 400 });
  }
  return NextResponse.json({ error: "Некорректное действие" }, { status: 400 });
}
