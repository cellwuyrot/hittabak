const SMTP_URL = process.env.SMTP_API_URL || "http://178.253.16.19:3003";
const SMTP_KEY = process.env.SMTP_API_KEY || "";
const FROM_EMAIL = process.env.SMTP_FROM_EMAIL || "hittabak@hittabak.ru";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "s4810769@ya.ru";

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: SendEmailOptions): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const res = await fetch(`${SMTP_URL}/api/emails`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SMTP_KEY}`,
      },
      body: JSON.stringify({ from_email: FROM_EMAIL, to, subject, html }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("SMTP API error:", res.status, text);
      return { success: false, error: text };
    }

    const data = await res.json();
    return { success: true, id: data.id };
  } catch (err) {
    console.error("SMTP send failed:", err);
    return { success: false, error: String(err) };
  }
}

export async function sendAdminNotification(subject: string, html: string) {
  return sendEmail({ to: ADMIN_EMAIL, subject, html });
}

export async function sendVerificationCode(email: string, code: string) {
  return sendEmail({
    to: email,
    subject: `Код подтверждения: ${code} — hittabak`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #f8fafc; border-radius: 12px;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="color: #4A90D9; font-size: 24px; margin: 0;">hittabak</h1>
          <p style="color: #64748b; font-size: 14px; margin-top: 4px;">Подтверждение email</p>
        </div>
        <div style="background: white; border-radius: 8px; padding: 24px; text-align: center;">
          <p style="color: #334155; font-size: 16px; margin-top: 0;">Ваш код подтверждения:</p>
          <div style="background: #f0f4f8; border-radius: 8px; padding: 16px; margin: 16px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #1a2332;">${code}</span>
          </div>
          <p style="color: #64748b; font-size: 13px; margin-bottom: 0;">Код действителен 10 минут.<br/>Если вы не запрашивали код, просто проигнорируйте это письмо.</p>
        </div>
        <p style="text-align: center; color: #94a3b8; font-size: 12px; margin-top: 16px;">© hittabak — hittabak.ru</p>
      </div>
    `,
  });
}

export async function sendNewInquiryNotification(inquiry: {
  name: string;
  email: string;
  phone: string;
  items: string;
  total: number;
  address: string;
  comment: string;
  preferredContact: string;
  deliveryMethod: string;
}) {
  const contactLabels: Record<string, string> = {
    phone: "Телефон", telegram: "Telegram", whatsapp: "WhatsApp", email: "Email",
  };
  const deliveryLabels: Record<string, string> = {
    cdek: "СДЭК", russian_post: "Почта России", pickup: "Самовывоз",
  };
  const itemsList = JSON.parse(inquiry.items || "[]");
  const itemsHtml = itemsList
    .map((item: { name?: string; productName?: string; quantity?: number; price?: number }) =>
      `<li>${item.productName || item.name || "Товар"} × ${item.quantity || 1}${item.price ? ` — ${item.price} ₽` : ""}</li>`
    )
    .join("");

  return sendAdminNotification(`Новая заявка от ${inquiry.name} — ${inquiry.total} ₽`, `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #f8fafc; border-radius: 12px;">
      <h2 style="color: #1a2332; margin-top: 0;">Новая заявка на сайте hittabak</h2>
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
        <tr><td style="padding: 8px; border-bottom: 1px solid #e2e8f0; color: #64748b;">Имя:</td><td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-weight: bold;">${inquiry.name}</td></tr>
        <tr><td style="padding: 8px; border-bottom: 1px solid #e2e8f0; color: #64748b;">Email:</td><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;"><a href="mailto:${inquiry.email}">${inquiry.email}</a></td></tr>
        <tr><td style="padding: 8px; border-bottom: 1px solid #e2e8f0; color: #64748b;">Телефон:</td><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;"><a href="tel:${inquiry.phone}">${inquiry.phone}</a></td></tr>
        <tr><td style="padding: 8px; border-bottom: 1px solid #e2e8f0; color: #64748b;">Предпочитаемая связь:</td><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${contactLabels[inquiry.preferredContact] || inquiry.preferredContact}</td></tr>
        <tr><td style="padding: 8px; border-bottom: 1px solid #e2e8f0; color: #64748b;">Доставка:</td><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${deliveryLabels[inquiry.deliveryMethod] || inquiry.deliveryMethod}</td></tr>
        <tr><td style="padding: 8px; border-bottom: 1px solid #e2e8f0; color: #64748b;">Адрес:</td><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${inquiry.address || "—"}</td></tr>
        <tr><td style="padding: 8px; border-bottom: 1px solid #e2e8f0; color: #64748b;">Комментарий:</td><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${inquiry.comment || "—"}</td></tr>
        <tr><td style="padding: 8px; color: #64748b;">Сумма:</td><td style="padding: 8px; font-weight: bold; font-size: 18px; color: #E8403A;">${inquiry.total.toLocaleString("ru-RU")} ₽</td></tr>
      </table>
      ${itemsHtml ? `<h3 style="color: #334155;">Товары:</h3><ul style="color: #334155;">${itemsHtml}</ul>` : ""}
      <p style="color: #94a3b8; font-size: 12px; margin-top: 24px;">Заявка получена с сайта hittabak.ru</p>
    </div>
  `);
}

export async function sendStatusUpdateNotification(email: string, name: string, status: string, inquiryId: string) {
  const statusLabels: Record<string, string> = {
    new: "Новая",
    processing: "В обработке",
    confirmed: "Подтверждена",
    shipped: "Отправлена",
    delivered: "Доставлена",
    cancelled: "Отменена",
  };

  const statusLabel = statusLabels[status] || status;

  return sendEmail({
    to: email,
    subject: `Статус заявки обновлён: ${statusLabel} — hittabak`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #f8fafc; border-radius: 12px;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="color: #4A90D9; font-size: 24px; margin: 0;">hittabak</h1>
        </div>
        <div style="background: white; border-radius: 8px; padding: 24px;">
          <p style="color: #334155; font-size: 16px; margin-top: 0;">Здравствуйте, ${name}!</p>
          <p style="color: #334155;">Статус вашей заявки <strong>#${inquiryId.slice(0, 8)}</strong> обновлён:</p>
          <div style="background: #f0f4f8; border-radius: 8px; padding: 16px; margin: 16px 0; text-align: center;">
            <span style="font-size: 20px; font-weight: bold; color: #4A90D9;">${statusLabel}</span>
          </div>
          <p style="color: #64748b; font-size: 13px;">Если у вас есть вопросы, свяжитесь с нами по телефону +7 (936) 256-89-50 или в <a href="https://t.me/tophit_new">Telegram</a>.</p>
        </div>
        <p style="text-align: center; color: #94a3b8; font-size: 12px; margin-top: 16px;">© hittabak — hittabak.ru</p>
      </div>
    `,
  });
}
