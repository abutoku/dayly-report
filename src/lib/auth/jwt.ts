import { SignJWT, jwtVerify, errors } from "jose";

function getJwtSecretKey(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error(
      "JWT_SECRET environment variable must be set in production",
    );
  }
  return secret ?? "dev-secret-change-me";
}

const JWT_ISSUER = "dayly-report";
const JWT_EXPIRATION = "8h";

function getSecret() {
  return new TextEncoder().encode(getJwtSecretKey());
}

export interface JwtPayload {
  sub: number;
  email: string;
  name: string;
  isManager: boolean;
}

export async function signToken(payload: JwtPayload): Promise<string> {
  const { sub, ...claims } = payload;
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(sub))
    .setIssuedAt()
    .setIssuer(JWT_ISSUER)
    .setExpirationTime(JWT_EXPIRATION)
    .sign(getSecret());
}

export async function verifyToken(token: string): Promise<JwtPayload> {
  const { payload } = await jwtVerify(token, getSecret(), {
    issuer: JWT_ISSUER,
  });

  const sub = Number(payload.sub);
  const { email, name, isManager } = payload;

  if (!Number.isFinite(sub) || sub <= 0) {
    throw new Error("Invalid JWT payload: sub must be a positive number");
  }
  if (typeof email !== "string" || email.length === 0) {
    throw new Error("Invalid JWT payload: email must be a non-empty string");
  }
  if (typeof name !== "string" || name.length === 0) {
    throw new Error("Invalid JWT payload: name must be a non-empty string");
  }
  if (typeof isManager !== "boolean") {
    throw new Error("Invalid JWT payload: isManager must be a boolean");
  }

  return { sub, email, name, isManager };
}

export function isTokenExpiredError(error: unknown): boolean {
  return error instanceof errors.JWTExpired;
}

export function isTokenInvalidError(error: unknown): boolean {
  return (
    error instanceof errors.JWSSignatureVerificationFailed ||
    error instanceof errors.JWTClaimValidationFailed ||
    error instanceof errors.JWTInvalid
  );
}
