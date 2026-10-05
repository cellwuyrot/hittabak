import { authorizeAdmin, adminDenied } from "@/lib/adminAuthorization";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";


// Распознаваемые колонки таблицы отзывов
const KNOWN_COLUMNS: Record<string, string[]> = {
  product: ["товар", "название товара", "название", "наименование", "product", "name", "код", "артикул", "code", "sku", "штрихкод", "barcode", "slug"],
  author: ["автор", "имя", "имя автора", "клиент", "покупатель", "author", "user"],
  rating: ["оценка", "рейтинг", "rating", "звёзды", "звезды", "stars", "балл"],
  text: ["отзыв", "текст", "текст отзыва", "комментарий", "review", "text", "comment", "содержание"],
  date: ["дата", "date", "created", "создан", "дата отзыва"],
  published: ["опубликован", "публикация", "статус", "published", "status", "видимость"],
};

function autoDetectColumns(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  for (const header of headers) {
    const lower = header.toLowerCase().trim();
    if (lower === "№" || lower === "#" || lower === "номер" || lower === "n") continue;
    for (const [field, aliases] of Object.entries(KNOWN_COLUMNS)) {
      if (aliases.includes(lower) && !Object.values(mapping).includes(field)) {
        mapping[header] = field;
        break;
      }
    }
  }
  return mapping;
}

function findHeaderRow(aoa: unknown[][]): number {
  let bestRow = 0;
  let bestScore = 0;
  for (let i = 0; i < Math.min(20, aoa.length); i++) {
    const row = aoa[i];
    if (!row) continue;
    const nonEmpty = row.filter((c) => c !== undefined && c !== null && String(c).trim() !== "");
    if (nonEmpty.length < 2) continue;
    const lower = nonEmpty.map((c) => String(c).toLowerCase().trim());
    const knownHeaders = lower.filter((l) =>
      Object.values(KNOWN_COLUMNS).some((aliases) => aliases.includes(l)),
    );
    const score = knownHeaders.length * 5 + nonEmpty.length;
    if (score > bestScore) {
      bestScore = score;
      bestRow = i;
    }
  }
  return bestRow;
}

export const maxDuration = 60;

// GET — скачать шаблон таблицы отзывов
export async function GET(request: Request) {
  const auth = await authorizeAdmin(request, "data:import");
  if (!auth.ok) return adminDenied(auth);

  const headers = ["Товар", "Автор", "Оценка", "Текст отзыва", "Дата", "Опубликован"];
  const example = [
    ["Название товара или артикул", "Василий А.", 5, "Отличный товар, всем доволен! Доставка быстрая.", "2026-07-01", "да"],
    ["Другой товар", "Ольга К.", 4, "Хорошее качество, рекомендую.", "", "да"],
  ];
  const ws = XLSX.utils.aoa_to_sheet([headers, ...example]);
  ws["!cols"] = [{ wch: 32 }, { wch: 16 }, { wch: 8 }, { wch: 50 }, { wch: 14 }, { wch: 14 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Отзывы");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="reviews-template.xlsx"',
    },
  });
}

