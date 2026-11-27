export function getHealth() {
  return {
    status: "ok",
    service: "novely-backend",
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
  };
}

export function createReadinessService({ repository, timeoutMs = 2_000 }) {
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1) throw new TypeError("Invalid readiness timeout.");
  let pending;
  return Object.freeze({
    async check() {
      // Coalesce simultaneous probes. A timed-out request never starts another
      // query while the previous one is still draining its driver/SQL timeout.
      pending ??= Promise.resolve().then(() => repository.checkConnection())
        .then((ready) => ready === true, () => false)
        .finally(() => { pending = undefined; });
      let timer;
      try {
        return await Promise.race([
          pending,
          new Promise((resolve) => { timer = setTimeout(() => resolve(false), timeoutMs); }),
        ]);
      } finally {
        clearTimeout(timer);
      }
    },
  });
}
