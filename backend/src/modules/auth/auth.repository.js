import { getPrisma } from "../../database/prisma.js";
import { createTransactionRunner } from "../../database/transaction.js";

const sessionSelection = {
  userId: true, username: true, role: true, profile: { select: { avatar: true } },
};
export function createAuthRepository({ getClient = getPrisma } = {}) {
  const withTransaction = createTransactionRunner({ getClient });
  return Object.freeze({
    async findCredentials(identifier) {
      const where = identifier.includes("@") ? { email: identifier.toLowerCase() } : { username: identifier };
      return (await getClient()).user.findUnique({ where, select: { ...sessionSelection, passwordHash: true } });
    },
    async findSessionUser(userId) {
      return (await getClient()).user.findUnique({ where: { userId }, select: sessionSelection });
    },
    register(data, createSession) {
      return withTransaction(async (tx) => {
        // Explicit whitelist; role remains the database reader default.
        const user = await tx.user.create({
          data: { username: data.username, email: data.email, passwordHash: data.passwordHash },
          select: { userId: true, username: true, role: true },
        });
        const profile = await tx.profile.create({ data: { userId: user.userId }, select: { avatar: true } });
        // Signing errors also abort registration. No cookie is sent until commit succeeds.
        return createSession({ ...user, profile });
      });
    },
  });
}
