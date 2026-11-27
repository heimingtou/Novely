// One standalone PostgREST write = one database transaction. Recreate the query
// on every attempt. Never wrap a multi-step workflow or an open SQL transaction.
// Retry only PostgreSQL's confirmed deadlock abort, never an ambiguous timeout,
// network failure, unique violation, or a generic HTTP error.
export async function retryDeadlockedQuery(createQuery) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      const result = await createQuery();
      if (result?.error?.code !== "40P01" || attempt === 2) return result;
    } catch (error) {
      if (error?.code !== "40P01" || attempt === 2) throw error;
    }
    // At most two retries, with short backoff and jitter to separate contenders.
    const delay = 25 * (attempt + 1) + Math.floor(Math.random() * 25);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
}
