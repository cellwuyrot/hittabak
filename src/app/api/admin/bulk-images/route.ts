import { authorizeAdmin, adminDenied } from "@/lib/adminAuthorization";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { detectFile } from "@/lib/safeFilePath";


/** Normalize: NFC, lowercase, ё→е, separators→space, collapse, trim */
function normalize(s: string): string {
  return s
    .normalize("NFC")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[_\-–—.,()\[\]{}'"`«»]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Extract leaf filename — handle both / and \ */
function leafName(fileName: string): string {
  const idx = Math.max(fileName.lastIndexOf("/"), fileName.lastIndexOf("\\"));
  return idx >= 0 ? fileName.slice(idx + 1) : fileName;
}

/** Split normalized string into a word set */
function wordSet(s: string): Set<string> {
  return new Set(s.split(" ").filter((w) => w.length > 0));
}

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_TOTAL_SIZE = 50 * 1024 * 1024;

export const maxDuration = 300;

type Ref = { id: string; name: string };
type IndexedProduct = Ref & { norm: string; words: Set<string> };

export async function POST(request: Request) {
  const auth = await authorizeAdmin(request, "files:upload");
  if (!auth.ok) return adminDenied(auth);
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > MAX_TOTAL_SIZE) {
    return Response.json({ error: "Общий размер файлов превышает 50 МБ" }, { status: 413 });
  }

  let formData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json(
      { error: "Ошибка загрузки. Возможно, файлы слишком большие." },
      { status: 413 },
    );
  }

  const files = formData.getAll("files") as File[];
  if (files.length === 0) {
    return Response.json({ error: "Файлы не выбраны" }, { status: 400 });
  }

  let totalSize = 0;
  for (const file of files) {
    if (file.size > MAX_FILE_SIZE) {
      return Response.json(
        { error: `Файл слишком большой: ${file.name} (макс 10 МБ)` },
        { status: 413 },
      );
    }
    totalSize += file.size;
    if (totalSize > MAX_TOTAL_SIZE) {
      return Response.json(
        { error: "Общий размер файлов превышает 50 МБ" },
        { status: 413 },
      );
    }
  }

  const products = await prisma.product.findMany({
    select: { id: true, name: true, color: true, image: true },
  });

  // Precompute normalized forms and word sets
  const indexed: IndexedProduct[] = products.map((p) => ({
    id: p.id,
    name: p.name,
    norm: normalize(p.name),
    words: wordSet(normalize(p.name)),
  }));

  // Exact map for fast-path (file name === product name after normalization)
  const exactMap = new Map<string, Ref>();
  for (const p of indexed) {
    if (!exactMap.has(p.norm)) exactMap.set(p.norm, { id: p.id, name: p.name });
  }

  const uploadDir = path.join(process.cwd(), "public", "uploads", "products");
  await mkdir(uploadDir, { recursive: true });

  const results: {
    fileName: string;
    matched: boolean;
    productName?: string;
    error?: string;
  }[] = [];
  let matchedCount = 0;
  let unmatchedCount = 0;

  for (const file of files) {
    const leaf = leafName(file.name);
    const ext = path.extname(leaf).toLowerCase();
    const baseName = ext ? leaf.slice(0, -ext.length) : leaf;

    const normName = normalize(baseName);
    const fileWords = wordSet(normName);

    // 1) Fast path — exact normalized match
    let matched: Ref | undefined = exactMap.get(normName);

    // 2) Word-based matching — find product with highest word overlap
    if (!matched && fileWords.size >= 2) {
      let bestOverlap = 0;
      let bestCoverage = 0;

      for (const p of indexed) {
        let overlap = 0;
        for (const w of fileWords) {
          if (p.words.has(w)) overlap++;
        }
        if (overlap < 2) continue;

        const coverage = p.words.size > 0 ? overlap / p.words.size : 0;

        if (
          overlap > bestOverlap ||
          (overlap === bestOverlap && coverage > bestCoverage)
        ) {
          bestOverlap = overlap;
          bestCoverage = coverage;
          matched = { id: p.id, name: p.name };
        }
      }
    }

    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      const detected = detectFile(buffer);
      if (!detected || detected.active || ![".jpg", ".png", ".gif", ".webp"].includes(detected.extension)) {
        results.push({ fileName: file.name, matched: false, error: "Недопустимый или неподтверждённый формат" });
        unmatchedCount++;
        continue;
      }
      const safeFileName = `${Date.now()}-${randomBytes(8).toString("hex")}${detected.extension}`;
      await writeFile(path.join(uploadDir, safeFileName), buffer);
      const imageUrl = `/api/uploads/products/${safeFileName}`;

      if (matched) {
        await prisma.product.update({
          where: { id: matched.id },
          data: { image: imageUrl },
        });
        results.push({
          fileName: file.name,
          matched: true,
          productName: matched.name,
        });
        matchedCount++;
      } else {
        results.push({ fileName: file.name, matched: false });
        unmatchedCount++;
      }
    } catch (err) {
      results.push({ fileName: file.name, matched: false, error: String(err) });
      unmatchedCount++;
    }
  }

  return Response.json({
    total: files.length,
    matched: matchedCount,
    unmatched: unmatchedCount,
    results,
  });
}
