import { defineConfig } from "prisma/config";
import { loadDatabaseConfig } from "./src/config/database.js";

const config = loadDatabaseConfig();

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: { url: config.url },
});
