import { getPrisma } from "./prisma.js";

// The service chooses the transaction boundary; repositories receive its client.
// Reusing an existing transaction does not open a nested transaction/savepoint.
export function createTransactionRunner({ getClient = getPrisma } = {}) {
  return async function withTransaction(work, { transaction, ...options } = {}) {
    if (typeof work !== "function") throw new TypeError("Transaction work must be a function.");
    if (transaction) return work(transaction);
    const client = await getClient();
    return client.$transaction(work, { maxWait: 2_000, timeout: 5_000, ...options });
  };
}

export const withTransaction = createTransactionRunner();