// PUT — распарсить загруженный файл и вернуть строки + автоопределение колонок
export async function PUT(request: Request) {
  const auth = await authorizeAdmin(request, "data:import");
  if (!auth.ok) return adminDenied(auth);

  let formData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json({ error: "Файл слишком большой. Максимум ~10 МБ." }, { status: 413 });
  }
  const file = formData.get("file") as File | null;
  if (!file) return Response.json({ error: "Файл не выбран" }, { status: 400 });
  if (file.size > 10 * 1024 * 1024) {
    return Response.json({ error: "Файл слишком большой. Максимум 10 МБ." }, { status: 413 });
  }

  const fileName = file.name.toLowerCase();
  if (!fileName.endsWith(".csv") && !fileName.endsWith(".xlsx") && !fileName.endsWith(".xls")) {
    return Response.json({ error: "Поддерживаемые форматы: CSV, XLSX, XLS" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });

  if (aoa.length < 2) {
    return Response.json({ error: "Файл пуст или содержит слишком мало данных" }, { status: 400 });
  }

  const headerRowIdx = findHeaderRow(aoa);
  const headerRow = aoa[headerRowIdx];
  const headers: string[] = headerRow
    .map((c) => (c !== undefined && c !== null ? String(c).trim() : ""))
    .filter((h) => h !== "");

  if (headers.length < 2) {
    return Response.json({ error: "Не удалось определить заголовки колонок" }, { status: 400 });
  }

  const colIndices: number[] = [];
  for (let j = 0; j < headerRow.length; j++) {
    const val = headerRow[j];
    if (val !== undefined && val !== null && String(val).trim() !== "") colIndices.push(j);
  }

  const autoMap = autoDetectColumns(headers);
  const productHeader = Object.entries(autoMap).find(([, v]) => v === "product")?.[0];

  const rows: Record<string, string>[] = [];
  for (let i = headerRowIdx + 1; i < aoa.length; i++) {
    const row = aoa[i];
    if (!row) continue;
    const nonEmpty = row.filter((c) => c !== undefined && c !== null && String(c).trim() !== "");
    if (nonEmpty.length < 1) continue;

    // строка не должна повторять заголовок
    const firstCell = row[colIndices[0]];
    if (firstCell !== undefined && String(firstCell).trim() === headers[0]) continue;

    // должен быть заполнен идентификатор товара
    if (productHeader) {
      const idx = colIndices[headers.indexOf(productHeader)];
      const val = idx !== undefined ? row[idx] : undefined;
      if (!val || String(val).trim() === "") continue;
    }

    const obj: Record<string, string> = {};
    for (let k = 0; k < headers.length; k++) {
      const colIdx = colIndices[k];
      const val = row[colIdx];
      obj[headers[k]] = val !== undefined && val !== null ? String(val) : "";
    }
    rows.push(obj);
  }

  if (rows.length === 0) {
    return Response.json({ error: "Не найдено строк с данными" }, { status: 400 });
  }

  return Response.json({ headers, autoMap, sample: rows.slice(0, 3), rows, totalRows: rows.length });
}

interface ImportReview {
  product?: string;
  author?: string;
  rating?: string | number;
  text?: string;
  date?: string;
  published?: string;
}

function norm(s: string): string {
  return s.toLowerCase().trim();
}

// POST — импорт отзывов с привязкой к существующим товарам
export async function POST(request: Request) {
  const auth = await authorizeAdmin(request, "data:import");
  if (!auth.ok) return adminDenied(auth);

  const body = await request.json();
  const reviews: ImportReview[] = body.reviews;
  if (!reviews || reviews.length === 0) {
    return Response.json({ error: "Нет отзывов для импорта" }, { status: 400 });
  }

  // Карта соответствия товаров по разным идентификаторам
  const products = await prisma.product.findMany({
    select: { id: true, name: true, slug: true, code: true, barcode: true },
  });
  const byKey = new Map<string, string>();
  for (const p of products) {
    if (p.name) byKey.set(`name:${norm(p.name)}`, p.id);
    if (p.slug) byKey.set(`slug:${norm(p.slug)}`, p.id);
    if (p.code) byKey.set(`code:${norm(p.code)}`, p.id);
    if (p.barcode) byKey.set(`barcode:${norm(p.barcode)}`, p.id);
  }

  function resolveProduct(value: string): string | undefined {
    const v = norm(value);
    return (
      byKey.get(`code:${v}`) ||
      byKey.get(`barcode:${v}`) ||
      byKey.get(`slug:${v}`) ||
      byKey.get(`name:${v}`)
    );
  }

  let imported = 0;
  const notFound: string[] = [];
  let skipped = 0;

  for (const r of reviews) {
    const productValue = (r.product || "").toString().trim();
    if (!productValue) {
      skipped++;
      continue;
    }
    const productId = resolveProduct(productValue);
    if (!productId) {
      if (notFound.length < 50) notFound.push(productValue);
      continue;
    }

    let rating = Number(r.rating);
    if (!rating || rating < 1 || rating > 5) rating = 5;

    let createdAt: Date | undefined;
    if (r.date) {
      const d = new Date(r.date);
      if (!isNaN(d.getTime())) createdAt = d;
    }

    await prisma.review.create({
      data: {
        productId,
        authorName: (r.author || "").toString().trim(),
        rating,
        text: (r.text || "").toString().trim(),
        published: false,
        source: "import-unverified",
        ...(createdAt ? { createdAt } : {}),
      },
    });
    imported++;
  }

  return Response.json({
    imported,
    notFoundCount: notFound.length,
    notFound: notFound.slice(0, 20),
    skipped,
    total: reviews.length,
  });
}
