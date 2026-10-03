"use client";

import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Link from "next/link";
import { useState, useEffect, startTransition } from "react";
import { getCart, clearCart } from "@/lib/localCart";

interface CartProduct { id: string; name: string; price: number; image?: string; packSize?: number | null; }
interface CartItemDisplay { productId: string; quantity: number; isPack: boolean; product: CartProduct; }
interface PublicSettings { disableCheckoutEmailVerification: boolean; }

export default function CheckoutPage() {
  const [items, setItems] = useState<CartItemDisplay[]>([]);
  const [form, setForm] = useState({
    name: "", email: "", phone: "+7", address: "", comment: "",
    preferredContact: "phone", deliveryMethod: "cdek",
  });
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [inquiryId, setInquiryId] = useState("");
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [emailVerified, setEmailVerified] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [codeSending, setCodeSending] = useState(false);
  const [codeError, setCodeError] = useState("");
  const [codeVerifying, setCodeVerifying] = useState(false);
  const [settings, setSettings] = useState<PublicSettings>({ disableCheckoutEmailVerification: false });

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.ok ? r.json() : null)
      .then((data: PublicSettings | null) => {
        if (data) {
          startTransition(() => setSettings({ disableCheckoutEmailVerification: Boolean(data.disableCheckoutEmailVerification) }));
        }
      })
      .catch(() => null);
  }, []);

  useEffect(() => {
    const cartItems = getCart();
    if (cartItems.length === 0) {
      startTransition(() => { setItems([]); setPageLoading(false); });
      return;
    }
    const ids = [...new Set(cartItems.map((i) => i.productId))];
    fetch(`/api/products?ids=${ids.join(",")}`)
      .then((r) => r.ok ? r.json() : [])
      .then((products: CartProduct[]) => {
        const productMap = new Map(products.map((p) => [p.id, p]));
        const displayItems: CartItemDisplay[] = cartItems
          .map((ci) => {
            const product = productMap.get(ci.productId);
            if (!product) return null;
            return { productId: ci.productId, quantity: ci.quantity, isPack: ci.isPack, product };
          })
          .filter((x): x is CartItemDisplay => x !== null);
        startTransition(() => { setItems(displayItems); setPageLoading(false); });
      })
      .catch(() => startTransition(() => setPageLoading(false)));
  }, []);

  const total = items.reduce((sum, item) => {
    if (item.isPack) return sum + Math.round(item.product.price * item.quantity * 0.9);
    return sum + item.product.price * item.quantity;
  }, 0);

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    const nameRegex = /^[a-zA-Zа-яА-ЯёЁ\s-]+$/;

    if (!form.name.trim()) {
      errors.name = "Укажите имя";
    } else if (!nameRegex.test(form.name.trim())) {
      errors.name = "Имя должно содержать только буквы";
    }

    if (!form.email.trim()) {
      errors.email = "Укажите email";
    } else if (!form.email.includes("@")) {
      errors.email = "Email должен содержать @";
    }

    if (!form.phone.trim()) {
      errors.phone = "Укажите телефон";
    } else if (!form.phone.startsWith("+7")) {
      errors.phone = "Телефон должен начинаться с +7";
    } else if (form.phone.replace(/\D/g, "").length < 11) {
      errors.phone = "Телефон должен содержать 11 цифр";
    }

    if (form.deliveryMethod !== "pickup" && form.address.trim().length < 10) {
      errors.address = "Укажите полный адрес доставки";
    }

    if (!["phone", "telegram", "whatsapp", "email"].includes(form.preferredContact)) {
      errors.preferredContact = "Выберите способ связи";
    }

    if (!["cdek", "russian_post", "pickup"].includes(form.deliveryMethod)) {
      errors.deliveryMethod = "Выберите способ доставки";
    }

    if (form.comment.length > 2000) {
      errors.comment = "Комментарий не должен превышать 2000 символов";
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSendCode = async () => {
    if (!form.email.trim() || !form.email.includes("@")) {
      setFieldErrors((p) => ({ ...p, email: "Укажите корректный email" }));
      return;
    }
    setCodeSending(true);
    setCodeError("");
    try {
      const res = await fetch("/api/email/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setCodeError(data.error || "Ошибка отправки кода"); }
      else { setCodeSent(true); }
    } catch { setCodeError("Ошибка сети"); }
    setCodeSending(false);
  };

  const handleVerifyCode = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      setCodeError("Введите 6-значный код");
      return;
    }
    setCodeVerifying(true);
    setCodeError("");
    try {
      const res = await fetch("/api/email/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email.trim(), code: verificationCode }),
      });
      const data = await res.json();
      if (!res.ok) { setCodeError(data.error || "Неверный код"); }
      else { setEmailVerified(true); setCodeError(""); }
    } catch { setCodeError("Ошибка сети"); }
    setCodeVerifying(false);
  };

  const handleSubmit = async () => {
    setError("");
    if (!validateForm()) return;
    if (!settings.disableCheckoutEmailVerification && !emailVerified) { setError("Подтвердите email"); return; }
    if (items.length === 0) { setError("Корзина пуста"); return; }

    setLoading(true);
    try {
      const res = await fetch("/api/inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          items: items.map((i) => ({
            productId: i.productId,
            productName: i.product.name,
            quantity: i.quantity,
            price: i.product.price,
            isPack: i.isPack,
          })),
          comment: form.comment.trim(),
          preferredContact: form.preferredContact,
          deliveryMethod: form.deliveryMethod,
          address: form.deliveryMethod === "pickup"
            ? "Москва, ул. Складочная, 1, стр. 18"
            : form.address.trim(),
          total,
          emailVerified: settings.disableCheckoutEmailVerification ? false : emailVerified,
        }),
      });
      const data = await res.json();
      setLoading(false);
      if (!res.ok) { setError(data.error || "Ошибка отправки заявки"); return; }
      clearCart();
      setInquiryId(data.inquiryId);
    } catch {
      setLoading(false);
      setError("Ошибка сети. Попробуйте ещё раз.");
    }
  };

  if (inquiryId) {
    return (
      <>
        <Header />
        <main className="flex-1 bg-bg-light">
          <div className="max-w-md mx-auto px-4 py-10 text-center">
            <div className="bg-bg-white rounded-xl border border-border p-8">
              <div className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-text-dark mb-2">Заявка отправлена!</h1>
              <p className="text-text-gray mb-4">Номер заявки: #{inquiryId.slice(0, 8)}</p>
              <p className="text-sm text-text-gray mb-6">Мы свяжемся с вами по указанным контактным данным для подтверждения заказа</p>
              <Link href="/catalog" className="inline-block bg-primary text-white px-6 py-2.5 rounded-lg hover:bg-primary-dark font-medium">
                Продолжить покупки
              </Link>
            </div>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="flex-1 bg-bg-light">
        <div className="max-w-4xl mx-auto px-3 sm:px-4 py-6 sm:py-8">
          <h1 className="text-xl sm:text-2xl font-bold text-text-dark mb-4 sm:mb-6">Оформление заявки</h1>

          {pageLoading && <p className="text-text-gray text-center py-8">Загрузка...</p>}

          {!pageLoading && items.length === 0 && (
            <div className="bg-bg-white rounded-xl border border-border p-8 text-center">
              <p className="text-text-gray mb-4">Корзина пуста</p>
              <Link href="/catalog" className="inline-block bg-primary text-white px-6 py-2.5 rounded-lg hover:bg-primary-dark font-medium">
                Перейти в каталог
              </Link>
            </div>
          )}

          {!pageLoading && items.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
              <div className="md:col-span-2 space-y-4">
                {/* Cart items */}
                <div className="bg-bg-white rounded-xl border border-border p-4 sm:p-6">
                  <h2 className="text-base sm:text-lg font-bold text-text-dark mb-3 sm:mb-4">Состав заказа</h2>
                  <div className="space-y-3">
                    {items.map((item) => (
                      <div key={`${item.productId}-${item.isPack}`} className="flex items-center gap-4 p-3 bg-bg-light rounded-lg">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-text-dark">{item.product.name}</p>
                          <p className="text-xs text-text-gray">
                            {item.quantity} шт. × {item.product.price.toLocaleString("ru-RU")} ₽
                            {item.isPack && " (упаковка, −10%)"}
                          </p>
                        </div>
                        <span className="font-medium text-text-dark">
                          {(item.isPack
                            ? Math.round(item.product.price * item.quantity * 0.9)
                            : item.product.price * item.quantity
                          ).toLocaleString("ru-RU")} ₽
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Contact form */}
                <div className="bg-bg-white rounded-xl border border-border p-4 sm:p-6">
                  <h2 className="text-base sm:text-lg font-bold text-text-dark mb-3 sm:mb-4">Контактные данные</h2>
                  {error && <p className="text-danger text-sm mb-4 p-3 bg-danger/5 rounded-lg">{error}</p>}
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm text-text-gray mb-1 block">Имя и фамилия *</label>
                      <input
                        type="text"
                        value={form.name}
                        onChange={(e) => { setForm({ ...form, name: e.target.value }); setFieldErrors((p) => ({ ...p, name: "" })); }}
                        placeholder="Иван Иванов"
                        className={`w-full border rounded-lg px-4 py-2.5 focus:outline-none focus:border-primary ${fieldErrors.name ? "border-danger" : "border-border"}`}
                      />
                      {fieldErrors.name && <p className="text-danger text-xs mt-1">{fieldErrors.name}</p>}
                    </div>
                    <div>
                      <label className="text-sm text-text-gray mb-1 block">Email *</label>
                      <div className="flex gap-2">
                        <input
                          type="email"
                          value={form.email}
                          onChange={(e) => {
                            setForm({ ...form, email: e.target.value });
                            setFieldErrors((p) => ({ ...p, email: "" }));
                            if (!settings.disableCheckoutEmailVerification && emailVerified) { setEmailVerified(false); setCodeSent(false); setVerificationCode(""); }
                          }}
                          placeholder="example@mail.ru"
                          disabled={!settings.disableCheckoutEmailVerification && emailVerified}
                          className={`flex-1 border rounded-lg px-4 py-2.5 focus:outline-none focus:border-primary ${fieldErrors.email ? "border-danger" : "border-border"} ${!settings.disableCheckoutEmailVerification && emailVerified ? "bg-green-50 border-green-300" : ""}`}
                        />
                        {!settings.disableCheckoutEmailVerification && !emailVerified && !codeSent && (
                          <button
                            type="button"
                            onClick={handleSendCode}
                            disabled={codeSending || !form.email.includes("@")}
                            className="px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark disabled:opacity-50 whitespace-nowrap"
                          >
                            {codeSending ? "..." : "Отправить код"}
                          </button>
                        )}
                        {!settings.disableCheckoutEmailVerification && emailVerified && (
                          <span className="flex items-center text-green-600 text-sm font-medium px-3">✓ Подтверждён</span>
                        )}
                      </div>
                      {fieldErrors.email && <p className="text-danger text-xs mt-1">{fieldErrors.email}</p>}
                      {settings.disableCheckoutEmailVerification && (
                        <p className="text-xs text-text-gray mt-2">Подтверждение email отключено администратором.</p>
                      )}
                      {codeSent && !settings.disableCheckoutEmailVerification && !emailVerified && (
                        <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                          <p className="text-sm text-blue-700 mb-2">Код отправлен на {form.email}</p>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={verificationCode}
                              onChange={(e) => { setVerificationCode(e.target.value.replace(/\D/g, "").slice(0, 6)); setCodeError(""); }}
                              placeholder="6-значный код"
                              maxLength={6}
                              className="flex-1 border border-blue-300 rounded-lg px-4 py-2 text-center text-lg tracking-widest focus:outline-none focus:border-primary"
                            />
                            <button
                              type="button"
                              onClick={handleVerifyCode}
                              disabled={codeVerifying || verificationCode.length !== 6}
                              className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                            >
                              {codeVerifying ? "..." : "Подтвердить"}
                            </button>
                          </div>
                          {codeError && <p className="text-danger text-xs mt-1">{codeError}</p>}
                          <button type="button" onClick={handleSendCode} className="text-xs text-blue-600 hover:underline mt-2">
                            Отправить код повторно
                          </button>
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="text-sm text-text-gray mb-1 block">Телефон *</label>
                      <input
                        type="tel"
                        value={form.phone}
                        onChange={(e) => { setForm({ ...form, phone: e.target.value }); setFieldErrors((p) => ({ ...p, phone: "" })); }}
                        placeholder="+7 (999) 123-45-67"
                        className={`w-full border rounded-lg px-4 py-2.5 focus:outline-none focus:border-primary ${fieldErrors.phone ? "border-danger" : "border-border"}`}
                      />
                      {fieldErrors.phone && <p className="text-danger text-xs mt-1">{fieldErrors.phone}</p>}
                    </div>

                    <fieldset>
                      <legend className="text-sm text-text-gray mb-2">Предпочитаемый способ связи *</legend>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {[
                          { value: "phone", label: "Телефон" },
                          { value: "telegram", label: "Telegram" },
                          { value: "whatsapp", label: "WhatsApp" },
                          { value: "email", label: "Почта" },
                        ].map((option) => (
                          <label key={option.value} className={`cursor-pointer rounded-lg border px-3 py-2.5 text-center text-sm transition-colors ${
                            form.preferredContact === option.value ? "border-primary bg-primary text-white" : "border-border bg-bg-light text-text-gray"
                          }`}>
                            <input
                              type="radio"
                              name="preferredContact"
                              value={option.value}
                              checked={form.preferredContact === option.value}
                              onChange={(event) => {
                                setForm({ ...form, preferredContact: event.target.value });
                                setFieldErrors((current) => ({ ...current, preferredContact: "" }));
                              }}
                              className="sr-only"
                            />
                            {option.label}
                          </label>
                        ))}
                      </div>
                      {fieldErrors.preferredContact && <p className="text-danger text-xs mt-1">{fieldErrors.preferredContact}</p>}
                    </fieldset>

                    {/* Delivery */}
                    <fieldset className="pt-2">
                      <legend className="text-sm text-text-gray mb-2">Способ доставки *</legend>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {[
                          { value: "cdek", label: "СДЭК" },
                          { value: "russian_post", label: "Почта России" },
                          { value: "pickup", label: "Самовывоз" },
                        ].map((option) => (
                          <label key={option.value} className={`cursor-pointer rounded-lg border px-3 py-2.5 text-center text-sm font-medium transition-colors ${
                            form.deliveryMethod === option.value
                              ? option.value === "pickup" ? "border-green-600 bg-green-600 text-white" : "border-primary bg-primary text-white"
                              : "border-border bg-bg-light text-text-gray"
                          }`}>
                            <input
                              type="radio"
                              name="deliveryMethod"
                              value={option.value}
                              checked={form.deliveryMethod === option.value}
                              onChange={(event) => {
                                setForm({ ...form, deliveryMethod: event.target.value, address: "" });
                                setFieldErrors((current) => ({ ...current, deliveryMethod: "", address: "" }));
                              }}
                              className="sr-only"
                            />
                            {option.label}
                          </label>
                        ))}
                      </div>
                      {fieldErrors.deliveryMethod && <p className="text-danger text-xs mt-1">{fieldErrors.deliveryMethod}</p>}
                    </fieldset>
                    {form.deliveryMethod === "pickup" && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">
                        <p className="font-medium">Москва, ул. Складочная, 1, стр. 18</p>
                        <p>Пн–Пт с 11:00 до 16:00, выходной — Сб и Вск</p>
                      </div>
                    )}
                    {form.deliveryMethod !== "pickup" && (
                      <div>
                        <label className="text-sm text-text-gray mb-1 block">
                          {form.deliveryMethod === "cdek" ? "Адрес или пункт выдачи СДЭК *" : "Почтовый адрес и индекс *"}
                        </label>
                        <textarea
                          value={form.address}
                          onChange={(e) => { setForm({ ...form, address: e.target.value }); setFieldErrors((p) => ({ ...p, address: "" })); }}
                          placeholder={form.deliveryMethod === "cdek"
                            ? "Город, адрес пункта СДЭК или адрес доставки"
                            : "Индекс, город, улица, дом, квартира"}
                          className={`w-full border rounded-lg px-4 py-2.5 focus:outline-none focus:border-primary ${fieldErrors.address ? "border-danger" : "border-border"}`}
                          rows={2}
                        />
                        {fieldErrors.address && <p className="text-danger text-xs mt-1">{fieldErrors.address}</p>}
                      </div>
                    )}
                    <div>
                      <label className="text-sm text-text-gray mb-1 block">Комментарий</label>
                      <textarea
                        value={form.comment}
                        onChange={(e) => {
                          setForm({ ...form, comment: e.target.value });
                          setFieldErrors((current) => ({ ...current, comment: "" }));
                        }}
                        placeholder="Дополнительные пожелания к заказу или доставке"
                        maxLength={2000}
                        className={`w-full border rounded-lg px-4 py-2.5 focus:outline-none focus:border-primary ${fieldErrors.comment ? "border-danger" : "border-border"}`}
                        rows={3}
                      />
                      <div className="flex justify-between gap-2 mt-1">
                        {fieldErrors.comment ? <p className="text-danger text-xs">{fieldErrors.comment}</p> : <span />}
                        <span className="text-xs text-text-light">{form.comment.length}/2000</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleSubmit}
                    disabled={loading || items.length === 0}
                    className="w-full mt-4 bg-accent hover:bg-accent-dark text-white py-3 rounded-lg transition-colors font-medium text-lg disabled:opacity-50"
                  >
                    {loading ? "Отправка..." : "Оставить заявку"}
                  </button>
                </div>
              </div>

              {/* Order summary sidebar */}
              <div>
                <div className="bg-bg-white rounded-xl border border-border p-6 sticky top-4">
                  <h2 className="text-lg font-bold text-text-dark mb-4">Ваш заказ</h2>
                  <div className="space-y-2 text-sm mb-4">
                    {items.map((item) => (
                      <div key={`${item.productId}-${item.isPack}`} className="flex justify-between text-text-gray">
                        <span className="truncate mr-2">{item.product.name} × {item.quantity}</span>
                        <span className="flex-shrink-0">
                          {(item.isPack
                            ? Math.round(item.product.price * item.quantity * 0.9)
                            : item.product.price * item.quantity
                          ).toLocaleString("ru-RU")} ₽
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-border pt-3 flex justify-between font-bold text-lg">
                    <span>Итого:</span>
                    <span className="text-primary">{total.toLocaleString("ru-RU")} ₽</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
