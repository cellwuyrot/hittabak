import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { prisma } from "@/lib/prisma";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Где купить — hittabak",
  description: "Найдите ближайший магазин hittabak на карте. Адреса точек продаж по всей России.",
  alternates: { canonical: "https://hittabak.ru/stores" },
  openGraph: {
    title: "Где купить — hittabak",
    description: "Найдите ближайший магазин hittabak на карте.",
    locale: "ru_RU",
    type: "website",
    url: "https://hittabak.ru/stores",
  },
};

export const revalidate = 60;

export default async function StoresPage() {
  const stores = await prisma.store.findMany({
    where: { active: true },
    orderBy: { city: "asc" },
  });

  const cities = [...new Set(stores.map((s) => s.city))];

  return (
    <>
      <Header />
      <main className="flex-1 pb-16 lg:pb-0">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <h1 className="font-heading text-3xl sm:text-4xl font-extrabold text-text-dark mb-8">Где купить</h1>

          <div className="grid grid-cols-1 gap-8">
            {/* Store list */}
            <div className="space-y-6 max-h-[600px] overflow-y-auto">
              {cities.length > 0 ? cities.map((city) => (
                <div key={city}>
                  <h2 className="text-lg font-bold text-text-dark mb-3">{city}</h2>
                  <div className="space-y-3">
                    {stores.filter((s) => s.city === city).map((store) => (
                      <div key={store.id} className="bg-white rounded-xl border border-border p-4">
                        <h3 className="text-sm font-semibold text-text-dark">{store.name}</h3>
                        <p className="text-xs text-text-gray mt-1">{store.address}</p>
                        {store.phone && <p className="text-xs text-text-gray mt-1">{store.phone}</p>}
                        {store.hours && <p className="text-xs text-text-light mt-1">{store.hours}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )) : (
                <div className="text-center py-10">
                  <p className="text-text-gray">Данные о точках продаж не опубликованы.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
