/* eslint-disable @typescript-eslint/no-explicit-any */
import test from "node:test";
import assert from "node:assert/strict";
import { escapeHtml, sendEmail, sendNewInquiryNotification } from "../../src/lib/mail";

test("mail templates escape untrusted HTML and have no transport fallback", async () => {
  assert.equal(escapeHtml("<img src=x onerror=alert(1)>"), "&lt;img src=x onerror=alert(1)&gt;");
  const oldUrl = process.env.SMTP_API_URL;
  delete process.env.SMTP_API_URL;
  assert.deepEqual(await sendEmail({ to: "a@example.test", subject: "x", html: "x" }), {
    success: false,
    error: "Mail transport unavailable",
  });
  process.env.SMTP_API_URL = oldUrl;

  process.env.SMTP_API_URL = "https://mail.test";
  process.env.SMTP_API_KEY = "test";
  process.env.SMTP_FROM_EMAIL = "n@example.test";
  process.env.ADMIN_EMAIL = "admin@example.test";
  let body = "";
  (globalThis as any).fetch = async (_url: unknown, options: any) => {
    body = options.body;
    return new Response('{"id":"mock"}');
  };
  await sendNewInquiryNotification({
    name: "<b>Eve</b>",
    email: "eve@example.test",
    phone: "+70000000000",
    items: "[]",
    total: 1,
    address: "<script>x</script>",
    comment: "<img src=x>",
    preferredContact: "email",
    deliveryMethod: "pickup",
  });
  assert.doesNotMatch(JSON.parse(body).html, /<b>Eve|<script>|<img src=x>/);
});

test("mail timeout is sanitized and secrets are not logged", async () => {
  process.env.SMTP_API_URL = "https://mail.test";
  process.env.SMTP_API_KEY = "secret-mail-key";
  process.env.SMTP_FROM_EMAIL = "n@example.test";
  const messages: string[] = [];
  const oldError = console.error;
  console.error = (...args: unknown[]) => messages.push(JSON.stringify(args));
  (globalThis as any).fetch = async (_url: unknown, options: any) =>
    new Promise((_resolve, reject) => options.signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))));
  const result = await sendEmail({ to: "a@example.test", subject: "token-secret", html: "token-secret" });
  console.error = oldError;
  assert.equal(result.success, false);
  assert.doesNotMatch(messages.join(" "), /secret-mail-key|token-secret|a@example/);
});