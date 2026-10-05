const TIMEOUT_MS = Math.max(1, Math.min(Number(process.env.SMTP_TIMEOUT_MS || 8_000), 30_000));
export function escapeHtml(value: unknown): string { return String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]!)); }
function validEmail(value: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && !/[\r\n]/.test(value); }
function validPhone(value: string) { return /^[+()\d .-]{3,32}$/.test(value); }
function config() {
  const endpoint = process.env.SMTP_API_URL; const key = process.env.SMTP_API_KEY; const from = process.env.SMTP_FROM_EMAIL;
  if (!endpoint || !key || !from) return null;
  const url = new URL(endpoint);
  const localHttp = process.env.NODE_ENV !== "production" && process.env.ALLOW_INSECURE_LOCAL_SMTP === "true" && ["localhost", "127.0.0.1"].includes(url.hostname);
  if (url.protocol !== "https:" && !localHttp) return null;
  return { endpoint: url.toString().replace(/\/$/, ""), key, from };
}
interface SendEmailOptions { to: string; subject: string; html: string }
export async function sendEmail({ to, subject, html }: SendEmailOptions): Promise<{ success: boolean; id?: string; error?: string }> {
  const cfg = config();
  if (!cfg || !validEmail(to)) return { success: false, error: "Mail transport unavailable" };
  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${cfg.endpoint}/api/emails`, { method: "POST", signal: controller.signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.key}` },
      body: JSON.stringify({ from_email: cfg.from, to, subject: String(subject).replace(/[\r\n]/g, " ").slice(0, 200), html }) });
    if (!res.ok) { console.error("Mail transport failed", { status: res.status }); return { success: false, error: "Mail transport failed" }; }
    const data = await res.json().catch(() => ({})); return { success: true, id: typeof data.id === "string" ? data.id : undefined };
  } catch (error) { console.error("Mail transport failed", { reason: error instanceof DOMException && error.name === "AbortError" ? "timeout" : "network" }); return { success: false, error: "Mail transport failed" }; }
  finally { clearTimeout(timeout); }
}
export async function sendAdminNotification(subject: string, html: string) {
  const email = process.env.ADMIN_EMAIL; return email ? sendEmail({ to: email, subject, html }) : { success: false, error: "Mail transport unavailable" };
}
export async function sendVerificationCode(email: string, code: string) {
  return sendEmail({ to: email, subject: "Код подтверждения — hittabak", html: `<div><h1>hittabak</h1><p>Ваш код подтверждения:</p><strong>${escapeHtml(code)}</strong><p>Код действителен 10 минут. Если вы не запрашивали код, проигнорируйте письмо.</p></div>` });
}
export async function sendPasswordResetEmail(email: string, resetUrl: string) {
  const parsed = new URL(resetUrl); const trusted = new URL(process.env.APP_ORIGIN || "https://invalid.local");
  if (parsed.origin !== trusted.origin) return { success: false, error: "Invalid reset URL" };
  return sendEmail({ to: email, subject: "Восстановление пароля — hittabak", html: `<div><h1>hittabak</h1><p>Для смены пароля откройте ссылку:</p><p><a href="${escapeHtml(parsed.toString())}">Восстановить пароль</a></p><p>Если вы не запрашивали сброс, проигнорируйте письмо.</p></div>` });
}
export async function sendNewInquiryNotification(inquiry: { name:string; email:string; phone:string; items:string; total:number; address:string; comment:string; preferredContact:string; deliveryMethod:string }) {
  let items: unknown[] = []; try { const parsed = JSON.parse(inquiry.items || "[]"); if (Array.isArray(parsed)) items = parsed; } catch {}
  const itemsHtml = items.map((raw) => { const item = raw as Record<string, unknown>; return `<li>${escapeHtml(item.productName || item.name || "Товар")} × ${escapeHtml(item.quantity || 1)}</li>`; }).join("");
  const email = validEmail(inquiry.email) ? `<a href="mailto:${escapeHtml(inquiry.email)}">${escapeHtml(inquiry.email)}</a>` : escapeHtml(inquiry.email);
  const phone = validPhone(inquiry.phone) ? `<a href="tel:${escapeHtml(inquiry.phone)}">${escapeHtml(inquiry.phone)}</a>` : escapeHtml(inquiry.phone);
  return sendAdminNotification(`Новая заявка — hittabak`, `<div><h2>Новая заявка на сайте hittabak</h2><p>Имя: ${escapeHtml(inquiry.name)}</p><p>Email: ${email}</p><p>Телефон: ${phone}</p><p>Адрес: ${escapeHtml(inquiry.address)}</p><p>Комментарий: ${escapeHtml(inquiry.comment)}</p><p>Сумма: ${escapeHtml(inquiry.total)} ₽</p><ul>${itemsHtml}</ul></div>`);
}
export async function sendStatusUpdateNotification(email:string, name:string, status:string, inquiryId:string) {
  const labels: Record<string,string> = { new:"Новая", processing:"В обработке", confirmed:"Подтверждена", shipped:"Отправлена", delivered:"Доставлена", cancelled:"Отменена" };
  return sendEmail({ to: email, subject: "Статус заявки обновлён — hittabak", html: `<div><p>Здравствуйте, ${escapeHtml(name)}!</p><p>Статус заявки <strong>#${escapeHtml(inquiryId.slice(0,8))}</strong>: ${escapeHtml(labels[status] || status)}</p></div>` });
}
