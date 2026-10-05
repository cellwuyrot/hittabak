"use client";

import { useState } from "react";

export default function ContactForm() {
  const [form, setForm] = useState({ name: "", email: "", phone: "", subject: "", message: "" });
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("sending");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setStatus("sent");
        setForm({ name: "", email: "", phone: "", subject: "", message: "" });
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  };

  if (status === "sent") {
    return (
      <div className="bg-success/10 text-success rounded-xl p-6 text-center">
        <p className="font-bold">Сообщение отправлено!</p>
        <p className="text-sm mt-1">Мы свяжемся с вами в ближайшее время</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <label htmlFor="contact-name" className="block text-sm font-medium">Ваше имя</label>
      <input
        id="contact-name"
        type="text"
        maxLength={100}
        placeholder="Ваше имя"
        required
        value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })}
        className="w-full px-4 py-3 border border-border rounded-xl text-sm focus:border-accent focus:outline-none"
      />
      <label htmlFor="contact-email" className="block text-sm font-medium">Email</label>
      <input
        id="contact-email"
        type="email"
        maxLength={254}
        placeholder="Email"
        required
        value={form.email}
        onChange={(e) => setForm({ ...form, email: e.target.value })}
        className="w-full px-4 py-3 border border-border rounded-xl text-sm focus:border-accent focus:outline-none"
      />
      <label htmlFor="contact-phone" className="block text-sm font-medium">Телефон (необязательно)</label>
      <input
        id="contact-phone"
        type="tel"
        maxLength={32}
        placeholder="Телефон"
        value={form.phone}
        onChange={(e) => setForm({ ...form, phone: e.target.value })}
        className="w-full px-4 py-3 border border-border rounded-xl text-sm focus:border-accent focus:outline-none"
      />
      <label htmlFor="contact-subject" className="block text-sm font-medium">Тема (необязательно)</label>
      <input
        id="contact-subject"
        type="text"
        maxLength={150}
        placeholder="Тема обращения"
        value={form.subject}
        onChange={(e) => setForm({ ...form, subject: e.target.value })}
        className="w-full px-4 py-3 border border-border rounded-xl text-sm focus:border-accent focus:outline-none"
      />
      <label htmlFor="contact-message" className="block text-sm font-medium">Сообщение</label>
      <textarea
        id="contact-message"
        maxLength={4000}
        aria-describedby="contact-status"
        placeholder="Сообщение"
        required
        rows={4}
        value={form.message}
        onChange={(e) => setForm({ ...form, message: e.target.value })}
        className="w-full px-4 py-3 border border-border rounded-xl text-sm focus:border-accent focus:outline-none resize-none"
      />
      <p id="contact-status" aria-live="polite" className="text-danger text-xs">{status === "error" ? "Проверьте данные или попробуйте позже." : ""}</p>
      <button
        type="submit"
        disabled={status === "sending"}
        className="w-full bg-accent hover:bg-accent-dark text-white font-bold py-3 rounded-xl transition-colors disabled:opacity-50"
      >
        {status === "sending" ? "Отправка..." : "Отправить"}
      </button>
    </form>
  );
}
