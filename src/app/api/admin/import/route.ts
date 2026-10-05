import { authorizeAdmin, adminDenied } from "@/lib/adminAuthorization";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slugify";
import * as XLSX from "xlsx";


// Expected XLSX columns — supports both initial import and re-import from export
const KNOWN_COLUMNS: Record<string, string[]> = {
  section: ["раздел", "модель", "девайс", "device", "section", "категория"],
  name: ["название товара", "название", "наименование", "наименование товара", "товар", "name", "product"],
  color: ["цвет", "color"],
  price: ["цена", "цена (₽)", "цена (руб)", "цена (руб.)", "price", "стоимость"],
  oldPrice: ["старая цена", "old price", "oldprice"],
  image: ["файл изображения", "изображение", "картинка", "фото", "image", "файл"],
  description: ["описание", "description"],
  brand: ["бренд", "brand", "производитель"],
  country: ["страна", "country"],
  barcode: ["штрихкод", "barcode", "ean"],
  code: ["код/артикул", "код", "артикул", "code", "sku"],
  productType: ["тип/вид", "тип", "вид", "type", "producttype"],
  inStock: ["в наличии", "наличие", "instock", "in stock", "остаток"],
  packSize: ["кол-во в упаковке", "упаковка", "packsize", "pack size"],
  weight: ["вес (кг)", "вес", "weight"],
  volume: ["объём (м³)", "объём", "объем", "volume"],
  expirationDate: ["годен до", "срок годности", "expiration"],
  tags: ["теги", "tags", "ключевые слова", "keywords"],
  metaTitle: ["seo заголовок", "meta title", "metatitle", "мета заголовок"],
  metaDescription: ["seo описание", "meta description", "metadescription", "мета описание"],
};

