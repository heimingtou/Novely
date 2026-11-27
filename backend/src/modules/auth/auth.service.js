import { ApiError } from "../../shared/errors/api-error.js";
import { mapDatabaseError } from "../../shared/errors/database-error.js";
import { hashPassword, verifyPassword } from "./password.js";
import { REMEMBER_TTL_SECONDS, SESSION_TTL_SECONDS } from "./token.js";

const dto = (user, expiresAt) => ({
  id: user.userId, username: user.username, role: user.role,
  avatar: user.profile?.avatar ?? null, expiresAt,
});

// Only structured, whitelisted constraint metadata; never inspect SQL/error.message.
function duplicateField(error) {
  if (error?.code !== "P2002") return null;
  const target = error.meta?.target;
  const constraint = error.meta?.driverAdapterError?.cause?.constraint;
  const candidates = [target, constraint?.fields, constraint?.index];
  for (const value of candidates) {
    for (const field of ["email", "username"]) {
      if (Array.isArray(value) && value.length === 1 && value[0] === field) return field;
      if ([field, `uq_users_${field}`, `users_${field}_key`].includes(value)) return field;
    }
  }
  return null;
}

function operationError(error, message) {
  const mapped = mapDatabaseError(error);
  return new ApiError(mapped?.status === 503 ? 503 : 500,
    mapped?.status === 503 ? "DATABASE_UNAVAILABLE" : "INTERNAL_ERROR", message);
}

export function createAuthService({ repository, tokens }) {
  async function sessionFor(user, ttl) {
    const signed = await tokens.sign({ userId: user.userId, role: user.role }, ttl);
    return { user: dto(user, signed.expiresAt), token: signed.token, ttl };
  }
  return Object.freeze({
    async login({ identifier, password, rememberMe }) {
      let user;
      try { user = await repository.findCredentials(identifier); }
      catch (error) { throw operationError(error, "Không thể đăng nhập lúc này, vui lòng thử lại."); }
      if (!(await verifyPassword(password, user?.passwordHash))) {
        throw new ApiError(401, "UNAUTHORIZED", "Email/tên đăng nhập hoặc mật khẩu không đúng.");
      }
      return sessionFor(user, rememberMe ? REMEMBER_TTL_SECONDS : SESSION_TTL_SECONDS);
    },
    async register({ username, email, password }) {
      tokens.assertConfigured();
      const passwordHash = await hashPassword(password); // Outside the short DB transaction.
      try {
        return await repository.register({ username, email, passwordHash }, (user) => sessionFor(user, SESSION_TTL_SECONDS));
      } catch (error) {
        const field = duplicateField(error);
        if (field) throw new ApiError(409, field === "email" ? "EMAIL_EXISTS" : "USERNAME_EXISTS",
          field === "email" ? "Email này đã được đăng ký." : "Tên đăng nhập đã có người dùng.");
        throw operationError(error, "Không thể tạo tài khoản lúc này, vui lòng thử lại.");
      }
    },
    async me(token) {
      const session = await tokens.verify(token);
      if (!session) return null;
      const user = await repository.findSessionUser(session.userId);
      // JWT role is deliberately never used for authorization or the response.
      return user ? dto(user, session.expiresAt) : null;
    },
  });
}
