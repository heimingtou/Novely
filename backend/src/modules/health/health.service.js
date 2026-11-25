export function getHealth() {
  return {
    status: "ok",
    service: "novely-backend",
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
  };
}
