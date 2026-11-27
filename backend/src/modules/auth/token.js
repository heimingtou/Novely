import { SignJWT, jwtVerify } from "jose";

// Same wire format as Next's src/server/auth/token.js; no dependency on root src.
export const SESSION_COOKIE = "novely_session";
export const SESSION_TTL_SECONDS = 86400;
export const REMEMBER_TTL_SECONDS = 2592000;

export function createSessionTokens({ secret } = {}) {
  function secretKey() {
    if (typeof secret !== "string" || secret.length < 32) {
      throw new Error("AUTH_SECRET thiếu hoặc quá ngắn (cần >= 32 ký tự).");
    }
    return new TextEncoder().encode(secret);
  }
  return Object.freeze({
    assertConfigured: () => { secretKey(); },
    async sign({ userId, role }, ttlSeconds) {
      const expires = Math.floor(Date.now() / 1000) + ttlSeconds;
      const token = await new SignJWT({ role }).setProtectedHeader({ alg: "HS256" })
        .setSubject(String(userId)).setIssuedAt().setExpirationTime(expires).sign(secretKey());
      return { token, expiresAt: expires * 1000 };
    },
    async verify(token) {
      if (!token) return null;
      // Missing server configuration is an operational error, not an anonymous session.
      const key = secretKey();
      try {
        const { payload } = await jwtVerify(token, key, {
          algorithms: ["HS256"], requiredClaims: ["sub", "iat", "exp"],
        });
        const userId = Number(payload.sub);
        if (!/^[1-9]\d*$/.test(payload.sub) || !Number.isSafeInteger(userId) || userId > 2147483647
          || !Number.isSafeInteger(payload.exp) || !Number.isSafeInteger(payload.iat)) return null;
        return { userId, expiresAt: payload.exp * 1000 };
      } catch { return null; }
    },
  });
}
