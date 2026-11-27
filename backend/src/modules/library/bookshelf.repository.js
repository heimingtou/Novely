import { getPrisma } from "../../database/prisma.js";

// Reference repository only. No unauthenticated Library route is mounted.
// Explicit projections keep user credentials and private profile fields out.
const selection = {
  userId: true, novelId: true, savedAt: true, readingStatus: true, updatedAt: true,
  novel: { select: { novelId: true, title: true } },
  user: { select: { userId: true, username: true } },
};

export function createBookshelfRepository({ getClient = getPrisma } = {}) {
  const clientFor = async (transaction) => transaction ?? await getClient();
  const where = (userId, novelId) => ({ userId_novelId: { userId, novelId } });
  return Object.freeze({
    async find(userId, novelId, { transaction } = {}) {
      return (await clientFor(transaction)).bookshelf.findUnique({ where: where(userId, novelId), select: selection });
    },
    async create({ userId, novelId, readingStatus = "plan_to_read" }, { transaction } = {}) {
      return (await clientFor(transaction)).bookshelf.create({ data: { userId, novelId, readingStatus }, select: selection });
    },
    async updateStatus(userId, novelId, readingStatus, { transaction } = {}) {
      return (await clientFor(transaction)).bookshelf.update({ where: where(userId, novelId), data: { readingStatus }, select: selection });
    },
    async remove(userId, novelId, { transaction } = {}) {
      return (await clientFor(transaction)).bookshelf.delete({ where: where(userId, novelId), select: selection });
    },
  });
}
