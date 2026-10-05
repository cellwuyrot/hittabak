import { prisma } from "@/lib/prisma";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";

export type AdminPermission =
  | "content:read" | "content:write" | "content:delete"
  | "reviews:read" | "reviews:moderate"
  | "personal:read" | "personal:write" | "personal:delete"
  | "settings:manage" | "files:upload" | "data:import" | "data:export" | "admins:manage";

const EDITOR_PERMISSIONS = new Set<AdminPermission>(["content:read", "content:write", "reviews:read", "reviews:moderate"]);
export const ADMIN_PERMISSION_MATRIX = { admin: "all", editor: [...EDITOR_PERMISSIONS] } as const;

export async function authorizeAdmin(request: Request, permission: AdminPermission) {
  const token = getTokenFromRequest(request);
  if (!token) return { ok: false as const, status: 401, error: "Не авторизован" };
  const claims = verifyToken(token);
  if (!claims || (claims.role !== "admin" && claims.role !== "editor")) return { ok: false as const, status: 401, error: "Не авторизован" };
  const admin = await prisma.admin.findUnique({ where: { id: claims.id }, select: { id: true, username: true, role: true } });
  if (!admin) return { ok: false as const, status: 401, error: "Не авторизован" };
  if (admin.role !== "admin" && admin.role !== "editor") return { ok: false as const, status: 403, error: "Нет прав" };
  if (admin.role === "editor" && !EDITOR_PERMISSIONS.has(permission)) return { ok: false as const, status: 403, error: "Нет прав" };
  return { ok: true as const, admin };
}
export function adminDenied(result: { ok: false; status: number; error: string }) { return Response.json({ error: result.error }, { status: result.status }); }
