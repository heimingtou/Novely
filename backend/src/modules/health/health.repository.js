import { createTransactionRunner } from "../../database/transaction.js";

export function createHealthRepository({ getClient } = {}) {
  const runTransaction = createTransactionRunner({ getClient });
  return Object.freeze({
    async checkConnection() {
      return runTransaction(async (transaction) => {
        // These settings are local to this read-only transaction, not DDL/data.
        await transaction.$executeRaw`SET TRANSACTION READ ONLY`;
        await transaction.$executeRaw`SET LOCAL statement_timeout = '1000ms'`;
        const rows = await transaction.$queryRaw`SELECT 1::integer AS ok`;
        return rows.length === 1 && rows[0].ok === 1;
      }, { maxWait: 1_000, timeout: 1_500 });
    },
  });
}
