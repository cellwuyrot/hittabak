import { authorizeAdmin, adminDenied } from "@/lib/adminAuthorization";
import { prisma } from "@/lib/prisma";


export async function GET(request: Request) {
  const auth = await authorizeAdmin(request, "personal:read");
  if (!auth.ok) return adminDenied(auth);

  const { searchParams } = new URL(request.url);
  const period = searchParams.get("period") || "week";

  const now = new Date();
  const today = now.toISOString().split("T")[0];

  if (period === "day") {
    // Hourly data for today
    const hours: number[] = [];
    for (let h = 0; h <= now.getHours(); h++) hours.push(h);

    const views = await prisma.pageView.groupBy({
      by: ["hour"],
      where: { date: today },
      _count: { id: true },
    });
    const viewMap = new Map(views.map((v) => [v.hour, v._count.id]));

    // Unique visitors per hour
    const uniqueByHour = await prisma.pageView.groupBy({
      by: ["hour", "visitorId"],
      where: { date: today, visitorId: { not: "" } },
    });
    const uniqueHourMap = new Map<number, Set<string>>();
    for (const row of uniqueByHour) {
      if (!uniqueHourMap.has(row.hour)) uniqueHourMap.set(row.hour, new Set());
      uniqueHourMap.get(row.hour)!.add(row.visitorId);
    }

    const data = hours.map((h) => ({
      date: today,
      hour: h,
      label: `${String(h).padStart(2, "0")}:00`,
      views: viewMap.get(h) || 0,
      unique: uniqueHourMap.get(h)?.size || 0,
    }));

    const totalViews = data.reduce((sum, d) => sum + d.views, 0);

    // Total unique visitors for today
    const allVisitorIds = new Set<string>();
    for (const s of uniqueHourMap.values()) {
      for (const v of s) allVisitorIds.add(v);
    }

    const topPages = await prisma.pageView.groupBy({
      by: ["path"],
      where: { date: today },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 10,
    });

    return Response.json({
      period,
      data,
      totalViews,
      totalUniqueVisitors: allVisitorIds.size,
      topPages: topPages.map((p) => ({ path: p.path, views: p._count.id })),
    });
  }

  // Week / Month — daily data
  let daysBack = 7;
  if (period === "month") daysBack = 30;

  const dates: string[] = [];
  for (let i = daysBack - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().split("T")[0]);
  }

  const startDate = dates[0];
  const endDate = dates[dates.length - 1];

  const views = await prisma.pageView.groupBy({
    by: ["date"],
    where: { date: { gte: startDate, lte: endDate } },
    _count: { id: true },
  });
  const viewMap = new Map(views.map((v) => [v.date, v._count.id]));

  // Unique visitors per day
  const uniqueByDay = await prisma.pageView.groupBy({
    by: ["date", "visitorId"],
    where: { date: { gte: startDate, lte: endDate }, visitorId: { not: "" } },
  });
  const uniqueMap = new Map<string, Set<string>>();
  for (const row of uniqueByDay) {
    if (!uniqueMap.has(row.date)) uniqueMap.set(row.date, new Set());
    uniqueMap.get(row.date)!.add(row.visitorId);
  }

  const data = dates.map((date) => ({
    date,
    label: (() => {
      const d = new Date(date + "T12:00:00");
      return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
    })(),
    views: viewMap.get(date) || 0,
    unique: uniqueMap.get(date)?.size || 0,
  }));

  const totalViews = data.reduce((sum, d) => sum + d.views, 0);

  const allVisitorIds = new Set<string>();
  for (const s of uniqueMap.values()) {
    for (const v of s) allVisitorIds.add(v);
  }

  const topPages = await prisma.pageView.groupBy({
    by: ["path"],
    where: { date: { gte: startDate, lte: endDate } },
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
    take: 10,
  });

  return Response.json({
    period,
    data,
    totalViews,
    totalUniqueVisitors: allVisitorIds.size,
    topPages: topPages.map((p) => ({ path: p.path, views: p._count.id })),
  });
}
