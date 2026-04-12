// @vitest-environment node
import { describe, it, expect } from "vitest";
import { signToken, verifyToken, type JwtPayload } from "./jwt";

const testPayload: JwtPayload = {
  sub: 1,
  email: "tanaka@example.com",
  name: "田中太郎",
  isManager: false,
};

describe("JWT utilities", () => {
  describe("signToken", () => {
    it("should return a JWT string", async () => {
      const token = await signToken(testPayload);
      expect(typeof token).toBe("string");
      expect(token.split(".")).toHaveLength(3);
    });
  });

  describe("verifyToken", () => {
    it("should verify a valid token and return the payload", async () => {
      const token = await signToken(testPayload);
      const decoded = await verifyToken(token);

      expect(decoded.sub).toBe(testPayload.sub);
      expect(decoded.email).toBe(testPayload.email);
      expect(decoded.name).toBe(testPayload.name);
      expect(decoded.isManager).toBe(testPayload.isManager);
    });

    it("should reject a tampered token", async () => {
      const token = await signToken(testPayload);
      const parts = token.split(".");
      parts[1] = parts[1] + "tampered";
      const tamperedToken = parts.join(".");

      await expect(verifyToken(tamperedToken)).rejects.toThrow();
    });

    it("should reject a completely invalid token", async () => {
      await expect(verifyToken("not-a-jwt")).rejects.toThrow();
    });

    it("should reject a token with missing payload fields", async () => {
      const { SignJWT } = await import("jose");
      const secret = new TextEncoder().encode(
        process.env.JWT_SECRET ?? "dev-secret-change-me",
      );
      // Token without email/name/isManager
      const token = await new SignJWT({})
        .setProtectedHeader({ alg: "HS256" })
        .setSubject("1")
        .setIssuedAt()
        .setIssuer("dayly-report")
        .setExpirationTime("1h")
        .sign(secret);

      await expect(verifyToken(token)).rejects.toThrow("Invalid JWT payload");
    });

    it("should reject a token with invalid sub", async () => {
      const { SignJWT } = await import("jose");
      const secret = new TextEncoder().encode(
        process.env.JWT_SECRET ?? "dev-secret-change-me",
      );
      const token = await new SignJWT({
        email: "test@example.com",
        name: "Test",
        isManager: false,
      })
        .setProtectedHeader({ alg: "HS256" })
        .setSubject("not-a-number")
        .setIssuedAt()
        .setIssuer("dayly-report")
        .setExpirationTime("1h")
        .sign(secret);

      await expect(verifyToken(token)).rejects.toThrow(
        "Invalid JWT payload: sub must be a positive number",
      );
    });

    it("should reject an expired token", async () => {
      // Create a token with 0 second expiration by directly using jose
      const { SignJWT } = await import("jose");
      const secret = new TextEncoder().encode(
        process.env.JWT_SECRET ?? "dev-secret-change-me",
      );
      const token = await new SignJWT({ ...testPayload })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setIssuer("dayly-report")
        .setExpirationTime("0s")
        .sign(secret);

      // Token with 0s expiration should be expired immediately
      await expect(verifyToken(token)).rejects.toThrow();
    });
  });

  describe("round-trip with manager payload", () => {
    it("should preserve isManager=true", async () => {
      const managerPayload: JwtPayload = {
        sub: 10,
        email: "suzuki@example.com",
        name: "鈴木部長",
        isManager: true,
      };
      const token = await signToken(managerPayload);
      const decoded = await verifyToken(token);

      expect(decoded.isManager).toBe(true);
      expect(decoded.sub).toBe(10);
    });
  });
});
