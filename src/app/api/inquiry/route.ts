import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendNewInquiryNotification } from "@/lib/mail";
import { getSiteSettings } from "@/lib/siteSettings";

const CONTACT_METHODS = ["phone", "telegram", "whatsapp", "email"] as const;
const DELIVERY_METHODS = ["cdek", "russian_post", "pickup"] as const;

export async function POST(req: NextRequest) {
  const {
    name, email, phone, items, comment, preferredContact, deliveryMethod,
    address, total, emailVerified,
  } = await req.json();
  const settings = await getSiteSettings();

  if (!name || !email || !phone || !items || items.length === 0) {
    return NextResponse.json({ error: "Заполните все обязательные поля" }, { status: 400 });
  }

  const nameRegex = /^[a-zA-Zа-яА-ЯёЁ\s-]+$/;
  if (!nameRegex.test(name)) {
    return NextResponse.json({ error: "Имя должно содержать только буквы" }, { status: 400 });
  }

  if (!email.includes("@")) {
    return NextResponse.json({ error: "Укажите корректный email" }, { status: 400 });
  }

  if (!phone.startsWith("+7") || phone.replace(/\D/g, "").length < 11) {
    return NextResponse.json({ error: "Телефон должен начинаться с +7 и содержать 11 цифр" }, { status: 400 });
  }

  if (!CONTACT_METHODS.includes(preferredContact)) {
    return NextResponse.json({ error: "Выберите предпочитаемый способ связи" }, { status: 400 });
  }

  if (!DELIVERY_METHODS.includes(deliveryMethod)) {
    return NextResponse.json({ error: "Выберите способ доставки" }, { status: 400 });
  }

  if (deliveryMethod !== "pickup" && (!address || address.trim().length < 10)) {
    return NextResponse.json({ error: "Укажите полный адрес доставки" }, { status: 400 });
  }

  if (typeof comment !== "string" || comment.length > 2000) {
    return NextResponse.json({ error: "Комментарий не должен превышать 2000 символов" }, { status: 400 });
  }

  if (!settings.disableCheckoutEmailVerification && !emailVerified) {
    return NextResponse.json({ error: "Подтвердите email" }, { status: 400 });
  }

  const inquiry = await prisma.inquiry.create({
    data: {
      name,
      email,
      phone,
      items: JSON.stringify(items),
      comment: comment.trim(),
      preferredContact,
      deliveryMethod,
      address: address?.trim() || "",
      total: total || 0,
      emailVerified: settings.disableCheckoutEmailVerification ? false : Boolean(emailVerified),
    },
  });

  sendNewInquiryNotification({
    name,
    email,
    phone,
    items: JSON.stringify(items),
    total: total || 0,
    address: address || "",
    comment: comment || "",
    preferredContact,
    deliveryMethod,
  }).catch((err) => console.error("Failed to send admin notification:", err));

  return NextResponse.json({ success: true, inquiryId: inquiry.id });
}
