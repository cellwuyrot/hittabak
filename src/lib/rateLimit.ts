type Entry = { count: number; resetAt: number };
const buckets = new Map<string, Entry>();
export function takeRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now(); const old = buckets.get(key);
  const next = !old || old.resetAt <= now ? { count: 1, resetAt: now + windowMs } : { ...old, count: old.count + 1 };
  buckets.set(key, next);
  return next.count <= limit;
}
export function clientIp(request: Request): string {
  return request.headers.get("x-real-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}
export function resetRateLimitsForTests() { buckets.clear(); }
