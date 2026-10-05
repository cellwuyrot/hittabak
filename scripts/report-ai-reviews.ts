import { prisma } from "../src/lib/prisma";
const grouped = await prisma.review.groupBy({ by: ["published"], where: { source: "ai" }, _count: { _all: true } });
const report = { generatedAt: new Date().toISOString(), source: "ai", total: grouped.reduce((n,r)=>n+r._count._all,0), published: grouped.find(r=>r.published)?._count._all ?? 0, unpublished: grouped.find(r=>!r.published)?._count._all ?? 0 };
console.log(JSON.stringify(report,null,2));
await prisma.$disconnect();
