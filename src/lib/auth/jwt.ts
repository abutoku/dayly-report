import { SignJWT, jwtVerify, errors } from "jose";

const JWT_SECRET_KEY = process.env.JWT_SECRET ?? "dev-secret-change-me";
const JWT_ISSUER = "dayly-report";
const JWT_EXPIRATION = "8h";

function getSecret() {
  return new TextEncoder().encode(JWT_SECRET_KEY);
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

  return {
    sub: Number(payload.sub),
    email: payload.email as string,
    name: payload.name as string,
    isManager: payload.isManager as boolean,
  };
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
