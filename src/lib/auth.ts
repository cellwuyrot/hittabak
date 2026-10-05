import jwt, { type JwtPayload } from "jsonwebtoken";

const ISSUER = "hittabak";
const AUDIENCE = "hittabak-api";
const ALGORITHM = "HS256" as const;

export type AuthClaims = {
  id: string;
  username?: string;
  email?: string;
  role: "admin" | "editor" | "user";
  sessionVersion?: number;
};

function jwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET must be configured with at least 32 characters");
  }
  return secret;
}

export function signToken(payload: AuthClaims): string {
  return jwt.sign(payload, jwtSecret(), {
    algorithm: ALGORITHM,
    issuer: ISSUER,
    audience: AUDIENCE,
    expiresIn: "30d",
  });
}

export function verifyToken(token: string): AuthClaims | null {
  try {
    const value = jwt.verify(token, jwtSecret(), {
      algorithms: [ALGORITHM], issuer: ISSUER, audience: AUDIENCE,
    }) as JwtPayload;
    if (typeof value.id !== "string" || !["admin", "editor", "user"].includes(String(value.role))) return null;
    if (value.sessionVersion !== undefined && (!Number.isInteger(value.sessionVersion) || value.sessionVersion < 0)) return null;
    return { id: value.id, username: typeof value.username === "string" ? value.username : undefined,
      email: typeof value.email === "string" ? value.email : undefined, role: value.role as AuthClaims["role"],
      sessionVersion: value.sessionVersion as number | undefined };
  } catch { return null; }
}

export function getTokenFromRequest(request: Request): string | null {
  const value = request.headers.get("authorization");
  return value?.startsWith("Bearer ") ? value.slice(7) : null;
}