function autoDetectColumns(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  for (const header of headers) {
    const lower = header.toLowerCase().trim();
    // Skip index column (№, #, номер)
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
      Object.values(KNOWN_COLUMNS).some((aliases) => aliases.includes(l))
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

// PUT — parse XLSX and return structured data
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

  const buffer = Buffer.from(await file.arrayBuffer());
  const fileName = file.name.toLowerCase();

  if (!fileName.endsWith(".csv") && !fileName.endsWith(".xlsx") && !fileName.endsWith(".xls")) {
    return Response.json({ error: "Поддерживаемые форматы: CSV, XLSX, XLS" }, { status: 400 });
  }

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
    if (val !== undefined && val !== null && String(val).trim() !== "") {
      colIndices.push(j);
    }
  }

  // Find name column for row validation
  const autoMap = autoDetectColumns(headers);
  const nameHeader = Object.entries(autoMap).find(([, v]) => v === "name")?.[0];

  const rows: Record<string, string>[] = [];
  for (let i = headerRowIdx + 1; i < aoa.length; i++) {
    const row = aoa[i];
    if (!row) continue;

    const nonEmpty = row.filter((c) => c !== undefined && c !== null && String(c).trim() !== "");
    if (nonEmpty.length < 2) continue;

    // Skip rows where first cell repeats header
    const firstCell = row[colIndices[0]];
    if (firstCell !== undefined && String(firstCell).trim() === headers[0]) continue;

    // Validate name column has data
    if (nameHeader) {
      const nameColIdx = colIndices[headers.indexOf(nameHeader)];
      const nameVal = nameColIdx !== undefined ? row[nameColIdx] : undefined;
      if (!nameVal || String(nameVal).trim() === "") continue;
      const nameStr = String(nameVal).trim();
      if (nameStr === "ИТОГО" || nameStr.startsWith("ИТОГО")) continue;
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

  const sample = rows.slice(0, 3);

  return Response.json({ headers, autoMap, sample, rows, totalRows: rows.length });
}

interface ImportProduct {
  section?: string;
  name?: string;
  color?: string;
  price?: number | string;
  oldPrice?: number | string;
  image?: string;
  description?: string;
  brand?: string;
  country?: string;
  barcode?: string;
  code?: string;
  productType?: string;
  inStock?: number | string;
  packSize?: number | string;
  weight?: number | string;
  volume?: number | string;
  expirationDate?: string;
  tags?: string;
  metaTitle?: string;
  metaDescription?: string;
}

// POST — import products with new structure (Раздел, Название, Цвет, Цена, Файл изображения)
export async function POST(request: Request) {
  const auth = await authorizeAdmin(request, "data:import");
  if (!auth.ok) return adminDenied(auth);

  const body = await request.json();
  const products: ImportProduct[] = body.products;

  if (!products || products.length === 0) {
    return Response.json({ error: "Нет товаров для импорта" }, { status: 400 });
  }

  const validRows = products.filter((r) => r.name);
  if (validRows.length === 0) {
    return Response.json({ error: "Не найдено строк с названием товара" }, { status: 400 });
  }

  // Auto-create categories from "Раздел" (device models)
  const allCategories = await prisma.category.findMany({ orderBy: { order: "asc" } });
  const catByName = new Map(allCategories.map((c) => [c.name.toLowerCase(), c.id]));
  let nextOrder = allCategories.length > 0 ? Math.max(...allCategories.map((c) => c.order)) + 1 : 0;

  // Collect unique sections and create missing categories
  const uniqueSections = [...new Set(
    validRows
      .filter((r) => r.section && String(r.section).trim() !== "")
      .map((r) => String(r.section!).trim())
  )];

  for (const sectionName of uniqueSections) {
    if (!catByName.has(sectionName.toLowerCase())) {
      const slug = slugify(sectionName);
      let finalSlug = slug;
      const slugExists = await prisma.category.findFirst({ where: { slug: finalSlug } });
      if (slugExists) {
        let counter = 2;
        while (await prisma.category.findFirst({ where: { slug: `${finalSlug}-${counter}` } })) {
          counter++;
        }
        finalSlug = `${slug}-${counter}`;
      }
      const created = await prisma.category.create({
        data: {
          name: sectionName,
          slug: finalSlug,
          order: nextOrder++,
        },
      });
      catByName.set(sectionName.toLowerCase(), created.id);
    }
  }

  const defaultCatId = catByName.values().next().value;
  if (!defaultCatId) {
    return Response.json({ error: "Нет категорий и не удалось создать" }, { status: 400 });
  }

  // Check existing products by name + color for deduplication
  const existingProducts = await prisma.product.findMany({
    select: { id: true, name: true, color: true, categoryId: true },
  });
  const existingByKey = new Map<string, string>();
  for (const p of existingProducts) {
    existingByKey.set(`${p.name.toLowerCase()}|||${p.color.toLowerCase()}`, p.id);
  }

  let imported = 0;
  let updated = 0;

  for (const row of validRows) {
    const name = String(row.name).trim();
    const color = row.color ? String(row.color).trim() : "";
    const price = Number(row.price) || 0;
    const oldPrice = row.oldPrice ? Number(row.oldPrice) || null : null;
    const image = row.image ? String(row.image).trim() : "";
    const section = row.section ? String(row.section).trim() : "";
    const description = row.description ? String(row.description).trim() : "";
    const brand = row.brand ? String(row.brand).trim() : "";
    const country = row.country ? String(row.country).trim() : "";
    const barcode = row.barcode ? String(row.barcode).trim() : "";
    const code = row.code ? String(row.code).trim() : "";
    const productType = row.productType ? String(row.productType).trim() : "";
    const inStock = row.inStock !== undefined ? Number(row.inStock) || 0 : 0;
    const packSize = row.packSize ? Number(row.packSize) || null : null;
    const weight = row.weight ? Number(row.weight) || null : null;
    const volume = row.volume ? Number(row.volume) || null : null;
    const expirationDate = row.expirationDate ? String(row.expirationDate).trim() : "";
    const tags = row.tags ? String(row.tags).trim() : "";
    const metaTitle = row.metaTitle ? String(row.metaTitle).trim() : "";
    const metaDescription = row.metaDescription ? String(row.metaDescription).trim() : "";

    const categoryId = (section ? catByName.get(section.toLowerCase()) : undefined) || defaultCatId;
    const key = `${name.toLowerCase()}|||${color.toLowerCase()}`;
    const existingId = existingByKey.get(key);

    if (existingId) {
      const updateData: Record<string, unknown> = {
        price,
        color,
        categoryId,
      };
      if (oldPrice !== null) updateData.oldPrice = oldPrice;
      if (image) updateData.image = image;
      if (description) updateData.description = description;
      if (brand) updateData.brand = brand;
      if (country) updateData.country = country;
      if (barcode) updateData.barcode = barcode;
      if (code) updateData.code = code;
      if (productType) updateData.productType = productType;
      if (row.inStock !== undefined) updateData.inStock = inStock;
      if (packSize !== null) updateData.packSize = packSize;
      if (weight !== null) updateData.weight = weight;
      if (volume !== null) updateData.volume = volume;
      if (expirationDate) updateData.expirationDate = expirationDate;
      if (tags) updateData.tags = tags;
      if (metaTitle) updateData.metaTitle = metaTitle;
      if (metaDescription) updateData.metaDescription = metaDescription;

      await prisma.product.update({
        where: { id: existingId },
        data: updateData,
      });
      updated++;
    } else {
      let slug = slugify(name);
      if (color) {
        slug = `${slug}-${slugify(color)}`;
      }
      const slugExists = await prisma.product.findFirst({ where: { slug } });
      if (slugExists) {
        let counter = 2;
        while (await prisma.product.findFirst({ where: { slug: `${slug}-${counter}` } })) {
          counter++;
        }
        slug = `${slug}-${counter}`;
      }
      const created = await prisma.product.create({
        data: {
          name, slug, price, color, image, categoryId,
          oldPrice, description, brand, productType, country,
          barcode, code, inStock, packSize, weight, volume,
          expirationDate, tags, metaTitle, metaDescription,
        },
      });
      existingByKey.set(key, created.id);
      imported++;
    }
  }

  return Response.json({
    imported,
    updated,
    total: products.length,
    skipped: products.length - imported - updated,
    categoriesCreated: uniqueSections.filter(
      (s) => !allCategories.some((c) => c.name.toLowerCase() === s.toLowerCase())
    ).length,
  });
}
