import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { prisma } from "@/lib/prisma";
import type { Metadata } from "next";
import FaqAccordion from "@/components/FaqAccordion";

export const metadata: Metadata = {
  title: "FAQ — hittabak",
  description: "Часто задаваемые вопросы о продукции hittabak. Ответы на популярные вопросы об устройствах и стиках.",
  alternates: { canonical: "https://hittabak.ru/faq" },
  openGraph: {
    title: "FAQ — hittabak",
    description: "Часто задаваемые вопросы о продукции hittabak.",
    locale: "ru_RU",
    type: "website",
    url: "https://hittabak.ru/faq",
  },
};

export const revalidate = 60;

export default async function FaqPage() {
  const items = await prisma.faqItem.findMany({
    where: { published: true },
    orderBy: { order: "asc" },
  });

  const categories = [...new Set(items.map((i) => i.category))];

  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };

  return (
    <>
      <Header />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      <main className="flex-1 pb-16 lg:pb-0">
        <div className="max-w-3xl mx-auto px-4 py-8">
          <h1 className="font-heading text-3xl sm:text-4xl font-extrabold text-text-dark mb-8">Частые вопросы</h1>

          {items.length > 0 ? (
            <>
              {categories.map((cat) => (
                <div key={cat} className="mb-8">
                  <h2 className="text-lg font-bold text-text-dark mb-4 capitalize">{cat}</h2>
                  <FaqAccordion items={items.filter((i) => i.category === cat).map((i) => ({ question: i.question, answer: i.answer }))} />
                </div>
              ))}
            </>
          ) : (
            <div className="text-center py-20">
              <p className="text-text-gray text-lg">Ответы на вопросы пока не опубликованы.</p>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
