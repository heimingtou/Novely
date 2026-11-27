import { Router } from "express";
import { ApiError } from "../../shared/errors/api-error.js";
import { createAuthRepository } from "./auth.repository.js";
import { createAuthService } from "./auth.service.js";
import { createSessionTokens, SESSION_COOKIE } from "./token.js";
import { loginSchema, registerSchema, parseInput } from "./validation.js";

function sessionCookie(request) {
  const values = (request.headers.cookie ?? "").split(";").map((part) => part.trim())
    .filter((part) => part.split("=", 1)[0] === SESSION_COOKIE);
  if (values.length !== 1) return undefined;
  try { return decodeURIComponent(values[0].slice(SESSION_COOKIE.length + 1)); }
  catch { return undefined; }
}

export function createAuthRouter({ getClient, config = {} } = {}) {
  const router = Router();
  const origins = new Set(config.corsOrigins);
  const service = createAuthService({ repository: createAuthRepository({ getClient }),
    tokens: createSessionTokens({ secret: config.authSecret }) });
  const cookieOptions = { httpOnly: true, secure: config.nodeEnv === "production", sameSite: "lax", path: "/" };
  router.use((_request, response, next) => { response.set("Cache-Control", "no-store"); next(); });
  router.use((request, _response, next) => {
    if (request.method !== "POST") return next();
    // CORS alone does not prevent credentialed writes. Missing/null origins fail closed,
    // including server-to-server callers: the reviewed BFF must forward a checked Origin.
    if (!origins.has(request.get("Origin"))) {
      throw new ApiError(403, "ORIGIN_DENIED", "Origin không được phép truy cập API.");
    }
    next();
  });
  function sendSession(response, session, status) {
    response.cookie(SESSION_COOKIE, session.token, { ...cookieOptions, maxAge: session.ttl * 1000 });
    return response.status(status).json({ data: { user: session.user } });
  }
  router.post("/register", async (request, response) =>
    sendSession(response, await service.register(parseInput(registerSchema, request.body)), 201));
  router.post("/login", async (request, response) =>
    sendSession(response, await service.login(parseInput(loginSchema, request.body)), 200));
  router.post("/logout", (_request, response) => {
    response.clearCookie(SESSION_COOKIE, cookieOptions);
    return response.json({ data: { ok: true } });
  });
  router.get("/me", async (request, response) => response.json({ data: await service.me(sessionCookie(request)) }));
  return router;
}
