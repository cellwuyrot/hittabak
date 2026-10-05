import { prisma } from "@/lib/prisma";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
export async function authenticateUser(request: Request) {
  const token = getTokenFromRequest(request); const claims = token ? verifyToken(token) : null;
  if (!claims || claims.role !== "user") return null;
  const user = await prisma.user.findUnique({ where: { id: claims.id }, select: { id: true, email: true, sessionVersion: true } });
  // Tokens issued before sessionVersion existed are version 0. They remain valid
  // until the first password reset increments the database value.
  const tokenVersion = claims.sessionVersion ?? 0;
  return user && user.sessionVersion === tokenVersion ? { claims: { ...claims, sessionVersion: tokenVersion }, user } : null;
}
