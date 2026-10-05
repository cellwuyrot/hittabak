import Header from "@/components/Header";
import Footer from "@/components/Footer";
import type { Metadata } from "next";
import ContactForm from "@/components/ContactForm";
import { publicBusinessConfig } from "@/lib/publicConfig";

export const metadata: Metadata = {
  title: "Контакты — hittabak",
  description: "Свяжитесь с hittabak. Телефон, email, адрес офиса, форма обратной связи.",
  alternates: { canonical: "https://hittabak.ru/contacts" },
  openGraph: {
    title: "Контакты — hittabak",
    description: "Свяжитесь с hittabak. Телефон, email, адрес офиса, форма обратной связи.",
    locale: "ru_RU",
    type: "website",
    url: "https://hittabak.ru/contacts",
  },
};

export default function ContactsPage() {
  const { supportEmail, supportPhone } = publicBusinessConfig();
  return (
    <>
      <Header />
      <main className="flex-1 pb-16 lg:pb-0">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <h1 className="font-heading text-3xl sm:text-4xl font-extrabold text-text-dark mb-8">Контакты</h1>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <div className="space-y-6">
                {supportPhone && <div className="bg-white rounded-xl border border-border p-5"><h3 className="text-sm font-bold text-text-dark mb-2">Телефон</h3><p>{supportPhone}</p></div>}
                {supportEmail && <div className="bg-white rounded-xl border border-border p-5"><h3 className="text-sm font-bold text-text-dark mb-2">Email</h3><p>{supportEmail}</p></div>}

                <div className="bg-white rounded-xl border border-border p-5">
                  <h3 className="text-sm font-bold text-text-dark mb-2">Мессенджеры</h3>
                  <div className="flex gap-3">
                    <a href="https://t.me/tophit_new" target="_blank" rel="nofollow noopener noreferrer"
                      className="px-4 py-2 bg-[#229ED9]/10 text-[#229ED9] rounded-lg text-sm font-medium hover:bg-[#229ED9]/20 transition-colors">
                      Telegram
                    </a>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h2 className="text-lg font-bold text-text-dark mb-4">Форма обратной связи</h2>
              <ContactForm />
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
