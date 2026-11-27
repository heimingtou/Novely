import { once } from "node:events";
import { createServer } from "node:http";

export async function listen(app) {
  const server = createServer(app);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  return { server, baseUrl: `http://127.0.0.1:${server.address().port}` };
}

export async function close(server) {
  await new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
    server.closeAllConnections();
  });
}
